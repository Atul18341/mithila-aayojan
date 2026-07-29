import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function POST(request: Request) {
  let client;

  try {
    const body = await request.json();
    const { registration, guest, paymentDetails } = body;

    // 1. Basic Required Payload Verification
    if (!registration?.eventId || !registration?.email || !guest?.qrToken) {
      return NextResponse.json({ error: 'Incomplete registration payload.' }, { status: 400 });
    }

    const isPaidRegistration = Number(registration.totalPrice || 0) > 0;

    // 2. SECURITY CHECK: Verify Payment Signature IF Paid Event
    if (isPaidRegistration) {
      if (!paymentDetails?.razorpay_order_id || !paymentDetails?.razorpay_payment_id || !paymentDetails?.razorpay_signature) {
        return NextResponse.json({ error: 'Missing required payment verification tokens.' }, { status: 400 });
      }

      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${paymentDetails.razorpay_order_id}|${paymentDetails.razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== paymentDetails.razorpay_signature) {
        return NextResponse.json({ error: 'Payment signature verification failed. Potential tampering detected.' }, { status: 400 });
      }
    }

    // 3. ATOMIC POSTGRES TRANSACTION INSERTION
    client = await pool.connect();
    await client.query('BEGIN');

    // A. Insert into event_registrations table
    const registrationQuery = `
      INSERT INTO event_registrations (
        event_id, 
        name, 
        email, 
        phone, 
        category, 
        custom_answers, 
        base_price, 
        gst_amount, 
        total_price, 
        registration_timestamp, 
        status, 
        sync_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id;
    `;

    const registrationValues = [
      Number(registration.eventId),
      registration.name,
      registration.email,
      registration.phone,
      registration.category || 'general-public',
      JSON.stringify(registration.customAnswers || {}),
      parseFloat(registration.basePrice || 0),
      parseFloat(registration.gstAmount || 0),
      parseFloat(registration.totalPrice || 0),
      registration.registrationTimestamp ? Number(registration.registrationTimestamp) : Date.now(),
      registration.status || 'CONFIRMED',
      'synced'
    ];

    const regResult = await client.query(registrationQuery, registrationValues);
    const createdRegistrationId = regResult.rows[0]?.id;

    // B. Insert into guests table (🟢 Fixed: Removed non-existent "category" column)
    const guestQuery = `
      INSERT INTO guests (
        event_id, 
        name, 
        email, 
        phone, 
        type, 
        qr_token, 
        is_check_in, 
        has_food_access, 
        amount_paid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id;
    `;

    const guestValues = [
      Number(guest.eventId),
      guest.name,
      guest.email,
      guest.phone,
      guest.category || guest.type || 'general-public',
      guest.qrToken,
      false,
      Boolean(guest.hasFoodAccess),
      parseFloat(guest.amountPaid || registration.totalPrice || 0)
    ];

    await client.query(guestQuery, guestValues);

    await client.query('COMMIT');

    return NextResponse.json({
      success: true,
      message: isPaidRegistration ? 'Payment verified and registration recorded.' : 'Free registration successfully recorded.',
      registrationId: createdRegistrationId,
      qrToken: guest.qrToken
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Registration processing error:', error.message);
    return NextResponse.json({ error: 'Failed to complete registration.', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}