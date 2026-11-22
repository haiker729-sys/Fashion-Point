import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import {
  BOOTSTRAP_SUPER_ADMIN,
  firestoreRestCommitWrites,
  firestoreRestDeleteDocument,
  firestoreRestGetDocument,
  firestoreRestGetDocumentWithMeta,
  firestoreRestListCollection,
  resolveVerifiedStaffContext,
  verifyFirebaseIdToken,
  type FirestoreAtomicWriteSpec,
  type ResolvedStaffContext,
  type VerifiedFirebaseUser,
} from './firebaseAuth';
import { createRateLimiter } from './rateLimiter';
import {
  ALL_STAFF_ROLES,
  isStaffRole,
  maskEmailForRole,
  maskPhoneForRole,
  type AdminPermission,
  type StaffRole,
} from '../src/utils/adminPermissions';
import {
  buildCsvDocument,
  COLLECTED_ONLINE_PAYMENT_STATUSES,
  computeSalesAnalytics,
  resolveDateRangeWindow,
} from '../src/utils/adminAnalytics';
import type { OrderDoc, OrderStatus } from '../src/types/commerce';
import type { PaymentRecordDoc, RefundRecordDoc } from '../src/types/payment';
import type { AdminReportType, AnalyticsDatePreset } from '../src/types/admin';

const VALID_ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Packed',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
];

const VALID_MOVEMENT_TYPES = [
  'manual_adjustment',
  'restock',
  'damage',
  'order_deduction',
  'return_restock',
] as const;

const VALID_CUSTOMER_STATUSES = ['active', 'suspended', 'flagged'] as const;

export interface AdminRouterDeps {
  verifyAuth: (authHeader?: string) => Promise<VerifiedFirebaseUser>;
  resolveStaff: (user: VerifiedFirebaseUser) => Promise<ResolvedStaffContext>;
  getDoc: (docPath: string, idToken: string) => Promise<Record<string, unknown> | null>;
  getDocWithMeta: (
    docPath: string,
    idToken: string
  ) => Promise<{ data: Record<string, unknown>; updateTime: string } | null>;
  listCollection: (
    collectionId: string,
    idToken: string,
    pageSize?: number
  ) => Promise<Array<{ id: string; data: Record<string, unknown> }>>;
  commitWrites: (
    specs: FirestoreAtomicWriteSpec[],
    idToken: string
  ) => Promise<{ synced: boolean; status: number; conflict?: boolean; error?: string }>;
  deleteDoc: (
    docPath: string,
    idToken: string
  ) => Promise<{ ok: boolean; status: number; error?: string }>;
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
}

