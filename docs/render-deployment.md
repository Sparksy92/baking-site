# Cedar & Sage Homestead Render Deployment Guide

## Deployment Scope

This deployment runs the full Cedar & Sage Homestead application:

* Render Postgres (Database)
* FastAPI backend web service (API)
* Next.js storefront web service (Frontend)

---

## Recommended Render Services

### 1. Database
- **Name**: `cedar-sage-db`
- **Type**: Render Postgres
- **Region**: Choose the same region for all services (e.g. `us-east` or `Oregon`) to minimize latency.
- **Plan**: Use a paid basic tier (e.g., Starter) for real beta/production. The free Postgres tier on Render expires after 90 days and deletes data, making it unsuitable for customer order requests and settings.

### 2. API Service
- **Name**: `cedar-sage-api`
- **Type**: Web Service
- **Root Directory**: `api`
- **Runtime**: `Python`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Environment Variables**:
  - `DATABASE_URL`: Set to the **Internal Database URL** of `cedar-sage-db`.
  - `ADMIN_JWT_SECRET`: Generate a secure random string (e.g. via `openssl rand -base64 32`).
  - `CUSTOMER_JWT_SECRET`: Generate a separate secure random string.
  - `CONTACT_EMAIL`: Owner's notification email address.
  - `ETRANSFER_EMAIL`: Payment destination email (e.g. `hello@cedarandsagehomestead.ca`).
  - `STORE_DOMAIN`: The public URL of the storefront service (e.g., `https://cedar-sage.onrender.com`).
  - `DEV_MODE`: Set to `false` in production.
  - `RESEND_API_KEY`: (Optional) Your Resend API key for emailing order confirmations to Kirstin.

### 3. Storefront Service
- **Name**: `cedar-sage-storefront`
- **Type**: Web Service
- **Root Directory**: `storefront`
- **Runtime**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**:
  - `NEXT_PUBLIC_API_BASE_URL`: Set to the **Public URL** of your deployed API service (e.g., `https://cedar-sage-api.onrender.com`). Do not include a trailing slash.
  - `API_URL`: Set to the same public URL (`https://cedar-sage-api.onrender.com`) for Next.js server-side fetches.
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: (Optional) Set to your Stripe publishable key if Stripe checkout is enabled.

---

## Database Setup

1. Create the **Render Postgres** database first (`cedar-sage-db`).
2. Copy the **Internal Database URL** from the database dashboard.
3. Paste the URL as the value for `DATABASE_URL` in your API service's environment variables.
4. Deploy the API service. **Migrations run automatically** on startup during the lifespan setup.
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
2. **Create API Service**: Configure `cedar-sage-api`, add the database URL and credentials, and deploy it.
3. **Run Seed Command**: Open the API shell on Render and run `python cli.py seed`.
4. **Create Storefront**: Set up `cedar-sage-storefront` and define the public API URL env vars.
5. **Live Smoke Test**: Verify that the public storefront and admin pages work cleanly.

---

## Live Smoke Test Checklist

### Storefront (Public View)
- [ ] Open Vercel/Render generated URL.
- [ ] Homepage loads successfully.
- [ ] 3D diorama loads (or fallback works if webgl is not supported).
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
* **Shared Regions**: Ensure that database, API, and storefront reside in the same Render region (e.g., Oregon) to eliminate cross-region latency.
* **Internal URLs**: Use the internal database URL (`.render.com` suffix) for API-to-Postgres communication. Only use the public URL if connecting from outside Render.
* **HTTPS**: Storefront requests to the API require HTTPS; verify that `NEXT_PUBLIC_API_BASE_URL` uses the `https://` protocol prefix.
* **Free Tier Postgres**: Do not use the free Postgres database for production, as database access will be automatically revoked after 90 days, resulting in data loss.
