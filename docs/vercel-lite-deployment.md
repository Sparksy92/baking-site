# Cedar & Sage Homestead Vercel-Lite Deployment Guide

This guide details the deployment of the simplified, serverless Next.js-only Cedar & Sage Homestead website on Vercel with Neon Postgres.

---

## 1. Database Setup (Neon Postgres)

1. Create a free account at [neon.tech](https://neon.tech) and initialize a new project named `cedar-sage-db`.
2. Retrieve your connection string from the Neon dashboard (make sure the `Pooled` connection toggle is enabled for serverless compatibility, e.g. using `sslmode=require`).
3. Set this connection string as the `DATABASE_URL` environment variable.
4. Execute the schema migration and seeding script. 
   - Note: The Vercel-Lite codebase contains a self-healing database layer (`storefront/lib/db.ts`). Upon the **first request** to any API endpoint (such as visiting the shop or public about page), the application will automatically detect the missing tables, execute `storefront/db/schema.sql`, and seed the database with the Cedar & Sage products from `storefront/db/seed.sql`.

---

## 2. Vercel Deployment Setup

1. Connect your GitHub repository `Sparksy92/cedar-and-sage` to your Vercel account.
2. Create a new project pointing to the repo, and configure these **Project Settings**:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `storefront`
   - **Build Command**: `npm install && npm run build`
   - **Output Directory**: `.next`
3. Add the following **Environment Variables** in the Vercel project settings:
   - `DATABASE_URL`: Your Neon Postgres connection string.
   - `ADMIN_SESSION_SECRET`: A secure random string of at least 32 characters (e.g. `openssl rand -base64 32`).
   - `ADMIN_EMAIL`: The login email for the admin panel (e.g. `hello@cedarandsagehomestead.ca`).
   - `ADMIN_PASSWORD_HASH`: The PBKDF2 hash of your desired administrator password (see generation instructions below).
   - `CONTACT_EMAIL`: The email address where order notifications will be sent (e.g. `hello@cedarandsagehomestead.ca`).
   - `ETRANSFER_EMAIL`: The payment email address (e.g. `payments@cedarandsagehomestead.ca`).
   - `RESEND_API_KEY`: (Optional) Your Resend API key to send automated email alerts on bakes requests.
   - `EMAIL_FROM`: The verified Resend email sender (e.g. `Cedar & Sage Homestead <orders@cedarandsagehomestead.ca>`).
   - `NEXT_PUBLIC_SITE_NAME`: `Cedar & Sage Homestead`
   - `NEXT_PUBLIC_SITE_URL`: Your Vercel generated URL or custom domain (e.g. `https://cedar-sage.vercel.app`).
4. Click **Deploy**. Vercel will build and launch your serverless website.

---

## 3. How to Generate the Admin Password Hash

Since we store the hashed administrator password securely in environment variables (saving database overhead), run the following command in your terminal to generate the PBKDF2 hash of your desired password:

```bash
node -e "console.log(require('crypto').pbkdf2Sync('YOUR_PASSWORD_HERE', 'cedar-salt-homestead', 1000, 64, 'sha512').toString('hex'))"
```

Copy the printed 128-character hex string and paste it as the value for `ADMIN_PASSWORD_HASH` in your Vercel environment variables.

*(The default hash in `.env.example` corresponds to the password `admin123`).*

---

## 4. How to Test the Order Request Flow

1. Open your deployed Vercel URL (e.g., `https://cedar-sage.vercel.app`).
2. Navigate to the **Menu** page, click a featured product, or open the **Custom Orders** form page directly at `/custom-orders`.
3. Fill in the name, email, preferred contact method, desired date, pickup/delivery choice, and input requested items (e.g., `2x Cinnamon Rolls, 1x Sourdough`).
4. Submit the request. Confirm that a success screen is displayed.
5. In the background:
   - The request is saved to Neon Postgres.
   - If `RESEND_API_KEY` is configured, an automated email notification is sent to the `CONTACT_EMAIL` with full details. If the email fails, the customer request still registers successfully.

---

## 5. How to Manage the Site and Menu

1. Navigate to `/admin/login` on your deployed Vercel domain.
2. Log in with your `ADMIN_EMAIL` and password.
3. **Menu Management** (`/admin/products`):
   - View the list of all menu items (including draft/hidden items).
   - Click a menu item or click **Add Product** to create a new one.
   - You can edit the name, description, price (in cents, e.g., `800` for `$8.00`), pricing mode (`fixed`, `starting_at`, `quote_only`, `seasonal`), availability status, and add allergy or pickup notes.
   - Update the `image_url` field with static assets in the repo (e.g., `/images/products/sourdough.jpg`) or an absolute external image URL.
4. **Order Request Inbox** (`/admin/order-requests`):
   - View all incoming customer requests.
   - Click a request to view details, update the status (`new`, `reviewed`, `quoted`, `accepted`, `completed`, `cancelled`), and append private admin notes.
5. **Settings Editor** (`/admin/settings`):
   - Edit the brand identity, Oven Fund amounts, and instructions (payment/pickup/preorder/allergy copy). Click **Save Settings** to persist to Neon.

---

## 6. Limitations of the Vercel-Lite Version

- **No FastAPI Backend**: This branch operates entirely serverless within Next.js. The `api/` directory is not deployed.
- **No Stripe Checkout**: Orders are request-based only. Payments are completed manually via e-transfer or on pickup, suitable for Kirstin's small-batch homestead operations.
- **No File Uploads**: Administrative uploads are not supported on Vercel's serverless environment in this phase. Images must be added to the repository static assets or linked via external `image_url` strings in the product form.
- **Bakery Ordering Model**: Built strictly around order inquiries rather than instant cart checkout, preventing overselling and allowing scheduling.
