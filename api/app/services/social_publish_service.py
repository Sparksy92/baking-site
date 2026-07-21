"""Outbound social publishing service.

Sprint 3: Facebook and Instagram via Meta Graph API.
Sprint 4: LinkedIn, TikTok, X will be added here.

Each platform returns a platform_post_id on success or raises on failure.
Callers store the result in social_posts and update status accordingly.
"""
from __future__ import annotations

import logging
import httpx

from app.config import get_settings
from app.services.utm_service import tag_content_links

logger = logging.getLogger(__name__)

GRAPH_BASE = "https://graph.facebook.com/v19.0"


class PublishError(Exception):
    """Raised when a platform API call fails. Message is user-displayable."""


# ── Facebook ─────────────────────────────────────────────────────────────────

async def publish_to_facebook(
    content: str,
    image_url: str | None,
    video_url: str | None = None,
    content_type: str = "feed",
) -> str:
    """Post to the configured Facebook Page using the OAuth token stored in DB.

    Dispatches to the correct Graph API endpoint based on available media:
    - video_url present → /{page_id}/videos  (content_type='reel' enables Reels)
    - image_url present → /{page_id}/photos
    - neither           → /{page_id}/feed  (text post)

    Returns the platform post ID (e.g. '123456789_987654321').
    Raises PublishError on failure.
    """
    from app.database import db_connection
    from app.services.social.service import get_decrypted_page_token
    from app.services.social.providers.facebook import FacebookProvider
    from app.services.social.providers.base import SocialProviderError
    from app.services.social.token_crypto import TokenCryptoError

    settings = get_settings()

    try:
        async with db_connection() as db:
            connection, token = await get_decrypted_page_token(db, provider="facebook")
    except (ValueError, TokenCryptoError) as e:
        raise PublishError(f"Facebook not connected. Connect Facebook in Admin → Social → Platforms. ({e})") from e

    page_id = connection.get("external_account_id")
    tagged_content = tag_content_links(content, "facebook", "social-post")
    provider = FacebookProvider()

    try:
        if content_type == "story":
            if not image_url:
                raise PublishError("Facebook Stories require an image URL.")
            absolute_image = _make_absolute(image_url, settings.store_domain)
            result = await provider.publish_story(token, page_id, absolute_image)
        elif video_url:
            absolute_video = _make_absolute(video_url, settings.store_domain)
            result = await provider.publish_video_post(
                token, page_id, tagged_content, absolute_video,
                is_reel=(content_type == "reel"),
            )
        elif image_url:
            absolute_image = _make_absolute(image_url, settings.store_domain)
            result = await provider.publish_image_post(token, page_id, tagged_content, absolute_image)
        else:
            result = await provider.publish_text_post(token, page_id, tagged_content)
    except SocialProviderError as e:
        raise PublishError(f"Facebook publish failed: {e}") from e

    post_id = result.get("id")
    if not post_id:
        raise PublishError("Facebook returned no post ID")

    logger.info(f"Published to Facebook: post_id={post_id} type={content_type}")
    return post_id


# ── Instagram ────────────────────────────────────────────────────────────────

