# Cloud Firestore Security Rules — 3D Jummo Fashion World

The active rules file is located at `/firestore.rules` and has been statically verified with `@firebase/eslint-plugin-security-rules` (`npx eslint firestore.rules` — 0 errors) and deployed to the provisioned Cloud Firestore database.

---

## Security Architecture (8 Pillars)

1. **Default Deny Everything**: The very first rule under `/databases/{database}/documents` explicitly denies all unmatched paths (`allow read, write: if false`).
2. **Strict Role Verification**:
   - `isBootstrapSuperAdmin()` enforces BOTH `request.auth.token.email_verified == true` and the verified owner email (`merajalam906090@gmail.com`) to defeat email spoofing.
   - `isRegisteredAdmin()` checks `exists(/databases/$(database)/documents/admins/$(request.auth.uid))` with `active == true` and `role in ['admin', 'super_admin']`.
   - `isSuperAdmin()` gates all writes to `/admins/{uid}`.
3. **Strict Schema & Payload Validation**:
   - Every collection validates required keys (`hasAll`) and forbids unknown keys (`hasOnly`) on `create`.
   - Every `update` validates `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])` to block shadow updates and field injection.
   - Every `string` and `list` field enforces explicit `.size()` bounds.
4. **Pricing & Domain Invariants**:
   - `originalPrice > 0`, `sellingPrice > 0`, `sellingPrice <= originalPrice`.
   - `salePrice == 0 || (salePrice > 0 && salePrice < sellingPrice)`.
   - `discountPercentage >= 0 && discountPercentage <= 95`.
5. **Server Timestamps**:
   - `create` enforces `createdAt == request.time && updatedAt == request.time`.
   - `update` enforces immutable `createdAt == resource.data.createdAt` and fresh `updatedAt == request.time`.
6. **PII Isolation & Role Immutability (`/users/{uid}` & Subcollections)**:
   - Only the document owner (`request.auth.uid == uid`) or an Admin can `get` a user profile; only Admins can `list` `/users`.
   - Self-registration forces `role == 'customer'`; owners cannot alter `role` or `uid` on update.
   - `/users/{uid}/cart`, `/users/{uid}/savedForLater`, and `/users/{uid}/addresses` are strictly owner-only; Indian 10-digit mobile (`^[6-9][0-9]{9}$`) and 6-digit PIN (`^[1-9][0-9]{5}$`) formats are enforced server-side.
7. **Server-Enforced Checkout & Order Integrity (`/orders/{orderId}` & `/coupons/{couponCode}`)**:
   - Customers can only create orders with `customerUid == request.auth.uid`, `orderStatus == 'Pending'`, and `paymentStatus == 'COD Pending'` (for COD) or `'Pending'` (for Online — never `'Paid'`, `'Payment Verified'`, or `'Payment Captured'`).
   - Rules independently verify `totalAmount == subtotal - discount + deliveryCharge + tax`, exact shipping thresholds (`₹0` standard ≥ ₹999 net else `₹99`; express `₹199`), live coupon eligibility (`active`, date window, `minOrderValue`, `usageLimit`, `maxDiscount`), and published product pricing.
   - Customer orders are immutable after creation; customers can read only their own orders (`customerUid == request.auth.uid`), while Admins can update only `orderStatus`, `paymentStatus`, `razorpayOrderId`, `latestPaymentId`, and `updatedAt`.
8. **Zero-Trust Payment & Refund Isolation (`/payments/{paymentId}` & `/refunds/{refundId}`)**:
   - Customers can `read` ONLY their own payment and refund records (`resource.data.customerUid == request.auth.uid`), and are **strictly blocked from creating, updating, or deleting** documents in `/payments` or `/refunds` directly from the browser.
   - Only verified Admins (or authenticated server workflows) can write `/payments` and `/refunds`, and all payloads enforce strict `hasAll` / `hasOnly` allowlists that reject raw card numbers, CVV, UPI PINs, or gateway secrets.
   - `/payments` and `/refunds` documents cannot be deleted by regular admins (`isSuperAdmin()` only for emergency maintenance), preserving an intact financial audit trail.

---

## Collection Access Matrix

| Collection | Public / Guest | Signed-In Customer | Verified Admin | Super Admin |
| :--- | :--- | :--- | :--- | :--- |
| `/products/{productId}` | Read `published` only | Read `published` only | Full CRUD + Read Draft/Archived | Full CRUD |
| `/categories/{categoryId}` | Read `published` only | Read `published` only | Full CRUD | Full CRUD |
| `/users/{uid}` | Denied | Read/Create/Update own doc (`role` locked to `customer`) | Read all user docs | Read/Delete |
| `/users/{uid}/cart/{cartItemId}` | Denied | Full CRUD (owner only) | Denied | Denied |
| `/users/{uid}/savedForLater/{itemId}` | Denied | Full CRUD (owner only) | Denied | Denied |
| `/users/{uid}/addresses/{addressId}` | Denied | Full CRUD (owner only) | Denied | Denied |
| `/coupons/{couponCode}` | Denied | Exact-code `get` only (no listing) | Full CRUD | Full CRUD |
| `/orders/{orderId}` | Denied | Create own (`Pending` / `COD Pending` locked) + Read own only (immutable) | Read all + Update status/Razorpay link fields only | Read + Status Update + Delete |
| `/payments/{paymentId}` | Denied | Read own only (`customerUid == uid`); all writes denied | Read all + Create/Update validated records (no delete) | Full CRUD |
| `/refunds/{refundId}` | Denied | Read own only (`customerUid == uid`); all writes denied | Read all + Create/Update validated records (no delete) | Full CRUD |
| `/admins/{uid}` | Denied | Get own doc only (for role check) | Get own doc only | Full CRUD |
| `/showroom/{sectionId}` | Read `active == true` | Read `active == true` | Full CRUD | Full CRUD |
| `/settings/{settingId}` | `get` only | `get` only | Read/Create/Update | Full CRUD |

---

## Production Review Recommendation

Before opening the store to broad public production traffic, review `/firestore.rules` and `/security_spec.md` with your security team, enable Firebase App Check, and test rules against the Firebase Emulator Suite (`firestore.rules.test.ts`).
