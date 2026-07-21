from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from app.database import PostgresConnection

from app.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(tags=["newsletter"])


class NewsletterSubscribeRequest(BaseModel):
    email: EmailStr


class NewsletterSubscribeResponse(BaseModel):
    message: str


@router.post("/newsletter/subscribe", response_model=NewsletterSubscribeResponse)
async def subscribe(
    body: NewsletterSubscribeRequest,
    db: PostgresConnection = Depends(get_db),
):
    """Subscribe an email to the newsletter."""
    try:
        await db.execute(
            """INSERT INTO newsletter_subscribers (email) VALUES (?)
               ON CONFLICT(email) DO UPDATE SET is_active = TRUE""",
            (body.email.lower(),),
        )
        await db.commit()
    except Exception:
        logger.exception("Newsletter subscribe failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not subscribe. Please try again.",
        )

    logger.info("Newsletter subscription: %s", body.email)
    return NewsletterSubscribeResponse(message="You're in! Watch your inbox.")


@router.post("/newsletter/unsubscribe", response_model=NewsletterSubscribeResponse)
async def unsubscribe(
    body: NewsletterSubscribeRequest,
    db: PostgresConnection = Depends(get_db),
):
    """Unsubscribe an email from the newsletter."""
    result = await db.execute(
        "UPDATE newsletter_subscribers SET is_active = FALSE WHERE LOWER(email) = LOWER(?)",
        (body.email.lower(),),
    )
    await db.commit()
    logger.info("Newsletter unsubscribe: %s (rows=%d)", body.email, result.rowcount)
    return NewsletterSubscribeResponse(message="You've been unsubscribed.")
