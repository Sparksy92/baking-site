export const SCHEMA_SQL = `-- Cedar & Sage Homestead Vercel-Lite Database Schema

CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    image_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    image_url TEXT,
    price_cents INTEGER NOT NULL DEFAULT 0,
    pricing_mode VARCHAR(50) NOT NULL DEFAULT 'fixed', -- fixed, starting_at, quote_only, seasonal
    availability_status VARCHAR(50) NOT NULL DEFAULT 'available', -- available, preorder, weekend_only, sold_out, seasonal, hidden
    lead_time_days INTEGER NOT NULL DEFAULT 0,
    allergy_notes TEXT,
    pickup_notes TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS order_requests (
    id SERIAL PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(50),
    requested_items JSONB NOT NULL,
    desired_date DATE,
    pickup_or_delivery VARCHAR(50) NOT NULL DEFAULT 'pickup',
    preferred_contact_method VARCHAR(50) NOT NULL DEFAULT 'email',
    allergy_notes TEXT,
    special_instructions TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'new', -- new, reviewed, quoted, accepted, completed, cancelled
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS site_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT
);

CREATE TABLE IF NOT EXISTS media_assets (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    pathname TEXT,
    filename TEXT,
    alt_text TEXT,
    content_type TEXT,
    size_bytes INTEGER,
    source TEXT DEFAULT 'vercel_blob',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

export const SEED_SQL = `-- Seed default Cedar & Sage categories
INSERT INTO categories (name, slug, description, sort_order) VALUES
('Baked Fresh', 'baked-fresh', 'Freshly baked breads, buns, and sourdoughs from our homestead oven.', 1),
('Desserts', 'desserts', 'Cakes, cheesecakes, cinnamon rolls, and sweet treats.', 2),
('Pantry', 'pantry', 'Homemade jams, jellies, pickled goods, simmer pots, and dried mixes.', 3),
('Home & Body', 'home-body', 'Handmade tallow lotions, lip balms, salves, and herbal oils.', 4),
('Oven Fund', 'oven-fund', 'Support our homestead baking by contributing to the wood-fired oven fund.', 5)
ON CONFLICT (slug) DO NOTHING;

-- Seed default menu items
INSERT INTO menu_items (name, slug, category_id, description, image_url, price_cents, pricing_mode, availability_status, lead_time_days, allergy_notes, pickup_notes, sort_order, is_featured) VALUES
-- Baked Fresh
('Artisan Bread', 'artisan-bread', (SELECT id FROM categories WHERE slug = 'baked-fresh'), 'Rustic, crusty white bread baked fresh by request.', '/images/products/artisan-bread.jpg', 800, 'fixed', 'available', 1, 'Contains wheat/gluten.', 'Best enjoyed fresh on pickup day.', 1, true),
('Sandwich Loaf', 'sandwich-loaf', (SELECT id FROM categories WHERE slug = 'baked-fresh'), 'Soft, sliceable homestead sandwich loaf.', '/images/products/sandwich-loaf.jpg', 800, 'fixed', 'available', 1, 'Contains wheat/gluten, dairy (butter).', 'Store in a sealed bag.', 2, false),
('Bagels', 'bagels', (SELECT id FROM categories WHERE slug = 'baked-fresh'), 'Pack of 6 chewy, hand-rolled bagels (Plain, Sesame, or Everything).', '/images/products/bagels.jpg', 1200, 'fixed', 'available', 2, 'Contains wheat/gluten. May contain sesame.', 'Toasting recommended if not eaten fresh.', 3, true),
('Buns', 'buns', (SELECT id FROM categories WHERE slug = 'baked-fresh'), 'Pack of 6 soft dinner or brioche hamburger buns.', '/images/products/buns.jpg', 800, 'fixed', 'available', 1, 'Contains wheat/gluten, eggs, dairy.', 'Bake fresh for your weekend dinners.', 4, false),
('Sourdough', 'sourdough', (SELECT id FROM categories WHERE slug = 'baked-fresh'), 'Wild-fermented artisan sourdough. Available for weekend preorders only.', '/images/products/sourdough.jpg', 1000, 'fixed', 'weekend_only', 3, 'Contains wheat/gluten.', 'Preorders close Wednesday evening for weekend pickup.', 5, true),

