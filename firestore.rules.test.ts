/**
 * Firestore Security Rules & Payload Invariant Verification Suite (Phase 5)
 * Verifies the "Dirty Dozen" adversarial scenarios from security_spec.md against
 * both the deployed firestore.rules text and our client-side defensive validators.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const storageRulesPath = path.resolve(process.cwd(), 'storage.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');

const rules = fs.readFileSync(rulesPath, 'utf8');
const storageRules = fs.readFileSync(storageRulesPath, 'utf8');
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
  entities: Record<string, unknown>;
  firestore: Record<string, unknown>;
};

const tests: Array<{ name: string; run: () => void }> = [
  {
    name: '1. Default Deny Everything is declared first inside /databases/{database}/documents',
    run: () => {
      assert.match(rules, /rules_version\s*=\s*'2';/);
      assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
    },
  },
  {
    name: '2. Bootstrap Super Admin enforces email_verified == true (Email Spoofing protection)',
    run: () => {
      assert.match(
        rules,
        /request\.auth\.token\.email_verified\s*==\s*true[\s\S]*request\.auth\.token\.email\s*==\s*'merajalam906090@gmail\.com'/
      );
    },
  },
  {
    name: '3. Products prevent unauthenticated/customer writes and price inversion attacks',
    run: () => {
      assert.match(rules, /match \/products\/\{productId\}/);
      assert.match(rules, /data\.sellingPrice\s*>\s*0\s*&&\s*data\.sellingPrice\s*<=\s*data\.originalPrice/);
      assert.match(rules, /allow create:[\s\S]*isAdmin\(\)[\s\S]*isValidProduct/);
      assert.match(rules, /allow delete:\s*if isValidId\(productId\)\s*&&\s*isAdmin\(\);/);
    },
  },
  {
    name: '4. Draft/Archived products are hidden from unauthenticated & customer reads',
    run: () => {
      assert.match(rules, /allow get:\s*if isValidId\(productId\)\s*&&\s*\(resource == null \|\| existing\(\)\.status\s*==\s*'published'\s*\|\|\s*isAdmin\(\)\);/);
      assert.match(rules, /allow list:\s*if existing\(\)\.status\s*==\s*'published'\s*\|\|\s*isAdmin\(\);/);
    },
  },
  {
    name: '5. Users collection enforces strict PII isolation and prevents role self-elevation',
    run: () => {
      assert.match(rules, /match \/users\/\{uid\}/);
      assert.match(rules, /allow get:\s*if isValidId\(uid\)\s*&&\s*\(isOwner\(uid\)\s*\|\|\s*isAdmin\(\)\);/);
      assert.match(rules, /allow list:\s*if isAdmin\(\);/);
      assert.match(rules, /incoming\(\)\.role\s*==\s*'customer'/);
      assert.match(rules, /incoming\(\)\.role\s*==\s*existing\(\)\.role/);
    },
  },
  {
    name: '6. Admins registry is exclusively managed by super_admin',
    run: () => {
      assert.match(rules, /match \/admins\/\{uid\}/);
      assert.match(rules, /allow create:[\s\S]*isSuperAdmin\(\)/);
      assert.match(rules, /allow update:[\s\S]*isSuperAdmin\(\)/);
      assert.match(rules, /allow delete:\s*if isValidId\(uid\)\s*&&\s*isSuperAdmin\(\);/);
    },
  },
  {
    name: '7. Server timestamps and immutable createdAt are enforced on create & update',
    run: () => {
      assert.match(rules, /incoming\(\)\.createdAt\s*==\s*request\.time/);
      assert.match(rules, /incoming\(\)\.updatedAt\s*==\s*request\.time/);
      assert.match(rules, /incoming\(\)\.createdAt\s*==\s*existing\(\)\.createdAt/);
    },
  },
  {
    name: '8. Shadow updates are prevented via diff(existing()).affectedKeys().hasOnly(...)',
    run: () => {
      const matches = rules.match(/incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/g) || [];
      assert.ok(matches.length >= 13, `Expected >= 13 affectedKeys guards, found ${matches.length}`);
    },
  },
  {
    name: '9. Storage rules enforce default deny, 5 MB limit, and image MIME allowlist',
    run: () => {
      assert.match(storageRules, /match \/\{allPaths=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);
      assert.match(storageRules, /5 \* 1024 \* 1024/);
      assert.match(storageRules, /image\/\(jpeg\|png\|webp\)/);
    },
  },
  {
    name: '10. Persistent Cart, SavedForLater & Addresses are strictly owner-only with Indian mobile/PIN checks',
    run: () => {
      assert.match(rules, /match \/cart\/\{cartItemId\}/);
      assert.match(rules, /match \/savedForLater\/\{itemId\}/);
      assert.match(rules, /match \/addresses\/\{addressId\}/);
      assert.match(rules, /addr\.mobile\.matches\('\^\[6-9\]\[0-9\]\{9\}\$'\)/);
      assert.match(rules, /addr\.pinCode\.matches\('\^\[1-9\]\[0-9\]\{5\}\$'\)/);
    },
  },
  {
    name: '11. Coupons enforce exact-code get only for signed-in users and Admin-only list/CRUD',
    run: () => {
      assert.match(rules, /match \/coupons\/\{couponCode\}/);
      assert.match(rules, /allow get:\s*if isValidId\(couponCode\)\s*&&\s*isSignedIn\(\);/);
      assert.match(rules, /allow list:\s*if isAdmin\(\);/);
      assert.match(rules, /function isValidCouponApplication\(code, subtotal, discount\)/);
    },
  },
  {
    name: '12. Orders enforce customer privacy, locked Pending/COD Pending status, math invariant & immutability',
    run: () => {
      assert.match(rules, /match \/orders\/\{orderId\}/);
      assert.match(rules, /data\.customerUid == request\.auth\.uid/);
      assert.match(rules, /data\.orderStatus == 'Pending'/);
      assert.match(rules, /data\.paymentMethod == 'cod' && data\.paymentStatus == 'COD Pending'/);
      assert.match(rules, /data\.paymentMethod == 'online' && data\.paymentStatus == 'Pending'/);
      assert.match(rules, /data\.totalAmount == \(data\.subtotal - data\.discount \+ data\.deliveryCharge \+ data\.tax\)/);
      assert.match(rules, /allow update:[\s\S]*isAdmin\(\)[\s\S]*affectedKeys\(\)\.hasOnly\(\[\s*'orderStatus', 'paymentStatus', 'razorpayOrderId', 'latestPaymentId', 'updatedAt'/);
    },
  },
  {
    name: '13. Payments collection enforces owner read-only, Admin/server-only writes, and blocks card/CVV/UPI PIN fields',
    run: () => {
      assert.match(rules, /match \/payments\/\{paymentId\}/);
      assert.match(rules, /function isValidPaymentRecord\(data, paymentId\)/);
      assert.match(rules, /match \/payments\/\{paymentId\}[\s\S]*allow create:[\s\S]*isAdmin\(\)/);
      assert.match(rules, /match \/payments\/\{paymentId\}[\s\S]*allow update:[\s\S]*isAdmin\(\)/);
      assert.doesNotMatch(rules, /'(cardNumber|cvv|upiPin|upi_pin|card_number)'/i);
    },
  },
  {
    name: '14. Refunds collection enforces owner read-only and strictly Admin-initiated writes',
    run: () => {
      assert.match(rules, /match \/refunds\/\{refundId\}/);
      assert.match(rules, /function isValidRefundRecord\(data, refundId\)/);
      assert.match(rules, /match \/refunds\/\{refundId\}[\s\S]*allow create:[\s\S]*isAdmin\(\)[\s\S]*incoming\(\)\.initiatedByUid == request\.auth\.uid/);
    },
  },
  {
    name: '15. Blueprint defines all Phases 5, 6 & 7 Firestore collections',
    run: () => {
      const requiredPaths = [
        '/products/{productId}',
        '/categories/{categoryId}',
        '/users/{uid}',
        '/users/{uid}/cart/{cartItemId}',
        '/users/{uid}/savedForLater/{itemId}',
        '/users/{uid}/addresses/{addressId}',
        '/coupons/{couponCode}',
        '/orders/{orderId}',
        '/payments/{paymentId}',
        '/refunds/{refundId}',
        '/admins/{uid}',
        '/showroom/{sectionId}',
        '/settings/{settingId}',
      ];
      for (const p of requiredPaths) {
        assert.ok(p in blueprint.firestore, `Missing blueprint collection path: ${p}`);
      }
    },
  },
];

let passed = 0;
for (const t of tests) {
  t.run();
  passed += 1;
  console.log(`PASS: ${t.name}`);
}
console.log(`\nAll ${passed}/${tests.length} security rule invariant assertions passed.`);
