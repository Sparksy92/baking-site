import { NextResponse, NextRequest } from 'next/server';
import { query } from '@/lib/db';

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

    // 1. Validate required fields
    if (!customer_name || !customer_email || !requested_items) {
      return NextResponse.json({ detail: 'Missing required fields' }, { status: 400 });
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
      customer_name,
      customer_email,
      customer_phone || null,
      itemsJson,
      desired_date || null,
      pickup_or_delivery || 'pickup',
      preferred_contact_method || 'email',
      allergy_notes || null,
      special_instructions || null
    ];

    const result = await query(sql, params);
    const savedOrder = result.rows[0];

    // 3. Attempt to send notification email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const contactEmail = process.env.CONTACT_EMAIL || 'hello@cedarandsagehomestead.ca';
    const emailFrom = process.env.EMAIL_FROM || 'Cedar & Sage Homestead <orders@cedarandsagehomestead.ca>';

    if (resendApiKey) {
      try {
        const emailHtml = `
          <h2>New Order Request #${savedOrder.id}</h2>
          <p><strong>Customer:</strong> ${customer_name} (${customer_email})</p>
          <p><strong>Phone:</strong> ${customer_phone || 'N/A'}</p>
          <p><strong>Contact Method:</strong> ${preferred_contact_method}</p>
          <p><strong>Pickup/Delivery:</strong> ${pickup_or_delivery}</p>
          <p><strong>Desired Date:</strong> ${desired_date || 'Flexible/Unconfirmed'}</p>
          <h3>Requested Items:</h3>
          <pre>${JSON.stringify(JSON.parse(itemsJson), null, 2)}</pre>
          <p><strong>Allergy Notes:</strong> ${allergy_notes || 'None'}</p>
          <p><strong>Special Instructions:</strong> ${special_instructions || 'None'}</p>
          <br/>
          <p><a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin/order-requests">View in Admin Panel</a></p>
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
            subject: `New Order Request #${savedOrder.id} - ${customer_name}`,
            html: emailHtml
          })
        });
      } catch (emailError) {
        // Log the email error server-side, but do not fail the customer request
        console.error('Failed to send notification email via Resend:', emailError);
      }
    }

    return NextResponse.json({ order_number: `CSH-${savedOrder.id}`, id: savedOrder.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }
}
