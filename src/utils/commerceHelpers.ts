import {
  SHIPPING_RULES,
  type AddressValidationErrors,
  type CheckoutPriceBreakdown,
  type CouponDoc,
  type CouponValidationResult,
  type DeliveryAddressInput,
  type DeliveryMethod,
} from '../types/commerce';
import type { CatalogProduct, ProductVariant } from '../types/catalog';

const INDIAN_MOBILE_REGEX = /^[6-9][0-9]{9}$/;
const INDIAN_PIN_REGEX = /^[1-9][0-9]{5}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Produces a strictly Firestore-safe ID token matching ^[A-Za-z0-9_-]+$.
 */
export function sanitizeFirestoreIdPart(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'default';
}

/**
 * Deterministic Cart Item document ID:
 * - Identical (productId, selectedSize, selectedColour) produces the exact same ID -> merges quantity.
 * - Different size or different colour produces a distinct ID -> separate cart rows.
 * Guaranteed to match ^[A-Za-z0-9_-]+$ and <= 128 chars.
 */
export function buildCartItemId(
  productId: string,
  selectedSize: string,
  selectedColour: string
): string {
  const p = productId.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 56) || 'prod';
  const s = sanitizeFirestoreIdPart(selectedSize).slice(0, 24);
  const c = sanitizeFirestoreIdPart(selectedColour).slice(0, 36);
  return `${p}__${s}__${c}`.slice(0, 128);
}

/**
 * Generates a deterministic, human-friendly Fashion World Order ID from an idempotency key.
 * Matches ^[A-Za-z0-9_-]+$ so it passes firestore.rules isValidId().
 */
export function buildOrderIdFromIdempotencyKey(idempotencyKey: string): string {
  const cleanKey = idempotencyKey.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16);
  return `FW-${cleanKey || Date.now().toString(36).toUpperCase()}`;
}

