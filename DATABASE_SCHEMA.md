# Cloud Firestore Database Schema — 3D Jummo Fashion World (Phases 5, 6 & 7)

All collections below are formally described in `/firebase-blueprint.json` and strictly enforced by `/firestore.rules`.

---

## 1. `products/{productId}`
Stores clothing catalog records, INR pricing, Colour × Size variants, Firebase Storage image URLs (never raw base64), and Phase 3 3D Showroom rack placement.

| Field | Type | Constraints / Notes |
| :--- | :--- | :--- |
| `id` | `string` | Must match `{productId}` |
| `name` | `string` | 2–140 chars |
| `slug` | `string` | URL-safe unique slug (1–160 chars) |
| `sku` | `string` | Uppercase unique SKU (2–64 chars) |
| `description` | `string` | 1–4000 chars |
| `categoryId` | `string` | References `categories/{categoryId}` |
| `subcategoryId` | `string` | References nested subcategory ID |
| `brand` | `string` | 1–80 chars |
| `originalPrice` | `number` | INR > 0 |
| `sellingPrice` | `number` | INR > 0 and `<= originalPrice` |
| `discountPercentage` | `number` | 0–95 |
| `salePrice` | `number` | `0` when unused, or `> 0 && < sellingPrice` |
| `taxInfoPlaceholder` | `string` | Max 160 chars |
| `images` | `array<map>` | 1–12 entries (`id`, `url`, optional `storagePath`, `viewType`, `isMain`, `order`, `alt`, `sizeKb`, `compressed`) |
| `variants` | `array<map>` | 1–80 entries (`id`, `colour`, `colourHex`, `size`, `sku`, `stockQuantity`) |
| `tags` | `array<string>` | Max 25 items |
| `fabric` / `weight` | `string` | Fabric composition and garment weight |
| `featured`, `bestSeller`, `newArrival`, `trending`, `discountCollection` | `boolean` | Merchandising flags |
| `status` | `string` | `'published' \| 'draft' \| 'archived'` |
| `lowStockThreshold` | `number` | 1–500 |
| `rating` / `reviewCount` | `number` | Rating `0–5`, review count `>= 0` |
| `showroomPlacement` | `map` | `{ enabled, productId, modelUrlPlaceholder, modelArchetype, has3DModel, showroomSection, rackId, displaySlot, position[3], rotation[3], scale }` |
| `createdAt` / `updatedAt` | `timestamp` | Enforced via `serverTimestamp()` |

---

## 2. `categories/{categoryId}`
Stores main fashion departments and nested subcategories.

- Fields: `id`, `name`, `slug`, `departmentKey` (`Men | Women | Kids | Traditional Wear | Collections | Custom`), `description`, `image`, `isCustom`, `status` (`published | draft | archived`), `subcategories[]`, `createdAt`, `updatedAt`.

---

## 3. `users/{uid}` & Private Customer Subcollections (Phase 6)
Stores private customer profile information with strict owner-only read/write isolation.

- Profile fields (`users/{uid}`): `uid`, `displayName`, `email`, `photoURL`, `phone`, `role` (locked to `'customer'` on self-create and immutable by owner), `createdAt`, `updatedAt`.
- **3a. `users/{uid}/cart/{cartItemId}`** — Persistent customer shopping bag.
  - Deterministic ID `${productId}__${sizeSlug}__${colourSlug}` merges identical variants and separates distinct sizes/colours.
  - Fields: `id`, `productId`, `productName`, `productImage`, `sku`, `selectedSize`, `selectedColour`, `quantity` (`1–50`), `priceSnapshot`, `addedAt`, `updatedAt`.
- **3b. `users/{uid}/savedForLater/{itemId}`** — Saved-for-later items moved from the cart (same schema as `CartItem`).
- **3c. `users/{uid}/addresses/{addressId}`** — Saved Indian delivery addresses.
  - Fields: `id`, `fullName`, `mobile` (`^[6-9][0-9]{9}$`), `email`, `houseFlat`, `streetArea`, `landmark`, `city`, `state`, `pinCode` (`^[1-9][0-9]{5}$`), `deliveryInstructions`, `isDefault`, `createdAt`, `updatedAt`.

---

## 4. `coupons/{couponCode}` (Phase 6)
Discount coupon registry with exact-code customer lookup and Admin CRUD.

- Fields: `code` (must match `{couponCode}`), `type` (`'percentage' | 'fixed'`), `value`, `minOrderValue`, `maxDiscount`, `startDate` (`timestamp`), `expiryDate` (`timestamp`), `usageLimit`, `usedCount`, `active` (`boolean`), `description`, `createdAt`, `updatedAt`.

---

## 5. `orders/{orderId}` (Phases 6 & 7)
Immutable customer orders created atomically via `runTransaction()` and verified server-side by `firestore.rules`.

