from __future__ import annotations

from dataclasses import dataclass


class SocialProviderError(Exception):
    """User-displayable social provider error."""


@dataclass(frozen=True)
class SocialPage:
    id: str
    name: str
    category: str | None
    access_token: str
    scopes: list[str]


@dataclass(frozen=True)
class SocialAccount:
    id: str
    name: str
    category: str | None
    access_token: str
    scopes: list[str]
    metadata: dict
    refresh_token: str | None = None
    token_expires_at: str | None = None
    refresh_token_expires_at: str | None = None
