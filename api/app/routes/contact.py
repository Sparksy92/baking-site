from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException, status

from app.models.schemas import ContactRequest
from app.services.email_service import send_contact_form

logger = logging.getLogger(__name__)

router = APIRouter(tags=["contact"])


@router.post("/contact", status_code=status.HTTP_200_OK)
async def submit_contact_form(body: ContactRequest):
    """Accept a contact form submission and email it to the store owner."""
    try:
        await send_contact_form(
            name=body.name,
            email=body.email,
            subject=body.subject,
            message=body.message,
            order_number=body.order_number,
        )
    except Exception:
        logger.exception("Failed to send contact form email")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to send message. Please try again later.",
        )

    return {"success": True, "message": "Your message has been sent. We'll get back to you soon."}
