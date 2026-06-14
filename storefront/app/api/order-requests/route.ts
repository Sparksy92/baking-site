import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customer_name,
      customer_email,
      customer_phone,
      requested_items,
      desired_date,
      pickup_or_delivery,
      preferred_contact_method,
      allergy_notes,
      special_instructions
    } = body;

    const errors: Record<string, string> = {};

    // 1. Validation
    if (!customer_name || typeof customer_name !== 'string' || customer_name.trim() === '') {
      errors.customer_name = 'Customer name is required.';
    } else if (customer_name.length > 100) {
      errors.customer_name = 'Customer name cannot exceed 100 characters.';
    }

    if (!customer_email || typeof customer_email !== 'string' || !EMAIL_REGEX.test(customer_email)) {
      errors.customer_email = 'A valid customer email is required.';
    } else if (customer_email.length > 100) {
      errors.customer_email = 'Customer email cannot exceed 100 characters.';
    }

    if (customer_phone && (typeof customer_phone !== 'string' || customer_phone.length > 50)) {
      errors.customer_phone = 'Customer phone cannot exceed 50 characters.';
    }

    if (!requested_items || (Array.isArray(requested_items) && requested_items.length === 0)) {
      errors.requested_items = 'Requested items list cannot be empty.';
    }

    const validPickupDelivery = ['pickup', 'delivery'];
    if (pickup_or_delivery && !validPickupDelivery.includes(pickup_or_delivery)) {
      errors.pickup_or_delivery = 'Pickup/delivery must be "pickup" or "delivery".';
    }

    const validContactMethods = ['email', 'phone', 'text'];
    if (preferred_contact_method && !validContactMethods.includes(preferred_contact_method)) {
      errors.preferred_contact_method = 'Preferred contact method must be "email", "phone", or "text".';
    }

    if (allergy_notes && (typeof allergy_notes !== 'string' || allergy_notes.length > 1000)) {
      errors.allergy_notes = 'Allergy notes cannot exceed 1000 characters.';
    }

    if (special_instructions && (typeof special_instructions !== 'string' || special_instructions.length > 1000)) {
      errors.special_instructions = 'Special instructions cannot exceed 1000 characters.';
    }

    if (desired_date) {
      const d = new Date(desired_date);
      if (isNaN(d.getTime())) {
        errors.desired_date = 'Desired date must be a valid date.';
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    const itemsJson = typeof requested_items === 'string'
      ? requested_items
      : JSON.stringify(requested_items);

    // 2. Save the request to Neon
    const sql = `
      INSERT INTO order_requests (
        customer_name, customer_email, customer_phone, requested_items,
        desired_date, pickup_or_delivery, preferred_contact_method,
        allergy_notes, special_instructions, status, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'new', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;
    const params = [
      customer_name.trim(),
      customer_email.trim().toLowerCase(),
      customer_phone ? customer_phone.trim() : null,
      itemsJson,
      desired_date || null,
      pickup_or_delivery || 'pickup',
      preferred_contact_method || 'email',
      allergy_notes ? allergy_notes.trim() : null,
      special_instructions ? special_instructions.trim() : null
    ];

    const result = await query(sql, params);
    const savedOrder = result.rows[0];

    // 3. Send notification email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const contactEmail = process.env.CONTACT_EMAIL || 'hello@cedarandsagehomestead.ca';
    const emailFrom = process.env.EMAIL_FROM || 'Cedar & Sage Homestead <orders@cedarandsagehomestead.ca>';

    if (resendApiKey) {
      try {
        let parsedItems: any[] = [];
        try {
          parsedItems = JSON.parse(itemsJson);
        } catch {
          parsedItems = requested_items;
        }

        let itemsListHtml = '<ul style="margin: 0; padding-left: 20px;">';
        if (Array.isArray(parsedItems)) {
          for (const item of parsedItems) {
            const name = escapeHtml(item.name || item.productName || 'Unnamed Item');
            const qty = escapeHtml(String(item.quantity || 1));
            const notes = item.notes ? ` (Note: ${escapeHtml(item.notes)})` : '';
            itemsListHtml += `<li style="margin-bottom: 6px;"><strong>${name}</strong> x ${qty}${notes}</li>`;
          }
        } else {
          itemsListHtml += `<li>${escapeHtml(String(parsedItems))}</li>`;
        }
        itemsListHtml += '</ul>';

        const emailHtml = `
          <div style="font-family: sans-serif; color: #2B2522; line-height: 1.6; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #E3DDD3; borderRadius: 16px; backgroundColor: #FAF7F2;">
            <h2 style="color: #6F7D5C; border-bottom: 2px solid #E3DDD3; padding-bottom: 10px; margin-top: 0;">New Order Request #CSH-${savedOrder.id}</h2>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 150px;">Customer Name:</td>
                <td style="padding: 8px 0;">${escapeHtml(customer_name)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Customer Email:</td>
                <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(customer_email)}" style="color: #C8A2A8; text-decoration: none;">${escapeHtml(customer_email)}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Phone Number:</td>
                <td style="padding: 8px 0;">${customer_phone ? escapeHtml(customer_phone) : 'N/A'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Contact Preference:</td>
                <td style="padding: 8px 0; text-transform: capitalize;">${escapeHtml(preferred_contact_method || 'email')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Service Style:</td>
                <td style="padding: 8px 0; text-transform: capitalize;">${escapeHtml(pickup_or_delivery || 'pickup')}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Desired Date:</td>
                <td style="padding: 8px 0;">${desired_date ? escapeHtml(desired_date) : 'Flexible/Unspecified'}</td>
              </tr>
            </table>

            <h3 style="color: #6F7D5C; border-bottom: 1px solid #E3DDD3; padding-bottom: 6px;">Requested Items</h3>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid #E3DDD3; margin-bottom: 20px;">
              ${itemsListHtml}
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top; width: 150px;">Allergies/Dietary:</td>
                <td style="padding: 8px 0; color: #C53030;">${allergy_notes ? escapeHtml(allergy_notes) : 'None reported'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; vertical-align: top;">Special Instructions:</td>
                <td style="padding: 8px 0;">${special_instructions ? escapeHtml(special_instructions) : 'None'}</td>
              </tr>
            </table>

            <div style="border-t: 1px solid #E3DDD3; padding-top: 15px; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/admin/order-requests" 
                 style="background-color: #6F7D5C; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; display: inline-block;">
                Open Admin Panel
              </a>
            </div>
          </div>
        `;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: emailFrom,
            to: contactEmail,
            subject: `New Order Request #CSH-${savedOrder.id} - ${customer_name}`,
            html: emailHtml
          })
        });
      } catch (emailError) {
        console.error('Failed to send notification email via Resend:', emailError);
      }
    }

    return NextResponse.json({ order_number: `CSH-${savedOrder.id}`, id: savedOrder.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
