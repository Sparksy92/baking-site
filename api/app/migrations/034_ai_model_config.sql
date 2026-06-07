-- 034_ai_model_config.sql
-- Per-task AI model configuration.
-- Allows the admin to override which model handles each content task
-- without changing code or redeploying.

CREATE TABLE IF NOT EXISTS ai_model_configs (
    id              SERIAL PRIMARY KEY,
    task_type       TEXT NOT NULL UNIQUE,   -- matches AITaskType enum in ai_router.py
    provider        TEXT NOT NULL DEFAULT 'auto',   -- 'openai' | 'gemini' | 'auto'
    model           TEXT NOT NULL DEFAULT '',       -- e.g. 'gpt-4o-mini', 'gemini-1.5-flash'; '' = use provider default
    temperature     REAL NOT NULL DEFAULT 0.7,
    max_tokens      INTEGER NOT NULL DEFAULT 500,
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    notes           TEXT NOT NULL DEFAULT '',       -- admin-visible description
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed defaults — these match the ModelRouter defaults in ai_router.py
-- Admin can override any of these from Admin → Settings → AI Models
INSERT INTO ai_model_configs (task_type, provider, model, temperature, max_tokens, notes)
VALUES
    ('blog_post',        'auto', 'gpt-4o',            0.7,  2000, 'Long-form blog content. Needs depth and reasoning. Best model.'),
    ('social_caption',   'auto', 'gpt-4o-mini',       0.8,  400,  'Short social captions. Fast and cheap. Mini is plenty.'),
    ('social_reply',     'auto', 'gpt-4o',            0.6,  200,  'Replies to comments. Tone-sensitive — use best model.'),
    ('hashtag_gen',      'auto', 'gpt-4o-mini',       0.5,  100,  'Hashtag suggestions. Deterministic, cheapest task.'),
    ('seo_synthesis',    'auto', 'gpt-4o-mini',       0.3,  600,  'Structured extraction of SEO context. Low creativity needed.'),
    ('product_social',   'auto', 'gpt-4o-mini',       0.8,  400,  'Product-to-social captions. Short form, mini is fine.'),
    ('image_alt_text',   'auto', 'gpt-4o-mini',       0.2,  80,   'Alt text generation. Factual and brief.')
ON CONFLICT (task_type) DO NOTHING;