-- Desserts
('Cinnamon Rolls', 'cinnamon-rolls', (SELECT id FROM categories WHERE slug = 'desserts'), 'Pack of 4 large, gooey cinnamon rolls with cream cheese icing.', '/images/products/cinnamon-rolls.jpg', 1600, 'fixed', 'available', 1, 'Contains wheat, dairy, eggs.', 'Warm for 15-20 seconds in microwave before serving.', 1, true),
('Banana Bread', 'banana-bread', (SELECT id FROM categories WHERE slug = 'desserts'), 'Moist, rich banana bread loaf. Optional chocolate chips or walnuts.', '/images/products/banana-bread.jpg', 1000, 'starting_at', 'available', 1, 'Contains wheat, eggs, dairy. May contain nuts.', 'Great toasted with butter.', 2, false),
('Muffins', 'muffins', (SELECT id FROM categories WHERE slug = 'desserts'), 'Pack of 6 freshly baked muffins (Blueberry, Lemon Poppyseed, or Bran).', '/images/products/muffins.jpg', 1200, 'fixed', 'available', 1, 'Contains wheat, eggs, dairy.', 'Baked fresh on pickup morning.', 3, false),
('Basic Cookies', 'basic-cookies', (SELECT id FROM categories WHERE slug = 'desserts'), 'Pack of 12 classic cookies (Chocolate Chip, Oatmeal Raisin, or Ginger).', '/images/products/basic-cookies.jpg', 1500, 'fixed', 'available', 1, 'Contains wheat, eggs, dairy.', 'Specify cookie choice in special instructions.', 4, false),
('Special Cookies', 'special-cookies', (SELECT id FROM categories WHERE slug = 'desserts'), 'Custom decorated sugar cookies or specialty holiday bakes.', '/images/products/special-cookies.jpg', 0, 'quote_only', 'preorder', 5, 'Contains wheat, eggs, dairy.', 'Requires custom consultation.', 5, false),
('Cheesecakes', 'cheesecakes', (SELECT id FROM categories WHERE slug = 'desserts'), 'Rich, creamy cheesecakes (9-inch). Classic, Raspberry Swirl, or Caramel Pecan.', '/images/products/cheesecakes.jpg', 4500, 'starting_at', 'available', 3, 'Contains dairy, eggs, wheat.', 'Keep refrigerated.', 6, true),
('Custom Desserts', 'custom-desserts', (SELECT id FROM categories WHERE slug = 'desserts'), 'Custom celebration cakes, cupcakes, and dessert platters.', '/images/products/custom-desserts.jpg', 0, 'quote_only', 'preorder', 7, 'Allergens depend on request.', 'Please submit request form 1-2 weeks in advance.', 7, false),

-- Pantry
('Jams/Jellies', 'jams-jellies', (SELECT id FROM categories WHERE slug = 'pantry'), 'Small-batch, water-bath canned jams (Strawberry, Raspberry, or Peach).', '/images/products/jams.jpg', 800, 'fixed', 'available', 0, 'Gluten-free.', 'Refrigerate after opening.', 1, false),
('Pickled Goods', 'pickled-goods', (SELECT id FROM categories WHERE slug = 'pantry'), 'Dill pickles, pickled red onions, and hot pepper rings.', '/images/products/pickled-goods.jpg', 900, 'fixed', 'available', 0, 'Gluten-free.', 'Refrigerate after opening.', 2, false),
('Simmer Pots', 'simmer-pots', (SELECT id FROM categories WHERE slug = 'pantry'), 'Dehydrated stovetop potpourri mix (Citrus, Pine, Cinnamon, Cloves).', '/images/products/simmer-pots.jpg', 600, 'fixed', 'available', 0, 'Non-edible.', 'Add to a pot of water on low heat for a fragrant home.', 3, false),
('Dried Mix Jars', 'dried-mix-jars', (SELECT id FROM categories WHERE slug = 'pantry'), 'Layered dry ingredients in mason jars (Cookie mix, soup mix, or cocoa).', '/images/products/dried-mix-jars.jpg', 1200, 'fixed', 'available', 0, 'Allergens listed on tag.', 'Add wet ingredients and bake.', 4, false),
('Bundles', 'bundles', (SELECT id FROM categories WHERE slug = 'pantry'), 'Special holiday or breakfast gift baskets.', '/images/products/bundles.jpg', 0, 'quote_only', 'seasonal', 0, 'Depends on bundle choices.', 'Contact us for seasonal options.', 5, false),