async def publish_to_instagram(
    content: str,
    image_url: str | None,
    video_url: str | None = None,
    content_type: str = "feed",
    thumb_offset_ms: int | None = None,
    product_tags: list[dict] | None = None,
) -> str:
    """Post to the configured Instagram Business Account via Meta Graph API.

    Supports:
    - Image posts  (image_url set, content_type='feed')
    - Reels        (video_url set, content_type='reel')

    Instagram requires a 2-step process:
      1. Create a media container  →  /{ig_account_id}/media
      2. Publish the container     →  /{ig_account_id}/media_publish

    For video/Reels the container may take time to process; we poll its status
    up to 10 times (5 s apart) before attempting to publish.

    Uses the OAuth page access token stored in DB (same pattern as Facebook).
    Falls back to META_PAGE_ACCESS_TOKEN env var for backwards compatibility.
    Raises PublishError on failure.
    """
    import asyncio as _asyncio
    from app.database import db_connection
    from app.services.social.token_crypto import TokenCryptoError

    settings = get_settings()

    # Resolve token + account ID — prefer OAuth DB token, fall back to env
    ig_account_id: str | None = None
    access_token: str | None = None

    try:
        from app.services.social.service import get_decrypted_page_token
        async with db_connection() as db:
            connection, access_token = await get_decrypted_page_token(db, provider="instagram")
        ig_account_id = connection.get("instagram_account_id") or connection.get("external_account_id")
    except (ValueError, TokenCryptoError, Exception):
        access_token = settings.meta_page_access_token
        ig_account_id = settings.meta_instagram_account_id

    if not access_token or not ig_account_id:
        raise PublishError(
            "Instagram not connected. Connect Instagram in Admin → Social → Platforms "
            "or set META_PAGE_ACCESS_TOKEN and META_INSTAGRAM_ACCOUNT_ID."
        )

    if not image_url and not video_url:
        raise PublishError("Instagram requires an image or video URL.")

    # Instagram Story — separate fast path (no polling needed)
    if content_type == "story":
        if not image_url:
            raise PublishError("Instagram Stories require an image URL.")
        from app.services.social.providers.instagram import InstagramProvider
        absolute_image = _make_absolute(image_url, settings.store_domain)
        provider = InstagramProvider()
        try:
            result = await provider.publish_story(access_token, ig_account_id, absolute_image)
        except Exception as exc:
            raise PublishError(f"Instagram Story publish failed: {exc}") from exc
        media_id = result.get("id")
        if not media_id:
            raise PublishError("Instagram returned no media ID for Story")
        logger.info(f"Published to Instagram Story: media_id={media_id}")
        return media_id

    is_reel = content_type == "reel" or bool(video_url)

    container_payload: dict = {"caption": content, "access_token": access_token}
    if is_reel and video_url:
        absolute_video = _make_absolute(video_url, settings.store_domain)
        container_payload["video_url"] = absolute_video
        container_payload["media_type"] = "REELS"
        if thumb_offset_ms is not None:
            container_payload["thumb_offset"] = str(thumb_offset_ms)
    elif image_url:
        absolute_image = _make_absolute(image_url, settings.store_domain)
        container_payload["image_url"] = absolute_image

    # IG Shopping product tags (image feed posts only — requires catalogue connected)
    if product_tags and not is_reel and content_type not in ("story", "reel"):
        import json as _json
        container_payload["product_tags"] = _json.dumps(product_tags)

    async with httpx.AsyncClient(timeout=60.0) as client:
        # Step 1 — Create media container
        container_url = f"{GRAPH_BASE}/{ig_account_id}/media"
        try:
            resp = await client.post(container_url, data=container_payload)
            data = resp.json()
        except Exception as e:
            raise PublishError(f"Instagram container creation failed: {e}") from e

        if "error" in data:
            raise PublishError(f"Instagram API error (container): {data['error'].get('message', 'Unknown')}")

        container_id = data.get("id")
        if not container_id:
            raise PublishError("Instagram returned no container ID")

        # Step 1b — Poll container status for video/Reels (image containers are instant)
        if is_reel:
            status_url = f"{GRAPH_BASE}/{container_id}"
            for attempt in range(12):
                await _asyncio.sleep(5)
                try:
                    status_resp = await client.get(
                        status_url,
                        params={"fields": "status_code", "access_token": access_token},
                    )
                    status_data = status_resp.json()
                except Exception:
                    continue
                status_code = status_data.get("status_code", "")
                if status_code == "FINISHED":
                    break
                if status_code == "ERROR":
                    raise PublishError("Instagram video processing failed. Check the video format (MP4, H.264).")
                logger.info(f"Instagram container {container_id} status: {status_code} (attempt {attempt + 1}/12)")
            else:
                raise PublishError("Instagram video container timed out after 60 s. Try again or use a shorter clip.")

        # Step 2 — Publish container
        publish_url = f"{GRAPH_BASE}/{ig_account_id}/media_publish"
        try:
            resp = await client.post(
                publish_url,
                data={"creation_id": container_id, "access_token": access_token},
            )
            data = resp.json()
        except Exception as e:
            raise PublishError(f"Instagram publish step failed: {e}") from e

        if "error" in data:
            raise PublishError(f"Instagram API error (publish): {data['error'].get('message', 'Unknown')}")

        media_id = data.get("id")
        if not media_id:
            raise PublishError("Instagram returned no media ID after publish")

        post_type = "Reel" if is_reel else "image post"
        logger.info(f"Published to Instagram {post_type}: media_id={media_id}")

        # Post hashtags as first comment if platform config requests it
        await _maybe_post_instagram_hashtag_comment(
            client, media_id, access_token, content
        )

        return media_id


