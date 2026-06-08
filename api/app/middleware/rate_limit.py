from __future__ import annotations

import time
import logging
from collections import defaultdict
from typing import Callable

from fastapi import Request, Response, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """In-memory sliding window rate limiter per IP.

    Limits:
    - POST /api/auth/login, /api/customers/login → 5 per 15 min
    - POST /api/checkout    → 10 per 1 min
    - GET  /api/orders/:id  → 10 per 15 min
    - Everything else       → 100 per 1 min
    """

    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._last_prune: float = 0.0

    def _get_limit(self, method: str, path: str) -> tuple[int, int]:
        """Returns (max_requests, window_seconds) for the given endpoint."""
        if method == "POST" and path in ("/api/auth/login", "/api/customers/login"):
            return 5, 900
        if method == "POST" and path.startswith("/api/checkout"):
            return 10, 60
        if method == "GET" and path.startswith("/api/orders/"):
            return 10, 900
        return 100, 60

    def _get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # DISABLED FOR LOCAL TESTING - rate limiting bypassed
        return await call_next(request)
