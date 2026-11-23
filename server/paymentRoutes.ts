import crypto from 'node:crypto';
import express, { type Request, type Response, type Router } from 'express';
import {
  firestoreRestCommitWrites,
  firestoreRestGetDocument,
  firestoreRestWriteWithServerTimestamps,
  isVerifiedAdminUser,
  resolveVerifiedStaffContext,
  verifyFirebaseIdToken,
  type VerifiedFirebaseUser,
} from './firebaseAuth';
import { createRateLimiter } from './rateLimiter';
import {
  createRazorpayClient,
  getRazorpayConfigStatus,
  recalculateAuthoritativeOrderTotal,
  toPaise,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  type LiveCouponRecord,
  type LiveProductRecord,
  type RazorpayConfigStatus,
  type ServerOrderData,
} from './razorpayCore';
import {
  globalPaymentLedger,
  isCapturedOrVerifiedStatus,
  type OrderStatusValue,
  type PaymentLedger,
  type Phase7PaymentStatus,
  type ServerPaymentRecord,
  type ServerRefundRecord,
} from './paymentLedger';

export interface RazorpayClientLike {
  orders: {
    create(params: {
      amount: number;
      currency: string;
      receipt: string;
      notes?: Record<string, string>;
    }): Promise<{ id: string; amount: number; currency: string; status?: string }>;
    fetchPayments(orderId: string): Promise<{
      items?: Array<{
        id: string;
        status: string;
        method?: string;
        amount?: number;
        error_description?: string | null;
      }>;
    }>;
  };
  payments: {
    fetch(paymentId: string): Promise<{
      id: string;
      order_id?: string;
      status: string;
      method?: string;
      amount?: number;
      currency?: string;
      error_description?: string | null;
    }>;
    refund(
      paymentId: string,
      params: { amount?: number; notes?: Record<string, string> }
    ): Promise<{ id: string; status?: string; amount?: number }>;
  };
}

export interface PaymentRouterDeps {
  ledger?: PaymentLedger;
  getEnv?: () => NodeJS.ProcessEnv;
  getConfigStatus?: () => RazorpayConfigStatus;
  getRazorpayClient?: () => RazorpayClientLike;
  verifyAuth?: (authHeader?: string) => Promise<VerifiedFirebaseUser>;
  checkAdmin?: (user: VerifiedFirebaseUser) => Promise<boolean>;
  fetchOrder?: (orderId: string, idToken: string) => Promise<ServerOrderData | null>;
  fetchProducts?: (
    productIds: string[],
    idToken: string
  ) => Promise<Map<string, LiveProductRecord>>;
  fetchCoupon?: (code: string, idToken: string) => Promise<LiveCouponRecord | null>;
  syncPaymentToFirestore?: (
    payment: ServerPaymentRecord,
    idToken: string,
    isCreate: boolean
  ) => Promise<boolean>;
  syncOrderToFirestore?: (
    orderId: string,
    patch: {
      orderStatus: OrderStatusValue;
      paymentStatus: Phase7PaymentStatus;
      razorpayOrderId?: string;
      latestPaymentId?: string;
    },
    idToken: string
  ) => Promise<boolean>;
  syncRefundToFirestore?: (
    refund: ServerRefundRecord,
    idToken: string
  ) => Promise<boolean>;
  checkPaymentsViewer?: (user: VerifiedFirebaseUser) => Promise<boolean>;
}

const VALID_ID_REGEX = /^[A-Za-z0-9_-]{3,128}$/;

function normalizeMethod(
  rawMethod?: string
): 'razorpay' | 'upi' | 'card' | 'netbanking' | 'wallet' | 'online' | 'cod' {
  const m = String(rawMethod || '').toLowerCase();
  if (m === 'upi' || m === 'card' || m === 'netbanking' || m === 'wallet') return m;
  if (m === 'cod') return 'cod';
  return 'razorpay';
}