async def _maybe_post_instagram_hashtag_comment(
    client: "httpx.AsyncClient",
    media_id: str,
    access_token: str,
    caption: str,
) -> None:
    """If Instagram platform config uses first_comment hashtag mode, post hashtags as first comment."""
    try:
        from app.database import db_connection
        async with db_connection() as db:
            cursor = await db.execute(
                "SELECT hashtag_mode, brand_hashtag FROM social_platform_configs WHERE platform = 'instagram'",
            )
            cfg = await cursor.fetchone()

        if not cfg or cfg["hashtag_mode"] != "first_comment":
            return

        import re
        hashtags = " ".join(re.findall(r"#\w+", caption))
        if cfg.get("brand_hashtag") and cfg["brand_hashtag"] not in hashtags:
            hashtags = f"{hashtags} #{cfg['brand_hashtag']}".strip()
        if not hashtags:
            return

        comment_url = f"{GRAPH_BASE}/{media_id}/comments"
        resp = await client.post(
            comment_url,
            data={"message": hashtags, "access_token": access_token},
        )
        data = resp.json()
        if "error" in data:
            logger.warning(f"Instagram first-comment hashtag failed: {data['error'].get('message')}")
        else:
            logger.info(f"Posted Instagram first-comment hashtags: {hashtags}")
    except Exception as e:
        logger.warning(f"Could not post Instagram first-comment hashtags: {e}")


# ── LinkedIn ─────────────────────────────────────────────────────────────────


async def publish_to_linkedin(
    content: str,
    image_url: str | None = None,
    video_url: str | None = None,
    content_type: str = "feed",
) -> str:
    """Post a LinkedIn Organization Page text, image, or video post using the OAuth connection."""
    from app.database import db_connection
    from app.services.social.providers.linkedin import (
        LINKEDIN_COMMENTARY_LIMIT,
        LINKEDIN_PERMISSION_ERROR,
        LinkedInProvider,
    )
    from app.services.social.service import get_connection
    from app.services.social.token_crypto import decrypt_token

    if not content.strip():
        raise PublishError("LinkedIn posts require commentary.")
    if len(content) > LINKEDIN_COMMENTARY_LIMIT:
        raise PublishError(f"LinkedIn commentary must be {LINKEDIN_COMMENTARY_LIMIT} characters or fewer.")
    async with db_connection() as db:
        connection = await get_connection(db, provider="linkedin", account_type="organization_page")
    if not connection or connection["status"] == "disconnected":
        raise PublishError("LinkedIn Organization Page is not connected.")
    if connection["status"] == "pending_review":
        raise PublishError(LINKEDIN_PERMISSION_ERROR)
    if connection["status"] != "connected":
        raise PublishError(connection.get("last_error") or "LinkedIn connection is not ready.")

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        raise PublishError("LinkedIn token is unavailable. Reconnect LinkedIn.")

    import json as _json
    metadata = _json.loads(connection.get("metadata") or "{}")
    organization_urn = metadata.get("organization_urn") or connection["external_account_id"]
    tagged_content = tag_content_links(content, "linkedin", "social-post")
    provider = LinkedInProvider()

    # content_type='video' on LinkedIn means video post; 'image' means image post
    # Fallback: if video_url is present always use video path regardless of content_type
    use_video = video_url and (content_type in ("video", "feed") or bool(video_url))
    use_image = image_url and not video_url

    try:
        if use_video:
            absolute_video = _make_absolute(video_url, get_settings().store_domain)  # type: ignore[arg-type]
            result = await provider.publish_video_post(access_token, organization_urn, tagged_content, absolute_video)
        elif use_image:
            absolute_image = _make_absolute(image_url, get_settings().store_domain)  # type: ignore[arg-type]
            result = await provider.publish_image_post(access_token, organization_urn, tagged_content, absolute_image)
        else:
            result = await provider.publish_text_post(access_token, organization_urn, tagged_content)
    except Exception as exc:
        raise PublishError(f"LinkedIn publish failed: {exc}") from exc

    post_urn = result.get("id")
    if not post_urn:
        raise PublishError("LinkedIn returned no post URN")
    return str(post_urn)


