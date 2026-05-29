from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


# ── Auth ────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    username: str
    role: str
    display_name: str


# ── Categories ──────────────────────────────────────────────────

class CategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    image_url: str | None = None
    sort_order: int
    is_active: bool
    product_count: int = 0


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: str | None = None
    sort_order: int = 0
    is_active: bool = True


class CategoryUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


# ── Products ────────────────────────────────────────────────────

class VariantResponse(BaseModel):
    id: int
    product_id: int
    size: str
    color: str
    color_hex: str | None = None
    price_cents: int
    compare_at_price_cents: int | None = None
    sku: str | None = None
    stock_quantity: int
    is_active: bool
    sort_order: int


class ImageResponse(BaseModel):
    id: int
    product_id: int
    url: str
    alt_text: str | None = None
    sort_order: int
    is_primary: bool


class ProductResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    category: CategoryResponse | None = None
    is_active: bool
    is_featured: bool
    sort_order: int
    variants: list[VariantResponse] = []
    images: list[ImageResponse] = []


class ProductListItem(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    category_id: int | None = None
    is_active: bool
    is_featured: bool
    image_url: str | None = None
    min_price_cents: int | None = None
    max_price_cents: int | None = None
    compare_at_price_cents: int | None = None
    total_stock: int = 0


class ProductCreate(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    slug: str = Field(min_length=1, max_length=300)
    description: str | None = None
    category_id: int | None = None
    is_active: bool = True
    is_featured: bool = False
    sort_order: int = 0


class ProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    category_id: int | None = None
    is_active: bool | None = None
    is_featured: bool | None = None
    sort_order: int | None = None


class VariantCreate(BaseModel):
    size: str = Field(min_length=1, max_length=50)
    color: str = Field(min_length=1, max_length=100)
    color_hex: str | None = None
    price_cents: int = Field(gt=0)
    compare_at_price_cents: int | None = None
    sku: str | None = None
    stock_quantity: int = Field(ge=0, default=0)
    is_active: bool = True
    sort_order: int = 0


class VariantUpdate(BaseModel):
    size: str | None = None
    color: str | None = None
    color_hex: str | None = None
    price_cents: int | None = None
    compare_at_price_cents: int | None = None
    sku: str | None = None
    stock_quantity: int | None = None
    is_active: bool | None = None
    sort_order: int | None = None


# ── Collections ─────────────────────────────────────────────────

class CollectionResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    image_url: str | None = None
    is_active: bool
    sort_order: int
    product_count: int = 0


class CollectionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str = Field(min_length=1, max_length=200)
    description: str | None = None
    is_active: bool = True
    sort_order: int = 0


class CollectionUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


# ── Checkout ────────────────────────────────────────────────────

class ShippingAddress(BaseModel):
    line1: str = Field(min_length=1, max_length=500)
    line2: str | None = None
    city: str = Field(min_length=1, max_length=200)
    province: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    country: str = Field(default="CA", max_length=2)


class CheckoutItem(BaseModel):
    variant_id: int
    quantity: int = Field(gt=0, le=20)


class CheckoutRequest(BaseModel):
    customer_name: str = Field(min_length=1, max_length=300)
    customer_email: EmailStr
    customer_phone: str | None = None
    shipping_address: ShippingAddress
    items: list[CheckoutItem] = Field(min_length=1)
    promo_code: str | None = None
    customer_notes: str | None = None


class CheckoutResponse(BaseModel):
    order_number: str
    stripe_checkout_url: str


# ── Orders ──────────────────────────────────────────────────────

class OrderItemResponse(BaseModel):
    product_name: str
    variant_size: str
    variant_color: str
    quantity: int
    unit_price_cents: int
    line_total_cents: int


class OrderResponse(BaseModel):
    order_number: str
    status: str
    payment_status: str
    items: list[OrderItemResponse]
    subtotal_cents: int
    discount_cents: int = 0
    shipping_cents: int
    tax_cents: int
    total_cents: int
    promo_code: str | None = None
    tracking_number: str | None = None
    tracking_carrier: str | None = None
    created_at: str


class OrderStatusUpdate(BaseModel):
    status: str | None = None
    tracking_number: str | None = None
    tracking_carrier: str | None = None
    admin_notes: str | None = None


# ── Promo Codes ──────────────────────────────────────────────────

class PromoCodeCreate(BaseModel):
    code: str = Field(min_length=2, max_length=50)
    description: str | None = None
    discount_type: str = Field(default="percent", pattern="^(percent|fixed_cents)$")
    discount_value: int = Field(gt=0)
    minimum_order_cents: int = 0
    max_uses: int | None = None
    starts_at: str | None = None
    expires_at: str | None = None
    is_active: bool = True


class PromoCodeUpdate(BaseModel):
    description: str | None = None
    discount_type: str | None = None
    discount_value: int | None = None
    minimum_order_cents: int | None = None
    max_uses: int | None = None
    starts_at: str | None = None
    expires_at: str | None = None
    is_active: bool | None = None


class PromoValidateResponse(BaseModel):
    valid: bool
    code: str
    discount_type: str | None = None
    discount_value: int | None = None
    message: str | None = None


# ── Settings ────────────────────────────────────────────────────

class PublicSettingsResponse(BaseModel):
    brand_name: str
    store_announcement: str
    shipping_flat_rate_cents: int
    shipping_free_threshold_cents: int
    tax_rate: float
    currency: str
    analytics_id: str = ""
