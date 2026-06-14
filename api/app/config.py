from __future__ import annotations

import os
from pathlib import Path
from functools import lru_cache

from pydantic import model_validator
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
    postgres_user: str = "ecommerce"
    postgres_password: str = "ecommerce_password"
    postgres_db: str = "ecommerce"
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    
    database_url: str | None = None
    
    @model_validator(mode="after")
    def resolve_database_url(self) -> Settings:
        if not self.database_url:
            self.database_url = f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        return self

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

    # ── Integrations — Meta (Facebook / Instagram) ───────────────
    meta_page_access_token: str = ""
    meta_facebook_page_id: str = ""
    meta_instagram_account_id: str = ""
    meta_app_secret: str = ""         # Used to verify webhook signatures (Meta App Secret from developer portal)
    meta_webhook_verify_token: str = "rez-hub-webhook-verify"  # Arbitrary string — must match what you set in Meta dashboard

    # ── Integrations — AI ────────────────────────────────────────
    openai_api_key: str = ""
    gemini_api_key: str = ""
    serp_api_key: str = ""    # SerpAPI — 100 free searches/month at serpapi.com

    # ── Integrations — LinkedIn ──────────────────────────────────
    linkedin_client_id: str = ""
    linkedin_client_secret: str = ""

    # ── Integrations — TikTok ────────────────────────────────────
    tiktok_client_key: str = ""
    tiktok_client_secret: str = ""

    # ── Integrations — X / Twitter ───────────────────────────────
    x_api_key: str = ""
    x_api_secret: str = ""
    x_access_token: str = ""
    x_access_token_secret: str = ""

    # ── App version ──────────────────────────────────────────────
    app_version: str = "0.1.0"

    # ── Render Hardening Settings ────────────────────────────────
    upload_storage_root: str = "./data/uploads"
    enable_background_workers: bool = False
    cors_allowed_origins: str = ""

    model_config = {
        "env_file": os.environ.get("ENV_FILE", "../.env"),
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def uploads_dir(self) -> Path:
        return Path(self.upload_storage_root) / "products"

    @property
    def parsed_cors_origins(self) -> list[str]:
        origins = []
        
        def normalize(url: str) -> str:
            val = url.strip()
            if val.endswith("/"):
                val = val[:-1].strip()
            return val

        if self.cors_allowed_origins:
            for part in self.cors_allowed_origins.split(","):
                norm = normalize(part)
                if norm and norm != "*" and norm not in origins:
                    origins.append(norm)

        if self.store_domain:
            norm_store = normalize(self.store_domain)
            if norm_store and norm_store != "*" and norm_store not in origins:
                origins.append(norm_store)

        return origins



@lru_cache
def get_settings() -> Settings:
    return Settings()
