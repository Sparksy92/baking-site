from __future__ import annotations

import json
from datetime import datetime, timezone

from app.database import PostgresConnection
from app.services.social.providers.base import SocialAccount, SocialPage
from app.services.social.token_crypto import decrypt_token, encrypt_token


def _loads_scopes(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except json.JSONDecodeError:
        return [part.strip() for part in value.split(",") if part.strip()]


def serialize_connection(row: dict) -> dict:
    return {
        "id": row["id"],
        "brand_id": row.get("brand_id", "default"),
        "provider": row["provider"],
        "account_type": row["account_type"],
        "display_name": row.get("display_name"),
        "external_account_id": row["external_account_id"],
        "external_user_id": row.get("external_user_id"),
        "scopes": _loads_scopes(row.get("scopes")),
        "status": row["status"],
        "last_error": row.get("last_error"),
        "token_expires_at": row.get("token_expires_at"),
        "refresh_token_expires_at": row.get("refresh_token_expires_at"),
        "last_checked_at": row.get("last_checked_at"),
        "last_synced_at": row.get("last_synced_at"),
        "connected_by_user_id": row.get("connected_by_user_id"),
        "metadata": _loads_metadata(row.get("metadata")),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def _loads_metadata(value: str | None) -> dict:
    if not value:
        return {}
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, dict) else {}
    except json.JSONDecodeError:
        return {}


def _loads_datetime(value: str | datetime | None) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed


async def get_connection(
    db: PostgresConnection,
    *,
    provider: str,
    account_type: str = "page",
    brand_id: str = "default",
) -> dict | None:
    cursor = await db.execute(
        """SELECT * FROM social_connections
           WHERE brand_id = ? AND provider = ? AND account_type = ?
           ORDER BY updated_at DESC, id DESC
           LIMIT 1""",
        (brand_id, provider, account_type),
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def get_serialized_connection(
    db: PostgresConnection,
    *,
    provider: str,
    account_type: str = "page",
    brand_id: str = "default",
) -> dict | None:
    row = await get_connection(db, provider=provider, account_type=account_type, brand_id=brand_id)
    return serialize_connection(row) if row else None


async def store_oauth_pages(
    db: PostgresConnection,
    *,
    oauth_state_id: int,
    provider: str,
    pages: list[SocialPage],
) -> None:
    for page in pages:
        await db.execute(
            """INSERT INTO social_oauth_pages
               (oauth_state_id, provider, external_account_id, display_name, category, encrypted_access_token, scopes)
               VALUES (?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (oauth_state_id, provider, external_account_id)
               DO UPDATE SET
                   display_name = EXCLUDED.display_name,
                   category = EXCLUDED.category,
                   encrypted_access_token = EXCLUDED.encrypted_access_token,
                   scopes = EXCLUDED.scopes""",
            (
                oauth_state_id,
                provider,
                page.id,
                page.name,
                page.category,
                encrypt_token(page.access_token),
                json.dumps(page.scopes),
            ),
        )
    await db.commit()


async def store_oauth_accounts(
    db: PostgresConnection,
    *,
    oauth_state_id: int,
    provider: str,
    accounts: list[SocialAccount],
) -> None:
    for account in accounts:
        await db.execute(
            """INSERT INTO social_oauth_pages
               (oauth_state_id, provider, external_account_id, display_name, category, encrypted_access_token, scopes, metadata)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON CONFLICT (oauth_state_id, provider, external_account_id)
               DO UPDATE SET
                   display_name = EXCLUDED.display_name,
                   category = EXCLUDED.category,
                   encrypted_access_token = EXCLUDED.encrypted_access_token,
                   scopes = EXCLUDED.scopes,
                   metadata = EXCLUDED.metadata""",
            (
                oauth_state_id,
                provider,
                account.id,
                account.name,
                account.category,
                encrypt_token(account.access_token),
                json.dumps(account.scopes),
                json.dumps(
                    {
                        **account.metadata,
                        "_refresh_token": encrypt_token(account.refresh_token) if account.refresh_token else None,
                        "_token_expires_at": account.token_expires_at,
                        "_refresh_token_expires_at": account.refresh_token_expires_at,
                    }
                ),
            ),
        )
    await db.commit()


async def list_available_pages(
    db: PostgresConnection,
    *,
    provider: str = "facebook",
) -> list[dict]:
    cursor = await db.execute(
        """SELECT p.id, p.external_account_id, p.display_name, p.category, p.scopes,
                  c.id AS connection_id, c.status AS connection_status
           FROM social_oauth_pages p
           JOIN social_oauth_states s ON s.id = p.oauth_state_id
           LEFT JOIN social_connections c
             ON c.provider = p.provider
            AND c.account_type = 'page'
            AND c.external_account_id = p.external_account_id
            AND c.status != 'disconnected'
           WHERE p.provider = ? AND s.status = 'used'
           ORDER BY p.id DESC""",
        (provider,),
    )
    rows = await cursor.fetchall()
    seen: set[str] = set()
    pages: list[dict] = []
    for row in rows:
        data = dict(row)
        page_id = data["external_account_id"]
        if page_id in seen:
            continue
        seen.add(page_id)
        pages.append(
            {
                "id": data["id"],
                "page_id": page_id,
                "name": data["display_name"],
                "category": data.get("category"),
                "scopes": _loads_scopes(data.get("scopes")),
                "connection_status": data.get("connection_status"),
                "connected": bool(data.get("connection_id")),
            }
        )
    return pages


async def list_available_accounts(
    db: PostgresConnection,
    *,
    provider: str,
    account_type: str,
) -> list[dict]:
    cursor = await db.execute(
        """SELECT p.id, p.external_account_id, p.display_name, p.category, p.scopes, p.metadata,
                  c.id AS connection_id, c.status AS connection_status
           FROM social_oauth_pages p
           JOIN social_oauth_states s ON s.id = p.oauth_state_id
           LEFT JOIN social_connections c
             ON c.provider = p.provider
            AND c.account_type = ?
            AND c.external_account_id = p.external_account_id
            AND c.status != 'disconnected'
           WHERE p.provider = ? AND s.status = 'used'
           ORDER BY p.id DESC""",
        (account_type, provider),
    )
    rows = await cursor.fetchall()
    seen: set[str] = set()
    accounts: list[dict] = []
    for row in rows:
        data = dict(row)
        account_id = data["external_account_id"]
        if account_id in seen:
            continue
        seen.add(account_id)
        accounts.append(
            {
                "id": data["id"],
                "external_account_id": account_id,
                "name": data["display_name"],
                "category": data.get("category"),
                "scopes": _loads_scopes(data.get("scopes")),
                "metadata": _loads_metadata(data.get("metadata")),
                "connection_status": data.get("connection_status"),
                "connected": bool(data.get("connection_id")),
            }
        )
    return accounts


async def select_page_connection(
    db: PostgresConnection,
    *,
    page_id: str,
    provider: str,
    admin_user_id: str | None,
    external_user_id: str | None,
    brand_id: str = "default",
) -> dict:
    cursor = await db.execute(
        """SELECT * FROM social_oauth_pages
           WHERE provider = ? AND external_account_id = ?
           ORDER BY id DESC
           LIMIT 1""",
        (provider, page_id),
    )
    page = await cursor.fetchone()
    if not page:
        raise ValueError("Page selection expired. Reconnect Facebook and try again.")
    page_data = dict(page)

    await db.execute(
        """INSERT INTO social_connections
           (brand_id, provider, account_type, display_name, external_account_id,
            external_user_id, encrypted_access_token, scopes, status,
            last_error, last_synced_at, connected_by_user_id)
           VALUES (?, ?, 'page', ?, ?, ?, ?, ?, 'connected', NULL, CURRENT_TIMESTAMP, ?)
           ON CONFLICT (brand_id, provider, account_type, external_account_id)
           DO UPDATE SET
               display_name = EXCLUDED.display_name,
               external_user_id = EXCLUDED.external_user_id,
               encrypted_access_token = EXCLUDED.encrypted_access_token,
               scopes = EXCLUDED.scopes,
               status = 'connected',
               last_error = NULL,
               last_synced_at = CURRENT_TIMESTAMP,
               connected_by_user_id = EXCLUDED.connected_by_user_id,
               updated_at = CURRENT_TIMESTAMP""",
        (
            brand_id,
            provider,
            page_data["display_name"],
            page_data["external_account_id"],
            external_user_id,
            page_data["encrypted_access_token"],
            page_data["scopes"],
            admin_user_id,
        ),
    )
    await db.commit()
    row = await get_connection(db, provider=provider, brand_id=brand_id)
    if not row:
        raise ValueError("Connection could not be saved")
    return serialize_connection(row)


async def select_account_connection(
    db: PostgresConnection,
    *,
    external_account_id: str,
    provider: str,
    account_type: str,
    admin_user_id: str | None,
    external_user_id: str | None,
    brand_id: str = "default",
) -> dict:
    cursor = await db.execute(
        """SELECT * FROM social_oauth_pages
           WHERE provider = ? AND external_account_id = ?
           ORDER BY id DESC
           LIMIT 1""",
        (provider, external_account_id),
    )
    account = await cursor.fetchone()
    if not account:
        raise ValueError("Account selection expired. Reconnect and try again.")
    data = dict(account)

    metadata = _loads_metadata(data.get("metadata"))
    encrypted_refresh_token = metadata.pop("_refresh_token", None)
    token_expires_at = _loads_datetime(metadata.pop("_token_expires_at", None))
    refresh_token_expires_at = _loads_datetime(metadata.pop("_refresh_token_expires_at", None))

    await db.execute(
        """INSERT INTO social_connections
           (brand_id, provider, account_type, display_name, external_account_id,
            external_user_id, encrypted_access_token, encrypted_refresh_token,
            token_expires_at, refresh_token_expires_at, scopes, metadata, status,
            last_error, last_synced_at, connected_by_user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'connected', NULL, CURRENT_TIMESTAMP, ?)
           ON CONFLICT (brand_id, provider, account_type, external_account_id)
           DO UPDATE SET
               display_name = EXCLUDED.display_name,
               external_user_id = EXCLUDED.external_user_id,
               encrypted_access_token = EXCLUDED.encrypted_access_token,
               encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
               token_expires_at = EXCLUDED.token_expires_at,
               refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
               scopes = EXCLUDED.scopes,
               metadata = EXCLUDED.metadata,
               status = 'connected',
               last_error = NULL,
               last_synced_at = CURRENT_TIMESTAMP,
               connected_by_user_id = EXCLUDED.connected_by_user_id,
               updated_at = CURRENT_TIMESTAMP""",
        (
            brand_id,
            provider,
            account_type,
            data["display_name"],
            data["external_account_id"],
            external_user_id,
            data["encrypted_access_token"],
            encrypted_refresh_token,
            token_expires_at,
            refresh_token_expires_at,
            data["scopes"],
            json.dumps(metadata),
            admin_user_id,
        ),
    )
    await db.commit()
    row = await get_connection(db, provider=provider, account_type=account_type, brand_id=brand_id)
    if not row:
        raise ValueError("Connection could not be saved")
    return serialize_connection(row)


async def get_decrypted_page_token(db: PostgresConnection, *, provider: str = "facebook") -> tuple[dict, str]:
    connection = await get_connection(db, provider=provider)
    if not connection or connection["status"] == "disconnected":
        raise ValueError("Facebook Page is not connected")
    token = decrypt_token(connection.get("encrypted_access_token"))
    if not token:
        raise ValueError("Facebook Page token is unavailable")
    return connection, token


async def mark_connection_checked(
    db: PostgresConnection,
    *,
    connection_id: int,
    status: str,
    last_error: str | None = None,
) -> None:
    await db.execute(
        """UPDATE social_connections
           SET status = ?, last_error = ?, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (status, last_error, connection_id),
    )
    await db.commit()


async def disconnect_connection(
    db: PostgresConnection,
    *,
    provider: str = "facebook",
    account_type: str = "page",
    brand_id: str = "default",
) -> bool:
    row = await get_connection(db, provider=provider, account_type=account_type, brand_id=brand_id)
    if not row:
        return False
    await db.execute(
        """UPDATE social_connections
           SET status = 'disconnected',
               encrypted_access_token = NULL,
               encrypted_refresh_token = NULL,
               last_error = NULL,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = ?""",
        (row["id"],),
    )
    await db.commit()
    return True


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