# ── TikTok ───────────────────────────────────────────────────────────────────

async def publish_to_tiktok(
    content: str,
    video_url: str | None,
    image_url: str | None,
    content_type: str = "feed",
) -> str:
    """Send TikTok video to creator inbox or publish directly (if video.publish scope present).

    content_type='short' maps to a TikTok Short (≤60s). Uses direct_post when the
    video.publish scope is granted; falls back to upload-to-inbox otherwise.

    Returns the publish_id on success.
    Raises PublishError on failure.
    """
    from app.database import db_connection
    from app.services.social.providers.tiktok import TIKTOK_DIRECT_POST_SCOPE, TIKTOK_TITLE_LIMIT, TikTokProvider
    from app.services.social.service import get_connection
    from app.services.social.token_crypto import decrypt_token
    import json as _json

    if not video_url and image_url:
        raise PublishError(
            "TikTok photo posting requires 2-35 images for carousel. "
            "Upload video instead, or create a carousel with multiple images."
        )
    if not video_url:
        raise PublishError("TikTok requires video or photo media. Text-only posts cannot be published to TikTok.")

    title = (content or "").strip()
    if len(title) > TIKTOK_TITLE_LIMIT:
        raise PublishError(f"TikTok captions must be {TIKTOK_TITLE_LIMIT} characters or fewer.")

    async with db_connection() as db:
        connection = await get_connection(db, provider="tiktok", account_type="tiktok_user")
    if not connection or connection["status"] == "disconnected":
        raise PublishError("TikTok account is not connected.")
    if connection["status"] == "pending_review":
        raise PublishError("TikTok app review or required scope approval is missing.")
    if connection["status"] != "connected":
        raise PublishError(connection.get("last_error") or "TikTok connection is not ready.")

    scopes: list[str] = _json.loads(connection["scopes"]) if connection.get("scopes") else []
    if "video.upload" not in scopes and TIKTOK_DIRECT_POST_SCOPE not in scopes:
        raise PublishError("TikTok video.upload or video.publish scope is required.")

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        raise PublishError("TikTok token is unavailable. Reconnect TikTok.")

    provider = TikTokProvider()
    absolute_video = _make_absolute(video_url, get_settings().store_domain)

    try:
        # Prefer direct_post (video.publish) when scope available — needed for Shorts
        if TIKTOK_DIRECT_POST_SCOPE in scopes and provider.direct_post_enabled:
            result = await provider.init_video_direct_post(
                access_token,
                absolute_video,
                title=title,
                privacy_level="PUBLIC_TO_EVERYONE",
            )
        else:
            result = await provider.init_video_upload_to_inbox(access_token, absolute_video)
    except Exception as exc:
        raise PublishError(f"TikTok publish failed: {exc}") from exc

    publish_id = result.get("data", {}).get("publish_id")
    if not publish_id:
        raise PublishError("TikTok returned no publish_id")
    return str(publish_id)


# ── X / Twitter ──────────────────────────────────────────────────────────────