export function createCheckoutIdempotencyKey(): string {
  const timePart = Date.now().toString(36).toUpperCase();
  const randPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${timePart}${randPart}`;
}

/**
 * Returns the authoritative effective selling price of a CatalogProduct (salePrice if active, else sellingPrice).
 */
export function getTrustedUnitPrice(product: Pick<CatalogProduct, 'sellingPrice' | 'salePrice'>): number {
  const sale = typeof product.salePrice === 'number' && product.salePrice > 0 ? product.salePrice : 0;
  const selling = Number(product.sellingPrice) || 0;
  return Math.max(1, Math.round(sale > 0 && sale < selling ? sale : selling));
}

/**
 * Finds the exact variant for (size, colour) on a product (case-insensitive trimmed comparison).
 */
export function findMatchingVariant(
  variants: ProductVariant[],
  selectedSize: string,
  selectedColour: string
): ProductVariant | undefined {
  const sizeNorm = selectedSize.trim().toLowerCase();
  const colourNorm = selectedColour.trim().toLowerCase();
  return variants.find(
    (v) =>
      v.size.trim().toLowerCase() === sizeNorm &&
      v.colour.trim().toLowerCase() === colourNorm
  );
}

/**
 * Normalizes a coupon code string to uppercase alphanumeric/underscore/hyphen.
 */
export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

/**
 * Pure validation of a Firestore CouponDoc against a trusted subtotal and timestamp.
 */
export function validateCouponRecord(
  coupon: CouponDoc | null | undefined,
  subtotal: number,
  nowMs: number = Date.now()
): CouponValidationResult {
  if (!coupon) {
    return { valid: false, discount: 0, message: 'Coupon code not found. Please check and try again.' };
  }
  if (!coupon.active) {
    return { valid: false, discount: 0, message: `Coupon "${coupon.code}" is currently inactive.` };
  }

  const startMs = Date.parse(coupon.startDate);
  const expiryMs = Date.parse(coupon.expiryDate);

  if (Number.isFinite(startMs) && nowMs < startMs) {
    return {
      valid: false,
      discount: 0,
      message: `Coupon "${coupon.code}" is not active yet.`,
    };
  }
  if (Number.isFinite(expiryMs) && nowMs > expiryMs) {
    return {
      valid: false,
      discount: 0,
      message: `Coupon "${coupon.code}" has expired.`,
    };
  }
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return {
      valid: false,
      discount: 0,
      message: `Coupon "${coupon.code}" has reached its maximum usage limit.`,
    };
  }
  if (subtotal < coupon.minOrderValue) {
    const shortfall = Math.ceil(coupon.minOrderValue - subtotal);
    return {
      valid: false,
      discount: 0,
      message: `Add ₹${shortfall.toLocaleString('en-IN')} more to unlock "${coupon.code}" (minimum order ₹${coupon.minOrderValue.toLocaleString('en-IN')}).`,
    };
  }

  let computedDiscount =
    coupon.type === 'percentage'
      ? Math.floor((subtotal * coupon.value) / 100)
      : Math.floor(coupon.value);

  if (coupon.maxDiscount > 0) {
    computedDiscount = Math.min(computedDiscount, Math.floor(coupon.maxDiscount));
  }
  computedDiscount = Math.max(0, Math.min(computedDiscount, Math.floor(subtotal)));

  if (computedDiscount <= 0) {
    return { valid: false, discount: 0, message: 'This coupon does not provide a discount on the current cart.' };
  }

  return {
    valid: true,
    discount: computedDiscount,
    message: `Coupon "${coupon.code}" applied — you save ₹${computedDiscount.toLocaleString('en-IN')}!`,
    coupon,
  };
}

/**
 * Trusted INR Checkout Price Calculator.
 * Matches firestore.rules isValidOrderOnCreate() equations exactly:
 * - subtotal = sum(unitPrice * quantity)
 * - discount = validated coupon discount (integer INR)
 * - deliveryCharge = express ? 199 : ((subtotal - discount) >= 999 ? 0 : 99)
 * - tax = 0 (GST-inclusive catalog pricing)
 * - totalAmount = subtotal - discount + deliveryCharge + tax
 */
export function calculateCheckoutTotals(params: {
  items: Array<{ unitPrice: number; originalPrice?: number; quantity: number }>;
  deliveryMethod: DeliveryMethod;
  coupon?: CouponDoc | null;
  nowMs?: number;
}): CheckoutPriceBreakdown {
  const totalItems = params.items.reduce((sum, item) => sum + Math.max(0, Math.floor(item.quantity)), 0);
  const subtotal = params.items.reduce(
    (sum, item) => sum + Math.round(item.unitPrice) * Math.max(0, Math.floor(item.quantity)),
    0
  );
  const catalogSavings = params.items.reduce((sum, item) => {
    const orig = Math.round(item.originalPrice ?? item.unitPrice);
    const unit = Math.round(item.unitPrice);
    return sum + Math.max(0, orig - unit) * Math.max(0, Math.floor(item.quantity));
  }, 0);

  let couponDiscount = 0;
  let couponCode = '';

  if (params.coupon && subtotal > 0) {
    const validation = validateCouponRecord(params.coupon, subtotal, params.nowMs);
    if (validation.valid) {
      couponDiscount = validation.discount;
      couponCode = params.coupon.code;
    }
  }

  const netSubtotal = Math.max(0, subtotal - couponDiscount);
  const deliveryCharge =
    subtotal === 0
      ? 0
      : params.deliveryMethod === 'express'
        ? SHIPPING_RULES.EXPRESS_CHARGE_INR
        : netSubtotal >= SHIPPING_RULES.FREE_STANDARD_THRESHOLD_INR
          ? 0
          : SHIPPING_RULES.STANDARD_CHARGE_INR;

  const freeDeliveryRemaining =
    subtotal === 0 || netSubtotal >= SHIPPING_RULES.FREE_STANDARD_THRESHOLD_INR
      ? 0
      : SHIPPING_RULES.FREE_STANDARD_THRESHOLD_INR - netSubtotal;

  const tax = 0; // GST-inclusive pricing
  const totalAmount = Math.max(0, subtotal - couponDiscount + deliveryCharge + tax);

  return {
    totalItems,
    subtotal,
    catalogSavings,
    couponDiscount,
    couponCode,
    deliveryMethod: params.deliveryMethod,
    deliveryCharge,
    freeDeliveryRemaining,
    tax,
    totalAmount,
  };
}

/**
 * Validates Indian delivery address inputs before saving or submitting an order.
 */
export function validateDeliveryAddress(input: DeliveryAddressInput): {
  isValid: boolean;
  errors: AddressValidationErrors;
  sanitized: DeliveryAddressInput;
} {
  const sanitized: DeliveryAddressInput = {
    fullName: input.fullName.trim().slice(0, 100),
    mobile: input.mobile.replace(/\D/g, '').slice(0, 10),
    email: input.email.trim().toLowerCase().slice(0, 254),
    houseFlat: input.houseFlat.trim().slice(0, 120),
    streetArea: input.streetArea.trim().slice(0, 160),
    landmark: input.landmark.trim().slice(0, 120),
    city: input.city.trim().slice(0, 80),
    state: input.state.trim().slice(0, 80),
    pinCode: input.pinCode.replace(/\D/g, '').slice(0, 6),
    deliveryInstructions: input.deliveryInstructions.trim().slice(0, 240),
  };

  const errors: AddressValidationErrors = {};

  if (sanitized.fullName.length < 2) {
    errors.fullName = 'Please enter recipient full name (at least 2 characters).';
  }
  if (!INDIAN_MOBILE_REGEX.test(sanitized.mobile)) {
    errors.mobile = 'Enter a valid 10-digit Indian mobile number starting with 6–9.';
  }
  if (!EMAIL_REGEX.test(sanitized.email)) {
    errors.email = 'Enter a valid email address for order confirmation.';
  }
  if (sanitized.houseFlat.length < 1) {
    errors.houseFlat = 'House / Flat / Building number is required.';
  }
  if (sanitized.streetArea.length < 2) {
    errors.streetArea = 'Street, Road, or Area is required.';
  }
  if (sanitized.city.length < 2) {
    errors.city = 'City name is required.';
  }
  if (sanitized.state.length < 2) {
    errors.state = 'Please select a State / Union Territory.';
  }
  if (!INDIAN_PIN_REGEX.test(sanitized.pinCode)) {
    errors.pinCode = 'Enter a valid 6-digit Indian PIN code (e.g., 400001).';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}

export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}
