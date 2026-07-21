# The Artisan Bakery Render Deployment Guide

This guide details the steps and configuration required to deploy the full The Artisan Bakery application on Render.

## Recommended Render Services

### 1. Database
- **Name**: `cedar-sage-db`
- **Type**: Render Postgres
- **Region**: Choose the same region for all services (e.g. `Oregon`) to minimize latency.
- **Plan**: Use a paid Postgres tier (e.g., Starter) for real customer data. The free Postgres tier on Render expires after 90 days and deletes data, making it unsuitable for customer order requests and settings.
- **Connection**: Use the **Internal Database URL** for API database connection.

### 2. API Service
- **Name**: `cedar-sage-api`
- **Branch**: `main`
- **Type**: Web Service
- **Root Directory**: `api`
- **Runtime**: `Python`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health Check Path**: `/api/health`
- **Disk**: Attach a persistent disk mounted at `/var/data` (10 GB or higher is sufficient).
- **Environment Variables**:
  - `DATABASE_URL`: Set to the **Internal Database URL** of `cedar-sage-db`.
  - `ADMIN_JWT_SECRET`: Generate a secure random string (e.g. `openssl rand -base64 32`).
  - `CUSTOMER_JWT_SECRET`: Generate a separate secure random string.
  - `CONTACT_EMAIL`: Owner's notification email address.
  - `ETRANSFER_EMAIL`: Payment destination email (e.g. `hello@example.com`).
  - `STORE_DOMAIN`: The public URL of the storefront service (e.g., `https://cedar-sage-storefront.onrender.com`).
  - `CORS_ALLOWED_ORIGINS`: Comma-separated list of allowed origins (e.g., `https://cedar-sage-storefront.onrender.com`).
  - `DEV_MODE`: Set to `false` in production (this activates localhost guards to prevent booting with localhost store domains).
  - `RESEND_API_KEY`: (Optional) Your Resend API key for emailing order confirmations to our baker.
  - `UPLOAD_STORAGE_ROOT`: `/var/data/uploads`
  - `ENABLE_BACKGROUND_WORKERS`: `false` (Recommended: Set to `true` only if social/RSS automation features are intentionally configured later).
  - `STRIPE_SECRET_KEY`: (Optional) Your Stripe secret key if Stripe is enabled.
  - `STRIPE_WEBHOOK_SECRET`: (Optional) Your Stripe webhook secret key if Stripe webhooks are enabled.

> [!NOTE]
> Setting `ENABLE_BACKGROUND_WORKERS=false` only disables background social/RSS/scheduler automation tasks. Essential startup procedures, including database migrations and `init_db()`, still run unconditionally on API startup.

### 3. Storefront Service
- **Name**: `cedar-sage-storefront`
- **Branch**: `main`
- **Type**: Web Service
- **Root Directory**: `storefront`
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `node .next/standalone/server.js` (replaces standard `next start` due to the standalone configuration in `next.config.ts`).
- **Health Check Path**: `/`
- **Environment Variables**:
  - `API_URL`: Set to the **Public URL** of your deployed API service (e.g., `https://cedar-sage-api.onrender.com`). Do not include a trailing slash. This is the critical variable that powers Next.js API proxy rewrites and server-side fetches.
  - `NEXT_PUBLIC_API_BASE_URL`: Keep set to the same public URL (`https://cedar-sage-api.onrender.com`) for compatibility.
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: (Optional) Set to your Stripe publishable key if Stripe checkout is enabled.

---

## Database Setup and Initialization

1. Create the **Render Postgres** database first (`cedar-sage-db`).
2. Copy the **Internal Database URL** from the database dashboard.
3. Paste the URL as the value for `DATABASE_URL` in your API service's environment variables.
4. Deploy the API service. **Migrations run automatically** on startup.
5. Once the API is deployed, run the **seeding command** to populate categories, products, and default homestead settings.
   - Go to the API service dashboard on Render.
   - Click the **Shell** tab on the left sidebar.
   - Execute the seeding command:
     ```bash
     python cli.py seed
     ```
6. To create your first administrative dashboard user:
   - In the same Shell window, run:
     ```bash
     python cli.py create-admin
     ```
   - Follow the interactive prompts to set your email/username and password.

---

## Deployment Order

1. **Create Postgres**: Set up `cedar-sage-db`.
2. **Create API Service**: Configure `cedar-sage-api`, add the persistent disk, environment variables, and deploy.
3. **Run Seed Command**: Open the API shell on Render and run `python cli.py seed`.
4. **Create Storefront**: Set up `cedar-sage-storefront`, define the API URL environment variables, and deploy.
5. **Live Smoke Test**: Verify that the public storefront and admin pages work cleanly.

---

## Upload Persistence Verification (Manual QA)

To verify that uploads persist across API service restarts:
1. Confirm the persistent disk is attached to the API service and mounted at `/var/data`.
2. Confirm the environment variable `UPLOAD_STORAGE_ROOT` is set to `/var/data/uploads`.
3. Log in to the admin panel at `/admin/login` and upload a new product image.
4. Restart or redeploy the API service via the Render dashboard ("Manual Deploy" -> "Clear Build Cache & Deploy" or "Restart Service").
5. Verify the uploaded image still loads successfully on the public storefront.

---

## Live Smoke Test Checklist

### Storefront (Public View)
- [ ] Open Render generated URL.
- [ ] Homepage loads successfully.
- [ ] 3D diorama loads (or fallback works if WebGL is not supported).
- [ ] Category links navigate to the shop filtered correctly (e.g. `/shop?category=baked-fresh`).
- [ ] Shop page loads all seeded homestead products and variants.
- [ ] Disclaimer notice banner displays at the top of the shop menu.
- [ ] Sourdough and Cheesecakes show correct preorder/weekend notices.
- [ ] Quote-only items display the quote request CTA instead of checkout button.
- [ ] Custom Orders page loads the form.
- [ ] Order Info page renders dynamic pickup, prepayment, and allergy instructions.
- [ ] About page renders the bio correctly.
- [ ] FAQ page renders all dynamic Q&A blocks.
- [ ] Contact page loads the form and exhibits the correct homestead contact email.
- [ ] Oven Fund page loads the progress bar ($2,500 goal, $1,620 raised) and manual e-transfer info.
- [ ] Standard HTML header/footer navigation works cleanly without relying on 3D.

### Order Flow
- [ ] Submit a custom order request for multiple items.
- [ ] Submit a standard checkout request for Cinnamon rolls (e-transfer default).
- [ ] Confirm checkout rejections are triggered if a user attempts to bypass UI protections for quote-only/zero-priced items.

### Admin Panel
- [ ] Navigate to `/admin/login` and log in successfully.
- [ ] Product list loads all seeded items.
- [ ] Change a product option price (e.g. Cinnamon Rolls) and save.
- [ ] Reload the product edit page and confirm the value persists.
- [ ] Order Requests page loads new requests.
- [ ] Change a request status to `reviewed` and add admin notes. Verify they persist.
- [ ] Settings/Homestead Content page loads settings, allows edits, and saves successfully.

---

## Known Render Notes
* **Shared Regions**: Ensure that database, API, and storefront reside in the same Render region to eliminate cross-region latency.
* **Internal URLs**: Use the internal database URL (`.render.com` suffix) for API-to-Postgres communication. Only use the public URL if connecting from outside Render.
* **HTTPS**: Storefront requests to the API require HTTPS; verify that `API_URL` uses the `https://` protocol prefix.
* **Free Tier Postgres**: Do not use the free Postgres database for production, as database access will be automatically revoked after 90 days, resulting in data loss.
