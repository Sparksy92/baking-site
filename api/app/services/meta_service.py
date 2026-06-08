import html
import logging
import httpx
from datetime import datetime, timezone
import aiofiles

from app.config import get_settings
from app.database import db_connection

logger = logging.getLogger(__name__)

async def download_image(url: str, filename: str) -> str | None:
    """Download an image from a URL and save it to the local uploads directory."""
    try:
        settings = get_settings()
        # Use a sub-directory for blog media
        upload_dir = settings.uploads_dir.parent / "blog"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = upload_dir / filename
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=30.0)
            response.raise_for_status()
            
            async with aiofiles.open(file_path, 'wb') as f:
                await f.write(response.content)
                
        # Return the public URL path
        return f"/images/uploads/blog/{filename}"
    except Exception as e:
        logger.error(f"Failed to download image {url}: {e}")
        return None

async def _process_meta_posts(posts: list, platform: str):
    """Process posts and insert them into the database as blog_post drafts."""
    settings = get_settings()
    async with db_connection() as db:
        for post in posts:
            post_id = post.get('id')
            caption = post.get('caption') or post.get('message')
            
            # Skip posts without any text
            if not caption:
                continue
                
            external_id = f"{platform}-{post_id}"
            
            # Check if this post already exists
            existing = await db.execute("SELECT id FROM pages WHERE external_id = ?", (external_id,))
            if await existing.fetchone():
                continue
                
            # Prepare metadata — published_at is TEXT in pages table
            timestamp = post.get('timestamp') or post.get('created_time')
            if timestamp:
                try:
                    published_at = datetime.fromisoformat(timestamp.replace('Z', '+00:00')).isoformat()
                except (ValueError, AttributeError):
                    published_at = datetime.now(timezone.utc).isoformat()
            else:
                published_at = datetime.now(timezone.utc).isoformat()
                
            media_url = post.get('media_url') or post.get('full_picture')
            local_image_url = None
            if media_url:
                # Instagram URLs expire, so download them
                filename = f"{external_id}.jpg"
                local_image_url = await download_image(media_url, filename)
                
            # Generate a title from the first sentence or first 50 chars
            title = caption.split('\n')[0].strip()
            if len(title) > 50:
                title = title[:47] + "..."
                
            slug = f"post-{external_id}"

            content_html = "".join(
                f"<p>{html.escape(para.strip())}</p>"
                for para in caption.split("\n")
                if para.strip()
            )

            # Insert into database
            try:
                await db.execute(
                    """
                    INSERT INTO pages (title, slug, content_html, featured_image_url, page_type, status, author, published_at, external_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        title,
                        slug,
                        content_html,
                        local_image_url,
                        'blog_post',
                        'draft',
                        settings.brand_name,
                        published_at,
                        external_id
                    )
                )
                await db.commit()
                logger.info(f"Successfully synced {platform} post: {post_id}")
            except Exception as e:
                logger.error(f"Error inserting post {post_id} into database: {e}")
                await db.rollback()

async def sync_instagram_posts():
    """Fetch recent posts from Instagram."""
    settings = get_settings()
    if not settings.meta_page_access_token or not settings.meta_instagram_account_id:
        return
        
    url = f"https://graph.facebook.com/v19.0/{settings.meta_instagram_account_id}/media"
    params = {
        "fields": "id,caption,media_url,timestamp,media_type",
        "access_token": settings.meta_page_access_token,
        "limit": 10
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            
            # Filter out videos if we only want images (or handle thumbnails)
            posts = [p for p in data.get('data', []) if p.get('media_type') in ('IMAGE', 'CAROUSEL_ALBUM')]
            await _process_meta_posts(posts, "ig")
    except Exception as e:
        logger.error(f"Failed to sync Instagram posts: {e}")

async def sync_facebook_posts():
    """Fetch recent posts from Facebook."""
    settings = get_settings()
    if not settings.meta_page_access_token or not settings.meta_facebook_page_id:
        return
        
    url = f"https://graph.facebook.com/v19.0/{settings.meta_facebook_page_id}/posts"
    params = {
        "fields": "id,message,full_picture,created_time",
        "access_token": settings.meta_page_access_token,
        "limit": 10
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            await _process_meta_posts(data.get('data', []), "fb")
    except Exception as e:
        logger.error(f"Failed to sync Facebook posts: {e}")

async def run_social_sync():
    """Run both Instagram and Facebook syncs."""
    await sync_instagram_posts()
    await sync_facebook_posts()
