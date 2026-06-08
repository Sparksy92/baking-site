# Social Platform Developer Registration Guide

Complete these registrations as early as possible — approval times vary from minutes (Facebook/Instagram) to 4 weeks (TikTok). Submit LinkedIn and TikTok **now** even if the code isn't ready.

---

## Facebook & Instagram (Meta)

**Cost:** Free  
**Approval time:** Minutes (no review for basic posting to your own page)  
**Credentials needed:** `META_PAGE_ACCESS_TOKEN`, `META_FACEBOOK_PAGE_ID`, `META_INSTAGRAM_ACCOUNT_ID`

### Steps

1. Go to [developers.facebook.com](https://developers.facebook.com) and log in with the Facebook account that manages your brand page.
2. Click **My Apps → Create App**.
3. Select **Other** → **Business** → give it a name (e.g. "YourBrand Social Publisher").
4. From the app dashboard, add the **Instagram Graph API** and **Pages API** products.
5. Go to **Tools → Graph API Explorer**.
6. Select your app, then click **Generate Access Token**.
7. Grant permissions: `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
8. Click **Get Page Access Token** — select your Facebook Page from the dropdown.
9. **Convert to long-lived token** (never expires):
   ```
   GET https://graph.facebook.com/v19.0/oauth/access_token
     ?grant_type=fb_exchange_token
     &client_id={app_id}
     &client_secret={app_secret}
     &fb_exchange_token={short_lived_token}
   ```
10. Get your **Facebook Page ID**: `GET https://graph.facebook.com/me?access_token={token}`
11. Get your **Instagram Account ID**: `GET https://graph.facebook.com/v19.0/{page_id}?fields=instagram_business_account&access_token={token}`

### Add to `.env`
```
META_PAGE_ACCESS_TOKEN=your_long_lived_token
META_FACEBOOK_PAGE_ID=your_page_id
META_INSTAGRAM_ACCOUNT_ID=your_instagram_business_account_id
```

### Enable in Admin
Settings → Social Platforms → Facebook → toggle Enabled  
Settings → Social Platforms → Instagram → toggle Enabled

---

## LinkedIn

**Cost:** Free  
**Approval time:** 1–2 weeks (app review required for posting permissions)  
**Credentials needed:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`  
**Requirement:** You must have a **LinkedIn Company Page** — personal profiles cannot be posted to via API.

### Steps

1. Go to [developer.linkedin.com](https://developer.linkedin.com) — sign in with your **regular LinkedIn account** (no special developer account needed).
2. Click **Create App**.
3. Fill in:
   - App name: e.g. "YourBrand Publisher"
   - LinkedIn Page: select your Company Page (create one first if needed at linkedin.com/company/setup/new)
   - App logo: required (use your brand logo)
   - Legal agreement: check the box
4. Click **Create App**.
5. Under the **Products** tab, request:
   - **Share on LinkedIn** — allows posting to your page
   - **Sign In with LinkedIn using OpenID Connect** — needed for OAuth
6. LinkedIn will review your request. You'll get an email when approved (1–2 weeks).
7. Once approved, go to **Auth** tab → copy `Client ID` and `Client Secret`.
8. Add OAuth redirect URL: `https://yourdomain.com/api/admin/social/linkedin/callback`

### Add to `.env`
```
LINKEDIN_CLIENT_ID=your_client_id
LINKEDIN_CLIENT_SECRET=your_client_secret
```

### Admin Setup Note
The admin panel will show a **Connect LinkedIn** button under Settings → Social Platforms → LinkedIn. This triggers an OAuth flow — you'll be redirected to LinkedIn to authorise the app and it will store the access token automatically.

---

## TikTok

**Cost:** Free  
**Approval time:** 1–4 weeks (app review required, can be slow)  
**Credentials needed:** `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`  
**Requirement:** A **TikTok Business Account** linked to your brand.

### Steps

1. Go to [developers.tiktok.com](https://developers.tiktok.com) — sign in with your TikTok account.
2. Click **Manage Apps → Create App**.
3. Fill in:
   - App name: e.g. "YourBrand Publisher"
   - App category: **Content tool**
   - Platform: **Web**
   - App icon and description: required
4. Under **Products**, add:
   - **Content Posting API** — this is the one that allows posting video/image content
   - **Login Kit** — required for OAuth
5. Under **Redirect URI**, add: `https://yourdomain.com/api/admin/social/tiktok/callback`
6. Submit for review. TikTok will email you. Status is visible in the developer portal.
7. Once approved, go to your app → copy `Client Key` and `Client Secret` from the **App Details** tab.

### Add to `.env`
```
TIKTOK_CLIENT_KEY=your_client_key
TIKTOK_CLIENT_SECRET=your_client_secret
```

### Admin Setup Note
The admin panel shows TikTok setup status under Settings → Social Platforms → TikTok. While review is pending, the status will show **"Pending Review"** with a link to the TikTok developer portal. Once credentials are added, status updates to **Active** automatically.

> **Note:** TikTok's Content Posting API currently supports video and images. Pure text posts are not supported. When posting blog content to TikTok, the system will attach the blog's featured image. If no image is present, the post will be skipped for TikTok.

---

## X / Twitter

**Cost:** $100/month (Basic tier API access — required for any write operations)  
**Approval time:** Immediate (automated)  
**Credentials needed:** `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET`

### Decision Required
X now charges for API write access. Before proceeding:
- **Basic ($100/mo):** 1 app, 1,500 tweets/month — sufficient for most brands
- **Free tier:** Read-only, cannot post

If you decide to proceed:

1. Go to [developer.twitter.com](https://developer.twitter.com) and sign in with the brand's X account.
2. Apply for **Basic** tier — credit card required.
3. Create a new project and app.
4. Under **Keys and Tokens**, generate:
   - API Key & Secret
   - Access Token & Secret (make sure to select **Read and Write** permissions)

### Add to `.env`
```
X_API_KEY=your_api_key
X_API_SECRET=your_api_secret
X_ACCESS_TOKEN=your_access_token
X_ACCESS_TOKEN_SECRET=your_access_token_secret
```

### Admin Setup Note
The admin panel will show a cost warning under Settings → Social Platforms → X / Twitter indicating this platform requires a paid API subscription before it can be enabled.

---

## YouTube

**Cost:** Free (YouTube Data API v3)  
**Status:** Phase 3 — deferred  
**Why deferred:** YouTube only supports video content. Text posts are not supported. Enabling YouTube requires integration with an AI video generation service (e.g. Synthesia, HeyGen, or a self-hosted model when GPU infrastructure is available).

The admin panel will show YouTube as **"Phase 3 — Video only. Coming soon."** with an informational note. It cannot be enabled until video generation is wired in.

---

## Summary Table

| Platform | Cost | Approval Time | Action Required Now |
|---|---|---|---|
| Facebook | Free | Minutes | Create Meta app, generate token |
| Instagram | Free | Minutes | Same Meta app as Facebook |
| LinkedIn | Free | 1–2 weeks | **Submit app now** |
| TikTok | Free | 1–4 weeks | **Submit app now** |
| X / Twitter | $100/mo | Immediate | Client decision on cost |
| YouTube | Free | N/A | Phase 3 — deferred |