async def publish_to_x(content: str, image_url: str | None = None, video_url: str | None = None) -> str:
    """Publish a text/link post to the connected X account using OAuth2."""
    from app.database import db_connection
    from app.services.social.providers.x import X_MEDIA_DISABLED_ERROR, X_MISSING_WRITE_SCOPE_ERROR, X_WRITE_ACCESS_ERROR, XProvider
    from app.services.social.service import get_connection
    from app.services.social.token_crypto import decrypt_token

    if image_url or video_url:
        raise PublishError(X_MEDIA_DISABLED_ERROR)
    if not content.strip():
        raise PublishError("X/Twitter post text is required.")

    async with db_connection() as db:
        connection = await get_connection(db, provider="x", account_type="user_account")
    if not connection or connection["status"] == "disconnected":
        raise PublishError("X/Twitter account is not connected.")
    if connection["status"] == "pending_api_access":
        raise PublishError(connection.get("last_error") or X_WRITE_ACCESS_ERROR)
    if connection["status"] != "connected":
        raise PublishError(connection.get("last_error") or "X/Twitter connection is not ready.")

    import json

    scopes = json.loads(connection.get("scopes") or "[]")
    if "tweet.write" not in scopes:
        raise PublishError(X_MISSING_WRITE_SCOPE_ERROR)
    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        raise PublishError("X/Twitter token is unavailable. Reconnect X/Twitter.")

    provider = XProvider()
    tagged_content = tag_content_links(content, "x", "social-post")
    try:
        result = await provider.publish_text_post(access_token, tagged_content)
    except Exception as exc:
        raise PublishError(f"X/Twitter publish failed: {exc}") from exc
    post_id = result.get("data", {}).get("id")
    if not post_id:
        raise PublishError("X returned no post ID")
    return str(post_id)


# ── YouTube ───────────────────────────────────────────────────────────────────

def _youtube_mime_type(url: str) -> str:
    """Infer video MIME type from URL extension; default to video/mp4."""
    lower = url.lower().split("?")[0]
    if lower.endswith(".webm"):
        return "video/webm"
    if lower.endswith(".mov"):
        return "video/quicktime"
    if lower.endswith(".avi"):
        return "video/x-msvideo"
    if lower.endswith(".mkv"):
        return "video/x-matroska"
    return "video/mp4"


