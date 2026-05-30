from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import init_db
from app.middleware.logging import setup_logging
from app.middleware.rate_limit import RateLimitMiddleware
from app.routes import health, products, settings, auth, checkout, webhooks, promos, newsletter
from app.routes.admin import (
    products as admin_products,
    collections as admin_collections,
    orders as admin_orders,
    settings as admin_settings,
    promos as admin_promos,
    newsletter as admin_newsletter,
)

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

    await init_db()
    logger.info("Database initialized")
    yield
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
        allow_origins=[app_settings.store_domain],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "PUT"],
        allow_headers=["Content-Type"],
    )
    app.add_middleware(RateLimitMiddleware)

    # ── Public routes ──────────────────────────────────────────
    app.include_router(health.router, prefix="/api")
    app.include_router(products.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")

    # ── Checkout, Promos, Newsletter & Webhooks ──────────────────
    app.include_router(checkout.router, prefix="/api")
    app.include_router(promos.router, prefix="/api")
    app.include_router(newsletter.router, prefix="/api")
    app.include_router(webhooks.router, prefix="/api")

    # ── Auth ───────────────────────────────────────────────────
    app.include_router(auth.router, prefix="/api")

    # ── Admin routes ───────────────────────────────────────────
    app.include_router(admin_products.router, prefix="/api")
    app.include_router(admin_collections.router, prefix="/api")
    app.include_router(admin_orders.router, prefix="/api")
    app.include_router(admin_settings.router, prefix="/api")
    app.include_router(admin_promos.router, prefix="/api")
    app.include_router(admin_newsletter.router, prefix="/api")

    # ── Static files (uploaded images) ─────────────────────────
    uploads_dir = app_settings.uploads_dir
    uploads_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/images/uploads/products", StaticFiles(directory=str(uploads_dir)), name="product-images")

    return app


app = create_app()
