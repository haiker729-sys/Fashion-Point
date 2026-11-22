/**
 * Phase 6 Commerce Logic & Invariant Verification Suite
 * Exercises cart variant deduplication/separation, Indian mobile & PIN validation,
 * coupon eligibility (percentage/fixed/minOrder/maxDiscount/expiry/inactive/usageLimit),
 * trusted INR totals, shipping thresholds, and deterministic order idempotency keys.
 */
import assert from 'node:assert/strict';
import {
  buildCartItemId,
  buildOrderIdFromIdempotencyKey,
  calculateCheckoutTotals,
  findMatchingVariant,
  getTrustedUnitPrice,
  validateCouponRecord,
  validateDeliveryAddress,
} from './src/utils/commerceHelpers';
import type { CouponDoc, DeliveryAddressInput } from './src/types/commerce';

const nowMs = Date.parse('2026-11-22T12:00:00.000Z');

const samplePctCoupon: CouponDoc = {
  code: 'JUMMO10',
  type: 'percentage',
  value: 10,
  minOrderValue: 999,
  maxDiscount: 500,
  startDate: '2026-01-01T00:00:00.000Z',
  expiryDate: '2027-01-01T00:00:00.000Z',
  usageLimit: 100,
  usedCount: 5,
  active: true,
  description: '10% off',
};

const sampleFixedCoupon: CouponDoc = {
  ...samplePctCoupon,
  code: 'FESTIVE500',
  type: 'fixed',
  value: 500,
  minOrderValue: 2999,
  maxDiscount: 500,
};

const validAddress: DeliveryAddressInput = {
  fullName: 'Aarav Sharma',
  mobile: '9876543210',
  email: 'aarav@example.com',
  houseFlat: 'Flat 402, Skyview',
  streetArea: 'Bandra West',
  landmark: 'Near Galleria',
  city: 'Mumbai',
  state: 'Maharashtra',
  pinCode: '400050',
  deliveryInstructions: 'Call on arrival',
};

