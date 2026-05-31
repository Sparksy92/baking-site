from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, EmailStr, Field

# Valid order statuses
ORDER_STATUSES = Literal[
    "received", "processing", "shipped", "delivered", "cancelled", "refunded"
]


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
    variant_id: int | None = None


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
    weight_g: int | None = None


class ProductUpdate(BaseModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None
    category_id: int | None = None
    is_active: bool | None = None
    is_featured: bool | None = None
    sort_order: int | None = None
    weight_g: int | None = None


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
    utm_source: str | None = None
    utm_medium: str | None = None
    utm_campaign: str | None = None


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
    status: ORDER_STATUSES | None = None
    tracking_number: str | None = None
    tracking_carrier: str | None = None
    admin_notes: str | None = None


class RefundRequest(BaseModel):
    amount_cents: int | None = None
    reason: str = Field(default="requested_by_customer", pattern="^(duplicate|fraudulent|requested_by_customer)$")


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


# ── Contact ────────────────────────────────────────────────────

class ContactRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    subject: str = Field(default="General Inquiry", max_length=300)
    message: str = Field(min_length=10, max_length=5000)
    order_number: str | None = None


# ── Customer Accounts ──────────────────────────────────────────

class CustomerRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str | None = None


class CustomerLogin(BaseModel):
    email: EmailStr
    password: str


class CustomerResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    phone: str | None = None


class CustomerUpdate(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    phone: str | None = None


class CustomerPasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)


class CustomerPasswordResetRequest(BaseModel):
    email: EmailStr


class CustomerPasswordReset(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class AddressCreate(BaseModel):
    label: str = Field(default="Home", max_length=50)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    line1: str = Field(min_length=1, max_length=500)
    line2: str | None = None
    city: str = Field(min_length=1, max_length=200)
    province: str = Field(min_length=1, max_length=100)
    postal_code: str = Field(min_length=1, max_length=20)
    country: str = Field(default="CA", max_length=2)
    phone: str | None = None
    is_default: bool = False


class AddressUpdate(BaseModel):
    label: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    line1: str | None = None
    line2: str | None = None
    city: str | None = None
    province: str | None = None
    postal_code: str | None = None
    country: str | None = None
    phone: str | None = None
    is_default: bool | None = None


class AddressResponse(BaseModel):
    id: int
    label: str
    first_name: str
    last_name: str
    line1: str
    line2: str | None = None
    city: str
    province: str
    postal_code: str
    country: str
    phone: str | None = None
    is_default: bool
