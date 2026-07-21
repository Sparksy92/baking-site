from __future__ import annotations

import asyncio
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.services.meta_service import run_social_sync
from app.services.token_refresh_service import refresh_expiring_tokens
from app.services.scheduler_service import run_scheduled_publisher
from app.services.engagement_service import sync_all_engagement_metrics
from app.services.publish_retry_service import run_pending_retries
from app.middleware.logging import setup_logging
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.routes import health, products, settings, auth, checkout, webhooks, promos, newsletter, customers, contact, shipping, wishlist, reviews, related_products, back_in_stock, cart, pages, size_guides, gift_cards, loyalty, bundles, sitemap, events, returns, social_proof, store_credit, order_requests
from app.routes.admin import (
    products as admin_products,
    collections as admin_collections,
    categories as admin_categories,
    orders as admin_orders,
    settings as admin_settings,
    promos as admin_promos,
    newsletter as admin_newsletter,
    dashboard as admin_dashboard,
    csv_io as admin_csv,
    reviews as admin_reviews,
    related_products as admin_related,
    auto_discounts as admin_auto_discounts,
    abandoned_carts as admin_abandoned_carts,
    fulfillments as admin_fulfillments,
    bulk_orders as admin_bulk_orders,
    staff as admin_staff,
    order_edit as admin_order_edit,
    packing_slip as admin_packing_slip,
    pages as admin_pages,
    tags as admin_tags,
    segments as admin_segments,
    size_guides as admin_size_guides,
    gift_cards as admin_gift_cards,
    loyalty as admin_loyalty,
    bundles as admin_bundles,
    events as admin_events,
    reports as admin_reports,
    returns as admin_returns,
    webhooks as admin_webhooks,
    redirects as admin_redirects,
    store_credit as admin_store_credit,
    customers as admin_customers,
    social as admin_social,
    order_requests as admin_order_requests,
    media as admin_media,
    compliance as admin_compliance,
)
from app.routes import agent_api, content_library, linkinbio, social_inbox, platform_variations, rss, social_facebook, social_instagram, social_linkedin, social_tiktok, social_x, social_pinterest, influencer_portal, social_youtube, social_threads
from app.services.rss_service import check_all_feeds
from app.services.engagement_sync_service import poll_tiktok_pending_posts
from app.services.analytics_sync_service import sync_all_platform_metrics

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    logger.info("Starting clothing-ecommerce API")

    # Guard against running with default JWT secret
    settings = get_settings()
    if not settings.dev_mode and settings.admin_jwt_secret == "CHANGE_ME":
        raise RuntimeError(
            "ADMIN_JWT_SECRET is set to the default value. "
            "Generate a real secret: openssl rand -base64 32"
        )
    if not settings.dev_mode and settings.customer_jwt_secret == "CHANGE_ME_CUSTOMER":
        raise RuntimeError(
            "CUSTOMER_JWT_SECRET is set to the default value. "
            "Generate a real secret: openssl rand -base64 32"
        )
    if not settings.dev_mode and ("localhost" in settings.store_domain or "127.0.0.1" in settings.store_domain):
        raise RuntimeError(
            f"STORE_DOMAIN is set to a localhost URL ('{settings.store_domain}') while DEV_MODE is false (production). "
            "Please configure a valid production storefront domain."
        )
    
    async def _background_social_sync():
        while True:
            try:
                await asyncio.sleep(10)
                await run_social_sync()
            except Exception as e:
                logger.error(f"Background social sync error: {e}", exc_info=True)
            await asyncio.sleep(3600)

    async def _background_token_refresh():
        """Check and refresh expiring Meta tokens once at startup then every 24 hours."""
        await asyncio.sleep(30)
        while True:
            try:
                summary = await refresh_expiring_tokens()
                if summary["refreshed"] or summary["failed"]:
                    logger.info(f"Token refresh run: {summary}")
            except Exception as e:
                logger.error(f"Background token refresh error: {e}", exc_info=True)
            await asyncio.sleep(86400)

    async def _background_scheduler():
        """Publish scheduled social posts — checks every 60 seconds."""
        await asyncio.sleep(15)
        while True:
            try:
                count = await run_scheduled_publisher()
                if count:
                    logger.info(f"Scheduler: published {count} due post(s)")
            except Exception as e:
                logger.error(f"Background scheduler error: {e}", exc_info=True)
            await asyncio.sleep(60)

    async def _background_engagement_sync():
        """Poll Meta for engagement metrics every 4 hours."""
        await asyncio.sleep(60)
        while True:
            try:
                summary = await sync_all_engagement_metrics()
                if summary["synced"] or summary["failed"]:
                    logger.info(f"Engagement sync: {summary}")
            except Exception as e:
                logger.error(f"Background engagement sync error: {e}", exc_info=True)
            await asyncio.sleep(14400)

    async def _background_rss_check():
        """Check RSS feeds every 15 minutes."""
        await asyncio.sleep(120)
        while True:
            try:
                result = await check_all_feeds()
                if result.get("total_posts_created", 0) > 0:
                    logger.info(f"RSS auto-publish: {result['total_posts_created']} posts created")
            except Exception as e:
                logger.error(f"Background RSS check error: {e}", exc_info=True)
            await asyncio.sleep(900)  # 15 minutes

    async def _background_retry_checker():
        """Check for pending publish retries every 5 minutes."""
        await asyncio.sleep(180)
        while True:
            try:
                result = await run_pending_retries()
                if result.get("processed", 0) > 0:
                    logger.info(f"Retry checker: {result['processed']} retries processed")
            except Exception as e:
                logger.error(f"Background retry checker error: {e}", exc_info=True)
            await asyncio.sleep(300)  # 5 minutes

    async def _background_tiktok_poll():
        """Poll TikTok publish_id status every 15 minutes."""
        await asyncio.sleep(90)
        while True:
            try:
                resolved = await poll_tiktok_pending_posts()
                if resolved:
                    logger.info(f"TikTok poll: {resolved} post(s) resolved")
            except Exception as e:
                logger.error(f"Background TikTok poll error: {e}", exc_info=True)
            await asyncio.sleep(900)  # 15 minutes

    async def _background_ab_test_autocomplete():
        """Auto-complete expired A/B tests every 30 minutes."""
        await asyncio.sleep(120)
        while True:
            try:
                from app.services.ab_test_service import auto_complete_expired_tests
                completed = await auto_complete_expired_tests()
                if completed:
                    logger.info(f"A/B test auto-complete: {completed} test(s) completed")
            except Exception as e:
                logger.error(f"Background A/B test auto-complete error: {e}", exc_info=True)
            await asyncio.sleep(1800)  # 30 minutes

    async def _background_analytics_sync():
        """Sync TikTok + YouTube post metrics every 6 hours."""
        await asyncio.sleep(300)  # 5 min after startup
        while True:
            try:
                result = await sync_all_platform_metrics()
                if result["total_synced"] or result["total_failed"]:
                    logger.info(f"Analytics sync: {result}")
            except Exception as e:
                logger.error(f"Background analytics sync error: {e}", exc_info=True)
            await asyncio.sleep(21600)  # 6 hours

    await init_db()
    logger.info("Database initialized")

    background_tasks = []
    if "pytest" not in sys.modules and settings.enable_background_workers:
        background_tasks = [
            asyncio.ensure_future(_background_social_sync()),
            asyncio.ensure_future(_background_token_refresh()),
            asyncio.ensure_future(_background_scheduler()),
            asyncio.ensure_future(_background_engagement_sync()),
            asyncio.ensure_future(_background_rss_check()),
            asyncio.ensure_future(_background_retry_checker()),
            asyncio.ensure_future(_background_tiktok_poll()),
            asyncio.ensure_future(_background_ab_test_autocomplete()),
            asyncio.ensure_future(_background_analytics_sync()),
        ]

    yield

    for task in background_tasks:
        task.cancel()
    logger.info("Shutting down")


