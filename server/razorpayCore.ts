import crypto from 'node:crypto';
import Razorpay from 'razorpay';

export type RazorpayGatewayMode = 'unconfigured' | 'test' | 'live' | 'live_blocked';

export interface RazorpayConfigStatus {
  configured: boolean;
  webhookConfigured: boolean;
  mode: RazorpayGatewayMode;
  keyId: string | null;
  liveModeEnabled: boolean;
  message: string;
}

export interface ServerOrderItem {
  productId: string;
  productName: string;
  sku: string;
  selectedSize: string;
  selectedColour: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface ServerOrderData {
  orderId: string;
  customerUid: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: ServerOrderItem[];
  deliveryMethod: 'standard' | 'express';
  subtotal: number;
  discount: number;
  couponCode: string;
  deliveryCharge: number;
  tax: number;
  totalAmount: number;
  currency: string;
  paymentMethod: 'cod' | 'online';
  paymentStatus: string;
  orderStatus: string;
}

export interface LiveProductRecord {
  id: string;
  name?: string;
  status?: string;
  sellingPrice?: number;
  salePrice?: number;
  variants?: Array<{
    size?: string;
    colour?: string;
    stockQuantity?: number;
  }>;
}

export interface LiveCouponRecord {
  code?: string;
  type?: 'percentage' | 'fixed';
  value?: number;
  minOrderValue?: number;
  maxDiscount?: number;
  startDate?: string;
  expiryDate?: string;
  usageLimit?: number;
  usedCount?: number;
  active?: boolean;
}

export interface AuthoritativePriceResult {
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  tax: number;
  totalAmount: number;
  amountPaise: number;
}

const FREE_STANDARD_THRESHOLD_INR = 999;
const STANDARD_CHARGE_INR = 99;
const EXPRESS_CHARGE_INR = 199;

export function getRazorpayConfigStatus(env: NodeJS.ProcessEnv = process.env): RazorpayConfigStatus {
  const keyId = String(env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || '').trim();
  const keySecret = String(env.RAZORPAY_KEY_SECRET || '').trim();
  const webhookSecret = String(env.RAZORPAY_WEBHOOK_SECRET || '').trim();
  const allowLive = String(env.RAZORPAY_ALLOW_LIVE || 'false').toLowerCase() === 'true';

  if (!keyId || !keySecret) {
    return {
      configured: false,
      webhookConfigured: Boolean(webhookSecret),
      mode: 'unconfigured',
      keyId: null,
      liveModeEnabled: false,
      message:
        'Razorpay test credentials (RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET) are not configured on the backend yet.',
    };
  }

  const isLiveKey = keyId.startsWith('rzp_live_');
  const isTestKey = keyId.startsWith('rzp_test_');

  if (isLiveKey && !allowLive) {
    return {
      configured: false,
      webhookConfigured: Boolean(webhookSecret),
      mode: 'live_blocked',
      keyId: null,
      liveModeEnabled: false,
      message:
        'Live Razorpay keys detected, but live payment processing is safely disabled until RAZORPAY_ALLOW_LIVE="true" is explicitly enabled by the store owner.',
    };
  }

  if (isLiveKey && allowLive) {
    return {
      configured: true,
      webhookConfigured: Boolean(webhookSecret),
      mode: 'live',
      keyId,
      liveModeEnabled: true,
      message: 'Razorpay Live Mode active.',
    };
  }

  if (isTestKey) {
    return {
      configured: true,
      webhookConfigured: Boolean(webhookSecret),
      mode: 'test',
      keyId,
      liveModeEnabled: false,
      message: 'Razorpay Test Mode ready (UPI, Cards, NetBanking & Wallets).',
    };
  }

  return {
    configured: false,
    webhookConfigured: Boolean(webhookSecret),
    mode: 'unconfigured',
    keyId: null,
    liveModeEnabled: false,
    message: 'Unrecognized Razorpay Key ID format. Expected rzp_test_* or rzp_live_*.',
  };
}

export function createRazorpayClient(env: NodeJS.ProcessEnv = process.env): Razorpay {
  const status = getRazorpayConfigStatus(env);
  if (!status.configured || !status.keyId) {
    throw new Error(status.message);
  }
  const keySecret = String(env.RAZORPAY_KEY_SECRET || '').trim();
  return new Razorpay({
    key_id: status.keyId,
    key_secret: keySecret,
  });
}

/**
 * Converts INR amount to exact integer paise (Razorpay's smallest currency unit).
 */
export function toPaise(inrAmount: number): number {
  if (!Number.isFinite(inrAmount) || inrAmount <= 0) {
    throw new Error('Payment amount must be a positive finite INR value.');
  }
  const paise = Math.round(inrAmount * 100);
  if (paise < 100) {
    throw new Error('Minimum Razorpay transaction amount is ₹1.00 (100 paise).');
  }
  return paise;
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay Checkout payment callback:
 * expected = HMAC_SHA256(razorpay_order_id + "|" + razorpay_payment_id, RAZORPAY_KEY_SECRET)
 */
export function verifyCheckoutSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  providedSignature: string,
  keySecret: string
): boolean {
  if (!razorpayOrderId || !razorpayPaymentId || !providedSignature || !keySecret) {
    return false;
  }
  const expectedHex = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'utf8');
  const providedBuf = Buffer.from(providedSignature.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Constant-time HMAC-SHA256 verification for Razorpay Webhook raw payload body:
 * expected = HMAC_SHA256(rawRequestBody, RAZORPAY_WEBHOOK_SECRET)
 */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signatureHeader: string,
  webhookSecret: string
): boolean {
  if (!rawBody || !signatureHeader || !webhookSecret) {
    return false;
  }
  const expectedHex = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const expectedBuf = Buffer.from(expectedHex, 'utf8');
  const providedBuf = Buffer.from(signatureHeader.trim(), 'utf8');
  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Independently recalculates authoritative INR totals on the server using live Firestore
 * product prices, variant availability/stock, coupon rules, and delivery pricing.
 * Never trusts any frontend-submitted amount.
 */
export function recalculateAuthoritativeOrderTotal(
  order: ServerOrderData,
  liveProductsById: Map<string, LiveProductRecord>,
  liveCoupon: LiveCouponRecord | null,
  now: Date = new Date()
): AuthoritativePriceResult {
  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new Error('Order contains no purchasable items.');
  }

  let subtotal = 0;
  for (const item of order.items) {
    const qty = Math.floor(Number(item.quantity));
    if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
      throw new Error(`Invalid item quantity for "${item.productName}".`);
    }

    const liveProd = liveProductsById.get(item.productId);
    if (!liveProd) {
      throw new Error(`Product "${item.productId}" could not be verified in Firestore.`);
    }
    if (liveProd.status !== 'published') {
      throw new Error(`Product "${liveProd.name || item.productName}" is no longer published.`);
    }

    const variants = Array.isArray(liveProd.variants) ? liveProd.variants : [];
    const matchedVariant = variants.find(
      (v) =>
        String(v.size || '').trim().toLowerCase() === item.selectedSize.trim().toLowerCase() &&
        String(v.colour || '').trim().toLowerCase() === item.selectedColour.trim().toLowerCase()
    );
    if (!matchedVariant) {
      throw new Error(
        `Variant (${item.selectedSize} / ${item.selectedColour}) for "${item.productName}" no longer exists.`
      );
    }
    if (Number(matchedVariant.stockQuantity || 0) < qty) {
      throw new Error(
        `Insufficient stock for "${item.productName}" (${item.selectedSize} / ${item.selectedColour}).`
      );
    }

    const sellingPrice = Number(liveProd.sellingPrice || 0);
    const salePrice = Number(liveProd.salePrice || 0);
    const trustedUnitPrice = Math.max(
      1,
      Math.round(salePrice > 0 && salePrice < sellingPrice ? salePrice : sellingPrice)
    );

    if (trustedUnitPrice !== Math.round(Number(item.unitPrice))) {
      throw new Error(
        `Price mismatch detected for "${item.productName}". Please refresh checkout to reflect current catalog pricing.`
      );
    }
    subtotal += trustedUnitPrice * qty;
  }

