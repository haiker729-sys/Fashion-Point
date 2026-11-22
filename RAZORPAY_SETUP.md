# Razorpay Payment Gateway Setup & Production Deployment Guide
**Project:** 3D Jummo Fashion World (Phase 7)  
**Official Dashboard:** https://dashboard.razorpay.com/  
**Official Documentation:** https://razorpay.com/docs/

---

## 1. Account Activation & KYC Verification
1. Create or sign in to your official business account at **https://dashboard.razorpay.com/**.
2. Complete **Merchant KYC Verification** (PAN, GSTIN if applicable, business address, settlement bank account, website URL, Privacy Policy, Refund & Cancellation Policy, and Terms of Service).
3. While KYC is in review, you can immediately generate **Test Mode** API keys (`rzp_test_*`) and test every payment method (UPI, Cards, Net Banking, Wallets) without charging real money.

---

## 2. Environment Variables & Secrets Configuration

> **SECURITY RULE:** Never commit `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to Git, and never expose them in frontend (`VITE_*`) variables or browser code.

Configure the following environment variables in your deployment Secrets panel or local `.env` file (matching `.env.example`):

| Variable | Scope | Example | Purpose |
| :--- | :--- | :--- | :--- |
| `VITE_RAZORPAY_KEY_ID` | Frontend (Public) | `rzp_test_xxxxxxxxxxxx` | Optional public key mirror (checkout also receives public `keyId` from `/api/payments/create-order`) |
| `RAZORPAY_KEY_ID` | Backend Only | `rzp_test_xxxxxxxxxxxx` | Authenticates Razorpay Node.js SDK API requests |
| `RAZORPAY_KEY_SECRET` | **Backend Secret** | `xxxxxxxxxxxxxxxxxxxx` | Signs API calls & verifies HMAC-SHA256 checkout signatures |
| `RAZORPAY_WEBHOOK_SECRET` | **Backend Secret** | `whsec_xxxxxxxxxxxxxx` | Verifies raw-body `X-Razorpay-Signature` on incoming webhooks |
| `RAZORPAY_ALLOW_LIVE` | Backend Safety Gate | `"false"` (default) | Prevents accidental live charges until explicitly set to `"true"` by store owner |

---

## 3. Webhook Registration (Mandatory for Production Reliability)
Webhooks ensure orders are confirmed even if the customer's browser closes or network drops after completing UPI/bank authorization.

1. In Razorpay Dashboard, navigate to **Account & Settings → Webhooks → + Add New Webhook**.
2. Set **Webhook URL** (HTTPS required in production):
   ```text
   https://<your-production-domain>/api/payments/webhook
   ```
3. Set a strong **Secret** and copy the exact same value into backend secret `RAZORPAY_WEBHOOK_SECRET`.
4. Enable these exact **Active Events**:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `order.paid`
   - `refund.processed`
5. Click **Create Webhook**.

### Raw-Body Verification Guarantee
Our Express server (`server.ts`) mounts `POST /api/payments/webhook` using `express.raw({ type: 'application/json' })` **before** `express.json()`, ensuring HMAC-SHA256 verification runs against the exact raw bytes transmitted by Razorpay using `crypto.timingSafeEqual`.

---

## 4. Test Mode End-to-End Verification Checklist
1. Configure `RAZORPAY_KEY_ID="rzp_test_..."`, `RAZORPAY_KEY_SECRET="..."`, `RAZORPAY_WEBHOOK_SECRET="..."`, and keep `RAZORPAY_ALLOW_LIVE="false"`.
2. Restart the server and verify `GET /api/payments/config` returns `"mode": "test"` and `"configured": true`.
3. Add an in-stock item to cart, complete Checkout Steps 1–3, and select **Online Payment via Razorpay** on Step 4.
4. Click **Pay Now with Razorpay** — verify the official Razorpay Checkout modal opens with **3D Jummo Fashion World**, `#FF7A00` branding, exact INR total, and UPI / Card / Net Banking options.
5. Complete a Test Mode payment (e.g., Razorpay test UPI `success@razorpay` or Razorpay test card).
6. Confirm the backend verifies HMAC-SHA256 + `captured` status, updates order status to `Confirmed` / `Payment Verified`, and navigates to `/order-confirmation/:orderId`.
7. Test a failed payment (`failure@razorpay`) — confirm the order is preserved without duplication and **Retry Payment** reuses the same `orderId`.
8. Test a Cash on Delivery order — confirm `COD Pending` works identically to Phase 6.

---

## 5. Switching to Production Live Mode
1. Ensure Merchant KYC is approved and your live domain is served exclusively over **HTTPS**.
2. Switch Razorpay Dashboard to **Live Mode** and generate `rzp_live_*` keys + a **Live Webhook Secret**.
3. Update backend secrets:
   - `RAZORPAY_KEY_ID="rzp_live_..."`
   - `RAZORPAY_KEY_SECRET="<live_secret>"`
   - `RAZORPAY_WEBHOOK_SECRET="<live_webhook_secret>"`
   - `RAZORPAY_ALLOW_LIVE="true"`
4. Run a ₹1–₹10 live smoke test order and verify both checkout signature verification and webhook delivery, then test a full refund via the Admin Console (`Payments → Initiate Razorpay Refund`).

---

## 6. Cloud Firestore Permissions & Refund Configuration
- **Zero-Trust Security Rules:** `firestore.rules` strictly forbids customers from writing to `/payments/{paymentId}`, `/refunds/{refundId}`, or modifying `/orders/{orderId}` statuses directly from the browser.
- **Admin Refunds:** Only verified administrators (`merajalam906090@gmail.com` or active `admins/{uid}` records) can call `POST /api/payments/refund` for Full or Partial refunds. Refunds are never auto-triggered without explicit admin submission.
- **Starter Tier vs Production Blaze Note:** On Google-hosted AI Studio Starter Tier (where service-account Admin SDK IAM writes are restricted), webhook events are recorded in the server's authoritative payment ledger and reconciled automatically via `GET /api/payments/status/:orderId` (and persisted to Firestore whenever an Admin session or Blaze Firebase Admin SDK service account is attached). Upgrading to a user-owned Firebase Blaze project enables direct server-to-Firestore writes from background webhooks.
