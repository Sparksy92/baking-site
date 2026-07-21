"""
BadAss Elder — blog post seed script
Run from: /home/rezzer/dev/badasselder-web/api/
Usage:  python seed_bae_blog.py [--reset]

--reset   Deletes existing blog posts before inserting.
          Without --reset, safe to re-run (upserts by slug).
"""
import asyncio
import os
import sys
import asyncpg

_user = os.environ.get("POSTGRES_USER", "ecommerce")
_pass = os.environ.get("POSTGRES_PASSWORD", "ecommerce_password")
_host = os.environ.get("POSTGRES_HOST", "localhost")
_port = os.environ.get("POSTGRES_PORT", "5432")
_db   = os.environ.get("POSTGRES_DB", "badasselder")
DB_URL = f"postgresql://{_user}:{_pass}@{_host}:{_port}/{_db}"

POSTS = [
    {
        "title": "Why We Built BadAss Elder",
        "slug": "why-we-built-badasselder",
        "page_type": "blog_post",
        "status": "published",
        "author": "Elder Energy Apparel",
        "meta_title": "Why We Built BadAss Elder — Elder Energy Apparel",
        "meta_description": (
            "BadAss Elder began with a real person. This is the story of Thomas, "
            "a Wabano men's healing circle, a birthday shirt, and how a feeling "
            "became a brand."
        ),
        "featured_image_url": "/images/about/badasselder-original-shirt.webp",
        "noindex": False,
        "canonical_url": None,
        "content_html": """
<h2>It started with Thomas.</h2>

<p>BadAss Elder began with Thomas R. Louttit — a respected Elder, Knowledge Keeper, firekeeper, teacher, pipe-carrier, mentor, and keeper of Miitig Healing Lodge.</p>

<p>I met Thomas through a Wabano men's healing circle. I would bring my dad with me. Over time Thomas became more than someone I listened to — he became part of a healing story in our family.</p>

<p>That kind of presence cannot be manufactured. It cannot be reduced to a logo. It carries humour. It carries survival. It carries pain, healing, responsibility, and love.</p>

<h2>The shirt came first.</h2>

<p>The original BadAss Elder shirt started as a birthday present for Thomas. It was not planned as a brand. It was a way to honour him — with humour, respect, and truth.</p>

<figure class="article-shirt-art">
  <img src="/images/about/badasselder-original-shirt.webp" alt="Original BadAss Elder concept artwork" />
  <figcaption>Original BadAss Elder concept artwork.</figcaption>
</figure>

<p>His daughter later said it became his favourite shirt. The one he wears everywhere. The one they can hardly get him to take off.</p>

<blockquote><p>That is when the idea became bigger than a shirt.</p></blockquote>

<h2>The character is fictional. The feeling is not.</h2>

<p>The elder character in BadAss Elder is fictional — built to carry the spirit of that energy without misrepresenting the man. The character is fictionalized so the story can travel without distorting the person.</p>

<p>Thomas is not a mascot. He is the reason this brand exists at all.</p>

<h2>Why it matters.</h2>

<p>&#8220;BadAss&#8221; is not a gimmick. Elders in Indigenous communities carry a weight most people don&#8217;t see. They&#8217;ve navigated systems designed to erase them, held families together through rupture, kept languages and stories alive when institutions tried to bury them. They did not survive by being meek. They survived by being relentless — with love, with humour, with grit.</p>

<p>We do not trade in cultural clichés. There are no decorative motifs borrowed without meaning. What you see in this brand comes from a real relationship — a real person who shaped real people who built this.</p>

<blockquote><p>&#8220;The character is fictional. The feeling is not.&#8221;</p></blockquote>

<div class="miitig-callout">
<h2>Giving back to healing.</h2>
<p>As BadAss Elder grows, our intention is for a portion of proceeds from BadAss Elder products to support <strong>Miitig Healing Lodge</strong> and healing work connected to community, recovery, wellness, and rebuilding.</p>
<p>Miitig Healing Lodge is connected to the work of Thomas R. Louttit — to healing, ceremony, land-based education, and community recovery. This is not a marketing line. It is a direction we are building toward.</p>
<a href="https://www.facebook.com/miitighealinglodge" target="_blank" rel="noopener noreferrer" class="miitig-link">Learn about Miitig Healing Lodge ↗</a>
</div>

<h2>The first drop.</h2>

<p>The first drop is hoodies and tees. Six pieces. Each one built around a real feeling: healing, humour, survival, and standing back up.</p>

<p>For the ones still healing, still laughing, still standing.</p>
""".strip(),
        "published_at": "2025-06-01T12:00:00+00:00",
    },
]


async def seed(reset: bool = False) -> None:
    conn = await asyncpg.connect(DB_URL)
    try:
        if reset:
            await conn.execute("DELETE FROM pages WHERE page_type = 'blog_post'")
            print("Cleared existing blog posts.")

        for post in POSTS:
            existing = await conn.fetchrow(
                "SELECT id FROM pages WHERE slug = $1", post["slug"]
            )
            published_at = post.get("published_at")
            if existing:
                await conn.execute(
                    """
                    UPDATE pages SET
                        title = $1, page_type = $2, status = $3, author = $4,
                        meta_title = $5, meta_description = $6,
                        featured_image_url = $7, noindex = $8, canonical_url = $9,
                        content_html = $10, published_at = $11,
                        updated_at = NOW()
                    WHERE slug = $12
                    """,
                    post["title"], post["page_type"], post["status"], post["author"],
                    post["meta_title"], post["meta_description"],
                    post["featured_image_url"], post["noindex"], post["canonical_url"],
                    post["content_html"], published_at,
                    post["slug"],
                )
                print(f"  Updated: {post['slug']}")
            else:
                await conn.execute(
                    """
                    INSERT INTO pages (
                        title, slug, page_type, status, author,
                        meta_title, meta_description, featured_image_url,
                        noindex, canonical_url, content_html, published_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    """,
                    post["title"], post["slug"], post["page_type"], post["status"],
                    post["author"], post["meta_title"], post["meta_description"],
                    post["featured_image_url"], post["noindex"], post["canonical_url"],
                    post["content_html"], published_at,
                )
                print(f"  Inserted: {post['slug']}")
    finally:
        await conn.close()


if __name__ == "__main__":
    reset = "--reset" in sys.argv
    asyncio.run(seed(reset=reset))
    print("Done.")