function buildDefaultDeps(overrides: PaymentRouterDeps = {}) {
  const getEnv = overrides.getEnv || (() => process.env);
  const ledger = overrides.ledger || globalPaymentLedger;

  return {
    ledger,
    getEnv,
    getConfigStatus: overrides.getConfigStatus || (() => getRazorpayConfigStatus(getEnv())),
    getRazorpayClient:
      overrides.getRazorpayClient ||
      (() => createRazorpayClient(getEnv()) as unknown as RazorpayClientLike),
    verifyAuth: overrides.verifyAuth || verifyFirebaseIdToken,
    checkAdmin: overrides.checkAdmin || isVerifiedAdminUser,
    checkPaymentsViewer:
      overrides.checkPaymentsViewer ||
      (overrides.checkAdmin
        ? overrides.checkAdmin
        : async (user: VerifiedFirebaseUser) => {
            const staff = await resolveVerifiedStaffContext(user);
            return staff.isStaff && staff.permissions.has('payments:view');
          }),
    fetchOrder:
      overrides.fetchOrder ||
      (async (orderId: string, idToken: string) => {
        const doc = await firestoreRestGetDocument(`orders/${orderId}`, idToken);
        return doc ? (doc as unknown as ServerOrderData) : null;
      }),
    fetchProducts:
      overrides.fetchProducts ||
      (async (productIds: string[], idToken: string) => {
        const map = new Map<string, LiveProductRecord>();
        await Promise.all(
          productIds.map(async (pid) => {
            const doc = await firestoreRestGetDocument(`products/${pid}`, idToken);
            if (doc) map.set(pid, doc as unknown as LiveProductRecord);
          })
        );
        return map;
      }),
    fetchCoupon:
      overrides.fetchCoupon ||
      (async (code: string, idToken: string) => {
        const doc = await firestoreRestGetDocument(`coupons/${code}`, idToken);
        return doc ? (doc as unknown as LiveCouponRecord) : null;
      }),
    syncPaymentToFirestore:
      overrides.syncPaymentToFirestore ||
      (async (payment: ServerPaymentRecord, idToken: string, isCreate: boolean) => {
        const res = await firestoreRestWriteWithServerTimestamps(
          `payments/${payment.paymentId}`,
          {
            paymentId: payment.paymentId,
            orderId: payment.orderId,
            customerUid: payment.customerUid,
            razorpayOrderId: payment.razorpayOrderId,
            razorpayPaymentId: payment.razorpayPaymentId,
            amount: payment.amount,
            currency: payment.currency,
            paymentMethod: payment.paymentMethod,
            paymentStatus: payment.paymentStatus,
            signatureVerified: payment.signatureVerified,
            gatewayMode: payment.gatewayMode,
            failureReason: payment.failureReason,
          },
          {
            idToken,
            isCreate,
            updateMaskFields: isCreate
              ? undefined
              : [
                  'razorpayOrderId',
                  'razorpayPaymentId',
                  'paymentMethod',
                  'paymentStatus',
                  'signatureVerified',
                  'failureReason',
                ],
          }
        );
        return res.synced;
      }),
    syncOrderToFirestore:
      overrides.syncOrderToFirestore ||
      (async (orderId, patch, idToken) => {
        const fields: Record<string, unknown> = {
          orderStatus: patch.orderStatus,
          paymentStatus: patch.paymentStatus,
        };
        const mask = ['orderStatus', 'paymentStatus'];
        if (patch.razorpayOrderId) {
          fields.razorpayOrderId = patch.razorpayOrderId;
          mask.push('razorpayOrderId');
        }
        if (patch.latestPaymentId) {
          fields.latestPaymentId = patch.latestPaymentId;
          mask.push('latestPaymentId');
        }
        const res = await firestoreRestWriteWithServerTimestamps(`orders/${orderId}`, fields, {
          idToken,
          isCreate: false,
          updateMaskFields: mask,
        });
        return res.synced;
      }),
    syncRefundToFirestore:
      overrides.syncRefundToFirestore ||
      (async (refund: ServerRefundRecord, idToken: string) => {
        const res = await firestoreRestWriteWithServerTimestamps(
          `refunds/${refund.refundId}`,
          {
            refundId: refund.refundId,
            paymentId: refund.paymentId,
            orderId: refund.orderId,
            customerUid: refund.customerUid,
            razorpayPaymentId: refund.razorpayPaymentId,
            razorpayRefundId: refund.razorpayRefundId,
            amount: refund.amount,
            currency: refund.currency,
            type: refund.type,
            reason: refund.reason,
            refundStatus: refund.refundStatus,
            initiatedByUid: refund.initiatedByUid,
          },
          { idToken, isCreate: true }
        );
        return res.synced;
      }),
  };
}

/**
 * Dedicated Raw-Body Webhook Handler — MUST be mounted with `express.raw({ type: 'application/json' })`
 * BEFORE `express.json()` so HMAC-SHA256 verification runs against the exact raw bytes sent by Razorpay.
 */
