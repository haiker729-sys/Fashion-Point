# Firebase Storage Security Rules — 3D Jummo Fashion World

The Storage rules definition is saved in `/storage.rules`.

---

## Folder Structure

| Path Pattern | Read Access | Write / Delete Access | Constraints |
| :--- | :--- | :--- | :--- |
| `products/{productId}/{fileName}` | Public (`true`) | Verified Admin only | `image/jpeg`, `image/png`, `image/webp`; max 5 MB |
| `categories/{categoryId}/{fileName}` | Public (`true`) | Verified Admin only | `image/jpeg`, `image/png`, `image/webp`; max 5 MB |
| `showroom/assets/{fileName}` | Public (`true`) | Verified Admin only | `image/jpeg`, `image/png`, `image/webp`; max 5 MB |
| `/{allPaths=**}` | Denied (`false`) | Denied (`false`) | Default deny catch-all |

---

## How to Publish `storage.rules` in Firebase Console

1. Open [Firebase Console](https://console.firebase.google.com/) → Select your project.
2. Navigate to **Build → Storage** (initialize the default bucket if not yet activated).
3. Click the **Rules** tab.
4. Copy the exact contents of `/storage.rules` into the editor and click **Publish**.

---

## Additional Admin Uploaders

By default, `/storage.rules` authorizes the verified bootstrap Super Admin email (`merajalam906090@gmail.com`) and any user with a verified Firebase Auth Custom Claim `admin: true`. When adding additional team admins who need to upload images, assign the `{ admin: true }` custom claim via the Firebase Admin SDK from a trusted backend script.
