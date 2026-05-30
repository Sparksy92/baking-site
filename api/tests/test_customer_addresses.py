"""Customer address CRUD tests — create, list, update, delete, default management, ownership."""
import pytest
from httpx import AsyncClient


# ── Create ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_address(customer_client: AsyncClient):
    resp = await customer_client.post("/api/customers/me/addresses", json={
        "label": "Home",
        "first_name": "Test",
        "last_name": "Customer",
        "line1": "123 Main St",
        "city": "Toronto",
        "province": "ON",
        "postal_code": "M5V 1A1",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["label"] == "Home"
    assert data["line1"] == "123 Main St"
    assert data["country"] == "CA"
    assert "id" in data


@pytest.mark.asyncio
async def test_first_address_auto_default(customer_client: AsyncClient):
    """First address should automatically be set as default."""
    resp = await customer_client.post("/api/customers/me/addresses", json={
        "label": "Office",
        "first_name": "Test",
        "last_name": "Customer",
        "line1": "456 Work Ave",
        "city": "Ottawa",
        "province": "ON",
        "postal_code": "K1A 0A6",
    })
    assert resp.status_code == 201
    assert resp.json()["is_default"] is True


@pytest.mark.asyncio
async def test_second_address_not_default(customer_client: AsyncClient):
    """Second address should not be default unless explicitly set."""
    await customer_client.post("/api/customers/me/addresses", json={
        "label": "Home",
        "first_name": "Test",
        "last_name": "Customer",
        "line1": "123 Main St",
        "city": "Toronto",
        "province": "ON",
        "postal_code": "M5V 1A1",
    })
    resp = await customer_client.post("/api/customers/me/addresses", json={
        "label": "Work",
        "first_name": "Test",
        "last_name": "Customer",
        "line1": "789 Office Blvd",
        "city": "Toronto",
        "province": "ON",
        "postal_code": "M5V 2B2",
    })
    assert resp.status_code == 201
    assert resp.json()["is_default"] is False


# ── List ──────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_addresses_empty(customer_client: AsyncClient):
    resp = await customer_client.get("/api/customers/me/addresses")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_list_addresses(customer_client: AsyncClient):
    await customer_client.post("/api/customers/me/addresses", json={
        "label": "Home", "first_name": "A", "last_name": "B",
        "line1": "1 St", "city": "C", "province": "ON", "postal_code": "X1X",
    })
    await customer_client.post("/api/customers/me/addresses", json={
        "label": "Work", "first_name": "A", "last_name": "B",
        "line1": "2 St", "city": "C", "province": "ON", "postal_code": "X2X",
    })
    resp = await customer_client.get("/api/customers/me/addresses")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


# ── Update ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_update_address(customer_client: AsyncClient):
    resp = await customer_client.post("/api/customers/me/addresses", json={
        "label": "Home", "first_name": "A", "last_name": "B",
        "line1": "Old St", "city": "Toronto", "province": "ON", "postal_code": "X1X",
    })
    addr_id = resp.json()["id"]

    resp2 = await customer_client.patch(f"/api/customers/me/addresses/{addr_id}", json={
        "line1": "New St",
        "city": "Ottawa",
    })
    assert resp2.status_code == 200
    assert resp2.json()["line1"] == "New St"
    assert resp2.json()["city"] == "Ottawa"
    # Unchanged fields preserved
    assert resp2.json()["province"] == "ON"


@pytest.mark.asyncio
async def test_update_address_not_found(customer_client: AsyncClient):
    resp = await customer_client.patch("/api/customers/me/addresses/9999", json={
        "line1": "Ghost St",
    })
    assert resp.status_code == 404


# ── Default Management ────────────────────────────────────────

@pytest.mark.asyncio
async def test_set_default_clears_previous(customer_client: AsyncClient):
    """Setting a new default should clear the old one."""
    r1 = await customer_client.post("/api/customers/me/addresses", json={
        "label": "Home", "first_name": "A", "last_name": "B",
        "line1": "1 St", "city": "C", "province": "ON", "postal_code": "X1X",
    })
    r2 = await customer_client.post("/api/customers/me/addresses", json={
        "label": "Work", "first_name": "A", "last_name": "B",
        "line1": "2 St", "city": "C", "province": "ON", "postal_code": "X2X",
        "is_default": True,
    })
    addr1_id = r1.json()["id"]
    addr2_id = r2.json()["id"]

    # Verify second is default
    addrs = (await customer_client.get("/api/customers/me/addresses")).json()
    defaults = [a for a in addrs if a["is_default"]]
    assert len(defaults) == 1
    assert defaults[0]["id"] == addr2_id


# ── Delete ────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_delete_address(customer_client: AsyncClient):
    resp = await customer_client.post("/api/customers/me/addresses", json={
        "label": "Temp", "first_name": "A", "last_name": "B",
        "line1": "Delete Me", "city": "C", "province": "ON", "postal_code": "X1X",
    })
    addr_id = resp.json()["id"]

    resp2 = await customer_client.delete(f"/api/customers/me/addresses/{addr_id}")
    assert resp2.status_code == 200
    assert resp2.json()["deleted"] is True

    # Verify gone
    addrs = (await customer_client.get("/api/customers/me/addresses")).json()
    assert len(addrs) == 0


@pytest.mark.asyncio
async def test_delete_default_promotes_next(customer_client: AsyncClient):
    """Deleting the default address should promote the most recent remaining."""
    r1 = await customer_client.post("/api/customers/me/addresses", json={
        "label": "First", "first_name": "A", "last_name": "B",
        "line1": "1 St", "city": "C", "province": "ON", "postal_code": "X1X",
    })
    r2 = await customer_client.post("/api/customers/me/addresses", json={
        "label": "Second", "first_name": "A", "last_name": "B",
        "line1": "2 St", "city": "C", "province": "ON", "postal_code": "X2X",
    })
    # First is default
    await customer_client.delete(f"/api/customers/me/addresses/{r1.json()['id']}")

    addrs = (await customer_client.get("/api/customers/me/addresses")).json()
    assert len(addrs) == 1
    assert addrs[0]["is_default"] is True


@pytest.mark.asyncio
async def test_delete_address_not_found(customer_client: AsyncClient):
    resp = await customer_client.delete("/api/customers/me/addresses/9999")
    assert resp.status_code == 404


# ── Ownership Isolation ───────────────────────────────────────

@pytest.mark.asyncio
async def test_cannot_access_other_customers_address(client: AsyncClient):
    """Customer A cannot read/update/delete Customer B's address."""
    # Register customer A
    await client.post("/api/customers/register", json={
        "email": "alice@example.com", "password": "AlicePass1",
        "first_name": "Alice", "last_name": "A",
    })
    r = await client.post("/api/customers/me/addresses", json={
        "label": "Alice Home", "first_name": "Alice", "last_name": "A",
        "line1": "Alice St", "city": "C", "province": "ON", "postal_code": "X1X",
    })
    alice_addr_id = r.json()["id"]
    await client.post("/api/customers/logout")

    # Register customer B
    await client.post("/api/customers/register", json={
        "email": "bob@example.com", "password": "BobPass123",
        "first_name": "Bob", "last_name": "B",
    })

    # Bob tries to access Alice's address
    resp = await client.patch(f"/api/customers/me/addresses/{alice_addr_id}", json={
        "line1": "Hacked!",
    })
    assert resp.status_code == 404

    resp2 = await client.delete(f"/api/customers/me/addresses/{alice_addr_id}")
    assert resp2.status_code == 404


# ── Unauthenticated ───────────────────────────────────────────

@pytest.mark.asyncio
async def test_addresses_require_auth(client: AsyncClient):
    resp = await client.get("/api/customers/me/addresses")
    assert resp.status_code == 401

    resp2 = await client.post("/api/customers/me/addresses", json={
        "label": "Nope", "first_name": "A", "last_name": "B",
        "line1": "X", "city": "C", "province": "ON", "postal_code": "Z",
    })
    assert resp2.status_code == 401
