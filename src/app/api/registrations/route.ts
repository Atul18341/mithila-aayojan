// src/app/api/registrations/route.ts
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

    // 🟢 Normalize inputs to prevent formatting bypass
    const eventId = Number(registration.eventId);
    const normalizedEmail = String(registration.email).trim().toLowerCase();
    const rawPhone = registration.phone || guest?.phone || '';
    const normalizedPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null;

    client = await pool.connect();

    // 🟢 2. DUPLICATE CHECK: Verify if Email OR Phone is already registered for this Event
    let duplicateQuery = `
      SELECT id, email, phone 
      FROM event_registrations 
      WHERE event_id = $1 AND (LOWER(email) = $2
    `;
    const duplicateParams: any[] = [eventId, normalizedEmail];

    if (normalizedPhone) {
      duplicateQuery += ` OR REGEXP_REPLACE(phone, '\\D', '', 'g') = $3`;
      duplicateParams.push(normalizedPhone);
    }

    duplicateQuery += `) LIMIT 1;`;

    const existingReg = await client.query(duplicateQuery, duplicateParams);

    if (existingReg.rows.length > 0) {
      const match = existingReg.rows[0];
      const matchType = match.email.toLowerCase() === normalizedEmail ? 'email' : 'phone number';

      client.release();
      client = null;

      return NextResponse.json(
        {
          error: `An entry with this ${matchType} is already registered for this event. Duplicate registrations are not allowed.`,
          isDuplicate: true,
          eventId
        },
        { status: 409 } // 409 Conflict status code
      );
    }

    const isPaidRegistration = Number(registration.totalPrice || 0) > 0;

    // 3. SECURITY CHECK: Verify Payment Signature IF Paid Event
    if (isPaidRegistration) {
      if (!paymentDetails?.razorpay_order_id || !paymentDetails?.razorpay_payment_id || !paymentDetails?.razorpay_signature) {
        if (client) client.release();
        return NextResponse.json({ error: 'Missing required payment verification tokens.' }, { status: 400 });
      }

      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
        .update(`${paymentDetails.razorpay_order_id}|${paymentDetails.razorpay_payment_id}`)
        .digest('hex');

      if (generatedSignature !== paymentDetails.razorpay_signature) {
        if (client) client.release();
        return NextResponse.json({ error: 'Payment signature verification failed. Potential tampering detected.' }, { status: 400 });
      }
    }

    // 4. EXTRACT COMPETITION & AGE GROUP DETAILS FROM PAYLOAD
    const competitionId = registration.competitionId || registration.competition_id || guest?.competitionId || null;
    const competitionTitle = registration.competitionTitle || registration.competition_title || registration.competitionName || guest?.competitionTitle || null;

    const ageGroupId = registration.ageGroupId || registration.age_group_id || guest?.ageGroupId || null;
    const ageGroupLabel = registration.ageGroupLabel || registration.age_group_label || guest?.ageGroupLabel || null;

    const isAgeVerified = Boolean(registration.isAgeVerified ?? registration.is_age_verified ?? false);
    const rawVerifiedAge = registration.verifiedAge ?? registration.verified_age;
    const verifiedAge = rawVerifiedAge !== undefined && rawVerifiedAge !== null && !isNaN(Number(rawVerifiedAge))
      ? Number(rawVerifiedAge)
      : null;

    // 5. ATOMIC POSTGRES TRANSACTION INSERTION
    await client.query('BEGIN');

    // A. Insert into event_registrations table
    const registrationQuery = `
      INSERT INTO event_registrations (
        event_id, 
        name, 
        email, 
        phone, 
        category, 
        competition_id,
        competition_title,
        age_group_id,
        age_group_label,
        is_age_verified,
        verified_age,
        custom_answers, 
        base_price, 
        gst_amount, 
        total_price, 
        registration_timestamp, 
        status, 
        sync_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING id;
    `;

    const registrationValues = [
      eventId,
      registration.name || registration.attendeeName,
      normalizedEmail,
      registration.phone,
      registration.category || registration.ticketType || 'general-public',
      competitionId,
      competitionTitle,
      ageGroupId,
      ageGroupLabel,
      isAgeVerified,
      verifiedAge,
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

    // B. Insert into guests table
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
      ON CONFLICT (qr_token) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, guests.name),
        email = COALESCE(EXCLUDED.email, guests.email),
        amount_paid = COALESCE(EXCLUDED.amount_paid, guests.amount_paid)
      RETURNING id;
    `;

    const guestValues = [
      Number(guest.eventId),
      guest.name,
      normalizedEmail,
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
      qrToken: guest.qrToken,
      competitionTitle: competitionTitle || undefined,
      ageGroupLabel: ageGroupLabel || undefined
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK');
    console.error('❌ Registration processing error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to complete registration.', details: error?.message || String(error) }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}