const tests: Array<{ name: string; run: () => void }> = [
  {
    name: '1. Deterministic Cart Item IDs merge identical variants & separate distinct size/colour',
    run: () => {
      const a1 = buildCartItemId('prod-1', 'L', 'Midnight Navy');
      const a2 = buildCartItemId('prod-1', ' l ', 'midnight  navy');
      const diffSize = buildCartItemId('prod-1', 'XL', 'Midnight Navy');
      const diffColour = buildCartItemId('prod-1', 'L', 'Ivory White');
      assert.equal(a1, a2);
      assert.notEqual(a1, diffSize);
      assert.notEqual(a1, diffColour);
      assert.match(a1, /^[A-Za-z0-9_-]{1,128}$/);
    },
  },
  {
    name: '2. Deterministic Order ID from idempotency key satisfies Firestore isValidId()',
    run: () => {
      const o1 = buildOrderIdFromIdempotencyKey('K9X8M2P1Q7');
      const o2 = buildOrderIdFromIdempotencyKey('K9X8M2P1Q7');
      assert.equal(o1, o2);
      assert.equal(o1, 'FW-K9X8M2P1Q7');
      assert.match(o1, /^[A-Za-z0-9_-]{1,128}$/);
    },
  },
  {
    name: '3. Trusted Unit Price selects valid salePrice (< sellingPrice) or falls back to sellingPrice',
    run: () => {
      assert.equal(getTrustedUnitPrice({ sellingPrice: 1999, salePrice: 1499 }), 1499);
      assert.equal(getTrustedUnitPrice({ sellingPrice: 1999, salePrice: 0 }), 1999);
      assert.equal(getTrustedUnitPrice({ sellingPrice: 1999, salePrice: 2500 }), 1999);
    },
  },
  {
    name: '4. Variant matcher resolves case-insensitive (size, colour) accurately',
    run: () => {
      const variants = [
        { id: 'v1', colour: 'Midnight Navy', colourHex: '#1F1D2B', size: 'L', sku: 'SKU-L', stockQuantity: 7 },
        { id: 'v2', colour: 'Midnight Navy', colourHex: '#1F1D2B', size: 'XL', sku: 'SKU-XL', stockQuantity: 0 },
      ];
      assert.equal(findMatchingVariant(variants, 'l', 'midnight navy')?.sku, 'SKU-L');
      assert.equal(findMatchingVariant(variants, 'XL', 'Midnight Navy')?.stockQuantity, 0);
      assert.equal(findMatchingVariant(variants, 'S', 'Midnight Navy'), undefined);
    },
  },
  {
    name: '5. Indian delivery address validator accepts valid Indian mobile/PIN and rejects invalid inputs',
    run: () => {
      const ok = validateDeliveryAddress(validAddress);
      assert.equal(ok.isValid, true);
      assert.equal(ok.sanitized.mobile, '9876543210');
      assert.equal(ok.sanitized.pinCode, '400050');

      const bad = validateDeliveryAddress({
        ...validAddress,
        mobile: '1234567890', // cannot start with 1
        pinCode: '012345', // cannot start with 0
        email: 'not-an-email',
      });
      assert.equal(bad.isValid, false);
      assert.ok(bad.errors.mobile);
      assert.ok(bad.errors.pinCode);
      assert.ok(bad.errors.email);
    },
  },
  {
    name: '6. Coupon validator enforces active, date window, minOrderValue, maxDiscount, and usageLimit',
    run: () => {
      // Valid percentage with maxDiscount cap (10% of 8000 = 800 -> capped at 500)
      const capped = validateCouponRecord(samplePctCoupon, 8000, nowMs);
      assert.equal(capped.valid, true);
      assert.equal(capped.discount, 500);

      // Below minOrderValue
      const tooLow = validateCouponRecord(samplePctCoupon, 799, nowMs);
      assert.equal(tooLow.valid, false);

      // Fixed coupon valid
      const fixedOk = validateCouponRecord(sampleFixedCoupon, 3500, nowMs);
      assert.equal(fixedOk.valid, true);
      assert.equal(fixedOk.discount, 500);

      // Expired coupon
      const expired = validateCouponRecord(
        { ...samplePctCoupon, expiryDate: '2026-01-01T00:00:00.000Z' },
        2000,
        nowMs
      );
      assert.equal(expired.valid, false);

      // Inactive coupon
      const inactive = validateCouponRecord({ ...samplePctCoupon, active: false }, 2000, nowMs);
      assert.equal(inactive.valid, false);

      // Exhausted usage limit
      const exhausted = validateCouponRecord(
        { ...samplePctCoupon, usageLimit: 10, usedCount: 10 },
        2000,
        nowMs
      );
      assert.equal(exhausted.valid, false);
    },
  },
  {
    name: '7. INR Checkout Totals enforce exact shipping rules and Firestore totalAmount equation',
    run: () => {
      // Standard below ₹999 -> ₹99 delivery
      const lowStd = calculateCheckoutTotals({
        items: [{ unitPrice: 699, originalPrice: 999, quantity: 1 }],
        deliveryMethod: 'standard',
      });
      assert.equal(lowStd.subtotal, 699);
      assert.equal(lowStd.catalogSavings, 300);
      assert.equal(lowStd.deliveryCharge, 99);
      assert.equal(lowStd.freeDeliveryRemaining, 300);
      assert.equal(lowStd.tax, 0);
      assert.equal(lowStd.totalAmount, 798);

      // Standard >= ₹999 after coupon -> Free delivery
      const highStd = calculateCheckoutTotals({
        items: [{ unitPrice: 1500, originalPrice: 2000, quantity: 2 }],
        deliveryMethod: 'standard',
        coupon: samplePctCoupon,
        nowMs,
      });
      assert.equal(highStd.subtotal, 3000);
      assert.equal(highStd.couponDiscount, 300);
      assert.equal(highStd.deliveryCharge, 0);
      assert.equal(highStd.totalAmount, 2700);

      // Express delivery -> ₹199 regardless of subtotal
      const expr = calculateCheckoutTotals({
        items: [{ unitPrice: 2500, originalPrice: 2500, quantity: 1 }],
        deliveryMethod: 'express',
        coupon: samplePctCoupon,
        nowMs,
      });
      assert.equal(expr.subtotal, 2500);
      assert.equal(expr.couponDiscount, 250);
      assert.equal(expr.deliveryCharge, 199);
      assert.equal(expr.totalAmount, 2449);
      assert.equal(expr.totalAmount, expr.subtotal - expr.couponDiscount + expr.deliveryCharge + expr.tax);
    },
  },
];

let passed = 0;
for (const t of tests) {
  t.run();
  passed += 1;
  console.log(`PASS: ${t.name}`);
}
console.log(`\nAll ${passed}/${tests.length} Phase 6 commerce verification tests passed.`);
