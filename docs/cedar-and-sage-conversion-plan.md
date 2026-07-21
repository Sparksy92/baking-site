# The Artisan Bakery Conversion Plan

## Project Goal

Convert the clothing/apparel baseline into The Artisan Bakery, a warm, rustic, professional baking and homestead commerce site.

The highest priority is admin self-service. our baker must be able to manage products, prices, options, availability, photos, content, and order requests from the admin dashboard without code.

## Business Model

The site will use a request-based ordering model suited to small-batch baking, custom desserts, pantry goods, and handmade home/body products.

Payment will primarily be e-transfer or pay-on-confirmation. Stripe may remain available for future fixed-price items, but MVP must not force instant checkout for quote-only/custom/preorder items.

## Core Categories

* Baked Fresh
* Desserts
* Pantry
* Home & Body

## Products to Seed Later

Baked Fresh:
* Artisan Bread
* Sandwich Loaf
* Bagels
* Buns
* Sourdough

Desserts:
* Cinnamon Rolls
* Banana Bread
* Muffins
* Basic Cookies
* Special Cookies
* Cheesecakes
* Custom Desserts

Pantry:
* Jams / Jellies
* Pickled Goods
* Simmer Pots
* Dried Mix Jars
* Bundles

Home & Body:
* Lotions
* Lip Balms
* Salves
* Herbal Oils

## Admin Self-Service Requirements

our baker must be able to:
* Add/edit/hide products and menu items
* Update prices
* Manage options such as batch size, flavour, icing, add-ons, inclusions, yeast/sourdough, half-dozen/dozen
* Upload/change product photos
* Manage product categories
* Set availability: available, sold out, preorder-only, weekend-only, seasonal, quote-only, unavailable, hidden
* Manage order requests
* Update pickup/payment instructions
* Update allergy/disclaimer text
* Update About, FAQ, and Order Info content

## Pricing Modes

Products must support:
* fixed
* starting_at
* quote_only
* seasonal
* unavailable

Prices must not be hardcoded into static React components or copy. Public prices must come from admin-managed product/option data.

## Checkout Protection

Checkout protection must be enforced on both frontend and backend.

Backend checkout must reject any cart containing products/variants where:
* price is 0
* pricing_mode is quote_only, seasonal, or unavailable
* availability_status is sold_out, seasonal, quote_only, unavailable, or hidden
* is_quote_only is true

Preorder-only and weekend-only items must either route to order requests or require desired date, pickup/delivery choice, and contact method before checkout.

## Order Request Inbox

Implement a database-backed order request system.

Public:
* POST /api/order-requests

Admin:
* GET /api/admin/order-requests
* GET /api/admin/order-requests/{id}
* PATCH /api/admin/order-requests/{id}

Admin endpoints must require authentication and permission checks.

Order requests must support multiple requested items using JSONB. There must be no top-level quantity field. Each item stores its own quantity, selected option, and notes.

Suggested requested_items structure:
```json
[
  {
    "product_id": 12,
    "product_name": "Cinnamon Rolls",
    "option": "Dozen",
    "quantity": 1,
    "notes": "Cream cheese icing"
  }
]
```

## Email Safety

When an order request is submitted:
1. Save it to the database first.
2. Attempt to send notification email to CONTACT_EMAIL.
3. If email fails, log the failure.
4. Do not lose the request.
5. Return success if the database save succeeded.

## PostgreSQL Migration Requirements

Use the next real migration number.

Add product fields:
* `pricing_mode` TEXT NOT NULL DEFAULT 'fixed'
* `availability_status` TEXT NOT NULL DEFAULT 'available'
* `lead_time_days` INTEGER DEFAULT 0
* `is_preorder_only` BOOLEAN NOT NULL DEFAULT FALSE
* `is_weekend_only` BOOLEAN NOT NULL DEFAULT FALSE
* `is_quote_only` BOOLEAN NOT NULL DEFAULT FALSE
* `allergy_notes` TEXT
* `pickup_notes` TEXT

Create order_requests table:
* `id` SERIAL PRIMARY KEY
* `customer_name` TEXT NOT NULL
* `customer_email` TEXT NOT NULL
* `customer_phone` TEXT
* `preferred_contact_method` TEXT NOT NULL
* `requested_items` JSONB NOT NULL
* `desired_date` DATE
* `pickup_or_delivery` TEXT NOT NULL DEFAULT 'pickup'
* `allergy_notes` TEXT
* `special_instructions` TEXT
* `status` TEXT NOT NULL DEFAULT 'new'
* `admin_notes` TEXT
* `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
* `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP

Add CHECK constraints:
* `pricing_mode IN ('fixed', 'starting_at', 'quote_only', 'seasonal', 'unavailable')`
* `availability_status IN ('available', 'sold_out', 'preorder_only', 'weekend_only', 'seasonal', 'quote_only', 'unavailable', 'hidden')`
* `order_requests.status IN ('new', 'reviewed', 'waiting_on_customer', 'confirmed', 'completed', 'cancelled')`

