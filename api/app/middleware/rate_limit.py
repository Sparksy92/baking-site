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
        method = request.method
        path = request.url.path

        if not path.startswith("/api/"):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        max_requests, window = self._get_limit(method, path)
        key = f"{client_ip}:{method}:{path}"

        now = time.time()
        cutoff = now - window

        hits = self._hits[key]
        self._hits[key] = [t for t in hits if t > cutoff]
        hits = self._hits[key]

        # Prune stale keys every 5 minutes to prevent memory leak
        if now - self._last_prune > 300:
            self._last_prune = now
            stale = [k for k, v in self._hits.items() if not v or v[-1] < now - 900]
            for k in stale:
                del self._hits[k]

        if len(hits) >= max_requests:
            retry_after = int(hits[0] - cutoff) + 1
            logger.warning(
                "Rate limit hit: ip=%s path=%s hits=%d limit=%d",
                client_ip, path, len(hits), max_requests,
            )
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests", "code": "RATE_LIMITED"},
                headers={"Retry-After": str(retry_after)},
            )

        self._hits[key].append(now)
        return await call_next(request)