async def _youtube_refresh_token_if_needed(
    connection: dict,
) -> str:
    """Return a valid access token, refreshing via Google if expired.

    Updates the DB record on refresh. Raises PublishError on failure.
    """
    from datetime import datetime, timezone
    from app.database import db_connection as _db
    from app.services.social.token_crypto import decrypt_token, encrypt_token
    from app.services.social.providers.youtube import YouTubeProvider

    access_token = decrypt_token(connection.get("encrypted_access_token"))
    if not access_token:
        raise PublishError("YouTube token is unavailable. Reconnect YouTube.")

    expires_at = connection.get("token_expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        # Refresh 60 s before expiry to avoid edge cases
        if expires_at <= datetime.now(timezone.utc).replace(second=0):
            refresh_token = decrypt_token(connection.get("encrypted_refresh_token"))
            if not refresh_token:
                raise PublishError("YouTube access token expired and no refresh token. Reconnect YouTube.")
            provider = YouTubeProvider()
            try:
                token_data = await provider.refresh_access_token(refresh_token)
            except Exception as exc:
                raise PublishError(f"YouTube token refresh failed: {exc}") from exc

            new_access = token_data.get("access_token")
            if not new_access:
                raise PublishError("Google returned no access token during refresh. Reconnect YouTube.")

            from datetime import timedelta
            new_expires_in = token_data.get("expires_in")
            new_expires_at = (
                datetime.now(timezone.utc) + timedelta(seconds=int(new_expires_in))
                if new_expires_in else None
            )
            async with _db() as db:
                await db.execute(
                    """UPDATE social_connections
                       SET encrypted_access_token = $1, token_expires_at = $2,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE id = $3""",
                    encrypt_token(new_access), new_expires_at, connection["id"],
                )
                await db.commit()

            logger.info("YouTube access token refreshed for connection id=%s", connection["id"])
            return new_access

    return access_token


async def publish_to_youtube(
    content: str,
    video_url: str | None,
    image_url: str | None,  # noqa: S1172 — kept for API compatibility
    content_type: str = "feed",
    short_video_url: str | None = None,
) -> str:
    """Publish a video to YouTube via YouTube Data API v3 resumable upload.

    content_type='feed'  → standard long-form video (video_url required)
    content_type='short' → YouTube Short  (short_video_url preferred, falls back
                           to video_url; must be ≤60 s vertical 9:16 clip)

    Token auto-refresh is performed before upload if the stored token is expired.
    Returns the YouTube video ID on success.
    Raises PublishError with a user-displayable message on failure.
    """
    from app.database import db_connection as _db
    from app.services.social.service import get_connection

    settings = get_settings()
    is_short = content_type == "short"

    # Resolve the video URL to use
    if is_short:
        resolved_video_url = short_video_url or video_url
        if not resolved_video_url:
            raise PublishError(
                "YouTube Short requires a video URL in the 'Short video URL' field "
                "(vertical 9:16, ≤60 s). Attach a video and try again."
            )
    else:
        resolved_video_url = video_url
        if not resolved_video_url:
            raise PublishError(
                "YouTube requires a video URL. "
                "Attach a video file or use AI video generation."
            )

    # Fetch connection
    async with _db() as db:
        connection = await get_connection(db, provider="youtube", account_type="youtube_channel")

    if not connection or connection["status"] == "disconnected":
        raise PublishError("YouTube not connected. Set up in Admin → Social → Platforms → YouTube.")
    if connection["status"] not in ("connected", "error"):
        raise PublishError(connection.get("last_error") or "YouTube connection is not ready.")

    # Get (and possibly refresh) the access token
    access_token = await _youtube_refresh_token_if_needed(connection)

    # Build video metadata
    # Title: first line of content or first 100 chars, stripped of hashtags for cleanliness
    first_line = content.split("\n")[0].strip()
    title_candidate = first_line[:97] + "…" if len(first_line) > 100 else first_line
    # Strip leading hashtags from title (YouTube penalises hashtag-heavy titles)
    title = " ".join(w for w in title_candidate.split() if not w.startswith("#")).strip()
    if not title:
        title = "New Video"

    description = content[:5000]

    if is_short:
        # #Shorts in description signals the Short to the algorithm
        if "#Shorts" not in description:
            description = description.rstrip() + "\n\n#Shorts"
        # YouTube Shorts category = 22 (People & Blogs); categoryId 26 is Howto & Style
        # The #Shorts tag + aspect ratio are what actually gate Shorts feed, not categoryId
        category_id = "22"
    else:
        category_id = "22"  # People & Blogs — safe default for brand content

    mime_type = _youtube_mime_type(resolved_video_url)

    init_url = "https://www.googleapis.com/upload/youtube/v3/videos"
    body = {
        "snippet": {
            "title": title,
            "description": description,
            "categoryId": category_id,
            "tags": ["Shorts"] if is_short else [],
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
            "madeForKids": False,
        },
    }

    try:
        absolute_video = _make_absolute(resolved_video_url, settings.store_domain)

        async with httpx.AsyncClient(timeout=300) as client:
            # Step 1: Initiate resumable upload session → get upload URI
            init_resp = await client.post(
                init_url,
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json",
                    "X-Upload-Content-Type": mime_type,
                },
                params={"uploadType": "resumable", "part": "snippet,status"},
                json=body,
            )

            if init_resp.status_code not in (200, 201):
                try:
                    err = init_resp.json().get("error", {})
                    msg = err.get("message", str(init_resp.status_code))
                    code = err.get("code", init_resp.status_code)
                except Exception:
                    msg = init_resp.text[:200]
                    code = init_resp.status_code
                if code == 401:
                    raise PublishError("YouTube token rejected (401). Reconnect YouTube in Admin → Social → Platforms.")
                if code == 403:
                    raise PublishError(f"YouTube permission denied (403): {msg}. Ensure youtube.upload scope is granted.")
                raise PublishError(f"YouTube upload init failed ({code}): {msg}")

            upload_url = init_resp.headers.get("Location")
            if not upload_url:
                raise PublishError("YouTube did not return a resumable upload URI.")

            # Step 2: Download video bytes from our storage
            video_resp = await client.get(absolute_video, follow_redirects=True)
            if video_resp.status_code != 200:
                raise PublishError(
                    f"Could not download video for upload (HTTP {video_resp.status_code}). "
                    f"Check the video URL is accessible: {absolute_video}"
                )
            video_bytes = video_resp.content
            if len(video_bytes) == 0:
                raise PublishError("Video file is empty. Check the video URL.")

            # Step 3: Upload video bytes to the resumable upload URI
            upload_resp = await client.put(
                upload_url,
                content=video_bytes,
                headers={
                    "Content-Type": mime_type,
                    "Content-Length": str(len(video_bytes)),
                },
            )

        if upload_resp.status_code not in (200, 201):
            raise PublishError(
                f"YouTube video upload failed (HTTP {upload_resp.status_code}). "
                "The file may be too large or in an unsupported format."
            )

        result = upload_resp.json()
        video_id = result.get("id")
        if not video_id:
            raise PublishError("YouTube returned a success status but no video ID.")

        watch_url = f"https://www.youtube.com/watch?v={video_id}"
        logger.info(
            "YouTube published video_id=%s is_short=%s mime=%s size=%d url=%s",
            video_id, is_short, mime_type, len(video_bytes), watch_url,
        )
        return str(video_id)

    except PublishError:
        raise
    except Exception as exc:
        logger.exception("YouTube publishing error")
        raise PublishError(f"YouTube publishing failed unexpectedly: {exc}") from exc


