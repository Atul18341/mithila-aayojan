// src/app/api/registrations/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { Pool } from 'pg';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

// Helper: Convert Base64 image payload to Buffer for Cloudflare R2[cite: 3]
function base64ToBuffer(base64Data: string): { buffer: Buffer; contentType: string } | null {
  if (!base64Data) return null;
  const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  return {
    buffer: Buffer.from(matches[2], 'base64'),
    contentType: matches[1],
  };
}

// Helper: Dynamic food access evaluation based on event database configuration
function checkFoodAccess(category: string | undefined | null, foodConfig: any): boolean {
  if (!foodConfig || !foodConfig.enabled) return false;
  if (foodConfig.availableForAll === 'yes') return true;
  if (!category) return false;

  let allowed: string[] = [];
  if (Array.isArray(foodConfig.allowedCategories)) {
    allowed = foodConfig.allowedCategories;
  } else if (typeof foodConfig.allowedCategories === 'string') {
    try {
      const parsed = JSON.parse(foodConfig.allowedCategories);
      allowed = Array.isArray(parsed) ? parsed : [];
    } catch {
      allowed = [];
    }
  }

  return allowed.includes(category);
}

export async function POST(request: Request) {
  let client;

  try {
    const body = await request.json(); //[cite: 11]
    const { registration, guest, paymentDetails } = body; //[cite: 11]

    // 1. Basic Required Payload Verification[cite: 11]
    if (!registration?.eventId || !registration?.email || !guest?.qrToken) {
      return NextResponse.json({ error: 'Incomplete registration payload.' }, { status: 400 }); //[cite: 11]
    }

    const rawEventId = registration.eventId;
    const normalizedEmail = String(registration.email).trim().toLowerCase(); //[cite: 11]
    const rawPhone = registration.phone || guest?.phone || ''; //[cite: 11]
    const normalizedPhone = rawPhone ? String(rawPhone).replace(/\D/g, '') : null; //[cite: 11]

    client = await pool.connect(); //[cite: 11]

    // 🟢 2. Fetch authoritative Event record & food_config to prevent spoofing
    const eventQuery = `
      SELECT id, food_config 
      FROM events 
      WHERE id = $1 OR slug = $2 
      LIMIT 1;
    `;
    const eventResult = await client.query(eventQuery, [
      isNaN(Number(rawEventId)) ? -1 : Number(rawEventId),
      String(rawEventId),
    ]);

    if (eventResult.rows.length === 0) {
      client.release();
      client = null;
      return NextResponse.json({ error: 'Target event not found.' }, { status: 404 });
    }

    const realEventId = eventResult.rows[0].id;
    let rawFoodConfig = eventResult.rows[0].food_config;
    if (typeof rawFoodConfig === 'string') {
      try {
        rawFoodConfig = JSON.parse(rawFoodConfig);
      } catch {
        rawFoodConfig = null;
      }
    }

    // 🟢 3. DUPLICATE CHECK: Verify if Email OR Phone is already registered for this Event[cite: 11]
    let duplicateQuery = `
      SELECT id, email, phone 
      FROM event_registrations 
      WHERE event_id = $1 AND (LOWER(email) = $2
    `; //[cite: 11]
    const duplicateParams: any[] = [realEventId, normalizedEmail]; //[cite: 11]

    if (normalizedPhone) {
      duplicateQuery += ` OR REGEXP_REPLACE(phone, '\\D', '', 'g') = $3`; //[cite: 11]
      duplicateParams.push(normalizedPhone); //[cite: 11]
    }

    duplicateQuery += `) LIMIT 1;`; //[cite: 11]

    const existingReg = await client.query(duplicateQuery, duplicateParams); //[cite: 11]

    if (existingReg.rows.length > 0) {
      const match = existingReg.rows[0]; //[cite: 11]
      const matchType = match.email.toLowerCase() === normalizedEmail ? 'email' : 'phone number'; //[cite: 11]

      client.release(); //[cite: 11]
      client = null; //[cite: 11]

      return NextResponse.json(
        {
          error: `An entry with this ${matchType} is already registered for this event. Duplicate registrations are not allowed.`, //[cite: 11]
          isDuplicate: true, //[cite: 11]
          eventId: realEventId,
        },
        { status: 409 } //[cite: 11]
      );
    }

    const isPaidRegistration = Number(registration.totalPrice || 0) > 0; //[cite: 11]

    // 🟢 4. SECURITY CHECK: Verify Payment Signature IF Paid Event[cite: 11]
    if (isPaidRegistration) {
      if (!paymentDetails?.razorpay_order_id || !paymentDetails?.razorpay_payment_id || !paymentDetails?.razorpay_signature) { //[cite: 11]
        if (client) client.release(); //[cite: 11]
        return NextResponse.json({ error: 'Missing required payment verification tokens.' }, { status: 400 }); //[cite: 11]
      }

      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!) //[cite: 11]
        .update(`${paymentDetails.razorpay_order_id}|${paymentDetails.razorpay_payment_id}`) //[cite: 11]
        .digest('hex'); //[cite: 11]

      if (generatedSignature !== paymentDetails.razorpay_signature) { //[cite: 11]
        if (client) client.release(); //[cite: 11]
        return NextResponse.json({ error: 'Payment signature verification failed. Potential tampering detected.' }, { status: 400 }); //[cite: 11]
      }
    }

    // 🟢 5. Cloudflare R2 Participant Photo Upload Pipeline[cite: 3]
    let photoKey: string | null = null;
    const rawPhotoUrl = registration.photoUrl || registration.customAnswers?.participantPhoto;

    if (rawPhotoUrl && typeof rawPhotoUrl === 'string' && rawPhotoUrl.startsWith('data:image')) {
      const media = base64ToBuffer(rawPhotoUrl); //[cite: 3]
      if (media) {
        photoKey = `participant-${realEventId}-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}.jpg`;
        await r2Client.send(new PutObjectCommand({
          Bucket: 'mithila-aayojan', //[cite: 3]
          Key: `participant-photos/${photoKey}`,
          Body: media.buffer, //[cite: 3]
          ContentType: media.contentType, //[cite: 3]
          CacheControl: 'public, max-age=31536000', //[cite: 3]
        })).catch((err) => console.error('⚠️ Cloudflare R2 Upload warning:', err));
      }
    }

    const finalPhotoUrl = photoKey 
      ? `https://assets.mithilaaayojan.in/participant-photos/${photoKey}` 
      : (rawPhotoUrl || null);

    // 🟢 6. Compute Food Access Dynamically
    const attendeeCategory = registration.category || registration.ticketType || guest?.category || 'general-public'; //[cite: 11]
    const isFoodAllowed = checkFoodAccess(attendeeCategory, rawFoodConfig);

    // 🟢 7. Extract Competition & Age Group Details[cite: 11]
    const competitionId = registration.competitionId || registration.competition_id || guest?.competitionId || null; //[cite: 11]
    const competitionTitle = registration.competitionTitle || registration.competition_title || registration.competitionName || guest?.competitionTitle || null; //[cite: 11]

    const ageGroupId = registration.ageGroupId || registration.age_group_id || guest?.ageGroupId || null; //[cite: 11]
    const ageGroupLabel = registration.ageGroupLabel || registration.age_group_label || guest?.ageGroupLabel || null; //[cite: 11]

    const isAgeVerified = Boolean(registration.isAgeVerified ?? registration.is_age_verified ?? false); //[cite: 11]
    const rawVerifiedAge = registration.verifiedAge ?? registration.verified_age; //[cite: 11]
    const verifiedAge = rawVerifiedAge !== undefined && rawVerifiedAge !== null && !isNaN(Number(rawVerifiedAge)) //[cite: 11]
      ? Number(rawVerifiedAge) //[cite: 11]
      : null; //[cite: 11]

    const customAnswersPayload = {
      ...(registration.customAnswers || {}),
      participantPhoto: finalPhotoUrl || '',
    };

    // 🟢 8. ATOMIC POSTGRES TRANSACTION INSERTION[cite: 11]
    await client.query('BEGIN'); //[cite: 11]

    // A. Insert into event_registrations table[cite: 11]
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
    `; //[cite: 11]

    const registrationValues = [
      realEventId,
      registration.name || registration.attendeeName, //[cite: 11]
      normalizedEmail, //[cite: 11]
      registration.phone || rawPhone,
      attendeeCategory,
      competitionId, //[cite: 11]
      competitionTitle, //[cite: 11]
      ageGroupId, //[cite: 11]
      ageGroupLabel, //[cite: 11]
      isAgeVerified, //[cite: 11]
      verifiedAge, //[cite: 11]
      JSON.stringify(customAnswersPayload),
      parseFloat(registration.basePrice || 0), //[cite: 11]
      parseFloat(registration.gstAmount || 0), //[cite: 11]
      parseFloat(registration.totalPrice || 0), //[cite: 11]
      registration.registrationTimestamp ? Number(registration.registrationTimestamp) : Date.now(), //[cite: 11]
      registration.status || 'CONFIRMED', //[cite: 11]
      'synced', //[cite: 11]
    ];

    const regResult = await client.query(registrationQuery, registrationValues); //[cite: 11]
    const createdRegistrationId = regResult.rows[0]?.id; //[cite: 11]

    // B. Insert into guests table with dynamically verified food access[cite: 11]
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
        has_food_access = EXCLUDED.has_food_access,
        amount_paid = COALESCE(EXCLUDED.amount_paid, guests.amount_paid)
      RETURNING id;
    `; //[cite: 11]

    const guestValues = [
      realEventId,
      guest.name || registration.name,
      normalizedEmail, //[cite: 11]
      guest.phone || rawPhone,
      attendeeCategory,
      guest.qrToken, //[cite: 11]
      false, //[cite: 11]
      isFoodAllowed, // Server-evaluated food status
      parseFloat(guest.amountPaid || registration.totalPrice || 0), //[cite: 11]
    ];

    await client.query(guestQuery, guestValues); //[cite: 11]
    await client.query('COMMIT'); //[cite: 11]

    return NextResponse.json({
      success: true, //[cite: 11]
      message: isPaidRegistration ? 'Payment verified and registration recorded.' : 'Free registration successfully recorded.', //[cite: 11]
      registrationId: createdRegistrationId, //[cite: 11]
      qrToken: guest.qrToken, //[cite: 11]
      photoUrl: finalPhotoUrl,
      hasFoodAccess: isFoodAllowed,
      competitionTitle: competitionTitle || undefined, //[cite: 11]
      ageGroupLabel: ageGroupLabel || undefined, //[cite: 11]
      syncStatus: 'synced',
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK'); //[cite: 11]
    console.error('❌ Registration processing error:', error?.message || error); //[cite: 11]
    return NextResponse.json(
      { error: 'Failed to complete registration.', details: error?.message || String(error) }, //[cite: 11]
      { status: 500 } //[cite: 11]
    );
  } finally {
    if (client) client.release(); //[cite: 11]
  }
}