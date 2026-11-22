/**
 * Phase 7 — Razorpay Payment Gateway & Secure Payment System Verification Suite
 * Exercises all 14+ security, pricing, signature, webhook, idempotency, retry,
 * COD preservation, browser-closed reconciliation, and admin refund scenarios
 * against the real Express payment router and cryptographic verification core.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import express from 'express';
import {
  getRazorpayConfigStatus,
  recalculateAuthoritativeOrderTotal,
  toPaise,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  type LiveCouponRecord,
  type LiveProductRecord,
  type ServerOrderData,
} from './server/razorpayCore';
import { PaymentLedger } from './server/paymentLedger';
import {
  createPaymentRouter,
  createRazorpayWebhookHandler,
  type RazorpayClientLike,
} from './server/paymentRoutes';
import type { VerifiedFirebaseUser } from './server/firebaseAuth';

const TEST_KEY_ID = 'rzp_test_JummoTestKey1234';
const TEST_KEY_SECRET = 'test_secret_never_exposed_998877';
const TEST_WEBHOOK_SECRET = 'whsec_jummo_secret_554433';

function signCheckout(orderId: string, paymentId: string, secret = TEST_KEY_SECRET): string {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function signWebhook(rawBody: string, secret = TEST_WEBHOOK_SECRET): string {
  return crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
}

const SAMPLE_CUSTOMER: VerifiedFirebaseUser = {
  uid: 'cust_aarav_01',
  email: 'aarav@example.com',
  emailVerified: true,
  name: 'Aarav Sharma',
  rawToken: 'customer-token',
};

const SAMPLE_OTHER_CUSTOMER: VerifiedFirebaseUser = {
  uid: 'cust_other_99',
  email: 'other@example.com',
  emailVerified: true,
  name: 'Other User',
  rawToken: 'other-token',
};

const SAMPLE_ADMIN: VerifiedFirebaseUser = {
  uid: 'admin_meraj_01',
  email: 'merajalam906090@gmail.com',
  emailVerified: true,
  name: 'Meraj Alam',
  rawToken: 'admin-token',
};

function makeOrder(overrides: Partial<ServerOrderData> = {}): ServerOrderData {
  return {
    orderId: 'FW-TEST-ORDER-1001',
    customerUid: SAMPLE_CUSTOMER.uid,
    customerName: 'Aarav Sharma',
    customerEmail: 'aarav@example.com',
    customerPhone: '9876543210',
    items: [
      {
        productId: 'prod-1',
        productName: 'Royal Indigo Linen Shirt',
        sku: 'FW-SHIRT-M-IND',
        selectedSize: 'M',
        selectedColour: 'Indigo',
        quantity: 2,
        unitPrice: 1299,
        lineTotal: 2598,
      },
    ],
    deliveryMethod: 'standard',
    subtotal: 2598,
    discount: 260,
    couponCode: 'JUMMO10',
    deliveryCharge: 0,
    tax: 0,
    totalAmount: 2338,
    currency: 'INR',
    paymentMethod: 'online',
    paymentStatus: 'Pending',
    orderStatus: 'Pending',
    ...overrides,
  };
}

function makeLiveProducts(): Map<string, LiveProductRecord> {
  return new Map([
    [
      'prod-1',
      {
        id: 'prod-1',
        name: 'Royal Indigo Linen Shirt',
        status: 'published',
        sellingPrice: 1299,
        salePrice: 0,
        variants: [{ size: 'M', colour: 'Indigo', stockQuantity: 10 }],
      },
    ],
  ]);
}

function makeLiveCoupon(): LiveCouponRecord {
  const now = Date.now();
  return {
    code: 'JUMMO10',
    type: 'percentage',
    value: 10,
    minOrderValue: 999,
    maxDiscount: 500,
    startDate: new Date(now - 86_400_000).toISOString(),
    expiryDate: new Date(now + 86_400_000 * 30).toISOString(),
    usageLimit: 500,
    usedCount: 10,
    active: true,
  };
}

async function startTestApp(options: {
  env: NodeJS.ProcessEnv;
  orders: Map<string, ServerOrderData>;
  ledger?: PaymentLedger;
  rzPaymentStatus?: string;
  rzOrderPayments?: Array<{ id: string; status: string; method?: string; amount?: number }>;
}) {
  const ledger = options.ledger || new PaymentLedger();
  let rzOrderCounter = 0;
  let rzRefundCounter = 0;

  const stubRazorpay: RazorpayClientLike = {
    orders: {
      async create(params) {
        rzOrderCounter += 1;
        return {
          id: `order_TestRz${rzOrderCounter}`,
          amount: params.amount,
          currency: params.currency,
          status: 'created',
        };
      },
      async fetchPayments() {
        return { items: options.rzOrderPayments || [] };
      },
    },
    payments: {
      async fetch(paymentId) {
        return {
          id: paymentId,
          order_id: ledger.getByRazorpayPaymentId(paymentId)?.razorpayOrderId || `order_TestRz${rzOrderCounter}`,
          status: options.rzPaymentStatus || 'captured',
          method: 'upi',
          amount: 233800,
          currency: 'INR',
        };
      },
      async refund(_paymentId, params) {
        rzRefundCounter += 1;
        return {
          id: `rfnd_TestRz${rzRefundCounter}`,
          status: 'processed',
          amount: params.amount,
        };
      },
    },
  };

  const deps = {
    ledger,
    getEnv: () => options.env,
    getRazorpayClient: () => stubRazorpay,
    verifyAuth: async (header?: string) => {
      if (header === 'Bearer customer-token') return SAMPLE_CUSTOMER;
      if (header === 'Bearer other-token') return SAMPLE_OTHER_CUSTOMER;
      if (header === 'Bearer admin-token') return SAMPLE_ADMIN;
      throw new Error('Invalid or missing Authorization Bearer token.');
    },
    checkAdmin: async (u: VerifiedFirebaseUser) => u.uid === SAMPLE_ADMIN.uid,
    fetchOrder: async (orderId: string) => options.orders.get(orderId) || null,
    fetchProducts: async () => makeLiveProducts(),
    fetchCoupon: async (code: string) => (code === 'JUMMO10' ? makeLiveCoupon() : null),
    syncPaymentToFirestore: async () => true,
    syncOrderToFirestore: async () => true,
    syncRefundToFirestore: async () => true,
  };

  const app = express();
  app.post(
    '/api/payments/webhook',
    express.raw({ type: 'application/json' }),
    createRazorpayWebhookHandler(deps)
  );
  app.use('/api', express.json());
  app.use('/api/payments', createPaymentRouter(deps));

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    ledger,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function runAll() {
  let passed = 0;
  const test = async (name: string, fn: () => Promise<void> | void) => {
    await fn();
    passed += 1;
    console.log(`PASS: ${name}`);
  };

  await test('1. INR-to-paise exact integer conversion & invalid amount rejection', () => {
    assert.equal(toPaise(2338), 233800);
    assert.equal(toPaise(999.5), 99950);
    assert.throws(() => toPaise(0));
    assert.throws(() => toPaise(-50));
    assert.throws(() => toPaise(0.5));
  });

  await test('2. Live Mode safety lock prevents accidental rzp_live_* usage unless explicitly enabled', () => {
    const blocked = getRazorpayConfigStatus({
      RAZORPAY_KEY_ID: 'rzp_live_ProductionKey',
      RAZORPAY_KEY_SECRET: 'live_secret',
      RAZORPAY_ALLOW_LIVE: 'false',
    });
    assert.equal(blocked.configured, false);
    assert.equal(blocked.mode, 'live_blocked');

    const allowed = getRazorpayConfigStatus({
      RAZORPAY_KEY_ID: 'rzp_live_ProductionKey',
      RAZORPAY_KEY_SECRET: 'live_secret',
      RAZORPAY_ALLOW_LIVE: 'true',
    });
    assert.equal(allowed.configured, true);
    assert.equal(allowed.mode, 'live');
  });

  await test('3. Server-side total recalculation validates live catalog prices & rejects tampered totals', () => {
    const validOrder = makeOrder();
    const calc = recalculateAuthoritativeOrderTotal(validOrder, makeLiveProducts(), makeLiveCoupon());
    assert.equal(calc.totalAmount, 2338);
    assert.equal(calc.amountPaise, 233800);

    const tamperedOrder = makeOrder({ totalAmount: 1 });
    assert.throws(
      () => recalculateAuthoritativeOrderTotal(tamperedOrder, makeLiveProducts(), makeLiveCoupon()),
      /mismatch/i
    );
  });

  await test('4. Cryptographic HMAC-SHA256 Checkout & Webhook signature helpers reject tampered values', () => {
    const validSig = signCheckout('order_ABC123', 'pay_XYZ789');
    assert.equal(verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', validSig, TEST_KEY_SECRET), true);
    assert.equal(verifyCheckoutSignature('order_ABC123', 'pay_XYZ789', 'deadbeef', TEST_KEY_SECRET), false);
    assert.equal(verifyCheckoutSignature('order_ABC123', 'pay_TAMPERED', validSig, TEST_KEY_SECRET), false);

    const raw = JSON.stringify({ event: 'payment.captured', id: 'evt_1' });
    const whSig = signWebhook(raw);
    assert.equal(verifyWebhookSignature(Buffer.from(raw, 'utf8'), whSig, TEST_WEBHOOK_SECRET), true);
    assert.equal(verifyWebhookSignature(Buffer.from(raw + ' ', 'utf8'), whSig, TEST_WEBHOOK_SECRET), false);
  });

  await test('5. Unconfigured credentials safely return 503 and NEVER simulate a paid payment', async () => {
    const orders = new Map([[makeOrder().orderId, makeOrder()]]);
    const srv = await startTestApp({ env: {}, orders });
    try {
      const cfg = await (await fetch(`${srv.baseUrl}/api/payments/config`)).json();
      assert.equal(cfg.configured, false);
      assert.equal(cfg.mode, 'unconfigured');
      assert.equal('keySecret' in cfg, false);

      const createRes = await fetch(`${srv.baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer customer-token',
        },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
      });
      assert.equal(createRes.status, 503);
    } finally {
      await srv.close();
    }
  });

  await test('6. Unauthorized requests (missing/invalid token) are rejected with 401 across all protected routes', async () => {
    const orders = new Map([[makeOrder().orderId, makeOrder()]]);
    const srv = await startTestApp({
      env: {
        RAZORPAY_KEY_ID: TEST_KEY_ID,
        RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
      },
      orders,
    });
    try {
      const r1 = await fetch(`${srv.baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
      });
      assert.equal(r1.status, 401);

      const r2 = await fetch(`${srv.baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer fake-token' },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
      });
      assert.equal(r2.status, 401);

      const r3 = await fetch(`${srv.baseUrl}/api/payments/status/FW-TEST-ORDER-1001`);
      assert.equal(r3.status, 401);

      const r4 = await fetch(`${srv.baseUrl}/api/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001', reason: 'test' }),
      });
      assert.equal(r4.status, 401);
    } finally {
      await srv.close();
    }
  });

  await test('7. Successful Razorpay Order Creation, Valid Signature Verification, and Zero Secret Leakage', async () => {
    const orders = new Map([[makeOrder().orderId, makeOrder()]]);
    const srv = await startTestApp({
      env: {
        RAZORPAY_KEY_ID: TEST_KEY_ID,
        RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
      },
      orders,
      rzPaymentStatus: 'captured',
    });
    try {
      // Cross-customer attempt blocked with 403
      const forbidden = await fetch(`${srv.baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer other-token' },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
      });
      assert.equal(forbidden.status, 403);

      // Legitimate owner creates Razorpay order
      const createRes = await fetch(`${srv.baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
      });
      assert.equal(createRes.status, 200);
      const created = await createRes.json();
      assert.equal(created.amountPaise, 233800);
      assert.equal(created.currency, 'INR');
      assert.equal(created.keyId, TEST_KEY_ID);
      assert.equal(JSON.stringify(created).includes(TEST_KEY_SECRET), false);

      // Invalid signature rejected with 400 Invalid Signature
      const badVerify = await fetch(`${srv.baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({
          orderId: 'FW-TEST-ORDER-1001',
          razorpay_order_id: created.razorpayOrderId,
          razorpay_payment_id: 'pay_Fake999',
          razorpay_signature: 'invalid_hex_signature',
        }),
      });
      assert.equal(badVerify.status, 400);
      const badJson = await badVerify.json();
      assert.equal(badJson.verified, false);
      assert.equal(badJson.paymentStatus, 'Invalid Signature');

      // Retry without creating a duplicate order (reuses same orderId!)
      const retryCreate = await fetch(`${srv.baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
      });
      assert.equal(retryCreate.status, 200);
      const retried = await retryCreate.json();
      assert.equal(retried.orderId, 'FW-TEST-ORDER-1001');

      // Valid HMAC-SHA256 signature + captured status marks order Payment Verified & Confirmed
      const goodSig = signCheckout(retried.razorpayOrderId, 'pay_RealCaptured01');
      const goodVerify = await fetch(`${srv.baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({
          orderId: 'FW-TEST-ORDER-1001',
          razorpay_order_id: retried.razorpayOrderId,
          razorpay_payment_id: 'pay_RealCaptured01',
          razorpay_signature: goodSig,
        }),
      });
      assert.equal(goodVerify.status, 200);
      const goodJson = await goodVerify.json();
      assert.equal(goodJson.verified, true);
      assert.equal(goodJson.paymentStatus, 'Payment Verified');
      assert.equal(goodJson.orderStatus, 'Confirmed');

      // Duplicate payment attempt on already verified order is blocked with 409 ALREADY_PAID
      const dupPay = await fetch(`${srv.baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
      });
      assert.equal(dupPay.status, 409);
    } finally {
      await srv.close();
    }
  });

  await test('8. Authorized-only payment NEVER marks order Paid or Confirmed', async () => {
    const orders = new Map([[makeOrder().orderId, makeOrder()]]);
    const srv = await startTestApp({
      env: {
        RAZORPAY_KEY_ID: TEST_KEY_ID,
        RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
      },
      orders,
      rzPaymentStatus: 'authorized',
    });
    try {
      const created = await (
        await fetch(`${srv.baseUrl}/api/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
          body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
        })
      ).json();

      const sig = signCheckout(created.razorpayOrderId, 'pay_AuthOnly01');
      const res = await fetch(`${srv.baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({
          orderId: 'FW-TEST-ORDER-1001',
          razorpay_order_id: created.razorpayOrderId,
          razorpay_payment_id: 'pay_AuthOnly01',
          razorpay_signature: sig,
        }),
      });
      assert.equal(res.status, 202);
      const body = await res.json();
      assert.equal(body.verified, false);
      assert.equal(body.paymentStatus, 'Payment Authorized');
      assert.equal(body.orderStatus, 'Pending');
    } finally {
      await srv.close();
    }
  });

  await test('9. Webhooks: Raw-Body Signature, Duplicate Idempotency, Authorized Guard, Out-of-Order Protection & Browser-Closed Reconciliation', async () => {
    const orders = new Map([[makeOrder().orderId, makeOrder()]]);
    const srv = await startTestApp({
      env: {
        RAZORPAY_KEY_ID: TEST_KEY_ID,
        RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
        RAZORPAY_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
      },
      orders,
    });
    try {
      // Create order first (simulating customer opening Razorpay & closing browser before callback!)
      const created = await (
        await fetch(`${srv.baseUrl}/api/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
          body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
        })
      ).json();

      // Invalid webhook signature -> 400
      const authPayload = JSON.stringify({
        event: 'payment.authorized',
        payload: {
          payment: {
            entity: {
              id: 'pay_Wh01',
              order_id: created.razorpayOrderId,
              amount: 233800,
              method: 'upi',
              notes: { orderId: 'FW-TEST-ORDER-1001' },
            },
          },
        },
      });
      const badWh = await fetch(`${srv.baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': 'wrong_signature',
          'x-razorpay-event-id': 'evt_auth_1',
        },
        body: authPayload,
      });
      assert.equal(badWh.status, 400);

      // Valid payment.authorized webhook -> status Payment Authorized, orderStatus STILL Pending!
      const goodAuthWh = await fetch(`${srv.baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signWebhook(authPayload),
          'x-razorpay-event-id': 'evt_auth_1',
        },
        body: authPayload,
      });
      assert.equal(goodAuthWh.status, 200);
      assert.equal(srv.ledger.getByOrderId('FW-TEST-ORDER-1001')?.paymentStatus, 'Payment Authorized');
      assert.equal(srv.ledger.getByOrderId('FW-TEST-ORDER-1001')?.orderStatus, 'Pending');

      // Valid payment.captured webhook -> Payment Captured & Confirmed
      const capPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_Wh01',
              order_id: created.razorpayOrderId,
              amount: 233800,
              method: 'upi',
              notes: { orderId: 'FW-TEST-ORDER-1001' },
            },
          },
        },
      });
      const capWh1 = await fetch(`${srv.baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signWebhook(capPayload),
          'x-razorpay-event-id': 'evt_cap_1',
        },
        body: capPayload,
      });
      assert.equal(capWh1.status, 200);
      assert.equal((await capWh1.json()).duplicate, false);

      // Duplicate delivery of evt_cap_1 -> idempotent duplicate: true
      const capWh2 = await fetch(`${srv.baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signWebhook(capPayload),
          'x-razorpay-event-id': 'evt_cap_1',
        },
        body: capPayload,
      });
      assert.equal(capWh2.status, 200);
      assert.equal((await capWh2.json()).duplicate, true);

      // Out-of-order payment.failed arriving AFTER payment.captured MUST NOT downgrade status!
      const lateFailPayload = JSON.stringify({
        event: 'payment.failed',
        payload: {
          payment: {
            entity: {
              id: 'pay_Wh01',
              order_id: created.razorpayOrderId,
              amount: 233800,
              error_description: 'Delayed failure event',
              notes: { orderId: 'FW-TEST-ORDER-1001' },
            },
          },
        },
      });
      const lateFailWh = await fetch(`${srv.baseUrl}/api/payments/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-razorpay-signature': signWebhook(lateFailPayload),
          'x-razorpay-event-id': 'evt_late_fail',
        },
        body: lateFailPayload,
      });
      assert.equal(lateFailWh.status, 200);
      assert.equal(srv.ledger.getByOrderId('FW-TEST-ORDER-1001')?.paymentStatus, 'Payment Captured');
      assert.equal(srv.ledger.getByOrderId('FW-TEST-ORDER-1001')?.orderStatus, 'Confirmed');

      // Browser-closed reconciliation: customer calls GET /api/payments/status/:orderId and sees Confirmed!
      const statusRes = await fetch(`${srv.baseUrl}/api/payments/status/FW-TEST-ORDER-1001`, {
        headers: { Authorization: 'Bearer customer-token' },
      });
      assert.equal(statusRes.status, 200);
      const statusJson = await statusRes.json();
      assert.equal(statusJson.paymentStatus, 'Payment Captured');
      assert.equal(statusJson.orderStatus, 'Confirmed');
      assert.equal(statusJson.canRetry, false);
    } finally {
      await srv.close();
    }
  });

  await test('10. Cash on Delivery orders are preserved untouched and blocked from online Razorpay create-order', async () => {
    const codOrder = makeOrder({
      orderId: 'FW-COD-ORDER-2002',
      paymentMethod: 'cod',
      paymentStatus: 'COD Pending',
    });
    const orders = new Map([[codOrder.orderId, codOrder]]);
    const srv = await startTestApp({
      env: {
        RAZORPAY_KEY_ID: TEST_KEY_ID,
        RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
      },
      orders,
    });
    try {
      const res = await fetch(`${srv.baseUrl}/api/payments/create-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({ orderId: codOrder.orderId }),
      });
      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.code, 'NOT_ONLINE_ORDER');

      const st = await (
        await fetch(`${srv.baseUrl}/api/payments/status/${codOrder.orderId}`, {
          headers: { Authorization: 'Bearer customer-token' },
        })
      ).json();
      assert.equal(st.paymentStatus, 'COD Pending');
      assert.equal(st.canRetry, false);
    } finally {
      await srv.close();
    }
  });

  await test('11. Refunds enforce strictly Admin-only authorization and support Partial + Full refund tracking', async () => {
    const orders = new Map([[makeOrder().orderId, makeOrder()]]);
    const srv = await startTestApp({
      env: {
        RAZORPAY_KEY_ID: TEST_KEY_ID,
        RAZORPAY_KEY_SECRET: TEST_KEY_SECRET,
      },
      orders,
      rzPaymentStatus: 'captured',
    });
    try {
      // Complete a verified payment first
      const created = await (
        await fetch(`${srv.baseUrl}/api/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
          body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001' }),
        })
      ).json();
      const sig = signCheckout(created.razorpayOrderId, 'pay_RefundTarget01');
      await fetch(`${srv.baseUrl}/api/payments/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({
          orderId: 'FW-TEST-ORDER-1001',
          razorpay_order_id: created.razorpayOrderId,
          razorpay_payment_id: 'pay_RefundTarget01',
          razorpay_signature: sig,
        }),
      });

      // Customer attempting refund -> 403 ADMIN_REQUIRED
      const custRefund = await fetch(`${srv.baseUrl}/api/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer customer-token' },
        body: JSON.stringify({ orderId: 'FW-TEST-ORDER-1001', reason: 'Self refund attempt' }),
      });
      assert.equal(custRefund.status, 403);

      // Admin issues Partial Refund (₹500)
      const partialRes = await fetch(`${srv.baseUrl}/api/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
        body: JSON.stringify({
          orderId: 'FW-TEST-ORDER-1001',
          amount: 500,
          reason: 'Size alteration credit',
        }),
      });
      assert.equal(partialRes.status, 200);
      const partialJson = await partialRes.json();
      assert.equal(partialJson.refund.type, 'partial');
      assert.equal(partialJson.refund.amount, 500);
      assert.equal(partialJson.refund.refundStatus, 'Partially Refunded');

      // Over-refund attempt rejected (remaining is ₹1838)
      const overRes = await fetch(`${srv.baseUrl}/api/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
        body: JSON.stringify({
          orderId: 'FW-TEST-ORDER-1001',
          amount: 2000,
          reason: 'Too much',
        }),
      });
      assert.equal(overRes.status, 400);

      // Admin issues remaining balance -> full Refunded
      const finalRes = await fetch(`${srv.baseUrl}/api/payments/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer admin-token' },
        body: JSON.stringify({
          orderId: 'FW-TEST-ORDER-1001',
          reason: 'Remaining return refund',
        }),
      });
      assert.equal(finalRes.status, 200);
      const finalJson = await finalRes.json();
      assert.equal(finalJson.refund.type, 'full');
      assert.equal(finalJson.refund.amount, 1838);
      assert.equal(finalJson.refund.refundStatus, 'Refunded');
    } finally {
      await srv.close();
    }
  });

  console.log(`\nAll ${passed}/11 Phase 7 Razorpay payment security & integration tests passed.`);
}

runAll().catch((err) => {
  console.error('Phase 7 payment test suite failed:', err);
  process.exit(1);
});
