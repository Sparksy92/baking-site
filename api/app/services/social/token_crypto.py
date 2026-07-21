from __future__ import annotations

import base64
import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)

_LEGACY_SALT = b"rezhub-social-token-v1"
_SALT_LEN = 32
_V2_PREFIX = b"v2:"


class TokenCryptoError(Exception):
    """Raised when social token encryption is not configured or fails."""


def _derive_fernet_key(secret: str, salt: bytes) -> bytes:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=200_000,
    )
    return base64.urlsafe_b64encode(kdf.derive(secret.encode("utf-8")))


def _get_secret(settings: Settings | None) -> str:
    settings = settings or get_settings()
    secret = settings.social_token_encryption_key
    if not secret:
        raise TokenCryptoError("SOCIAL_TOKEN_ENCRYPTION_KEY is not configured")
    return secret


def encrypt_token(token: str | None, settings: Settings | None = None) -> str | None:
    if not token:
        return None
    try:
        secret = _get_secret(settings)
        salt = os.urandom(_SALT_LEN)
        key = _derive_fernet_key(secret, salt)
        ciphertext = Fernet(key).encrypt(token.encode("utf-8"))
        payload = _V2_PREFIX + base64.urlsafe_b64encode(salt) + b":" + ciphertext
        return payload.decode("utf-8")
    except TokenCryptoError:
        raise
    except Exception as exc:
        logger.exception("Failed to encrypt social token")
        raise TokenCryptoError("Failed to encrypt token") from exc


def decrypt_token(encrypted_token: str | None, settings: Settings | None = None) -> str | None:
    if not encrypted_token:
        return None
    try:
        secret = _get_secret(settings)
        raw = encrypted_token.encode("utf-8")
        if raw.startswith(_V2_PREFIX):
            rest = raw[len(_V2_PREFIX):]
            salt_b64, ciphertext = rest.split(b":", 1)
            salt = base64.urlsafe_b64decode(salt_b64)
            key = _derive_fernet_key(secret, salt)
        else:
            key = _derive_fernet_key(secret, _LEGACY_SALT)
            ciphertext = raw
        return Fernet(key).decrypt(ciphertext).decode("utf-8")
    except TokenCryptoError:
        raise
    except InvalidToken as exc:
        raise TokenCryptoError("Stored social token cannot be decrypted") from exc
    except Exception as exc:
        logger.exception("Failed to decrypt social token")
        raise TokenCryptoError("Failed to decrypt token") from exc
