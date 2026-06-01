from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # ── Brand ────────────────────────────────────────────────────
    brand_name: str = "Elder"
    brand_tagline: str = "Indigenous Streetwear"
    brand_color_primary: str = "#1A1A1A"
    brand_color_accent: str = "#C53030"
    brand_color_background: str = "#FAFAFA"
    brand_color_text: str = "#111111"
    brand_logo_path: str = "/images/brand/logo.png"
    brand_favicon_path: str = "/images/brand/favicon.ico"

    # ── Database ─────────────────────────────────────────────────
    database_path: str = "./data/store.db"

    # ── Auth ─────────────────────────────────────────────────────
    admin_jwt_secret: str = "CHANGE_ME"
    admin_jwt_lifetime_hours: int = 8
    admin_jwt_algorithm: str = "HS256"
    customer_jwt_secret: str = "CHANGE_ME_CUSTOMER"
    customer_jwt_lifetime_hours: int = 72

    # ── Stripe ───────────────────────────────────────────────────
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""

    # ── Payments ──────────────────────────────────────────────────
    etransfer_email: str = "payments@example.com"

    # ── Shipping ─────────────────────────────────────────────────
    shipping_flat_rate_cents: int = 1200
    shipping_free_threshold_cents: int = 15000
    shipping_description: str = "Flat rate shipping across Canada"

    # ── Canada Post ────────────────────────────────────────────
    canadapost_api_key: str = ""
    canadapost_api_secret: str = ""
    canadapost_customer_number: str = ""
    canadapost_contract_number: str = ""
    origin_postal_code: str = ""
    default_parcel_weight_kg: float = 0.5
    default_parcel_length_cm: float = 30.0
    default_parcel_width_cm: float = 25.0
    default_parcel_height_cm: float = 5.0

    # ── Inventory Alerts ───────────────────────────────────────
    low_stock_threshold: int = 5
    low_stock_alert_email: str = ""

    # ── Tax ───────────────────────────────────────────────────────
    tax_rate: float = 0.0
    store_currency: str = "CAD"

    # ── Email (Resend) ───────────────────────────────────────────
    resend_api_key: str = ""
    email_from: str = "Elder <orders@example.com>"
    contact_email: str = ""

    # ── Store ────────────────────────────────────────────────────
    order_number_prefix: str = "ELD"
    store_domain: str = "http://localhost:3000"

    # ── Dev ──────────────────────────────────────────────────────
    dev_mode: bool = True

    # ── App version ──────────────────────────────────────────────
    app_version: str = "0.1.0"

    model_config = {
        "env_file": os.environ.get("ENV_FILE", "../.env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def database_dir(self) -> Path:
        return Path(self.database_path).parent

    @property
    def uploads_dir(self) -> Path:
        return self.database_dir / "uploads" / "products"


@lru_cache
def get_settings() -> Settings:
    return Settings()
