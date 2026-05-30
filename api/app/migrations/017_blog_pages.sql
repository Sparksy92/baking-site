-- Blog / CMS pages

CREATE TABLE pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content_html TEXT NOT NULL DEFAULT '',
    meta_title TEXT,
    meta_description TEXT,
    featured_image_url TEXT,
    page_type TEXT NOT NULL DEFAULT 'page',  -- 'page' | 'blog_post'
    status TEXT NOT NULL DEFAULT 'draft',    -- 'draft' | 'published'
    author TEXT,
    published_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_pages_slug ON pages(slug);
CREATE INDEX idx_pages_type_status ON pages(page_type, status);
CREATE INDEX idx_pages_published ON pages(published_at);
