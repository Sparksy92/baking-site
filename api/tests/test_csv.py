"""Product CSV import/export tests."""
import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_export_empty(admin_client: AsyncClient):
    resp = await admin_client.get("/api/admin/products/export.csv")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers["content-type"]
    lines = resp.text.strip().split("\n")
    assert len(lines) == 1  # Header only


@pytest.mark.asyncio
async def test_export_with_data(admin_client: AsyncClient):
    # Create product + variant
    resp = await admin_client.post("/api/admin/products", json={"name": "CSV Tee", "slug": "csv-tee"})
    pid = resp.json()["id"]
    await admin_client.post(f"/api/admin/products/{pid}/variants", json={
        "size": "L", "color": "Red", "price_cents": 3500, "stock_quantity": 10,
    })

    resp = await admin_client.get("/api/admin/products/export.csv")
    assert resp.status_code == 200
    lines = resp.text.strip().split("\n")
    assert len(lines) >= 2
    assert "csv-tee" in resp.text
    assert "3500" in resp.text


@pytest.mark.asyncio
async def test_import_csv(admin_client: AsyncClient):
    csv_content = """product_name,product_slug,description,category_id,is_active,is_featured,sort_order,variant_size,variant_color,variant_color_hex,price_cents,compare_at_price_cents,sku,stock_quantity,variant_is_active
Imported Tee,imported-tee,A cool imported tee,,1,0,0,S,Black,,2500,,IMP-S-BLK,20,1
Imported Tee,imported-tee,A cool imported tee,,1,0,0,M,Black,,2500,,IMP-M-BLK,15,1
Another Product,another-prod,Another one,,1,1,1,One Size,Default,,5000,,AP-001,50,1
"""
    resp = await admin_client.post(
        "/api/admin/products/import.csv",
        files={"file": ("products.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["created_products"] == 2
    assert data["created_variants"] == 3
    assert data["skipped_products"] == 0
    assert data["errors"] == []


@pytest.mark.asyncio
async def test_import_csv_skips_existing(admin_client: AsyncClient):
    # Create existing product
    await admin_client.post("/api/admin/products", json={"name": "Existing", "slug": "existing-prod"})

    csv_content = """product_name,product_slug,price_cents,variant_size,variant_color,stock_quantity
Existing,existing-prod,2000,M,Blue,5
New One,new-one-csv,3000,L,Green,10
"""
    resp = await admin_client.post(
        "/api/admin/products/import.csv",
        files={"file": ("test.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["created_products"] == 1
    assert data["skipped_products"] == 1


@pytest.mark.asyncio
async def test_import_csv_missing_columns(admin_client: AsyncClient):
    csv_content = "name,color\nBad,Red\n"
    resp = await admin_client.post(
        "/api/admin/products/import.csv",
        files={"file": ("bad.csv", io.BytesIO(csv_content.encode()), "text/csv")},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_csv_requires_auth(client: AsyncClient):
    assert (await client.get("/api/admin/products/export.csv")).status_code == 401
