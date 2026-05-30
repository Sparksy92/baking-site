"""Request ID middleware — adds X-Request-Id to every response for log tracing."""
from __future__ import annotations

import uuid
import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Assigns a unique request ID and catches unhandled exceptions."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        # Store on request state for use in route handlers / logging
        request.state.request_id = request_id

        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Unhandled exception [request_id=%s %s %s]", request_id, request.method, request.url.path)
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )

        response.headers["X-Request-Id"] = request_id
        return response