## Brand Defaults

Name:
The Artisan Bakery

Tagline:
Fresh baking, pantry goods & handmade homestead care

Description:
Fresh baking, desserts, pantry goods, jams, pickled goods, handmade tallow lotions, lip balms, salves, and herbal oils.

Colors:
* Primary: #6F7D5C
* Accent: #C8A2A8
* Background: #FAF7F2
* Text: #2B2522

## Public Pages

* Home
* Menu
* Custom Orders
* Order Info
* About
* Contact
* FAQ

## Admin UI Changes

Replace clothing language with baking-friendly language:
* Product = Menu Item where appropriate
* Variant = Option
* Size = Quantity / Batch Size
* Color = Flavour / Option
* Stock = Availability
* Collection = Menu Section / Seasonal Feature
* Shipping = Pickup / Local Delivery where applicable

Admin must include:
* Product pricing mode fields
* Availability fields
* Lead time fields
* Allergy notes
* Pickup notes
* Order Requests inbox
* Sidebar link with new request badge if practical
* Homestead Content settings section

## Safe Editable Content

Editable About, FAQ, Order Info, Pickup, Payment, Preorder, and Allergy text must render safely.
Do not use unsafe raw HTML rendering.

## Idempotent Seeding

Seed by slug/name checks.
Do not assume hardcoded category IDs.
Running seed more than once must not duplicate products.

## Phase 1 Findings

* **Existing migration count**: 8 migration files
* **Confirmed next migration**: 044_cedar_sage_custom_pricing.sql
* **Existing brand config path**: storefront/config/brand.config.ts
* **Existing product form path**: storefront/app/admin/(panel)/products/ProductForm.tsx
* **Existing checkout path**: storefront/app/(shop)/checkout/page.tsx
* **Existing admin layout path**: storefront/app/admin/(panel)/layout.tsx
* **Existing settings path**: storefront/app/admin/(panel)/settings/page.tsx
* **Existing product interactive path**: storefront/app/(shop)/product/[slug]/ProductInteractive.tsx
* **Any missing/renamed planned files**: None. All planned file paths were confirmed to exist exactly as expected.

## Deferred Features

Do not build in Phase 1:
* Calendar availability
* Delivery radius automation
* Full Stripe-first checkout
* Custom cake builder
* Loyalty/rewards
* SMS notifications
* Advanced inventory automation
* Gift cards

## Acceptance Criteria for Future Build Phase

The build is not complete until:
* our baker can change a product price from admin.
* Public price updates without code.
* our baker can add a menu item.
* our baker can hide an unavailable item.
* our baker can upload/change a product photo.
* our baker can mark cheesecake/custom desserts as quote-only.
* our baker can mark sourdough as preorder/weekend-only.
* Customer can submit an order request.
* Order request appears in admin.
* our baker can update request status/admin notes.
* Email alert is attempted.
* Backend rejects invalid checkout attempts.
* No old hardcoded menu prices appear.

## Phase 2 Implementation Notes

* **Actual migration filename used**: `api/app/migrations/044_cedar_sage_custom_pricing.sql`
* **Backend routes created**:
  * Public:
    * `POST /api/order-requests` - Create order requests, attempt email notifications
  * Admin:
    * `GET /api/admin/order-requests` - List order requests with filters and pagination
    * `GET /api/admin/order-requests/{id}` - Retrieve details of a single request
    * `PATCH /api/admin/order-requests/{id}` - Update request status and admin notes
* **Admin fields added**:
  * Pricing Mode (fixed, starting_at, quote_only, seasonal, unavailable)
  * Availability Status (available, sold_out, preorder_only, weekend_only, seasonal, quote_only, unavailable, hidden)
  * Lead Time Days (numeric)
  * Preorder-Only flag (boolean)
  * Weekend-Only flag (boolean)
  * Quote-Only flag (boolean)
  * Allergy Notes (text)
  * Pickup Notes (text)
* **Checkout protection implemented**:
  * Backend: Enforced in `api/app/services/order_service.py` to prevent checking out if a product/variant is zero-priced, quote-only, seasonal, unavailable, or hidden.
  * Frontend: Hide buy buttons/cart actions and display a custom order request CTA pointing to `/custom-orders` on custom or quote-only products.
* **Tests added**:
  * Backend: `api/tests/test_cedar_sage_custom_pricing.py` (checks checkout protections, public order submission, email resilience, admin list/update, and authentication security).
  * Frontend: `storefront/__tests__/lib/format.test.ts` (verifies `formatCents(0)` returns "Price to be confirmed").
* **Deferred items**:
  * Public site redesign polish (e.g. customized styling of general storefront, theme changes) is deferred to Phase 3.
  * Calendar-based scheduling, automated delivery radius verification, and custom cake constructor are deferred.

