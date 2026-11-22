# Security Specification — 3D Jummo Fashion World (Phases 5, 6 & 7)

## 1. Data Invariants
1. **Default Deny**: Any unmatched path under `/databases/{database}/documents` is explicitly denied (`allow read, write: if false`).
2. **Product & Category Integrity (`/products/{productId}`, `/categories/{categoryId}`)**:
   - `sellingPrice > 0`, `originalPrice > 0`, `sellingPrice <= originalPrice`, `salePrice == 0 || (salePrice > 0 && salePrice < sellingPrice)`.
   - Customers cannot modify products or manipulate product stock quantities (strictly Admin-only writes).
3. **PII Isolation & Role Immutability (`/users/{uid}`)**:
   - Users can ONLY read or update their own `users/{uid}` document. `role` is locked to `'customer'` on create and immutable on update.
4. **Customer Cart, Saved for Later & Address Privacy (`/users/{uid}/cart`, `/users/{uid}/savedForLater`, `/users/{uid}/addresses`)**:
   - Strictly `isOwner(uid)` for all reads and writes. No customer can read, list, or mutate another customer's cart or saved addresses.
   - Cart item quantities must be positive integers (`1..50`).
   - Saved addresses enforce Indian 10-digit mobile (`^[6-9][0-9]{9}$`) and Indian 6-digit PIN (`^[1-9][0-9]{5}$`).
5. **Coupon Validation (`/coupons/{couponCode}`)**:
   - Customers cannot `list` or scrape all coupons; only exact-code `get` is permitted when signed in.
   - Only verified Admins can create, update, or delete coupons.
   - At order creation, `firestore.rules` independently validates `coupons/{couponCode}` (`active`, date window, `minOrderValue`, `usageLimit`, and maximum discount cap).
6. **Order Creation & Immutability (`/orders/{orderId}`)**:
   - Customers can ONLY `get` and `list` their own orders (`resource.data.customerUid == request.auth.uid`).
   - On `create`:
     - `customerUid == request.auth.uid` (no impersonation).
     - `orderStatus == 'Pending'` (cannot skip to `Confirmed` or `Delivered`).
     - `paymentStatus == 'COD Pending'` (for `cod`) or `'Pending'` (for `online`) — customers can NEVER create an order with `paymentStatus == 'Paid'` or `'Payment Verified'`.
     - `razorpayOrderId` and `latestPaymentId` MUST NOT be injected by customers on create.
     - `currency == 'INR'`.
     - Delivery charge strictly matches store shipping rules (`express == 199`, `standard == 0` when net >= 999 else `99`).
     - `totalAmount == subtotal - discount + deliveryCharge + tax` and `totalAmount > 0`.
     - Referenced product in `items[0]` must exist in `/products/{id}` and have `status == 'published'`.
     - `createdAt == request.time && updatedAt == request.time`.
   - On `update`: Strictly `isAdmin()` only, restricted via `affectedKeys().hasOnly(['orderStatus', 'paymentStatus', 'razorpayOrderId', 'latestPaymentId', 'updatedAt'])`. Customers can NEVER alter order totals, payment status, or order status.
   - On `delete`: Strictly `isSuperAdmin()`.
7. **Server-Verified Payments (`/payments/{paymentId}`) — Phase 7**:
   - Customers can ONLY `get` and `list` their own payment records (`resource.data.customerUid == request.auth.uid`).
   - Customers can NEVER `create`, `update`, or `delete` payment records directly in Firestore — preventing client-side payment forgery.
   - Strict `hasOnly(...)` allowlist guarantees card numbers, CVV, UPI PIN, and Razorpay secrets can NEVER be stored in Firestore.
   - `amount > 0`, `currency == 'INR'`, `signatureVerified is bool`, strict Phase 7 `paymentStatus` enum, immutable `paymentId`/`orderId`/`customerUid`/`amount`/`currency`.
   - Deletes restricted strictly to `isSuperAdmin()`.
8. **Admin-Only Refunds (`/refunds/{refundId}`) — Phase 7**:
   - Customers can ONLY `get` and `list` their own refund records (`resource.data.customerUid == request.auth.uid`).
   - Customers can NEVER `create`, `update`, or `delete` refunds.
   - Only verified Admins (`isAdmin()`) can create/update refund records; `initiatedByUid == request.auth.uid`, `amount > 0`, `type in ['full', 'partial']`, `currency == 'INR'`.
   - Deletes restricted strictly to `isSuperAdmin()`.

9. **5-Role Granular RBAC (`/admins/{uid}`) — Phase 8**:
   - Roles supported: `super_admin`, `admin`, `manager`, `staff`, `accountant`.
   - Only `super_admin` can create, update, or delete `/admins/{uid}` records or change staff permissions.
   - `accountant` has read-only access to `orders`, `payments`, `refunds`, and `activityLogs` and is strictly blocked from mutating `products`, `categories`, `orders`, `coupons`, `admins`, or `settings`.
   - `staff` and `manager` cannot initiate refunds (`/refunds`), modify staff roles (`/admins`), or alter store settings (`/settings`).
