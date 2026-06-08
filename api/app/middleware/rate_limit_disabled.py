from __future__ import annotations

from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """DISABLED FOR LOCAL TESTING"""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        return await call_next(request)