-- Home & Body
('Lotions', 'lotions', (SELECT id FROM categories WHERE slug = 'home-body'), 'Hand-rendered grass-fed beef tallow body butter (Lavender or Unscented).', '/images/products/lotions.jpg', 1500, 'fixed', 'available', 0, 'Natural ingredients. Tallow, olive oil, essential oils.', 'Store in a cool place to prevent melting.', 1, false),
('Lip Balms', 'lip-balms', (SELECT id FROM categories WHERE slug = 'home-body'), 'Moisturizing beeswax lip balm (Peppermint, Honey, or Sweet Orange).', '/images/products/lip-balms.jpg', 400, 'fixed', 'available', 0, 'Natural ingredients. Beeswax, coconut oil, shea butter.', 'Store away from direct heat.', 2, false),
('Salves', 'salves', (SELECT id FROM categories WHERE slug = 'home-body'), 'Healing herbal salves (Calendula, Plantain, or Dandelion).', '/images/products/salves.jpg', 1200, 'fixed', 'available', 0, 'Infused organic oils, beeswax.', 'For external use only.', 3, false),
('Herbal Oils', 'herbal-oils', (SELECT id FROM categories WHERE slug = 'home-body'), 'Cold-infused body and facial oils.', '/images/products/herbal-oils.jpg', 1800, 'fixed', 'available', 0, 'Carrier oils, dried organic herbs.', 'Keep out of direct sunlight.', 4, false),

-- Oven Fund
('Oven Fund Contribution', 'oven-fund-contribution', (SELECT id FROM categories WHERE slug = 'oven-fund'), 'Contribute to our building fund for a wood-fired brick oven.', '/images/products/oven-fund.jpg', 1000, 'starting_at', 'available', 0, 'Non-refundable contribution.', 'Thank you for supporting our homestead bakery!', 1, true)
ON CONFLICT (slug) DO NOTHING;

-- Seed default site settings
INSERT INTO site_settings (key, value) VALUES
('about_content', 'Welcome to Cedar & Sage Homestead. We are a family-run homestead kitchen located in the heart of our community, focusing on small-batch artisan sourdoughs, freshly baked breads, home-canned pantry preserves, and hand-crafted body care items. Every loaf we bake is shaped by hand and crafted with care, using organic and locally sourced ingredients wherever possible. Because we believe in freshness and reducing waste, we bake exclusively by request. Your support helps build our homestead, including our dream of a wood-fired brick oven to serve our community even better!'),
('faq_content', 'Q: How do I order?
A: Browse our menu, add items to your request list, and submit the order request. We will review it and send an e-transfer payment confirmation within 24 hours.

Q: When is pickup?
A: Pickups are generally available Friday afternoons and Saturday mornings. We bake everything fresh on the day of pickup.

Q: Do you offer delivery?
A: We offer local delivery within our community for a flat $5 fee on orders over $30. Otherwise, pickups are free from our homestead.

Q: Is your sourdough organic?
A: Yes, our sourdough starter is fed exclusively with organic unbleached flour, and we use organic flours for our classic loaves.

Q: Can I request custom items?
A: Absolutely! Use the Custom Orders page to request birthday cakes, large bun counts, or specific allergy-safe items.'),
('pickup_instructions', 'Pickups are located at our homestead (address provided upon order confirmation). Please specify your desired pickup window in your order request. Fresh items are placed in the pickup cabinet at your scheduled time.'),
('payment_instructions', 'Payments are accepted via E-transfer to payments@cedarandsagehomestead.ca. Once your request is reviewed, we will email you the total and confirmation. Payment is required to secure your baking slot.'),
('preorder_instructions', 'Preorders for weekend sourdough close Wednesday at 5:00 PM. This allows us to feed the starter and complete the long cold-fermentation process.'),
('allergy_disclaimer', 'Our products are made in a home kitchen that handles wheat, nuts, dairy, eggs, and soy. While we take every precaution to prevent cross-contamination, we cannot guarantee a completely allergen-free environment.'),
('contact_email', 'hello@cedarandsagehomestead.ca'),
('etransfer_email', 'payments@cedarandsagehomestead.ca'),
('oven_fund_goal', '2500'),
('oven_fund_current_amount', '1620'),
('oven_fund_description', 'We are building a traditional wood-fired brick oven on the homestead! This oven will allow us to bake authentic sourdough boules, crusty flatbreads, and community-sized batches using renewable firewood. Every contribution brings us closer to sharing the warmth of brick-oven baking with our neighbors.'),
('store_announcement', 'Preorders for Saturday sourdough are open! Order by Wednesday 5 PM.')
ON CONFLICT (key) DO NOTHING;
`;
