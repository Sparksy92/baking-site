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
        path = request.url.path
        method = request.method
        from app.config import get_settings
        if get_settings().dev_mode:
            if not (method == "GET" and path.startswith("/api/orders/")):
                return await call_next(request)

        if not path.startswith("/api"):
            return await call_next(request)

        method = request.method
        ip = self._get_client_ip(request)
        max_requests, window_seconds = self._get_limit(method, path)

        now = time.time()
        
        # Prune old hits occasionally
        if now - self._last_prune > 300:
            for client_ip in list(self._hits.keys()):
                self._hits[client_ip] = [t for t in self._hits[client_ip] if now - t < 900]
                if not self._hits[client_ip]:
                    del self._hits[client_ip]
            self._last_prune = now

        # Filter hits for this IP within the window
        ip_hits = [t for t in self._hits[ip] if now - t < window_seconds]
        if len(ip_hits) >= max_requests:
            logger.warning(f"Rate limit exceeded for IP {ip} on {method} {path}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please try again later."},
                headers={"Retry-After": str(int(window_seconds))},
            )

        # Record this hit
        self._hits[ip].append(now)
        return await call_next(request)