10. **Immutable Inventory History (`/inventoryHistory/{movementId}`) — Phase 8**:
    - Append-only stock movement records (`actorUid == request.auth.uid`, `newStock >= 0`, `previousStock >= 0`, `newStock == previousStock + delta`, `createdAt == request.time`).
    - `update` and `delete` are ALWAYS denied (`if false`) so stock movement history cannot be forged or erased.
11. **Immutable Activity Logs (`/activityLogs/{logId}`) — Phase 8**:
    - Append-only audit logs (`actorUid == request.auth.uid`, `createdAt == request.time`).
    - `update` and `delete` are ALWAYS denied (`if false`) for every user including admins.
12. **Real-Event Admin Notifications (`/adminNotifications/{notificationId}`) — Phase 8**:
    - Readable only by active staff roles; staff may only append read acknowledgments (`readBy`, `updatedAt`); deletion restricted to `super_admin`.

## 2. Adversarial Test Matrix ("The Dirty Dozen" + Phases 6, 7 & 8 Attacks)
1. **Unauthenticated Product Write**: Anonymous client attempts `create` on `/products/prod-hack` -> **DENY**.
2. **Customer Stock Manipulation**: Signed-in `customer` attempts `update` on `/products/prod-1` to change variant `stockQuantity` -> **DENY**.
3. **Self-Elevation to Admin (`admins/{uid}` / `users/{uid}`)**: Signed-in `customer` or `staff` attempts to set `role: 'super_admin'` -> **DENY**.
4. **Cross-Customer Cart Access**: Customer A attempts `get`, `list`, or `write` on `/users/{customerB}/cart/{itemId}` -> **DENY**.
5. **Cross-Customer Order Privacy Breach**: Customer A attempts `get` on `/orders/{orderB}` or unfiltered `list` on `/orders` -> **DENY**.
6. **Fake Paid Payment Attack**: Customer creates `/orders/FW-FAKE` with `paymentStatus: 'Paid'` / `'Payment Verified'` or `orderStatus: 'Confirmed'` -> **DENY**.
7. **Order Total Tampering**: Customer submits `/orders/FW-CHEAP` where `subtotal: 3000`, `discount: 0`, `deliveryCharge: 0`, `totalAmount: 1` -> **DENY**.
8. **Fake Coupon Discount Injection**: Customer submits `couponCode: ''` with `discount: 500`, or applies an inactive/expired/nonexistent coupon code -> **DENY**.
9. **Unauthorized Order Modification**: Customer attempts `update` on their own `/orders/{orderId}` to change `orderStatus`, `paymentStatus`, or `totalAmount` -> **DENY**.
10. **Invalid Indian Address Payload**: Customer submits address with 5-digit PIN or invalid mobile starting with `1` -> **DENY**.
11. **Shadow Field / Timestamp Forgery**: Customer injects unknown key or backdated `createdAt` -> **DENY**.
12. **Unverified Admin Email Spoofing**: Account with `email == 'merajalam906090@gmail.com'` and `email_verified == false` attempts admin write -> **DENY**.
13. **Client-Side Payment Forgery (`/payments/{paymentId}`)**: Customer attempts direct `create` or `update` on `/payments/pay-fake` with `signatureVerified: true` -> **DENY**.
14. **Cross-Customer Payment / Refund Read**: Customer A attempts `get` on `/payments/{payB}` or `/refunds/{refB}` -> **DENY**.
15. **Sensitive Card/CVV/UPI Field Injection**: Any write to `/payments/{paymentId}` containing `cardNumber`, `cvv`, `upiPin`, or `secret` -> **DENY**.
16. **Unauthorized Customer Refund Request**: Non-admin customer or `staff`/`manager`/`accountant` attempts `create` on `/refunds/ref-1` -> **DENY**.
17. **Audit Log Tampering / Deletion**: Any user (even `super_admin`) attempts `update` or `delete` on `/activityLogs/{logId}` -> **DENY**.
18. **Inventory History Tampering / Negative Stock**: Any user attempts `update`/`delete` on `/inventoryHistory/{id}` or writes `newStock < 0` -> **DENY**.
19. **Accountant Write Escalation**: Signed-in `accountant` attempts `update` on `/products/{id}` or `/orders/{id}` -> **DENY**.
20. **Staff Privilege Escalation**: Signed-in `manager` or `admin` attempts `create`/`update` on `/admins/{uid}` -> **DENY**.
21. **Customer Account Status Tampering**: Signed-in `customer` attempts to overwrite their own `accountStatus` or `supportNotes` on `/users/{uid}` -> **DENY**.