function makeSafeId(prefix: string): string {
  const rand = crypto.randomBytes(5).toString('hex');
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function sanitizeLine(input: unknown, maxLen: number): string {
  return String(input ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function buildActivityLogSpec(
  staff: ResolvedStaffContext,
  action: string,
  entityType: string,
  entityId: string,
  summary: string
): FirestoreAtomicWriteSpec {
  const logId = makeSafeId('act');
  return {
    docPath: `activityLogs/${logId}`,
    isCreate: true,
    serverTimestampFields: ['createdAt'],
    fields: {
      logId,
      actorUid: staff.user.uid,
      actorEmail: staff.user.email || 'staff@fashionworld.local',
      actorName: sanitizeLine(staff.displayName, 100) || 'Staff',
      actorRole: staff.role === 'customer' ? 'staff' : staff.role,
      action: sanitizeLine(action, 80),
      entityType: sanitizeLine(entityType, 60),
      entityId: sanitizeLine(entityId, 128) || 'system',
      summary: sanitizeLine(summary, 400),
    },
  };
}

function buildNotificationSpec(input: {
  type:
    | 'new_order'
    | 'payment_success'
    | 'payment_failed'
    | 'low_stock'
    | 'out_of_stock'
    | 'refund_request'
    | 'order_cancelled'
    | 'security_event';
  severity: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  entityId: string;
}): FirestoreAtomicWriteSpec {
  const notificationId = makeSafeId('notif');
  return {
    docPath: `adminNotifications/${notificationId}`,
    isCreate: true,
    fields: {
      notificationId,
      type: input.type,
      severity: input.severity,
      title: sanitizeLine(input.title, 120),
      message: sanitizeLine(input.message, 360),
      entityId: sanitizeLine(input.entityId, 128),
      readBy: [],
    },
  };
}

function createDefaultDeps(): AdminRouterDeps {
  return {
    verifyAuth: verifyFirebaseIdToken,
    resolveStaff: resolveVerifiedStaffContext,
    getDoc: firestoreRestGetDocument,
    getDocWithMeta: firestoreRestGetDocumentWithMeta,
    listCollection: firestoreRestListCollection,
    commitWrites: firestoreRestCommitWrites,
    deleteDoc: firestoreRestDeleteDocument,
  };
}

export function createAdminRouter(overrides: Partial<AdminRouterDeps> = {}): Router {
  const deps: AdminRouterDeps = { ...createDefaultDeps(), ...overrides };
  const router = Router();

  const sensitiveLimiter = createRateLimiter({
    windowMs: deps.rateLimitWindowMs ?? 60_000,
    maxRequests: deps.rateLimitMax ?? 60,
    keyPrefix: 'admin-mutation',
  });

  const exportLimiter = createRateLimiter({
    windowMs: deps.rateLimitWindowMs ?? 60_000,
    maxRequests: Math.min(20, deps.rateLimitMax ?? 20),
    keyPrefix: 'admin-export',
  });

  async function requirePermission(
    req: Request,
    res: Response,
    permission?: AdminPermission
  ): Promise<ResolvedStaffContext | null> {
    let user: VerifiedFirebaseUser;
    try {
      user = await deps.verifyAuth(req.header('authorization'));
    } catch (err) {
      res.status(401).json({
        error: err instanceof Error ? err.message : 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
      return null;
    }

    const staff = await deps.resolveStaff(user);
    if (!staff.isStaff) {
      res.status(403).json({
        error: 'Authorized store staff role required.',
        code: 'FORBIDDEN_NOT_STAFF',
      });
      return null;
    }

    if (permission && !staff.permissions.has(permission)) {
      res.status(403).json({
        error: `Role "${staff.role}" does not hold required permission "${permission}".`,
        code: 'FORBIDDEN_PERMISSION',
      });
      return null;
    }

    return staff;
  }

  /* ------------------------------------------------------------------------ */
  /* 1. Server-Verified Identity & Granular Permissions                       */
  /* ------------------------------------------------------------------------ */
  router.get('/me', async (req: Request, res: Response) => {
    let user: VerifiedFirebaseUser;
    try {
      user = await deps.verifyAuth(req.header('authorization'));
    } catch (err) {
      return res.status(401).json({
        error: err instanceof Error ? err.message : 'Authentication required.',
        code: 'UNAUTHORIZED',
      });
    }

    const staff = await deps.resolveStaff(user);
    return res.status(200).json({
      uid: user.uid,
      email: user.email,
      displayName: staff.displayName,
      role: staff.role,
      isStaff: staff.isStaff,
      isSuperAdmin: staff.isSuperAdmin,
      permissions: Array.from(staff.permissions),
    });
  });

  /* ------------------------------------------------------------------------ */
  /* 2. Orders Management: Trusted Status Update & Internal Notes             */
  /* ------------------------------------------------------------------------ */
  router.post(
    '/orders/:orderId/status',
    sensitiveLimiter,
    async (req: Request, res: Response) => {
      const staff = await requirePermission(req, res, 'orders:update');
      if (!staff) return;

      const orderId = sanitizeLine(req.params.orderId, 128);
      const nextStatus = sanitizeLine(req.body?.orderStatus, 40) as OrderStatus;
      const reason = sanitizeLine(req.body?.reason, 280);
      const requestedPaymentStatus = req.body?.paymentStatus;

      if (!orderId || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
        return res.status(400).json({ error: 'Invalid orderId.', code: 'INVALID_ORDER_ID' });
      }
      if (!VALID_ORDER_STATUSES.includes(nextStatus)) {
        return res.status(400).json({
          error: `Unsupported orderStatus "${nextStatus}".`,
          code: 'INVALID_ORDER_STATUS',
        });
      }
      if (reason.length < 3) {
        return res.status(400).json({
          error: 'Please provide a clear reason (at least 3 characters) for the status update.',
          code: 'REASON_REQUIRED',
        });
      }

      // Security invariant: Admins can NEVER manually mark an online payment as Paid/Verified.
      if (requestedPaymentStatus !== undefined && requestedPaymentStatus !== null && requestedPaymentStatus !== '') {
        return res.status(403).json({
          error:
            'Manual payment status overrides are prohibited. Online payment statuses must come exclusively from verified Razorpay backend events.',
          code: 'PAYMENT_STATUS_LOCKED',
        });
      }

      const orderDoc = await deps.getDoc(`orders/${orderId}`, staff.user.rawToken);
      if (!orderDoc) {
        return res.status(404).json({ error: 'Order not found.', code: 'ORDER_NOT_FOUND' });
      }

      const previousStatus = String(orderDoc.orderStatus || 'Pending') as OrderStatus;
      const paymentMethod = String(orderDoc.paymentMethod || 'cod');
      const currentPaymentStatus = String(orderDoc.paymentStatus || 'Pending');

      // Guard: Cannot confirm or ship an unpaid online order
      if (
        paymentMethod === 'online' &&
        ['Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'].includes(
          nextStatus
        ) &&
        !COLLECTED_ONLINE_PAYMENT_STATUSES.includes(currentPaymentStatus as OrderDoc['paymentStatus'])
      ) {
        return res.status(400).json({
          error: `Online order ${orderId} cannot move to "${nextStatus}" while paymentStatus is "${currentPaymentStatus}".`,
          code: 'UNPAID_ONLINE_ORDER',
        });
      }

      // Guard: Delivered is terminal (only super_admin can reopen if needed)
      if (previousStatus === 'Delivered' && nextStatus !== 'Delivered' && !staff.isSuperAdmin) {
        return res.status(400).json({
          error: 'Delivered orders are finalized and can only be adjusted by a Super Admin.',
          code: 'TERMINAL_ORDER_STATUS',
        });
      }

      const existingHistory = Array.isArray(orderDoc.statusHistory)
        ? (orderDoc.statusHistory as Array<Record<string, unknown>>).slice(-39)
        : [];

      const timelineEntry = {
        status: nextStatus,
        previousStatus,
        actorUid: staff.user.uid,
        actorName: staff.displayName,
        actorRole: staff.role as StaffRole,
        reason,
        timestamp: new Date().toISOString(),
      };

      const nextHistory = [...existingHistory, timelineEntry];

      // For COD Delivered orders, Admin/Super Admin records paymentStatus as 'Paid' upon delivery confirmation
      const shouldMarkCodCollected =
        paymentMethod === 'cod' &&
        nextStatus === 'Delivered' &&
        (staff.role === 'super_admin' || staff.role === 'admin');

      const updateFields: Record<string, unknown> = {
        orderStatus: nextStatus,
        statusHistory: nextHistory,
      };
      const updateMask = ['orderStatus', 'statusHistory'];
      if (shouldMarkCodCollected) {
        updateFields.paymentStatus = 'Paid';
        updateMask.push('paymentStatus');
      }

      const writes: FirestoreAtomicWriteSpec[] = [
        {
          docPath: `orders/${orderId}`,
          isCreate: false,
          fields: updateFields,
          updateMaskFields: updateMask,
        },
        buildActivityLogSpec(
          staff,
          'Order Status Updated',
          'order',
          orderId,
          `Changed order ${orderId} from ${previousStatus} to ${nextStatus} — Reason: ${reason}`
        ),
      ];

      if (nextStatus === 'Cancelled') {
        writes.push(
          buildNotificationSpec({
            type: 'order_cancelled',
            severity: 'warning',
            title: `Order ${orderId} Cancelled`,
            message: `${staff.displayName} (${staff.role}) cancelled order ${orderId}: ${reason}`,
            entityId: orderId,
          })
        );
      }

      const result = await deps.commitWrites(writes, staff.user.rawToken);
      if (!result.synced) {
        return res.status(502).json({
          error: result.error || 'Failed to update order status in Firestore.',
          code: 'FIRESTORE_WRITE_FAILED',
        });
      }

      return res.status(200).json({
        orderId,
        previousStatus,
        orderStatus: nextStatus,
        paymentStatus: shouldMarkCodCollected ? 'Paid' : currentPaymentStatus,
        timelineEntry,
      });
    }
  );

  router.post(
    '/orders/:orderId/notes',
    sensitiveLimiter,
    async (req: Request, res: Response) => {
      const staff = await requirePermission(req, res, 'orders:note');
      if (!staff) return;

      const orderId = sanitizeLine(req.params.orderId, 128);
      const text = sanitizeLine(req.body?.text, 360);
      if (!orderId || !/^[A-Za-z0-9_-]+$/.test(orderId)) {
        return res.status(400).json({ error: 'Invalid orderId.' });
      }
      if (text.length < 2) {
        return res.status(400).json({ error: 'Internal note must be at least 2 characters.' });
      }

      const orderDoc = await deps.getDoc(`orders/${orderId}`, staff.user.rawToken);
      if (!orderDoc) {
        return res.status(404).json({ error: 'Order not found.' });
      }

      const existingNotes = Array.isArray(orderDoc.internalNotes)
        ? (orderDoc.internalNotes as Array<Record<string, unknown>>).slice(-39)
        : [];

      const noteEntry = {
        id: makeSafeId('note'),
        text,
        authorUid: staff.user.uid,
        authorName: staff.displayName,
        authorRole: staff.role as StaffRole,
        createdAt: new Date().toISOString(),
      };

      const writes: FirestoreAtomicWriteSpec[] = [
        {
          docPath: `orders/${orderId}`,
          isCreate: false,
          fields: { internalNotes: [...existingNotes, noteEntry] },
          updateMaskFields: ['internalNotes'],
        },
        buildActivityLogSpec(
          staff,
          'Order Note Added',
          'order',
          orderId,
          `Added internal note on ${orderId}: ${text.slice(0, 140)}`
        ),
      ];

      const result = await deps.commitWrites(writes, staff.user.rawToken);
      if (!result.synced) {
        return res.status(502).json({
          error: result.error || 'Failed to save internal note.',
        });
      }

      return res.status(200).json({ orderId, note: noteEntry });
    }
  );

  /* ------------------------------------------------------------------------ */
  /* 3. Transactional Inventory Stock Adjustment (Concurrency + Non-Negative) */
  /* ------------------------------------------------------------------------ */
  router.post(
    '/inventory/adjust',
    sensitiveLimiter,
    async (req: Request, res: Response) => {
      const staff = await requirePermission(req, res, 'inventory:update');
      if (!staff) return;

      const productId = sanitizeLine(req.body?.productId, 128);
      const variantId = sanitizeLine(req.body?.variantId, 96);
      const mode = req.body?.mode === 'set' ? 'set' : 'delta';
      const rawValue = Number(req.body?.value);
      const movementType = sanitizeLine(req.body?.movementType || 'manual_adjustment', 40);
      const reason = sanitizeLine(req.body?.reason, 280);

      if (!productId || !/^[A-Za-z0-9_-]+$/.test(productId) || !variantId) {
        return res.status(400).json({ error: 'Valid productId and variantId are required.' });
      }
      if (!Number.isInteger(rawValue)) {
        return res.status(400).json({ error: 'Stock adjustment value must be a whole integer.' });
      }
      if (!VALID_MOVEMENT_TYPES.includes(movementType as (typeof VALID_MOVEMENT_TYPES)[number])) {
        return res.status(400).json({ error: 'Unsupported inventory movementType.' });
      }
      if (reason.length < 3) {
        return res.status(400).json({
          error: 'Please provide an adjustment reason (at least 3 characters).',
        });
      }

      const productMeta = await deps.getDocWithMeta(`products/${productId}`, staff.user.rawToken);
      if (!productMeta) {
        return res.status(404).json({ error: 'Product not found in Firestore.' });
      }

      const variants = Array.isArray(productMeta.data.variants)
        ? (productMeta.data.variants as Array<Record<string, unknown>>)
        : [];
      const idx = variants.findIndex((v) => String(v.id || '') === variantId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Variant not found on product.' });
      }

      const targetVariant = variants[idx];
      const previousStock = Math.max(0, Math.floor(Number(targetVariant.stockQuantity) || 0));
      const newStock = mode === 'set' ? rawValue : previousStock + rawValue;
      const delta = newStock - previousStock;

      if (newStock < 0) {
        return res.status(400).json({
          error: `Stock cannot become negative (current: ${previousStock}, attempted: ${newStock}).`,
          code: 'NEGATIVE_STOCK_BLOCKED',
        });
      }
      if (newStock > 100000) {
        return res.status(400).json({
          error: 'Stock quantity cannot exceed 100,000 units per variant.',
        });
      }
      if (delta === 0) {
        return res.status(400).json({
          error: 'New stock quantity matches existing stock; no adjustment needed.',
        });
      }

      const nextVariants = variants.map((v, i) =>
        i === idx ? { ...v, stockQuantity: newStock } : v
      );

      const productName = sanitizeLine(productMeta.data.name || productId, 140);
      const variantSku = sanitizeLine(targetVariant.sku || variantId, 64);
      const colour = sanitizeLine(targetVariant.colour || 'Classic', 60);
      const size = sanitizeLine(targetVariant.size || 'M', 32);
      const movementId = makeSafeId('mov');

      const totalAfter = nextVariants.reduce(
        (sum, v) => sum + Math.max(0, Math.floor(Number(v.stockQuantity) || 0)),
        0
      );
      const lowThreshold = Math.max(1, Number(productMeta.data.lowStockThreshold || 10));

      const writes: FirestoreAtomicWriteSpec[] = [
        {
          docPath: `products/${productId}`,
          isCreate: false,
          fields: { variants: nextVariants },
          updateMaskFields: ['variants'],
          preconditionUpdateTime: productMeta.updateTime || undefined,
        },
        {
          docPath: `inventoryHistory/${movementId}`,
          isCreate: true,
          serverTimestampFields: ['createdAt'],
          fields: {
            movementId,
            productId,
            productName,
            variantId,
            variantSku,
            colour,
            size,
            previousStock,
            delta,
            newStock,
            movementType,
            reason,
            actorUid: staff.user.uid,
            actorName: staff.displayName,
            actorRole: staff.role as StaffRole,
          },
        },
        buildActivityLogSpec(
          staff,
          'Stock Changed',
          'product',
          productId,
          `${productName} (${colour}/${size} · ${variantSku}): ${previousStock} -> ${newStock} (${delta > 0 ? `+${delta}` : delta}) — ${reason}`
        ),
      ];

      if (totalAfter === 0) {
        writes.push(
          buildNotificationSpec({
            type: 'out_of_stock',
            severity: 'error',
            title: `Out of Stock: ${productName}`,
            message: `${productName} reached 0 total units after stock adjustment by ${staff.displayName}.`,
            entityId: productId,
          })
        );
      } else if (totalAfter <= lowThreshold) {
        writes.push(
          buildNotificationSpec({
            type: 'low_stock',
            severity: 'warning',
            title: `Low Stock: ${productName}`,
            message: `${productName} has ${totalAfter} total unit(s) left (threshold ≤ ${lowThreshold}).`,
            entityId: productId,
          })
        );
      }

      const result = await deps.commitWrites(writes, staff.user.rawToken);
      if (!result.synced) {
        if (result.conflict) {
          return res.status(409).json({
            error:
              'Concurrent stock update detected on this product. Please refresh inventory and retry.',
            code: 'CONCURRENT_STOCK_CONFLICT',
          });
        }
        return res.status(502).json({
          error: result.error || 'Failed to commit stock adjustment.',
          code: 'FIRESTORE_WRITE_FAILED',
        });
      }

      return res.status(200).json({
        movementId,
        productId,
        variantId,
        previousStock,
        delta,
        newStock,
        totalProductStock: totalAfter,
      });
    }
  );

  /* ------------------------------------------------------------------------ */
  /* 4. Trusted Backend Coupon Validation & Admin Coupon CRUD                 */
  /* ------------------------------------------------------------------------ */
  router.post(
    '/coupons/validate',
    sensitiveLimiter,
    async (req: Request, res: Response) => {
      let user: VerifiedFirebaseUser;
      try {
        user = await deps.verifyAuth(req.header('authorization'));
      } catch (err) {
        return res.status(401).json({
          error: err instanceof Error ? err.message : 'Authentication required.',
          code: 'UNAUTHORIZED',
        });
      }

      const code = sanitizeLine(req.body?.code, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
      const subtotal = Number(req.body?.subtotal || 0);

      if (code.length < 3 || !Number.isFinite(subtotal) || subtotal <= 0) {
        return res.status(400).json({
          valid: false,
          discount: 0,
          message: 'Provide a valid coupon code and positive subtotal.',
        });
      }

      const couponDoc = await deps.getDoc(`coupons/${code}`, user.rawToken);
      if (!couponDoc) {
        return res.status(200).json({
          valid: false,
          discount: 0,
          message: `Coupon "${code}" does not exist.`,
        });
      }

      const nowMs = Date.now();
      const startMs = Date.parse(String(couponDoc.startDate || '')) || 0;
      const expiryMs = Date.parse(String(couponDoc.expiryDate || '')) || 0;
      const active = couponDoc.active === true;
      const minOrderValue = Number(couponDoc.minOrderValue || 0);
      const maxDiscount = Number(couponDoc.maxDiscount || 0);
      const usageLimit = Number(couponDoc.usageLimit || 0);
      const usedCount = Number(couponDoc.usedCount || 0);
      const type = couponDoc.type === 'fixed' ? 'fixed' : 'percentage';
      const value = Number(couponDoc.value || 0);

      if (!active) {
        return res.status(200).json({ valid: false, discount: 0, message: `Coupon "${code}" is currently inactive.` });
      }
      if (nowMs < startMs) {
        return res.status(200).json({ valid: false, discount: 0, message: `Coupon "${code}" is not active yet.` });
      }
      if (nowMs > expiryMs) {
        return res.status(200).json({ valid: false, discount: 0, message: `Coupon "${code}" has expired.` });
      }
      if (usageLimit > 0 && usedCount >= usageLimit) {
        return res.status(200).json({ valid: false, discount: 0, message: `Coupon "${code}" has reached its usage limit.` });
      }
      if (subtotal < minOrderValue) {
        return res.status(200).json({
          valid: false,
          discount: 0,
          message: `Minimum order value of ₹${minOrderValue.toLocaleString('en-IN')} is required for "${code}".`,
        });
      }

      let rawDiscount = type === 'fixed' ? value : Math.round((subtotal * value) / 100);
      if (maxDiscount > 0) rawDiscount = Math.min(rawDiscount, maxDiscount);
      const discount = Math.max(0, Math.min(subtotal, Math.round(rawDiscount)));

      return res.status(200).json({
        valid: discount > 0,
        discount,
        code,
        type,
        value,
        message: `Coupon "${code}" validated server-side: ₹${discount.toLocaleString('en-IN')} discount applied.`,
      });
    }
  );

  router.post('/coupons', sensitiveLimiter, async (req: Request, res: Response) => {
    const staff = await requirePermission(req, res, 'coupons:manage');
    if (!staff) return;

    const code = sanitizeLine(req.body?.code, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const type = req.body?.type === 'fixed' ? 'fixed' : 'percentage';
    const value = Number(req.body?.value);
    const minOrderValue = Math.max(0, Number(req.body?.minOrderValue || 0));
    const maxDiscount = Math.max(0, Number(req.body?.maxDiscount || 0));
    const usageLimit = Math.max(0, Math.floor(Number(req.body?.usageLimit || 0)));
    const active = req.body?.active !== false;
    const description = sanitizeLine(req.body?.description || 'Store Promotional Coupon', 200);
    const startDate = new Date(String(req.body?.startDate || new Date().toISOString()));
    const expiryDate = new Date(
      String(req.body?.expiryDate || new Date(Date.now() + 30 * 86400_000).toISOString())
    );

    if (code.length < 3 || code.length > 32) {
      return res.status(400).json({ error: 'Coupon code must be 3–32 alphanumeric characters.' });
    }
    if (!Number.isFinite(value) || value <= 0 || (type === 'percentage' && value > 90)) {
      return res.status(400).json({ error: 'Invalid discount value (percentage must be 1–90%).' });
    }
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(expiryDate.getTime()) || expiryDate <= startDate) {
      return res.status(400).json({ error: 'Expiry date must be strictly after start date.' });
    }

    const existing = await deps.getDoc(`coupons/${code}`, staff.user.rawToken);
    const isUpdate = Boolean(existing);

    const writes: FirestoreAtomicWriteSpec[] = [
      {
        docPath: `coupons/${code}`,
        isCreate: !isUpdate,
        timestampFieldPaths: ['startDate', 'expiryDate'],
        updateMaskFields: isUpdate
          ? ['type', 'value', 'minOrderValue', 'maxDiscount', 'startDate', 'expiryDate', 'usageLimit', 'active', 'description']
          : undefined,
        fields: isUpdate
          ? {
              type,
              value,
              minOrderValue,
              maxDiscount,
              startDate: startDate.toISOString(),
              expiryDate: expiryDate.toISOString(),
              usageLimit,
              active,
              description,
            }
          : {
              code,
              type,
              value,
              minOrderValue,
              maxDiscount,
              startDate: startDate.toISOString(),
              expiryDate: expiryDate.toISOString(),
              usageLimit,
              usedCount: 0,
              active,
              description,
            },
      },
      buildActivityLogSpec(
        staff,
        isUpdate ? 'Coupon Updated' : 'Coupon Created',
        'coupon',
        code,
        `${isUpdate ? 'Updated' : 'Created'} coupon ${code} (${type === 'percentage' ? `${value}%` : `₹${value}`}, active: ${active})`
      ),
    ];

    const result = await deps.commitWrites(writes, staff.user.rawToken);
    if (!result.synced) {
      return res.status(502).json({ error: result.error || 'Failed to save coupon.' });
    }

    return res.status(200).json({ code, saved: true, updated: isUpdate });
  });

  router.delete('/coupons/:code', sensitiveLimiter, async (req: Request, res: Response) => {
    const staff = await requirePermission(req, res, 'coupons:manage');
    if (!staff) return;

    const code = sanitizeLine(req.params.code, 32).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (code.length < 3) {
      return res.status(400).json({ error: 'Invalid coupon code.' });
    }

    const del = await deps.deleteDoc(`coupons/${code}`, staff.user.rawToken);
    if (!del.ok) {
      return res.status(502).json({ error: del.error || 'Failed to delete coupon.' });
    }

    await deps
      .commitWrites(
        [buildActivityLogSpec(staff, 'Coupon Deleted', 'coupon', code, `Deleted coupon ${code}`)],
        staff.user.rawToken
      )
      .catch(() => {});

    return res.status(200).json({ code, deleted: true });
  });

  /* ------------------------------------------------------------------------ */
  /* 5. Super-Admin Staff & Role Management (Strict Privilege Escalation Guard)*/
  /* ------------------------------------------------------------------------ */
  router.post('/staff', sensitiveLimiter, async (req: Request, res: Response) => {
    const staff = await requirePermission(req, res, 'staff:manage');
    if (!staff) return;

    const targetUid = sanitizeLine(req.body?.uid, 128);
    const email = sanitizeLine(req.body?.email, 254).toLowerCase();
    const displayName = sanitizeLine(req.body?.displayName, 100);
    const role = sanitizeLine(req.body?.role, 32);
    const active = req.body?.active !== false;
    const rawPermissions = Array.isArray(req.body?.permissions)
      ? req.body.permissions.filter((p: unknown): p is string => typeof p === 'string').slice(0, 30)
      : undefined;

    if (!targetUid || !/^[A-Za-z0-9_-]+$/.test(targetUid)) {
      return res.status(400).json({ error: 'Valid Firebase User UID is required.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid staff email address is required.' });
    }
    if (!displayName) {
      return res.status(400).json({ error: 'Staff display name is required.' });
    }
    if (!isStaffRole(role)) {
      return res.status(400).json({
        error: `Role must be one of: ${ALL_STAFF_ROLES.join(', ')}.`,
      });
    }

    // Protect bootstrap super admin from accidental demotion or deactivation
    if (email === BOOTSTRAP_SUPER_ADMIN && (role !== 'super_admin' || !active)) {
      return res.status(403).json({
        error: 'The primary Super Admin account cannot be demoted or deactivated.',
        code: 'BOOTSTRAP_PROTECTED',
      });
    }

    const existing = await deps.getDoc(`admins/${targetUid}`, staff.user.rawToken);
    const isUpdate = Boolean(existing);

    const fields: Record<string, unknown> = isUpdate
      ? { email, displayName, role, active }
      : { uid: targetUid, email, displayName, role, active };
    const mask = ['email', 'displayName', 'role', 'active'];

    if (rawPermissions !== undefined) {
      fields.permissions = rawPermissions;
      mask.push('permissions');
    }

    const writes: FirestoreAtomicWriteSpec[] = [
      {
        docPath: `admins/${targetUid}`,
        isCreate: !isUpdate,
        fields,
        updateMaskFields: isUpdate ? mask : undefined,
      },
      buildActivityLogSpec(
        staff,
        'Staff Permissions Changed',
        'staff',
        targetUid,
        `${isUpdate ? 'Updated' : 'Assigned'} ${displayName} (${email}) -> role: ${role}, active: ${active}`
      ),
      buildNotificationSpec({
        type: 'security_event',
        severity: 'warning',
        title: 'Staff Permissions Updated',
        message: `${staff.displayName} set ${email} to ${role} (${active ? 'Active' : 'Suspended'}).`,
        entityId: targetUid,
      }),
    ];

    const result = await deps.commitWrites(writes, staff.user.rawToken);
    if (!result.synced) {
      return res.status(502).json({ error: result.error || 'Failed to save staff permissions.' });
    }

    return res.status(200).json({ uid: targetUid, role, active, updated: isUpdate });
  });

  router.delete('/staff/:uid', sensitiveLimiter, async (req: Request, res: Response) => {
    const staff = await requirePermission(req, res, 'staff:manage');
    if (!staff) return;

    const targetUid = sanitizeLine(req.params.uid, 128);
    if (!targetUid || !/^[A-Za-z0-9_-]+$/.test(targetUid)) {
      return res.status(400).json({ error: 'Invalid staff UID.' });
    }
    if (targetUid === staff.user.uid) {
      return res.status(403).json({ error: 'You cannot revoke your own Super Admin access.' });
    }

    const existing = await deps.getDoc(`admins/${targetUid}`, staff.user.rawToken);
    if (existing && String(existing.email || '').toLowerCase() === BOOTSTRAP_SUPER_ADMIN) {
      return res.status(403).json({ error: 'The primary Super Admin account cannot be deleted.' });
    }

    const del = await deps.deleteDoc(`admins/${targetUid}`, staff.user.rawToken);
    if (!del.ok) {
      return res.status(502).json({ error: del.error || 'Failed to remove staff record.' });
    }

    await deps
      .commitWrites(
        [
          buildActivityLogSpec(
            staff,
            'Staff Permissions Changed',
            'staff',
            targetUid,
            `Revoked staff access for UID ${targetUid}`
          ),
        ],
        staff.user.rawToken
      )
      .catch(() => {});

    return res.status(200).json({ uid: targetUid, deleted: true });
  });

  /* ------------------------------------------------------------------------ */
  /* 6. Customer Management: Account Status & Support History                 */
  /* ------------------------------------------------------------------------ */
  router.post(
    '/customers/:uid/status',
    sensitiveLimiter,
    async (req: Request, res: Response) => {
      const staff = await requirePermission(req, res, 'customers:manage');
      if (!staff) return;

      const uid = sanitizeLine(req.params.uid, 128);
      const accountStatus = sanitizeLine(req.body?.accountStatus, 32);
      const reason = sanitizeLine(req.body?.reason || 'Admin status review', 240);

      if (!uid || !/^[A-Za-z0-9_-]+$/.test(uid)) {
        return res.status(400).json({ error: 'Invalid customer UID.' });
      }
      if (!VALID_CUSTOMER_STATUSES.includes(accountStatus as (typeof VALID_CUSTOMER_STATUSES)[number])) {
        return res.status(400).json({ error: 'Invalid accountStatus.' });
      }

      const writes: FirestoreAtomicWriteSpec[] = [
        {
          docPath: `users/${uid}`,
          isCreate: false,
          fields: { accountStatus },
          updateMaskFields: ['accountStatus'],
        },
        buildActivityLogSpec(
          staff,
          'Customer Status Updated',
          'customer',
          uid,
          `Set customer ${uid} accountStatus -> ${accountStatus} (${reason})`
        ),
      ];

      const result = await deps.commitWrites(writes, staff.user.rawToken);
      if (!result.synced) {
        return res.status(502).json({ error: result.error || 'Failed to update customer status.' });
      }

      return res.status(200).json({ uid, accountStatus });
    }
  );

  router.post(
    '/customers/:uid/support',
    sensitiveLimiter,
    async (req: Request, res: Response) => {
      const staff = await requirePermission(req, res, 'customers:manage');
      if (!staff) return;

      const uid = sanitizeLine(req.params.uid, 128);
      const subject = sanitizeLine(req.body?.subject, 120);
      const summary = sanitizeLine(req.body?.summary, 320);
      const status = req.body?.status === 'resolved' ? 'resolved' : 'open';

      if (!uid || !/^[A-Za-z0-9_-]+$/.test(uid) || subject.length < 2 || summary.length < 2) {
        return res.status(400).json({ error: 'Customer UID, subject, and summary are required.' });
      }

      const customerDoc = await deps.getDoc(`users/${uid}`, staff.user.rawToken);
      if (!customerDoc) {
        return res.status(404).json({ error: 'Customer profile not found.' });
      }

      const existingNotes = Array.isArray(customerDoc.supportNotes)
        ? (customerDoc.supportNotes as Array<Record<string, unknown>>).slice(-29)
        : [];

      const entry = {
        id: makeSafeId('sup'),
        subject,
        summary,
        status,
        actorUid: staff.user.uid,
        actorName: staff.displayName,
        createdAt: new Date().toISOString(),
      };

      const writes: FirestoreAtomicWriteSpec[] = [
        {
          docPath: `users/${uid}`,
          isCreate: false,
          fields: { supportNotes: [...existingNotes, entry] },
          updateMaskFields: ['supportNotes'],
        },
        buildActivityLogSpec(
          staff,
          'Customer Status Updated',
          'customer',
          uid,
          `Logged support record (${status}) for customer ${uid}: ${subject}`
        ),
      ];

      const result = await deps.commitWrites(writes, staff.user.rawToken);
      if (!result.synced) {
        return res.status(502).json({ error: result.error || 'Failed to log support entry.' });
      }

      return res.status(200).json({ uid, supportNote: entry });
    }
  );

  /* ------------------------------------------------------------------------ */
  /* 7. Append Immutable Activity Log (Server-Enforced Actor UID)             */
  /* ------------------------------------------------------------------------ */
  router.post('/activity-logs', sensitiveLimiter, async (req: Request, res: Response) => {
    const staff = await requirePermission(req, res, 'dashboard:view');
    if (!staff) return;

    const action = sanitizeLine(req.body?.action, 80);
    const entityType = sanitizeLine(req.body?.entityType, 60);
    const entityId = sanitizeLine(req.body?.entityId, 128);
    const summary = sanitizeLine(req.body?.summary, 400);

    if (action.length < 2 || entityType.length < 2 || entityId.length < 1 || summary.length < 2) {
      return res.status(400).json({ error: 'Valid action, entityType, entityId, and summary are required.' });
    }

    const spec = buildActivityLogSpec(staff, action, entityType, entityId, summary);
    const result = await deps.commitWrites([spec], staff.user.rawToken);
    if (!result.synced) {
      return res.status(502).json({ error: result.error || 'Failed to append activity log.' });
    }

    return res.status(201).json({ logged: true, logId: spec.fields.logId });
  });

  /* ------------------------------------------------------------------------ */
  /* 8. Server-Authorized CSV Report Export (PII-Minimized & Formula-Safe)    */
  /* ------------------------------------------------------------------------ */
  router.post('/reports/export', exportLimiter, async (req: Request, res: Response) => {
    const reportType = sanitizeLine(req.body?.reportType, 32) as AdminReportType;
    const isFinancialReport = ['sales', 'payments', 'refunds'].includes(reportType);
    const isOperationalReport = ['orders', 'inventory', 'customers'].includes(reportType);

    if (!isFinancialReport && !isOperationalReport) {
      return res.status(400).json({
        error: 'reportType must be sales, orders, payments, refunds, inventory, or customers.',
      });
    }

    const requiredPerm: AdminPermission = isFinancialReport
      ? 'reports:financial'
      : 'reports:operational';
    const staff = await requirePermission(req, res, requiredPerm);
    if (!staff) return;

    const preset = (sanitizeLine(req.body?.preset || 'last_30_days', 32) ||
      'last_30_days') as AnalyticsDatePreset;
    const customStart = sanitizeLine(req.body?.customStart || '', 16);
    const customEnd = sanitizeLine(req.body?.customEnd || '', 16);
    const window = resolveDateRangeWindow(preset, customStart, customEnd);
    const canViewPii = staff.permissions.has('customers:pii');

    try {
      let csv = '';
      let rowCount = 0;

      if (reportType === 'sales') {
        const [rawOrders, rawPayments, rawRefunds] = await Promise.all([
          deps.listCollection('orders', staff.user.rawToken, 300),
          deps.listCollection('payments', staff.user.rawToken, 300),
          deps.listCollection('refunds', staff.user.rawToken, 300),
        ]);
        const orders = rawOrders.map((d) => ({ ...(d.data as unknown as OrderDoc), orderId: String(d.data.orderId || d.id) }));
        const payments = rawPayments.map((d) => ({ ...(d.data as unknown as PaymentRecordDoc), paymentId: String(d.data.paymentId || d.id) }));
        const refunds = rawRefunds.map((d) => ({ ...(d.data as unknown as RefundRecordDoc), refundId: String(d.data.refundId || d.id) }));

        const analytics = computeSalesAnalytics({
          orders,
          payments,
          refunds,
          products: [],
          categories: [],
          preset,
          granularity: 'daily',
          customStart,
          customEnd,
        });

        const rows = analytics.series.map((pt) => [
          pt.bucketKey,
          pt.orders,
          pt.revenue,
          pt.refunds,
          Math.max(0, pt.revenue - pt.refunds),
        ]);
        rowCount = rows.length;
        csv = buildCsvDocument(
          ['Date (IST)', 'Orders Count', 'Collected Sales (INR)', 'Refunds (INR)', 'Net Revenue (INR)'],
          rows
        );
      } else if (reportType === 'orders') {
        const rawOrders = await deps.listCollection('orders', staff.user.rawToken, 300);
        const rows = rawOrders
          .map((d) => d.data)
          .filter((o) => {
            const ms = Date.parse(String(o.createdAt || '')) || 0;
            return ms >= window.startMs && ms <= window.endMs;
          })
          .map((o) => {
            const addr = (o.deliveryAddress || {}) as Record<string, unknown>;
            return [
              o.orderId,
              o.createdAt,
              o.customerName,
              maskEmailForRole(String(o.customerEmail || ''), canViewPii),
              `${String(addr.city || '')}, ${String(addr.state || '')}`,
              o.paymentMethod,
              o.paymentStatus,
              o.orderStatus,
              o.subtotal,
              o.discount,
              o.deliveryCharge,
              o.totalAmount,
            ];
          });
        rowCount = rows.length;
        csv = buildCsvDocument(
          [
            'Order ID',
            'Created At (UTC)',
            'Customer Name',
            'Customer Email',
            'City/State',
            'Payment Method',
            'Payment Status',
            'Order Status',
            'Subtotal (INR)',
            'Discount (INR)',
            'Delivery (INR)',
            'Total (INR)',
          ],
          rows
        );
      } else if (reportType === 'payments') {
        const rawPayments = await deps.listCollection('payments', staff.user.rawToken, 300);
        const rows = rawPayments
          .map((d) => d.data)
          .filter((p) => {
            const ms = Date.parse(String(p.createdAt || '')) || 0;
            return ms >= window.startMs && ms <= window.endMs;
          })
          .map((p) => [
            p.paymentId,
            p.orderId,
            p.razorpayOrderId,
            p.razorpayPaymentId,
            p.paymentMethod,
            p.amount,
            p.currency,
            p.paymentStatus,
            p.signatureVerified ? 'Yes' : 'No',
            p.gatewayMode,
            p.createdAt,
          ]);
        rowCount = rows.length;
        csv = buildCsvDocument(
          [
            'Payment ID',
            'Order ID',
            'Razorpay Order ID',
            'Razorpay Payment ID',
            'Method',
            'Amount (INR)',
            'Currency',
            'Status',
            'HMAC Verified',
            'Mode',
            'Timestamp (UTC)',
          ],
          rows
        );
      } else if (reportType === 'refunds') {
        const rawRefunds = await deps.listCollection('refunds', staff.user.rawToken, 300);
        const rows = rawRefunds
          .map((d) => d.data)
          .filter((r) => {
            const ms = Date.parse(String(r.createdAt || '')) || 0;
            return ms >= window.startMs && ms <= window.endMs;
          })
          .map((r) => [
            r.refundId,
            r.orderId,
            r.razorpayPaymentId,
            r.razorpayRefundId,
            r.type,
            r.amount,
            r.refundStatus,
            r.reason,
            r.initiatedByUid,
            r.createdAt,
          ]);
        rowCount = rows.length;
        csv = buildCsvDocument(
          [
            'Refund ID',
            'Order ID',
            'Razorpay Payment ID',
            'Razorpay Refund ID',
            'Type',
            'Amount (INR)',
            'Status',
            'Reason',
            'Initiated By UID',
            'Timestamp (UTC)',
          ],
          rows
        );
      } else if (reportType === 'inventory') {
        const rawProducts = await deps.listCollection('products', staff.user.rawToken, 300);
        const rows: Array<Array<unknown>> = [];
        for (const item of rawProducts) {
          const p = item.data;
          const variants = Array.isArray(p.variants)
            ? (p.variants as Array<Record<string, unknown>>)
            : [];
          for (const v of variants) {
            rows.push([
              p.id || item.id,
              p.sku,
              p.name,
              p.status,
              v.sku,
              v.colour,
              v.size,
              v.stockQuantity,
              p.lowStockThreshold,
              p.sellingPrice,
            ]);
          }
        }
        rowCount = rows.length;
        csv = buildCsvDocument(
          [
            'Product ID',
            'Product SKU',
            'Product Name',
            'Visibility',
            'Variant SKU',
            'Colour',
            'Size',
            'Stock Qty',
            'Low Threshold',
            'Selling Price (INR)',
          ],
          rows
        );
      } else {
        // customers report — intentionally omits passwords, tokens, full street addresses; masks PII if role lacks customers:pii
        const [rawUsers, rawOrders] = await Promise.all([
          deps.listCollection('users', staff.user.rawToken, 300),
          deps.listCollection('orders', staff.user.rawToken, 300),
        ]);
        const spendByUid = new Map<string, { orders: number; total: number }>();
        for (const o of rawOrders) {
          const uid = String(o.data.customerUid || '');
          const prev = spendByUid.get(uid) || { orders: 0, total: 0 };
          prev.orders += 1;
          if (o.data.orderStatus !== 'Cancelled') {
            prev.total += Number(o.data.totalAmount || 0);
          }
          spendByUid.set(uid, prev);
        }
        const rows = rawUsers
          .map((u) => u.data)
          .filter((u) => String(u.role || 'customer') === 'customer')
          .map((u) => {
            const uid = String(u.uid || '');
            const agg = spendByUid.get(uid) || { orders: 0, total: 0 };
            return [
              uid,
              u.displayName,
              maskEmailForRole(String(u.email || ''), canViewPii),
              maskPhoneForRole(String(u.phone || ''), canViewPii),
              u.accountStatus || 'active',
              agg.orders,
              agg.total,
              u.createdAt,
            ];
          });
        rowCount = rows.length;
        csv = buildCsvDocument(
          [
            'Customer UID',
            'Display Name',
            'Email (Role-Scoped)',
            'Phone (Role-Scoped)',
            'Account Status',
            'Total Orders',
            'Total Purchase Value (INR)',
            'Joined At (UTC)',
          ],
          rows
        );
      }

      await deps
        .commitWrites(
          [
            buildActivityLogSpec(
              staff,
              'Report Exported',
              'report',
              reportType,
              `Exported ${reportType} CSV report (${rowCount} rows, range: ${window.label})`
            ),
          ],
          staff.user.rawToken
        )
        .catch(() => {});

      const fileName = `fashion-world-${reportType}-report-${window.startDateIso}-to-${window.endDateIso}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.status(200).send(csv);
    } catch (err) {
      return res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to generate report from Firestore.',
        code: 'REPORT_EXPORT_FAILED',
      });
    }
  });

  return router;
}
