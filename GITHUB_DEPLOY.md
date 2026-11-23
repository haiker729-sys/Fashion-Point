# GitHub Build & Deployment Guide — 3D Jummo Fashion World

This repository includes automated GitHub Actions workflows for building, type-checking, and deploying **3D Jummo Fashion World**.

## 1. Push This Project to GitHub

1. Export or download this project from Google AI Studio (or connect your GitHub repository directly).
2. If pushing from your local terminal:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: 3D Jummo Fashion World"
   git branch -M main
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPO_NAME>.git
   git push -u origin main
   ```

> **Security Note:** `.env*` files are excluded in `.gitignore`. Never commit `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to GitHub.

---

## 2. Configure GitHub Repository Secrets

In your GitHub repository, go to **Settings → Secrets and variables → Actions → New repository secret** and add:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_RAZORPAY_KEY_ID` (optional public Razorpay Key ID)

Also add your deployed domain to **Firebase Console → Authentication → Settings → Authorized domains** so Google Sign-In works on your live URL.

---

## 3. Automated GitHub Builds Included

### A. Continuous Integration (`.github/workflows/ci-build.yml`)
Runs on every push and pull request to `main`:
- `npm install`
- `npm run lint` (`tsc --noEmit`)
- `npx eslint firestore.rules`
- `npm run build` (production Vite build)

### B. Static Frontend Hosting on GitHub Pages (`.github/workflows/deploy-pages.yml`)
To publish the storefront & 3D Showroom on GitHub Pages:
1. Open **Settings → Pages** in your GitHub repository.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. Push to `main` (or trigger **Deploy Frontend to GitHub Pages** manually in the **Actions** tab).

> **Important (Backend APIs):** GitHub Pages hosts static frontend files only. Customer browsing, 3D Showroom, Firebase Auth, and Firestore work on GitHub Pages, while Express backend routes (`/api/payments/*` for Razorpay verification/webhooks and `/api/admin/*` for server-validated admin actions & CSV exports) require a Node.js host.

---

## 4. Full-Stack Deployment from GitHub (Frontend + Express Backend)

For complete Phases 1–8 functionality (including Razorpay payments, webhooks, and `/api/admin/*`), connect your GitHub repository to a Node.js host such as **Google Cloud Run**, **Render**, or **Railway**:

- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start` (`node server.ts` on Node.js 22+)
- **Port:** `3000` (or platform `PORT` env var)
- **Server Environment Variables:**
  - `NODE_ENV=production`
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
  - `RAZORPAY_WEBHOOK_SECRET`
  - `VITE_FIREBASE_*` and `VITE_RAZORPAY_KEY_ID`
