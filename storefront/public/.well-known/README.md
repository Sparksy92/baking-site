# Apple Pay Domain Verification

Place the `apple-developer-merchantid-domain-association` file here for Apple Pay to work in production.

Steps:
1. Stripe Dashboard → Settings → Payment Methods → Apple Pay
2. Click "Add domain" → enter your production domain
3. Stripe provides the verification file
4. Download it and place it in this directory (no extension, exact filename)
5. It will be served at: `https://yourdomain.ca/.well-known/apple-developer-merchantid-domain-association`
6. Click "Verify" in Stripe Dashboard

Google Pay requires no domain verification — it works automatically once NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is set.