export function createRazorpayWebhookHandler(overrides: PaymentRouterDeps = {}) {
  const deps = buildDefaultDeps(overrides);

  return async (req: Request, res: Response) => {
    const webhookSecret = String(deps.getEnv().RAZORPAY_WEBHOOK_SECRET || '').trim();
    if (!webhookSecret) {
      return res.status(503).json({
        error: 'RAZORPAY_WEBHOOK_SECRET is not configured on the server.',
        code: 'WEBHOOK_SECRET_MISSING',
      });
    }

    const signatureHeader = String(req.header('x-razorpay-signature') || '').trim();
    const rawBody = Buffer.isBuffer(req.body)
      ? req.body
      : typeof req.body === 'string'
        ? Buffer.from(req.body, 'utf8')
        : null;

    if (!rawBody || !signatureHeader) {
      return res.status(400).json({
        error: 'Missing raw webhook body or X-Razorpay-Signature header.',
        code: 'INVALID_WEBHOOK_REQUEST',
      });
    }

    const isValidSig = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
    if (!isValidSig) {
      deps.ledger.recordAudit({
        event: 'webhook_invalid_signature',
        orderId: 'unknown',
        status: 'Invalid Signature',
        note: 'Rejected Razorpay webhook due to HMAC-SHA256 mismatch',
      });
      return res.status(400).json({
        error: 'Invalid Razorpay webhook signature.',
        code: 'INVALID_WEBHOOK_SIGNATURE',
      });
    }

    let payload: {
      event?: string;
      payload?: {
        payment?: {
          entity?: {
            id?: string;
            order_id?: string;
            amount?: number;
            method?: string;
            status?: string;
            error_description?: string | null;
            notes?: Record<string, string>;
          };
        };
        order?: {
          entity?: {
            id?: string;
            receipt?: string;
            amount?: number;
            notes?: Record<string, string>;
          };
        };
        refund?: {
          entity?: {
            id?: string;
            payment_id?: string;
            amount?: number;
            status?: string;
            notes?: Record<string, string>;
          };
        };
      };
    };

    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Malformed webhook JSON payload.' });
    }

    const eventType = String(payload.event || '');
    const paymentEntity = payload.payload?.payment?.entity;
    const orderEntity = payload.payload?.order?.entity;
    const refundEntity = payload.payload?.refund?.entity;

    const eventId =
      String(req.header('x-razorpay-event-id') || '').trim() ||
      crypto
        .createHash('sha256')
        .update(
          `${eventType}:${paymentEntity?.id || ''}:${orderEntity?.id || ''}:${refundEntity?.id || ''}`
        )
        .digest('hex');

    // Strict Idempotency: ignore already-processed webhook deliveries cleanly
    if (deps.ledger.hasProcessedWebhookEvent(eventId)) {
      return res.status(200).json({
        received: true,
        duplicate: true,
        event: eventType,
        eventId,
      });
    }

    const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id || '';
    const razorpayPaymentId = paymentEntity?.id || refundEntity?.payment_id || '';

    let existing =
      (razorpayOrderId ? deps.ledger.getByRazorpayOrderId(razorpayOrderId) : null) ||
      (razorpayPaymentId ? deps.ledger.getByRazorpayPaymentId(razorpayPaymentId) : null);

    const notedOrderId =
      paymentEntity?.notes?.orderId ||
      orderEntity?.notes?.orderId ||
      orderEntity?.receipt ||
      refundEntity?.notes?.orderId ||
      existing?.orderId ||
      '';

    if (!existing && notedOrderId) {
      existing = deps.ledger.getByOrderId(notedOrderId);
    }

    const orderId = existing?.orderId || notedOrderId;
    if (!orderId) {
      deps.ledger.markWebhookEventProcessed(eventId);
      return res.status(200).json({
        received: true,
        ignored: true,
        reason: 'No matching Fashion World order reference in webhook payload.',
      });
    }

    const nowIso = new Date().toISOString();
    const baseRecord: ServerPaymentRecord = existing || {
      paymentId: `pay_${orderId.replace(/[^A-Za-z0-9_-]/g, '')}`,
      orderId,
      customerUid: paymentEntity?.notes?.customerUid || orderEntity?.notes?.customerUid || 'webhook',
      razorpayOrderId,
      razorpayPaymentId,
      amount: Math.max(1, Math.round((paymentEntity?.amount || orderEntity?.amount || 100) / 100)),
      currency: 'INR',
      paymentMethod: normalizeMethod(paymentEntity?.method),
      paymentStatus: 'Payment Processing',
      orderStatus: 'Pending',
      signatureVerified: false,
      gatewayMode: deps.getConfigStatus().mode === 'live' ? 'live' : 'test',
      failureReason: '',
      firestoreSynced: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    let transitionedStatus: Phase7PaymentStatus | null = null;
    let nextOrderStatus: OrderStatusValue = baseRecord.orderStatus;
    let nextSignatureVerified = baseRecord.signatureVerified;
    let nextFailureReason = baseRecord.failureReason;

    switch (eventType) {
      case 'payment.authorized':
        // CRITICAL: Never mark order Paid or Confirmed on payment.authorized alone!
        transitionedStatus = 'Payment Authorized';
        nextOrderStatus = baseRecord.orderStatus === 'Confirmed' ? 'Confirmed' : 'Pending';
        break;

      case 'payment.captured':
      case 'order.paid':
        transitionedStatus = 'Payment Captured';
        nextOrderStatus = 'Confirmed';
        nextSignatureVerified = true;
        nextFailureReason = '';
        break;

      case 'payment.failed':
        transitionedStatus = 'Payment Failed';
        nextFailureReason = String(
          paymentEntity?.error_description || 'Payment failed at Razorpay gateway.'
        ).slice(0, 300);
        break;

      case 'refund.processed': {
        const refundedInr = Math.max(1, Math.round(Number(refundEntity?.amount || 0) / 100));
        const isFull = refundedInr >= baseRecord.amount;
        transitionedStatus = isFull ? 'Refunded' : 'Partially Refunded';
        if (refundEntity?.id) {
          deps.ledger.addRefund({
            refundId: `ref_${refundEntity.id}`,
            paymentId: baseRecord.paymentId,
            orderId,
            customerUid: baseRecord.customerUid,
            razorpayPaymentId: razorpayPaymentId || baseRecord.razorpayPaymentId,
            razorpayRefundId: refundEntity.id,
            amount: refundedInr,
            currency: 'INR',
            type: isFull ? 'full' : 'partial',
            reason: String(refundEntity.notes?.reason || 'Razorpay refund processed'),
            refundStatus: isFull ? 'Refunded' : 'Partially Refunded',
            initiatedByUid: String(refundEntity.notes?.initiatedByUid || 'razorpay_webhook'),
            firestoreSynced: false,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        }
        break;
      }

      default:
        deps.ledger.markWebhookEventProcessed(eventId);
        return res.status(200).json({ received: true, ignored: true, event: eventType });
    }

    if (transitionedStatus) {
      const outcome = deps.ledger.upsertPayment({
        ...baseRecord,
        razorpayOrderId: razorpayOrderId || baseRecord.razorpayOrderId,
        razorpayPaymentId: razorpayPaymentId || baseRecord.razorpayPaymentId,
        paymentMethod: paymentEntity?.method
          ? normalizeMethod(paymentEntity.method)
          : baseRecord.paymentMethod,
        paymentStatus: transitionedStatus,
        orderStatus: nextOrderStatus,
        signatureVerified: nextSignatureVerified,
        failureReason: nextFailureReason,
      });

      deps.ledger.recordAudit({
        event: `webhook:${eventType}`,
        orderId,
        razorpayOrderId: outcome.record.razorpayOrderId,
        razorpayPaymentId: outcome.record.razorpayPaymentId,
        status: outcome.record.paymentStatus,
        note: outcome.updated
          ? `Applied ${eventType}`
          : `Out-of-order ${eventType} safely ignored`,
      });
    }

    deps.ledger.markWebhookEventProcessed(eventId);

    return res.status(200).json({
      received: true,
      duplicate: false,
      event: eventType,
      eventId,
      orderId,
    });
  };
}

export function createPaymentRouter(overrides: PaymentRouterDeps = {}): Router {
  const router = express.Router();
  const deps = buildDefaultDeps(overrides);

  // 1. Public non-secret Razorpay Gateway Config Status
  router.get('/config', (_req: Request, res: Response) => {
    const status = deps.getConfigStatus();
    return res.status(200).json({
      configured: status.configured,
      webhookConfigured: status.webhookConfigured,
      mode: status.mode,
      keyId: status.keyId, // Public key ID only; secrets NEVER exposed
      liveModeEnabled: status.liveModeEnabled,
      currency: 'INR',
      supportedMethods: ['UPI', 'Google Pay', 'PhonePe', 'Paytm', 'Debit Cards', 'Credit Cards', 'Net Banking'],
      message: status.message,
    });
  });

  // 2. Secure Server-Side Razorpay Order Creation
  router.post('/create-order', async (req: Request, res: Response) => {
    let user: VerifiedFirebaseUser;
    try {
      user = await deps.verifyAuth(req.header('authorization'));
    } catch (err) {
      return res.status(401).json({
        error: err instanceof Error ? err.message : 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    const config = deps.getConfigStatus();
    if (!config.configured || !config.keyId) {
      return res.status(503).json({
        error: config.message,
        code: config.mode === 'live_blocked' ? 'LIVE_MODE_DISABLED' : 'RAZORPAY_NOT_CONFIGURED',
        mode: config.mode,
      });
    }

    const orderId = String(req.body?.orderId || '').trim();
    if (!VALID_ID_REGEX.test(orderId)) {
      return res.status(400).json({ error: 'Invalid or missing orderId.', code: 'INVALID_ORDER_ID' });
    }

    try {
      const order = await deps.fetchOrder(orderId, user.rawToken);
      if (!order) {
        return res.status(404).json({ error: `Order "${orderId}" not found.`, code: 'ORDER_NOT_FOUND' });
      }

      const isAdmin = await deps.checkAdmin(user);
      if (order.customerUid !== user.uid && !isAdmin) {
        return res.status(403).json({
          error: 'You are not authorized to initiate payment for this order.',
          code: 'FORBIDDEN',
        });
      }

      if (order.paymentMethod !== 'online') {
        return res.status(400).json({
          error: 'This order is configured for Cash on Delivery, not online Razorpay payment.',
          code: 'NOT_ONLINE_ORDER',
        });
      }

      // Guard against duplicate payment on already captured/verified orders
      const existingPayment = deps.ledger.getByOrderId(orderId);
      if (
        isCapturedOrVerifiedStatus(order.paymentStatus as Phase7PaymentStatus) ||
        (existingPayment && isCapturedOrVerifiedStatus(existingPayment.paymentStatus))
      ) {
        return res.status(409).json({
          error: 'Payment for this order has already been captured and verified.',
          code: 'ALREADY_PAID',
        });
      }

      // Independently recalculate authoritative INR totals from live Firestore products & coupons
      const uniqueProductIds = Array.from(new Set(order.items.map((i) => i.productId)));
      const liveProducts = await deps.fetchProducts(uniqueProductIds, user.rawToken);
      const liveCoupon = order.couponCode
        ? await deps.fetchCoupon(order.couponCode.toUpperCase(), user.rawToken)
        : null;

      const trusted = recalculateAuthoritativeOrderTotal(order, liveProducts, liveCoupon);

      const razorpay = deps.getRazorpayClient();
      const rzOrder = await razorpay.orders.create({
        amount: trusted.amountPaise,
        currency: 'INR',
        receipt: orderId.slice(0, 40),
        notes: {
          orderId,
          customerUid: order.customerUid,
          store: '3D Jummo Fashion World',
        },
      });

      const nowIso = new Date().toISOString();
      const paymentId = existingPayment?.paymentId || `pay_${orderId.replace(/[^A-Za-z0-9_-]/g, '')}`;
      const record: ServerPaymentRecord = {
        paymentId,
        orderId,
        customerUid: order.customerUid,
        razorpayOrderId: rzOrder.id,
        razorpayPaymentId: '',
        amount: trusted.totalAmount,
        currency: 'INR',
        paymentMethod: 'razorpay',
        paymentStatus: 'Payment Processing',
        orderStatus: 'Pending',
        signatureVerified: false,
        gatewayMode: config.mode === 'live' ? 'live' : 'test',
        failureReason: '',
        firestoreSynced: false,
        createdAt: existingPayment?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      const { record: saved } = deps.ledger.upsertPayment(record);
      deps.ledger.recordAudit({
        event: 'razorpay_order_created',
        orderId,
        razorpayOrderId: rzOrder.id,
        status: 'Payment Processing',
        note: `Amount ₹${trusted.totalAmount} (${trusted.amountPaise} paise)`,
      });

      // Best-effort Firestore sync (succeeds when caller has Admin permissions; zero-trust rules block direct customer writes)
      const paymentSynced = await deps
        .syncPaymentToFirestore(saved, user.rawToken, !existingPayment)
        .catch(() => false);
      const orderSynced = await deps
        .syncOrderToFirestore(
          orderId,
          {
            orderStatus: 'Pending',
            paymentStatus: 'Payment Processing',
            razorpayOrderId: rzOrder.id,
            latestPaymentId: paymentId,
          },
          user.rawToken
        )
        .catch(() => false);

      if (paymentSynced && orderSynced) {
        saved.firestoreSynced = true;
      }

      return res.status(200).json({
        orderId,
        paymentId,
        razorpayOrderId: rzOrder.id,
        amount: trusted.totalAmount,
        amountPaise: trusted.amountPaise,
        currency: 'INR',
        keyId: config.keyId, // Public key ONLY
        mode: config.mode,
        customer: {
          name: order.customerName,
          email: order.customerEmail,
          contact: order.customerPhone,
        },
      });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to create Razorpay payment order.',
        code: 'CREATE_ORDER_FAILED',
      });
    }
  });

  // 3. Server-Side HMAC-SHA256 Payment Signature & Capture Verification
  router.post('/verify', async (req: Request, res: Response) => {
    let user: VerifiedFirebaseUser;
    try {
      user = await deps.verifyAuth(req.header('authorization'));
    } catch (err) {
      return res.status(401).json({
        error: err instanceof Error ? err.message : 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    const config = deps.getConfigStatus();
    const keySecret = String(deps.getEnv().RAZORPAY_KEY_SECRET || '').trim();
    if (!config.configured || !keySecret) {
      return res.status(503).json({
        error: config.message,
        code: 'RAZORPAY_NOT_CONFIGURED',
      });
    }

    const orderId = String(req.body?.orderId || '').trim();
    const razorpayOrderId = String(req.body?.razorpay_order_id || '').trim();
    const razorpayPaymentId = String(req.body?.razorpay_payment_id || '').trim();
    const razorpaySignature = String(req.body?.razorpay_signature || '').trim();

    if (!VALID_ID_REGEX.test(orderId) || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({
        verified: false,
        paymentStatus: 'Payment Verification Failed',
        error: 'Missing required Razorpay verification parameters.',
        code: 'MISSING_VERIFY_FIELDS',
      });
    }

    const order = await deps.fetchOrder(orderId, user.rawToken).catch(() => null);
    if (!order) {
      return res.status(404).json({ verified: false, error: `Order "${orderId}" not found.` });
    }
    const isAdmin = await deps.checkAdmin(user);
    if (order.customerUid !== user.uid && !isAdmin) {
      return res.status(403).json({ verified: false, error: 'Not authorized for this order.' });
    }

    const existing = deps.ledger.getByOrderId(orderId);
    if (existing && existing.razorpayOrderId && existing.razorpayOrderId !== razorpayOrderId) {
      return res.status(400).json({
        verified: false,
        paymentStatus: 'Payment Verification Failed',
        error: 'Razorpay Order ID does not match the order created on the server.',
        code: 'ORDER_ID_MISMATCH',
      });
    }

    const isSignatureValid = verifyCheckoutSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      keySecret
    );

    const nowIso = new Date().toISOString();
    const paymentId = existing?.paymentId || `pay_${orderId.replace(/[^A-Za-z0-9_-]/g, '')}`;

    if (!isSignatureValid) {
      const failedRecord: ServerPaymentRecord = {
        paymentId,
        orderId,
        customerUid: order.customerUid,
        razorpayOrderId,
        razorpayPaymentId,
        amount: order.totalAmount,
        currency: 'INR',
        paymentMethod: existing?.paymentMethod || 'razorpay',
        paymentStatus: 'Invalid Signature',
        orderStatus: 'Pending',
        signatureVerified: false,
        gatewayMode: config.mode === 'live' ? 'live' : 'test',
        failureReason: 'HMAC-SHA256 payment signature verification failed.',
        firestoreSynced: false,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      deps.ledger.upsertPayment(failedRecord);
      deps.ledger.recordAudit({
        event: 'signature_verification_failed',
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        status: 'Invalid Signature',
      });

      await deps.syncPaymentToFirestore(failedRecord, user.rawToken, !existing).catch(() => false);
      await deps
        .syncOrderToFirestore(
          orderId,
          {
            orderStatus: 'Pending',
            paymentStatus: 'Invalid Signature',
            razorpayOrderId,
            latestPaymentId: paymentId,
          },
          user.rawToken
        )
        .catch(() => false);

      return res.status(400).json({
        verified: false,
        paymentStatus: 'Invalid Signature',
        orderStatus: 'Pending',
        error: 'Invalid payment signature. Order will NOT be marked paid.',
        code: 'INVALID_SIGNATURE',
      });
    }

    // Double-check live payment capture state directly with Razorpay API
    let gatewayMethod: ServerPaymentRecord['paymentMethod'] = 'razorpay';
    let gatewayStatus = 'captured';
    try {
      const razorpay = deps.getRazorpayClient();
      const fetchedPayment = await razorpay.payments.fetch(razorpayPaymentId);
      gatewayMethod = normalizeMethod(fetchedPayment.method);
      gatewayStatus = String(fetchedPayment.status || '').toLowerCase();

      if (fetchedPayment.order_id && fetchedPayment.order_id !== razorpayOrderId) {
        return res.status(400).json({
          verified: false,
          paymentStatus: 'Payment Verification Failed',
          error: 'Gateway payment order reference mismatch.',
          code: 'GATEWAY_ORDER_MISMATCH',
        });
      }

      const expectedPaise = toPaise(order.totalAmount);
      if (typeof fetchedPayment.amount === 'number' && fetchedPayment.amount !== expectedPaise) {
        return res.status(400).json({
          verified: false,
          paymentStatus: 'Payment Verification Failed',
          error: 'Paid gateway amount does not match server order total.',
          code: 'AMOUNT_MISMATCH',
        });
      }
    } catch (err) {
      return res.status(502).json({
        verified: false,
        paymentStatus: 'Verification Pending',
        orderStatus: 'Pending',
        error:
          err instanceof Error
            ? `Signature matched, awaiting Razorpay gateway confirmation: ${err.message}`
            : 'Unable to confirm capture status with Razorpay. Please check status shortly.',
        code: 'GATEWAY_LOOKUP_FAILED',
      });
    }

    // Never mark order Confirmed if gateway status is only "authorized" or "created"
    if (gatewayStatus === 'authorized' || gatewayStatus === 'created') {
      const authRecord: ServerPaymentRecord = {
        paymentId,
        orderId,
        customerUid: order.customerUid,
        razorpayOrderId,
        razorpayPaymentId,
        amount: order.totalAmount,
        currency: 'INR',
        paymentMethod: gatewayMethod,
        paymentStatus: 'Payment Authorized',
        orderStatus: 'Pending',
        signatureVerified: true,
        gatewayMode: config.mode === 'live' ? 'live' : 'test',
        failureReason: '',
        firestoreSynced: false,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      deps.ledger.upsertPayment(authRecord);
      return res.status(202).json({
        verified: false,
        paymentStatus: 'Payment Authorized',
        orderStatus: 'Pending',
        payment: authRecord,
        message: 'Payment is authorized and awaiting final bank capture confirmation.',
      });
    }

    if (gatewayStatus !== 'captured') {
      const failRecord: ServerPaymentRecord = {
        paymentId,
        orderId,
        customerUid: order.customerUid,
        razorpayOrderId,
        razorpayPaymentId,
        amount: order.totalAmount,
        currency: 'INR',
        paymentMethod: gatewayMethod,
        paymentStatus: 'Payment Failed',
        orderStatus: 'Pending',
        signatureVerified: false,
        gatewayMode: config.mode === 'live' ? 'live' : 'test',
        failureReason: `Razorpay payment status is "${gatewayStatus}" (not captured).`,
        firestoreSynced: false,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };
      deps.ledger.upsertPayment(failRecord);
      return res.status(400).json({
        verified: false,
        paymentStatus: 'Payment Failed',
        orderStatus: 'Pending',
        error: `Payment was not captured by Razorpay (status: ${gatewayStatus}).`,
        code: 'PAYMENT_NOT_CAPTURED',
      });
    }

    // Signature verified AND payment confirmed captured at Razorpay!
    const verifiedRecord: ServerPaymentRecord = {
      paymentId,
      orderId,
      customerUid: order.customerUid,
      razorpayOrderId,
      razorpayPaymentId,
      amount: order.totalAmount,
      currency: 'INR',
      paymentMethod: gatewayMethod,
      paymentStatus: 'Payment Verified',
      orderStatus: 'Confirmed',
      signatureVerified: true,
      gatewayMode: config.mode === 'live' ? 'live' : 'test',
      failureReason: '',
      firestoreSynced: false,
      createdAt: existing?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    const { record: saved } = deps.ledger.upsertPayment(verifiedRecord);
    deps.ledger.recordAudit({
      event: 'payment_verified',
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      status: 'Payment Verified',
    });

    const paymentSynced = await deps
      .syncPaymentToFirestore(saved, user.rawToken, !existing)
      .catch(() => false);
    const orderSynced = await deps
      .syncOrderToFirestore(
        orderId,
        {
          orderStatus: 'Confirmed',
          paymentStatus: 'Payment Verified',
          razorpayOrderId,
          latestPaymentId: paymentId,
        },
        user.rawToken
      )
      .catch(() => false);

    saved.firestoreSynced = Boolean(paymentSynced && orderSynced);

    return res.status(200).json({
      verified: true,
      paymentStatus: saved.paymentStatus,
      orderStatus: saved.orderStatus,
      firestoreSynced: saved.firestoreSynced,
      payment: saved,
    });
  });

  // 4. Authoritative Payment Status Lookup & Reconciler (handles browser closed mid-payment!)
  router.get('/status/:orderId', async (req: Request, res: Response) => {
    let user: VerifiedFirebaseUser;
    try {
      user = await deps.verifyAuth(req.header('authorization'));
    } catch (err) {
      return res.status(401).json({
        error: err instanceof Error ? err.message : 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    const orderId = String(req.params.orderId || '').trim();
    if (!VALID_ID_REGEX.test(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId.' });
    }

    const order = await deps.fetchOrder(orderId, user.rawToken).catch(() => null);
    if (!order) {
      return res.status(404).json({ error: `Order "${orderId}" not found.` });
    }
    const isAdmin = await deps.checkAdmin(user);
    if (order.customerUid !== user.uid && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to inspect this order payment status.' });
    }

    let ledgerRecord = deps.ledger.getByOrderId(orderId);
    const config = deps.getConfigStatus();

    // If order is still pending and we have a razorpayOrderId + live config, reconcile directly with Razorpay
    if (
      ledgerRecord &&
      ledgerRecord.razorpayOrderId &&
      !isCapturedOrVerifiedStatus(ledgerRecord.paymentStatus) &&
      config.configured
    ) {
      try {
        const rz = deps.getRazorpayClient();
        const paymentsResp = await rz.orders.fetchPayments(ledgerRecord.razorpayOrderId);
        const items = paymentsResp?.items || [];
        const captured = items.find((p) => p.status === 'captured');
        const authorized = items.find((p) => p.status === 'authorized');
        const failed = items.find((p) => p.status === 'failed');

        if (captured) {
          const outcome = deps.ledger.upsertPayment({
            ...ledgerRecord,
            razorpayPaymentId: captured.id,
            paymentMethod: normalizeMethod(captured.method),
            paymentStatus: 'Payment Captured',
            orderStatus: 'Confirmed',
            signatureVerified: true,
            failureReason: '',
          });
          ledgerRecord = outcome.record;
        } else if (authorized) {
          const outcome = deps.ledger.upsertPayment({
            ...ledgerRecord,
            razorpayPaymentId: authorized.id,
            paymentMethod: normalizeMethod(authorized.method),
            paymentStatus: 'Payment Authorized',
            orderStatus: 'Pending',
          });
          ledgerRecord = outcome.record;
        } else if (failed) {
          const outcome = deps.ledger.upsertPayment({
            ...ledgerRecord,
            razorpayPaymentId: failed.id,
            paymentMethod: normalizeMethod(failed.method),
            paymentStatus: 'Payment Failed',
            failureReason: String(failed.error_description || 'Payment failed at gateway.').slice(
              0,
              300
            ),
          });
          ledgerRecord = outcome.record;
        }
      } catch {
        // Non-fatal: fall back to latest known server ledger / Firestore state
      }
    }

    // If Admin calls status check and ledger is ahead of Firestore, sync Firestore automatically
    if (ledgerRecord && isAdmin && !ledgerRecord.firestoreSynced) {
      const pSync = await deps.syncPaymentToFirestore(ledgerRecord, user.rawToken, false).catch(() => false);
      const oSync = await deps
        .syncOrderToFirestore(
          orderId,
          {
            orderStatus: ledgerRecord.orderStatus,
            paymentStatus: ledgerRecord.paymentStatus,
            razorpayOrderId: ledgerRecord.razorpayOrderId,
            latestPaymentId: ledgerRecord.paymentId,
          },
          user.rawToken
        )
        .catch(() => false);
      if (pSync && oSync) ledgerRecord.firestoreSynced = true;
    }

    const refunds = deps.ledger.getRefundsForOrder(orderId);
    const effectivePaymentStatus =
      ledgerRecord?.paymentStatus || (order.paymentStatus as Phase7PaymentStatus);
    const effectiveOrderStatus =
      ledgerRecord?.orderStatus || (order.orderStatus as OrderStatusValue);

    return res.status(200).json({
      orderId,
      paymentMethod: order.paymentMethod,
      paymentStatus: effectivePaymentStatus,
      orderStatus: effectiveOrderStatus,
      amount: order.totalAmount,
      currency: 'INR',
      payment: ledgerRecord,
      refunds,
      canRetry:
        order.paymentMethod === 'online' &&
        !isCapturedOrVerifiedStatus(effectivePaymentStatus),
    });
  });

  // 5. Admin-Only Razorpay Refund Endpoint (Full & Partial Refunds — Never Auto-Refunds)
  const inFlightRefundOrders = new Set<string>();
  const refundRateLimiter = createRateLimiter({
    windowMs: 60_000,
    maxRequests: 25,
    keyPrefix: 'payment-refund',
  });

  router.post('/refund', refundRateLimiter, async (req: Request, res: Response) => {
    let user: VerifiedFirebaseUser;
    try {
      user = await deps.verifyAuth(req.header('authorization'));
    } catch (err) {
      return res.status(401).json({
        error: err instanceof Error ? err.message : 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    const isAdmin = await deps.checkAdmin(user);
    if (!isAdmin) {
      return res.status(403).json({
        error: 'Only authorized Fashion World administrators can initiate refunds.',
        code: 'ADMIN_REQUIRED',
      });
    }

    const config = deps.getConfigStatus();
    if (!config.configured) {
      return res.status(503).json({
        error: config.message,
        code: 'RAZORPAY_NOT_CONFIGURED',
      });
    }

    const orderId = String(req.body?.orderId || '').trim();
    const reason = String(req.body?.reason || '').trim().slice(0, 300);
    const requestedAmountInr =
      req.body?.amount !== undefined && req.body?.amount !== null && req.body?.amount !== ''
        ? Number(req.body.amount)
        : undefined;

    if (!VALID_ID_REGEX.test(orderId)) {
      return res.status(400).json({ error: 'Invalid orderId.' });
    }
    if (reason.length < 3) {
      return res.status(400).json({ error: 'Please provide a refund reason (minimum 3 characters).' });
    }

    if (inFlightRefundOrders.has(orderId)) {
      return res.status(409).json({
        error: 'A refund request for this order is already in progress. Please wait for completion.',
        code: 'DUPLICATE_REFUND_IN_PROGRESS',
      });
    }

    inFlightRefundOrders.add(orderId);

    try {
      const paymentRecord = deps.ledger.getByOrderId(orderId);
      const order = await deps.fetchOrder(orderId, user.rawToken).catch(() => null);
      const razorpayPaymentId = String(
        req.body?.razorpayPaymentId || paymentRecord?.razorpayPaymentId || ''
      ).trim();

      if (!razorpayPaymentId) {
        return res.status(400).json({
          error: 'No captured Razorpay Payment ID found for this order.',
          code: 'PAYMENT_ID_REQUIRED',
        });
      }

      const maxRefundableInr = paymentRecord?.amount || order?.totalAmount || 0;
      const alreadyRefundedInr = deps.ledger.getTotalRefundedForOrder(orderId);
      const remainingInr = Math.max(0, maxRefundableInr - alreadyRefundedInr);

      if (remainingInr <= 0) {
        return res.status(409).json({
          error: 'This order has already been fully refunded.',
          code: 'ALREADY_REFUNDED',
        });
      }

      const refundAmountInr =
        requestedAmountInr !== undefined ? Math.round(requestedAmountInr) : remainingInr;

      if (!Number.isFinite(refundAmountInr) || refundAmountInr <= 0 || refundAmountInr > remainingInr) {
        return res.status(400).json({
          error: `Refund amount must be between ₹1 and ₹${remainingInr}.`,
          code: 'INVALID_REFUND_AMOUNT',
        });
      }

      const refundType: 'full' | 'partial' =
        alreadyRefundedInr + refundAmountInr >= maxRefundableInr ? 'full' : 'partial';

      const rz = deps.getRazorpayClient();
      const rzRefund = await rz.payments.refund(razorpayPaymentId, {
        amount: toPaise(refundAmountInr),
        notes: {
          orderId,
          reason,
          initiatedByUid: user.uid,
        },
      });

      const nowIso = new Date().toISOString();
      const refundStatus: ServerRefundRecord['refundStatus'] =
        rzRefund.status === 'failed'
          ? 'Failed'
          : rzRefund.status === 'processed'
            ? refundType === 'full'
              ? 'Refunded'
              : 'Partially Refunded'
            : 'Refund Initiated';

      const refundRecord: ServerRefundRecord = {
        refundId: `ref_${rzRefund.id}`,
        paymentId: paymentRecord?.paymentId || `pay_${orderId.replace(/[^A-Za-z0-9_-]/g, '')}`,
        orderId,
        customerUid: paymentRecord?.customerUid || order?.customerUid || user.uid,
        razorpayPaymentId,
        razorpayRefundId: rzRefund.id,
        amount: refundAmountInr,
        currency: 'INR',
        type: refundType,
        reason,
        refundStatus,
        initiatedByUid: user.uid,
        firestoreSynced: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      deps.ledger.addRefund(refundRecord);

      if (paymentRecord) {
        deps.ledger.upsertPayment({
          ...paymentRecord,
          paymentStatus: refundStatus === 'Failed' ? paymentRecord.paymentStatus : refundStatus,
        });
      }

      deps.ledger.recordAudit({
        event: 'refund_initiated',
        orderId,
        razorpayPaymentId,
        status: refundStatus,
        note: `${refundType} refund ₹${refundAmountInr} (${rzRefund.id})`,
      });

      const refundSynced = await deps.syncRefundToFirestore(refundRecord, user.rawToken).catch(() => false);
      refundRecord.firestoreSynced = refundSynced;

      await deps
        .syncOrderToFirestore(
          orderId,
          {
            orderStatus: refundType === 'full' ? 'Cancelled' : order?.orderStatus === 'Confirmed' ? 'Confirmed' : 'Processing',
            paymentStatus: refundStatus === 'Failed' ? 'Payment Verified' : refundStatus,
            razorpayOrderId: paymentRecord?.razorpayOrderId,
            latestPaymentId: refundRecord.paymentId,
          },
          user.rawToken
        )
        .catch(() => false);

      // Append immutable activity log & real refund notification in Firestore (best-effort)
      const logId = `act_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      const notifId = `notif_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
      await firestoreRestCommitWrites(
        [
          {
            docPath: `activityLogs/${logId}`,
            isCreate: true,
            serverTimestampFields: ['createdAt'],
            fields: {
              logId,
              actorUid: user.uid,
              actorEmail: user.email || 'admin@fashionworld.local',
              actorName: user.name || user.email?.split('@')[0] || 'Admin',
              actorRole: 'admin',
              action: 'Refund Initiated',
              entityType: 'refund',
              entityId: refundRecord.refundId,
              summary: `${refundType.toUpperCase()} refund of ₹${refundAmountInr} for order ${orderId} (${rzRefund.id}). Reason: ${reason}`,
            },
          },
          {
            docPath: `adminNotifications/${notifId}`,
            isCreate: true,
            fields: {
              notificationId: notifId,
              type: 'refund_request',
              severity: 'warning',
              title: `${refundType === 'full' ? 'Full' : 'Partial'} Refund Processed`,
              message: `Order ${orderId} refunded ₹${refundAmountInr} (${rzRefund.id}).`,
              entityId: orderId,
              readBy: [],
            },
          },
        ],
        user.rawToken
      ).catch(() => {});

      return res.status(200).json({
        refund: refundRecord,
        firestoreSynced: refundSynced,
      });
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Unable to initiate Razorpay refund.',
        code: 'REFUND_FAILED',
      });
    } finally {
      inFlightRefundOrders.delete(orderId);
    }
  });

  // 6. Staff-Authorized Read-Only Payment Summary (Super Admin, Admin, Manager, Accountant)
  router.get('/admin-summary', async (req: Request, res: Response) => {
    let user: VerifiedFirebaseUser;
    try {
      user = await deps.verifyAuth(req.header('authorization'));
    } catch (err) {
      return res.status(401).json({
        error: err instanceof Error ? err.message : 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    const canView = await deps.checkPaymentsViewer(user);
    if (!canView) {
      return res.status(403).json({ error: 'Authorized financial or admin access required.' });
    }

    const config = deps.getConfigStatus();
    return res.status(200).json({
      gateway: {
        configured: config.configured,
        webhookConfigured: config.webhookConfigured,
        mode: config.mode,
        liveModeEnabled: config.liveModeEnabled,
        message: config.message,
      },
      ledger: deps.ledger.getSummary(),
    });
  });

  return router;
}
