from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from app.database import PostgresConnection, get_db
from app.models.schemas import OrderRequestCreate, OrderRequestResponse
from app.services.email_service import send_order_request_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/order-requests", tags=["order-requests"])


@router.post("", response_model=OrderRequestResponse, status_code=status.HTTP_201_CREATED)
async def create_order_request(
    body: OrderRequestCreate,
    db: PostgresConnection = Depends(get_db)
):
    """Submit a new order request."""
    # Convert requested items to list of dicts for serialization/db insertion
    items_list = [item.model_dump() for item in body.requested_items]
    
    try:
        cursor = await db.execute(
            """INSERT INTO order_requests (
                customer_name, customer_email, customer_phone, 
                preferred_contact_method, requested_items, desired_date, 
                pickup_or_delivery, allergy_notes, special_instructions, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                body.customer_name,
                body.customer_email,
                body.customer_phone,
                body.preferred_contact_method,
                json.dumps(items_list),
                body.desired_date,
                body.pickup_or_delivery,
                body.allergy_notes,
                body.special_instructions,
                "new"
            )
        )
        request_id = cursor.lastrowid
        await db.commit()
        
        row_cursor = await db.execute("SELECT * FROM order_requests WHERE id = ?", (request_id,))
        row = await row_cursor.fetchone()
        
        if not row:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save order request."
            )
            
        created_at = row["created_at"]
        updated_at = row["updated_at"]
        
    except HTTPException as he:
        raise he
    except Exception as e:
        logger.error("Database save failed for order request: %s", str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save order request to database."
        )

    # Prepare response data
    response_data = {
        "id": request_id,
        "customer_name": body.customer_name,
        "customer_email": body.customer_email,
        "customer_phone": body.customer_phone,
        "preferred_contact_method": body.preferred_contact_method,
        "requested_items": body.requested_items,
        "desired_date": body.desired_date,
        "pickup_or_delivery": body.pickup_or_delivery,
        "allergy_notes": body.allergy_notes,
        "special_instructions": body.special_instructions,
        "status": "new",
        "admin_notes": None,
        "created_at": created_at,
        "updated_at": updated_at
    }

    # Attempt to send notification email, failure should not fail response
    try:
        await send_order_request_notification(response_data)
    except Exception as email_err:
        logger.error("Failed to send order request notification email: %s", str(email_err))

    return response_data
