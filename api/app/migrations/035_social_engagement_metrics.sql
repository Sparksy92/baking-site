-- 035_social_engagement_metrics.sql
-- Sprint 5: Store engagement metrics pulled from Meta/LinkedIn APIs

-- Add metrics columns to social_posts for reach/impressions/engagement
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS reach INTEGER DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS comments_count INTEGER DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS shares INTEGER DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0;
ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS metrics_updated_at TIMESTAMP WITH TIME ZONE;

-- Content template library: reusable templates for blog/social generation
CREATE TABLE IF NOT EXISTS content_templates (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,              -- e.g. "New Product Drop"
    template_type   TEXT NOT NULL DEFAULT 'blog',  -- 'blog' | 'social_facebook' | 'social_instagram' | etc.
    prompt_template TEXT NOT NULL,              -- the AI prompt with placeholders like {product_name}
    variables       TEXT NOT NULL DEFAULT '',  -- comma-separated list: "product_name,price,sale_percent"
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    usage_count     INTEGER NOT NULL DEFAULT 0, -- track which templates get used
    created_by      TEXT NOT NULL DEFAULT 'system',
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed default templates
INSERT INTO content_templates (name, template_type, prompt_template, variables, created_by)
VALUES
    ('New Product Drop', 'blog', 'Write an exciting blog post announcing our new {product_name}. Price: {price}. Highlight: {highlight}. Tone: energetic and exclusive.', 'product_name,price,highlight', 'system'),
    ('Sale Announcement', 'blog', 'Write a blog post announcing a {sale_percent} sale. Include urgency and clear CTA. Products on sale: {products}. Sale ends {end_date}.', 'sale_percent,products,end_date', 'system'),
    ('Behind the Scenes', 'blog', 'Write a personal behind-the-scenes blog post about {topic}. Include a photo description and authentic voice.', 'topic', 'system'),
    ('Style Guide Feature', 'blog', 'Write a style guide blog post featuring {product_name}. Show how to wear it with {pairing_item}. Include styling tips.', 'product_name,pairing_item', 'system'),
    ('Flash Sale - Instagram', 'social_instagram', 'Flash sale! {product_name} is {sale_percent} off for 24 hours only. Tap to shop! {hashtags}', 'product_name,sale_percent,hashtags', 'system'),
    ('New Drop - Facebook', 'social_facebook', 'Just dropped: {product_name}. This one is special because {highlight}. What do you think? Shop link in bio.', 'product_name,highlight', 'system')
ON CONFLICT DO NOTHING;

-- Index for template lookup
CREATE INDEX IF NOT EXISTS idx_content_templates_type_active
    ON content_templates (template_type, is_active);