  let discount = 0;
  const code = String(order.couponCode || '').trim().toUpperCase();
  if (code.length > 0) {
    if (!liveCoupon || !liveCoupon.active) {
      throw new Error(`Coupon "${code}" is no longer active.`);
    }
    const startMs = liveCoupon.startDate ? Date.parse(liveCoupon.startDate) : 0;
    const expiryMs = liveCoupon.expiryDate ? Date.parse(liveCoupon.expiryDate) : 0;
    if (now.getTime() < startMs || now.getTime() > expiryMs) {
      throw new Error(`Coupon "${code}" is outside its valid promotional window.`);
    }
    if (subtotal < Number(liveCoupon.minOrderValue || 0)) {
      throw new Error(`Order subtotal does not satisfy coupon "${code}" minimum order value.`);
    }
    const usageLimit = Number(liveCoupon.usageLimit || 0);
    const usedCount = Number(liveCoupon.usedCount || 0);
    if (usageLimit > 0 && usedCount >= usageLimit) {
      throw new Error(`Coupon "${code}" has reached its redemption limit.`);
    }

    const rawDiscount =
      liveCoupon.type === 'fixed'
        ? Math.round(Number(liveCoupon.value || 0))
        : Math.round((subtotal * Number(liveCoupon.value || 0)) / 100);
    const cap = Number(liveCoupon.maxDiscount || 0);
    discount = Math.max(0, Math.min(subtotal, cap > 0 ? Math.min(rawDiscount, cap) : rawDiscount));
  }

  const netAfterDiscount = Math.max(0, subtotal - discount);
  const deliveryCharge =
    order.deliveryMethod === 'express'
      ? EXPRESS_CHARGE_INR
      : netAfterDiscount >= FREE_STANDARD_THRESHOLD_INR
        ? 0
        : STANDARD_CHARGE_INR;

  const tax = 0; // GST inclusive
  const totalAmount = Math.max(1, subtotal - discount + deliveryCharge + tax);

  if (Math.round(Number(order.totalAmount)) !== totalAmount) {
    throw new Error(
      `Order total mismatch detected (stored ₹${order.totalAmount} vs verified ₹${totalAmount}). Payment aborted for security.`
    );
  }

  return {
    subtotal,
    discount,
    deliveryCharge,
    tax,
    totalAmount,
    amountPaise: toPaise(totalAmount),
  };
}