def create_app() -> FastAPI:
    app_settings = get_settings()

    # Disable API docs in production
    docs_url = "/api/docs" if app_settings.dev_mode else None
    redoc_url = "/api/redoc" if app_settings.dev_mode else None
    openapi_url = "/api/openapi.json" if app_settings.dev_mode else None

    app = FastAPI(
        title=f"{app_settings.brand_name} API",
        version=app_settings.app_version,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url,
        lifespan=lifespan,
    )

    # ── Middleware ──────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.parsed_cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT"],
        allow_headers=["Content-Type", "Authorization"],
    )
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(RequestIdMiddleware)

    # ── Public routes ──────────────────────────────────────────
    app.include_router(health.router, prefix="/api")
    app.include_router(products.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    app.include_router(shipping.router, prefix="/api")

    # ── Checkout, Promos, Newsletter, Contact & Webhooks ────────
    app.include_router(checkout.router, prefix="/api")
    app.include_router(promos.router, prefix="/api")
    app.include_router(newsletter.router, prefix="/api")
    app.include_router(contact.router, prefix="/api")
    app.include_router(webhooks.router, prefix="/api")

    # ── Auth ───────────────────────────────────────────────────
    app.include_router(auth.router, prefix="/api")

    # ── Customer accounts ────────────────────────────────────────
    app.include_router(customers.router, prefix="/api")
    app.include_router(wishlist.router, prefix="/api")
    app.include_router(reviews.router, prefix="/api")
    app.include_router(order_requests.router, prefix="/api")

    # ── Cart & Notifications ─────────────────────────────────────
    app.include_router(cart.router, prefix="/api")
    app.include_router(related_products.router, prefix="/api")
    app.include_router(back_in_stock.router, prefix="/api")

    # ── Pages & Guides ────────────────────────────────────────
    app.include_router(pages.router, prefix="/api")
    app.include_router(size_guides.router, prefix="/api")

    # ── Gift Cards, Loyalty & Bundles ─────────────────────────
    app.include_router(gift_cards.router, prefix="/api")
    app.include_router(loyalty.router, prefix="/api")
    app.include_router(bundles.router, prefix="/api")

    # ── Events, Returns & Sitemap ─────────────────────────────
    app.include_router(events.router, prefix="/api")
    app.include_router(returns.router, prefix="/api")
    app.include_router(sitemap.router, prefix="/api")
    app.include_router(social_proof.router, prefix="/api")
    app.include_router(store_credit.router, prefix="/api")

    # ── Admin routes ───────────────────────────────────────────
    app.include_router(admin_csv.router, prefix="/api")  # must be before admin_products (static paths before {product_id})
    app.include_router(admin_products.router, prefix="/api")
    app.include_router(admin_collections.router, prefix="/api")
    app.include_router(admin_redirects.router, prefix="/api")
    app.include_router(admin_categories.router, prefix="/api")
    app.include_router(admin_orders.router, prefix="/api")
    app.include_router(admin_customers.router, prefix="/api")
    app.include_router(admin_settings.router, prefix="/api")
    app.include_router(admin_promos.router, prefix="/api")
    app.include_router(admin_newsletter.router, prefix="/api")
    app.include_router(admin_dashboard.router, prefix="/api")
    app.include_router(admin_reviews.router, prefix="/api")
    app.include_router(admin_related.router, prefix="/api")
    app.include_router(admin_auto_discounts.router, prefix="/api")
    app.include_router(admin_abandoned_carts.router, prefix="/api")
    app.include_router(admin_fulfillments.router, prefix="/api")
    app.include_router(admin_bulk_orders.router, prefix="/api")
    app.include_router(admin_staff.router, prefix="/api")
    app.include_router(admin_order_edit.router, prefix="/api")
    app.include_router(admin_packing_slip.router, prefix="/api")
    app.include_router(admin_pages.router, prefix="/api")
    app.include_router(admin_tags.router, prefix="/api")
    app.include_router(admin_segments.router, prefix="/api")
    app.include_router(admin_size_guides.router, prefix="/api")
    app.include_router(admin_gift_cards.router, prefix="/api")
    app.include_router(admin_loyalty.router, prefix="/api")
    app.include_router(admin_bundles.router, prefix="/api")
    app.include_router(admin_events.router, prefix="/api")
    app.include_router(admin_reports.router, prefix="/api")
    app.include_router(admin_returns.router, prefix="/api")
    app.include_router(admin_webhooks.router, prefix="/api")
    app.include_router(admin_store_credit.router, prefix="/api")
    app.include_router(admin_social.router, prefix="/api")
    app.include_router(admin_order_requests.router, prefix="/api")
    app.include_router(admin_media.router, prefix="/api")
    app.include_router(admin_compliance.router, prefix="/api/admin")

    # ── Competitive Gap Features ────────────────────────────────
    app.include_router(content_library.router, prefix="/api")
    app.include_router(linkinbio.router, prefix="/api")
    app.include_router(linkinbio.public_router)  # Public /l/{slug} routes
    app.include_router(social_inbox.router, prefix="/api")
    app.include_router(platform_variations.router, prefix="/api")
    app.include_router(rss.router, prefix="/api")
    app.include_router(social_facebook.router, prefix="/api")
    app.include_router(social_instagram.router, prefix="/api")
    app.include_router(social_linkedin.router, prefix="/api")
    app.include_router(social_tiktok.router, prefix="/api")
    app.include_router(social_x.router, prefix="/api")
    app.include_router(social_pinterest.router, prefix="/api")
    app.include_router(influencer_portal.router, prefix="/api")
    app.include_router(social_youtube.router, prefix="/api")
    app.include_router(social_threads.router, prefix="/api")

    # ── Agent API (AI integration boundary) ─────────────────────
    app.include_router(agent_api.router)

    # ── Static files (uploaded images) ─────────────────────────
    uploads_dir = app_settings.uploads_dir
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/images/uploads/products", StaticFiles(directory=str(uploads_dir)), name="product-images")

    blog_uploads_dir = uploads_dir.parent / "blog"
    blog_uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/images/uploads/blog", StaticFiles(directory=str(blog_uploads_dir)), name="blog-images")

    media_library_dir = uploads_dir.parent / "media"
    media_library_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media/library", StaticFiles(directory=str(media_library_dir)), name="media-library")

    social_media_dir = uploads_dir.parent / "social-media"
    social_media_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media/social", StaticFiles(directory=str(social_media_dir)), name="media-social")

    app.mount("/media", StaticFiles(directory=str(media_library_dir)), name="media-v2")

    return app


app = create_app()