- Fields: `orderId`, `customerUid`, `customerName`, `customerEmail`, `customerPhone`, `items[]` (`productId`, `productName`, `productImage`, `sku`, `selectedSize`, `selectedColour`, `quantity`, `unitPrice`, `lineTotal`), `deliveryAddress`, `deliveryMethod` (`standard | express`), `subtotal`, `catalogSavings`, `discount`, `couponCode`, `deliveryCharge` (`0 | 99 | 199`), `tax` (`0`, GST-inclusive), `totalAmount`, `currency` (`INR`), `paymentMethod` (`cod | online`), `paymentStatus` (`COD Pending | Pending | Payment Pending | Payment Initiated | Authorized | Paid | Payment Captured | Payment Verified | Failed | Payment Failed | Cancelled | Partially Refunded | Refunded`), `orderStatus` (`Pending | Confirmed | Processing | Packed | Shipped | Out for Delivery | Delivered | Cancelled`), `idempotencyKey`, optional `razorpayOrderId`, optional `latestPaymentId`, `createdAt`, `updatedAt`.

---

## 6. `payments/{paymentId}` (Phase 7)
Server-verified Razorpay payment transaction records. Customers can read only their own payment documents (`customerUid == request.auth.uid`); client-side direct writes are denied (only verified Admins or server-side verified workflows can write). Never stores card numbers, CVV, or UPI PIN.

| Field | Type | Constraints / Notes |
| :--- | :--- | :--- |
| `paymentId` | `string` | Must match `{paymentId}` (Razorpay payment ID or internal ledger ID) |
| `orderId` | `string` | References `orders/{orderId}` |
| `customerUid` | `string` | Owner UID for strict read isolation |
| `razorpayOrderId` | `string` | Razorpay `order_*` identifier |
| `razorpayPaymentId` | `string` | Razorpay `pay_*` identifier (empty until checkout/webhook) |
| `amount` | `number` | Authoritative INR amount `> 0` |
| `amountPaise` | `number` | Integer paise `amount * 100` |
| `currency` | `string` | `'INR'` |
| `method` | `string` | `'upi' \| 'card' \| 'netbanking' \| 'wallet' \| 'emi' \| 'paylater' \| 'cod' \| 'unknown'` |
| `status` | `string` | `'Payment Pending' \| 'Payment Initiated' \| 'Authorized' \| 'Payment Captured' \| 'Payment Verified' \| 'Payment Failed' \| 'Cancelled' \| 'Partially Refunded' \| 'Refunded'` |
| `verified` | `boolean` | `true` ONLY after server HMAC-SHA256 signature verification |
| `verificationSource` | `string` | `'none' \| 'checkout_hmac' \| 'webhook_hmac' \| 'reconciled'` |
| `gatewayMode` | `string` | `'test' \| 'live'` |
| `failureReason` | `string` | Safe non-sensitive gateway failure detail (empty on success) |
| `webhookEventIds` | `array<string>` | Deduplicated processed Razorpay webhook event IDs |
| `createdAt` / `updatedAt` | `timestamp` | Enforced via `serverTimestamp()` |

---

## 7. `refunds/{refundId}` (Phase 7)
Admin-initiated Razorpay full and partial refund records linked to verified payments and orders. Customers can read only their own refund records; all client writes are restricted to verified Admins.

| Field | Type | Constraints / Notes |
| :--- | :--- | :--- |
| `refundId` | `string` | Must match `{refundId}` (Razorpay `rfnd_*` ID) |
| `orderId` | `string` | References `orders/{orderId}` |
| `paymentId` | `string` | References `payments/{paymentId}` (`pay_*`) |
| `customerUid` | `string` | Owner UID for read isolation |
| `amount` | `number` | Refunded amount in INR `> 0` |
| `amountPaise` | `number` | Integer paise `> 0` |
| `currency` | `string` | `'INR'` |
| `refundType` | `string` | `'full' \| 'partial'` |
| `status` | `string` | `'Initiated' \| 'Processed' \| 'Failed'` |
| `reason` | `string` | 3–300 chars admin audit reason |
| `initiatedByUid` | `string` | Verified Admin UID who triggered refund |
| `initiatedByEmail` | `string` | Verified Admin email |
| `createdAt` / `updatedAt` | `timestamp` | Enforced via `serverTimestamp()` |

---

## 8. `admins/{uid}`
Server-verified admin registry managed exclusively by `super_admin`.

- Fields: `uid`, `email`, `displayName`, `role` (`'admin' | 'super_admin'`), `active` (`boolean`), `createdAt`, `updatedAt`.

---

## 9. `showroom/{sectionId}`
Stores 3D Showroom section lighting and featured merchandising overrides.

- Fields: `id`, `sectionId`, `title`, `lightingPreset` (`warm_luxury | daylight_atelier | evening_gala`), `featuredProductIds[]`, `active`, `createdAt`, `updatedAt`.

---

## 10. `settings/{settingId}`
Stores global storefront configuration (primary document: `settings/storefront`).

- Fields: `id`, `storeName`, `currencyCode` (`INR`), `lowStockThreshold`, `announcementText`, `showroomDefaultLighting`, `createdAt`, `updatedAt`.