# ── Pinterest ────────────────────────────────────────────────────────────────

async def publish_to_pinterest(
    content: str,
    image_url: str | None,
    video_url: str | None = None,
    link: str | None = None,
) -> str:
    """Publish an image or video Pin to Pinterest.

    Reads the OAuth token + board_id from the DB (same pattern as other providers).
    Falls back to env vars PINTEREST_ACCESS_TOKEN / PINTEREST_BOARD_ID.
    Raises PublishError on failure.
    """
    from app.database import db_connection
    from app.services.social.token_crypto import TokenCryptoError

    settings = get_settings()
    access_token: str | None = None
    board_id: str | None = None

    try:
        from app.services.social.service import get_decrypted_page_token
        async with db_connection() as db:
            connection, access_token = await get_decrypted_page_token(db, provider="pinterest")
        board_id = connection.get("board_id") or connection.get("external_account_id")
    except (ValueError, TokenCryptoError, Exception):
        access_token = os.environ.get("PINTEREST_ACCESS_TOKEN", "")
        board_id = os.environ.get("PINTEREST_BOARD_ID", "")

    if not access_token or not board_id:
        raise PublishError(
            "Pinterest not connected. Connect Pinterest in Admin → Social → Platforms "
            "or set PINTEREST_ACCESS_TOKEN and PINTEREST_BOARD_ID."
        )

    if not image_url and not video_url:
        raise PublishError("Pinterest requires at least an image_url or video_url.")

    from app.services.social.providers.pinterest import PinterestProvider
    provider = PinterestProvider(settings)
    try:
        pin_id = await provider.publish_pin(
            token=access_token,
            board_id=board_id,
            title=content[:100],
            description=content[:500],
            image_url=image_url,
            video_url=video_url,
            link=link,
        )
    except Exception as e:
        raise PublishError(f"Pinterest publish failed: {e}") from e

    logger.info(f"Published to Pinterest: pin_id={pin_id} board={board_id}")
    return pin_id


# ── Threads ─────────────────────────────────────────────────────────────────

