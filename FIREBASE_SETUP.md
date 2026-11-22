# Firebase Setup Guide — 3D Jummo Fashion World (Phase 5)

This guide explains how **3D Jummo Fashion World** connects to Firebase (Cloud Firestore, Firebase Authentication, and Firebase Storage) and lists any manual Firebase Console steps needed for full production operation.

---

## 1. Provisioned Firebase Project

The AI Studio workspace has provisioned a Firebase Web App configuration in `/firebase-applet-config.json` and deployed `/firestore.rules` to the provisioned named Cloud Firestore database.

For standalone deployments outside AI Studio, copy `/.env.example` to `.env` and populate:

```env
VITE_FIREBASE_API_KEY="..."
VITE_FIREBASE_AUTH_DOMAIN="..."
VITE_FIREBASE_PROJECT_ID="..."
VITE_FIREBASE_STORAGE_BUCKET="..."
VITE_FIREBASE_MESSAGING_SENDER_ID="..."
VITE_FIREBASE_APP_ID="..."
VITE_FIREBASE_DATABASE_ID="..."
```

> **Security Note:** Never commit `.env` files or Firebase Admin SDK service-account JSON keys to the frontend repository.

---

## 2. Enable Authentication Providers

1. Open [Firebase Console](https://console.firebase.google.com/) and select your project.
2. Go to **Build → Authentication → Sign-in method**.
3. **Google Sign-In**: Pre-configured via AI Studio provisioning. Ensure your app domain is listed under **Authentication → Settings → Authorized domains**.
4. **Email/Password Sign-In (Optional Manual Step)**:
   - Click **Add new provider → Email/Password**.
   - Toggle **Enable** and save.
   - Until enabled, attempting Email/Password sign-in or registration will display a clear warning (`auth/operation-not-allowed`) and direct you to Google Sign-In.

---

## 3. Cloud Firestore Database & Indexes

- Firestore is initialized in `src/firebase/firebaseConfig.ts` with the exact `firestoreDatabaseId` from `firebase-applet-config.json`.
- **Deployed Security Rules**: `/firestore.rules` has been linted with `@firebase/eslint-plugin-security-rules` and deployed via `DeployRules`.
- **Collections**: `products`, `categories`, `users`, `admins`, `showroom`, `settings` (see `DATABASE_SCHEMA.md`).
- **Indexes**: Current queries (`where('status', '==', 'published')` + `limit(...)`) use single-field automatic indexes and sort client-side to avoid cold-start index blocks. If you add compound server-side `orderBy` filters later, create the prompted composite index from the Firestore Console link.

---

## 4. Firebase Storage Setup & Rules

1. In Firebase Console, open **Build → Storage**.
2. If Cloud Storage is not yet initialized for your project, click **Get Started** to provision the default bucket (`*.firebasestorage.app`).
3. Open the **Rules** tab and paste the contents of `/storage.rules`, then click **Publish** (see `STORAGE_RULES.md`).

---

## 5. Admin Access & Role Provisioning

Admin permissions are strictly server-verified by `firestore.rules` (never trusted from browser state):

1. **Bootstrap Super Admin**: Signing in with the verified owner Google account (`merajalam906090@gmail.com`, `email_verified == true`) grants `super_admin` access automatically.
2. **Additional Admins**: A `super_admin` can create documents under `admins/{uid}` with:
   ```json
   {
     "uid": "<target-user-uid>",
     "email": "manager@fashionworld.com",
     "displayName": "Store Manager",
     "role": "admin",
     "active": true,
     "createdAt": "<serverTimestamp>",
     "updatedAt": "<serverTimestamp>"
   }
   ```

---

## 6. Safe Local-to-Firestore Catalog Migration

1. Navigate to `/admin` and sign in with your authorized Admin account.
2. Open **Settings** (or click the live status pill in the Admin Header) to open **Firebase Database, Storage & Migration**.
3. Click **1. Backup Local Demo (JSON)** to download a complete local backup before migrating.
4. Click **2. Migrate to Cloud Firestore** to idempotently import your Phase 4 categories and products into Cloud Firestore.
   - Preserves original IDs and category hierarchy.
   - Prevents duplicate document IDs and duplicate SKUs.
   - Reports created, skipped, and failed counts transparently.
   - Does **not** auto-delete your local Phase 4 cache.

---

## 7. Verification Checklist

- [ ] Sign in at `/account` with Google (or Email/Password once enabled).
- [ ] Confirm `/admin` blocks unauthenticated visitors and non-admin `customer` accounts.
- [ ] Sign in as Admin at `/admin`, open **Settings**, and verify **Firebase Connection** reports **Connected**.
- [ ] Download JSON backup and run **Migrate to Cloud Firestore**.
- [ ] Add or edit a product and confirm it syncs in real time to `/products`, `/product/:slug`, and `/showroom`.
- [ ] Upload a product image in **Add/Edit Product** after publishing `storage.rules` and verify the Cloud badge and download URL.
