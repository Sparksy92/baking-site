"""Admin image management tests — reorder and toggle primary."""
import io
import pytest
from httpx import AsyncClient


async def _create_product(admin_client: AsyncClient) -> int:
    resp = await admin_client.post("/api/admin/products", json={"name": "Img Tee", "slug": "img-tee"})
    return resp.json()["id"]


async def _upload_image(admin_client: AsyncClient, product_id: int, filename: str = "test.png") -> int:
    # Create a minimal valid PNG (1x1 pixel)
    import struct, zlib
    def make_png():
        sig = b'\x89PNG\r\n\x1a\n'
        ihdr_data = struct.pack('>IIBBBBB', 1, 1, 8, 2, 0, 0, 0)
        ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
        ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
        raw = b'\x00\x00\x00\x00'  # filter byte + RGB
        compressed = zlib.compress(raw)
        idat_crc = zlib.crc32(b'IDAT' + compressed) & 0xffffffff
        idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc)
        iend_crc = zlib.crc32(b'IEND') & 0xffffffff
        iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
        return sig + ihdr + idat + iend

    png_bytes = make_png()
    resp = await admin_client.post(
        f"/api/admin/products/{product_id}/images",
        files={"file": (filename, io.BytesIO(png_bytes), "image/png")},
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.mark.asyncio
async def test_list_images(admin_client: AsyncClient):
    pid = await _create_product(admin_client)
    img1 = await _upload_image(admin_client, pid, "a.png")
    img2 = await _upload_image(admin_client, pid, "b.png")

    resp = await admin_client.get(f"/api/admin/products/{pid}/images")
    assert resp.status_code == 200
    images = resp.json()
    assert len(images) == 2
    assert images[0]["id"] == img1
    assert images[1]["id"] == img2


@pytest.mark.asyncio
async def test_first_image_is_primary(admin_client: AsyncClient):
    pid = await _create_product(admin_client)
    await _upload_image(admin_client, pid, "first.png")
    await _upload_image(admin_client, pid, "second.png")

    resp = await admin_client.get(f"/api/admin/products/{pid}/images")
    images = resp.json()
    assert images[0]["is_primary"] == 1
    assert images[1]["is_primary"] == 0


@pytest.mark.asyncio
async def test_set_primary(admin_client: AsyncClient):
    pid = await _create_product(admin_client)
    img1 = await _upload_image(admin_client, pid, "one.png")
    img2 = await _upload_image(admin_client, pid, "two.png")

    # Set second image as primary
    resp = await admin_client.patch(f"/api/admin/products/{pid}/images/{img2}/primary")
    assert resp.status_code == 200
    assert resp.json()["primary"] is True

    # Verify
    images_resp = await admin_client.get(f"/api/admin/products/{pid}/images")
    images = images_resp.json()
    img1_data = next(i for i in images if i["id"] == img1)
    img2_data = next(i for i in images if i["id"] == img2)
    assert img1_data["is_primary"] == 0
    assert img2_data["is_primary"] == 1


@pytest.mark.asyncio
async def test_set_primary_not_found(admin_client: AsyncClient):
    pid = await _create_product(admin_client)
    resp = await admin_client.patch(f"/api/admin/products/{pid}/images/9999/primary")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_reorder_images(admin_client: AsyncClient):
    pid = await _create_product(admin_client)
    img1 = await _upload_image(admin_client, pid, "x.png")
    img2 = await _upload_image(admin_client, pid, "y.png")
    img3 = await _upload_image(admin_client, pid, "z.png")

    # Reverse order
    resp = await admin_client.patch(
        f"/api/admin/products/{pid}/images/reorder",
        json={"image_ids": [img3, img2, img1]},
    )
    assert resp.status_code == 200
    assert resp.json()["reordered"] is True

    # Verify order
    images_resp = await admin_client.get(f"/api/admin/products/{pid}/images")
    images = images_resp.json()
    assert images[0]["id"] == img3
    assert images[1]["id"] == img2
    assert images[2]["id"] == img1


@pytest.mark.asyncio
async def test_reorder_empty_body(admin_client: AsyncClient):
    pid = await _create_product(admin_client)
    resp = await admin_client.patch(f"/api/admin/products/{pid}/images/reorder", json={})
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_images_require_auth(client: AsyncClient):
    resp = await client.get("/api/admin/products/1/images")
    assert resp.status_code == 401