async def publish_to_threads(
    content: str,
    image_url: str | None,
    video_url: str | None = None,
) -> str:
    """Publish to Threads via stored OAuth token.

    - video_url present → VIDEO Thread
    - image_url present → IMAGE Thread
    - neither           → TEXT Thread

    Returns the Threads post ID.
    Raises PublishError on failure.
    """
    from app.database import db_connection
    from app.services.social.service import get_connection
    from app.services.social.token_crypto import decrypt_token, TokenCryptoError
    from app.services.social.providers.threads import ThreadsProvider
    from app.services.social.providers.base import SocialProviderError

    settings = get_settings()

    async with db_connection() as db:
        connection = await get_connection(db, provider="threads", account_type="threads_user")

    if not connection or connection["status"] != "connected":
        raise PublishError("Threads is not connected. Go to Platforms → Threads to connect.")

    try:
        access_token = decrypt_token(connection["encrypted_access_token"])
    except (TokenCryptoError, Exception) as e:
        raise PublishError(f"Threads token decryption failed: {e}") from e

    if not access_token:
        raise PublishError("Threads token is missing. Reconnect Threads from Platforms.")

    # Auto-refresh if token expires within 7 days
    from datetime import datetime, timezone, timedelta
    from app.services.social.token_crypto import encrypt_token
    expires_at = connection.get("token_expires_at")
    if expires_at:
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc) + timedelta(days=7):
            try:
                provider_temp = ThreadsProvider()
                refreshed = await provider_temp.refresh_long_lived_token(access_token)
                new_token = refreshed.get("access_token")
                if new_token:
                    new_expires = datetime.now(timezone.utc) + timedelta(seconds=refreshed.get("expires_in", 60 * 86400))
                    async with db_connection() as _db:
                        await _db.execute(
                            """UPDATE social_connections
                               SET encrypted_access_token = $1, token_expires_at = $2, updated_at = CURRENT_TIMESTAMP
                               WHERE id = $3""",
                            (encrypt_token(new_token), new_expires.isoformat(), connection["id"]),
                        )
                        await _db.commit()
                    access_token = new_token
                    logger.info("Threads token auto-refreshed for connection id=%s", connection["id"])
            except Exception as _ref_err:
                logger.warning("Threads token refresh failed (will use existing): %s", _ref_err)

    import json
    meta = connection.get("metadata") or "{}"
    if isinstance(meta, str):
        meta = json.loads(meta)
    user_id = meta.get("user_id") or connection.get("external_account_id")
    if not user_id:
        raise PublishError("Threads user_id not stored. Reconnect Threads from Platforms.")

    tagged = tag_content_links(content, "threads", "social-post")
    provider = ThreadsProvider()

    try:
        if video_url:
            if video_url.startswith("/"):
                video_url = _make_absolute(video_url, settings.store_domain)
            post_id = await provider.publish_video(user_id, access_token, tagged, video_url)
        elif image_url:
            if image_url.startswith("/"):
                image_url = _make_absolute(image_url, settings.store_domain)
            post_id = await provider.publish_image(user_id, access_token, tagged, image_url)
        else:
            post_id = await provider.publish_text(user_id, access_token, tagged)
    except SocialProviderError as e:
        raise PublishError(f"Threads publish failed: {e}") from e
    except Exception as e:
        raise PublishError(f"Threads publish failed: {e}") from e

    logger.info("Published to Threads: post_id=%s user_id=%s", post_id, user_id)
    return post_id


# ── Dispatcher ───────────────────────────────────────────────────────────────

async def publish_post(
    platform: str,
    content: str,
    image_url: str | None,
    video_url: str | None = None,
    content_type: str = "feed",
    thumb_offset_ms: int | None = None,
    product_tags: list[dict] | None = None,
    short_video_url: str | None = None,
) -> str:
    """Dispatch to the correct platform publisher.

    Returns platform_post_id on success.
    Raises PublishError with a user-displayable message on failure.
    """
    if platform == "facebook":
        return await publish_to_facebook(content, image_url, video_url, content_type)
    elif platform == "instagram":
        return await publish_to_instagram(content, image_url, video_url, content_type, thumb_offset_ms, product_tags)
    elif platform == "linkedin":
        return await publish_to_linkedin(content, image_url, video_url, content_type)
    elif platform == "tiktok":
        return await publish_to_tiktok(content, video_url, image_url, content_type)
    elif platform == "youtube":
        return await publish_to_youtube(content, video_url, image_url, content_type, short_video_url)
    elif platform in {"x", "twitter"}:
        return await publish_to_x(content, image_url, video_url)
    elif platform == "pinterest":
        return await publish_to_pinterest(content, image_url, video_url)
    elif platform == "threads":
        return await publish_to_threads(content, image_url, video_url)
    else:
        raise PublishError(f"Unknown platform: '{platform}'")


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_absolute(url: str, domain: str) -> str:
    """Ensure image URL is absolute. Relative paths are prefixed with store domain."""
    if url.startswith("http://") or url.startswith("https://"):
        return url
    domain = domain.rstrip("/")
    url = url.lstrip("/")
    return f"{domain}/{url}"
