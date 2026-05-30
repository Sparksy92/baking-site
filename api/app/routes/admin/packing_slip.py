"""Packing slip / invoice generation — printable HTML."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
import aiosqlite

from app.auth import require_admin
from app.config import get_settings
from app.database import get_db

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])


@router.get("/{order_id}/packing-slip", response_class=HTMLResponse)
async def get_packing_slip(
    order_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Generate a printable packing slip for an order."""
    cursor = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    cursor = await db.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
    items = await cursor.fetchall()

    settings = get_settings()
    return HTMLResponse(_render_packing_slip(dict(order), [dict(i) for i in items], settings))


@router.get("/{order_id}/invoice", response_class=HTMLResponse)
async def get_invoice(
    order_id: int,
    db: aiosqlite.Connection = Depends(get_db),
    user: dict = Depends(require_admin),
):
    """Generate a printable invoice for an order."""
    cursor = await db.execute("SELECT * FROM orders WHERE id = ?", (order_id,))
    order = await cursor.fetchone()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")

    cursor = await db.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id,))
    items = await cursor.fetchall()

    settings = get_settings()
    return HTMLResponse(_render_invoice(dict(order), [dict(i) for i in items], settings))


def _render_packing_slip(order: dict, items: list[dict], settings) -> str:
    items_html = "".join(
        f"""<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd">{item['product_name']}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">{item.get('variant_size', '')} / {item.get('variant_color', '')}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">{item['quantity']}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">☐</td>
        </tr>"""
        for item in items
    )

    shipping = order.get("shipping_address_line1", "")
    if order.get("shipping_address_line2"):
        shipping += f"<br>{order['shipping_address_line2']}"
    shipping += f"<br>{order.get('shipping_address_city', '')}, {order.get('shipping_address_province', '')} {order.get('shipping_address_postal', '')}"

    return f"""<!DOCTYPE html>
<html><head>
<title>Packing Slip — {order['order_number']}</title>
<style>
    body {{ font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
    @media print {{ body {{ padding: 0; }} .no-print {{ display: none; }} }}
    h1 {{ margin: 0; font-size: 24px; }}
    .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }}
    .meta {{ font-size: 13px; color: #666; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
    th {{ background: #f5f5f5; padding: 10px 8px; text-align: left; font-size: 13px; border-bottom: 2px solid #ddd; }}
    .ship-to {{ margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 4px; }}
    .btn {{ display: inline-block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 4px; cursor: pointer; border: none; font-size: 14px; }}
</style>
</head><body>
<div class="no-print" style="margin-bottom:20px">
    <button class="btn" onclick="window.print()">🖨️ Print Packing Slip</button>
</div>
<div class="header">
    <div>
        <h1>{settings.brand_name}</h1>
        <p class="meta">PACKING SLIP</p>
    </div>
    <div style="text-align:right">
        <strong>Order #{order['order_number']}</strong><br>
        <span class="meta">{order.get('created_at', '')[:10]}</span>
    </div>
</div>
<div class="ship-to">
    <strong>Ship To:</strong><br>
    {order.get('customer_name', '')}<br>
    {shipping}
</div>
<table>
    <tr><th>Product</th><th>Variant</th><th style="text-align:center">Qty</th><th style="text-align:center">Packed ✓</th></tr>
    {items_html}
</table>
<p style="margin-top:30px;font-size:12px;color:#666">Thank you for shopping with {settings.brand_name}!</p>
</body></html>"""


def _render_invoice(order: dict, items: list[dict], settings) -> str:
    items_html = "".join(
        f"""<tr>
            <td style="padding:8px;border-bottom:1px solid #ddd">{item['product_name']}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd">{item.get('variant_size', '')} / {item.get('variant_color', '')}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:center">{item['quantity']}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${item['unit_price_cents'] / 100:.2f}</td>
            <td style="padding:8px;border-bottom:1px solid #ddd;text-align:right">${item['line_total_cents'] / 100:.2f}</td>
        </tr>"""
        for item in items
    )

    subtotal = order.get("subtotal_cents", 0)
    shipping = order.get("shipping_cents", 0)
    discount = order.get("discount_cents", 0)
    total = order.get("total_cents", 0)

    shipping_addr = order.get("shipping_address_line1", "")
    if order.get("shipping_address_line2"):
        shipping_addr += f"<br>{order['shipping_address_line2']}"
    shipping_addr += f"<br>{order.get('shipping_address_city', '')}, {order.get('shipping_address_province', '')} {order.get('shipping_address_postal', '')}"

    return f"""<!DOCTYPE html>
<html><head>
<title>Invoice — {order['order_number']}</title>
<style>
    body {{ font-family: -apple-system, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
    @media print {{ body {{ padding: 0; }} .no-print {{ display: none; }} }}
    h1 {{ margin: 0; font-size: 24px; }}
    .header {{ display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }}
    .meta {{ font-size: 13px; color: #666; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
    th {{ background: #f5f5f5; padding: 10px 8px; text-align: left; font-size: 13px; border-bottom: 2px solid #ddd; }}
    .totals {{ margin-top: 20px; text-align: right; }}
    .totals td {{ padding: 4px 8px; }}
    .total-row {{ font-size: 18px; font-weight: bold; }}
    .addresses {{ display: flex; gap: 40px; margin-top: 20px; }}
    .address {{ flex: 1; padding: 15px; background: #f9f9f9; border-radius: 4px; }}
    .btn {{ display: inline-block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 4px; cursor: pointer; border: none; font-size: 14px; }}
</style>
</head><body>
<div class="no-print" style="margin-bottom:20px">
    <button class="btn" onclick="window.print()">🖨️ Print Invoice</button>
</div>
<div class="header">
    <div>
        <h1>{settings.brand_name}</h1>
        <p class="meta">INVOICE</p>
    </div>
    <div style="text-align:right">
        <strong>Order #{order['order_number']}</strong><br>
        <span class="meta">Date: {order.get('created_at', '')[:10]}</span><br>
        <span class="meta">Status: {order.get('payment_status', 'pending')}</span>
    </div>
</div>
<div class="addresses">
    <div class="address">
        <strong>Bill To:</strong><br>
        {order.get('customer_name', '')}<br>
        {order.get('customer_email', '')}
    </div>
    <div class="address">
        <strong>Ship To:</strong><br>
        {order.get('customer_name', '')}<br>
        {shipping_addr}
    </div>
</div>
<table>
    <tr><th>Product</th><th>Variant</th><th style="text-align:center">Qty</th><th style="text-align:right">Unit</th><th style="text-align:right">Total</th></tr>
    {items_html}
</table>
<table class="totals">
    <tr><td>Subtotal:</td><td>${subtotal / 100:.2f}</td></tr>
    <tr><td>Shipping:</td><td>${shipping / 100:.2f}</td></tr>
    {"<tr><td>Discount:</td><td>-$" + f"{discount / 100:.2f}" + "</td></tr>" if discount else ""}
    <tr class="total-row"><td>Total:</td><td>${total / 100:.2f} CAD</td></tr>
</table>
<p style="margin-top:40px;font-size:12px;color:#666;border-top:1px solid #ddd;padding-top:15px">
    Thank you for your order! — {settings.brand_name}
</p>
</body></html>"""
