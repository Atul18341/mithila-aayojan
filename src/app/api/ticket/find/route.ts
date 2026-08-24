// src/app/api/ticket/find/route.ts
import { NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q')?.trim() || '';
  const eventParam =
    searchParams.get('eventId')?.trim() ||
    searchParams.get('event_id')?.trim() ||
    searchParams.get('event')?.trim() ||
    '';

  if (!query) {
    return NextResponse.json(
      {
        success: false,
        error: 'Query parameter "q" is required.',
      },
      { status: 400 }
    );
  }

  let client: PoolClient | null = null;

  try {
    const lowerQuery = query.toLowerCase();
    const allDigits = query.replace(/\D/g, '');
    const phoneDigits = allDigits.length >= 10 ? allDigits.slice(-10) : allDigits;

    const guestIdMatch = query.match(/^(?:GUEST|PASS)-(\d+)$/i);
    const registrationIdMatch = query.match(/^REG-(\d+)$/i);
    const numericIdMatch = query.match(/^\d+$/);

    const guestIdParam = guestIdMatch?.[1] || numericIdMatch?.[0] || '-1';
    const registrationIdParam = registrationIdMatch?.[1] || '-1';

    client = await pool.connect();

    /*
     * ------------------------------------------------------------
     * COMBINED UNIFIED LOOKUP (GUESTS + EVENT_REGISTRATIONS)
     * ------------------------------------------------------------
     * Uses a LEFT JOIN to fetch both operational gate pass attributes
     * and registration competition/age group data simultaneously.
     */
    const unifiedLookupQuery = `
      SELECT
        COALESCE(g.id, r.id) AS unified_id,
        COALESCE(g.event_id, r.event_id) AS event_id,
        COALESCE(g.name, r.name) AS attendee_name,
        COALESCE(g.email, r.email) AS attendee_email,
        COALESCE(g.phone, r.phone) AS attendee_phone,
        COALESCE(g.type, r.category, 'General') AS attendee_category,
        
        -- Guest Specific Fields
        g.qr_token,
        COALESCE(g.is_check_in, false) AS is_check_in,
        g.check_in_time,
        COALESCE(g.amount_paid, r.total_price, 0.00) AS amount_paid,
        COALESCE(g.has_food_access, false) AS has_food_access,
        g.server_updated_at,

        -- Registration Specific Fields
        r.id AS registration_id,
        r.custom_answers,
        COALESCE(r.base_price, 0.00) AS base_price,
        COALESCE(r.gst_amount, 0.00) AS gst_amount,
        COALESCE(r.total_price, 0.00) AS total_price,
        r.registration_timestamp,
        r.status AS registration_status,
        r.sync_status,
        r.competition_id,
        r.competition_title,
        r.age_group_id,
        r.age_group_label,
        COALESCE(r.is_age_verified, false) AS is_age_verified,
        r.verified_age,

        -- Event Metadata
        e.id AS event_primary_id,
        e.name AS event_name,
        e.slug AS event_slug,
        e.date AS event_date,
        COALESCE(e.venue_name, e.location, 'Main Venue') AS event_venue,
        e.cover_image,
        e.poster_image

      FROM events e
      LEFT JOIN guests g 
        ON g.event_id = e.id
      LEFT JOIN event_registrations r 
        ON r.event_id = e.id 
        AND (
          (g.email IS NOT NULL AND LOWER(TRIM(r.email)) = LOWER(TRIM(g.email)))
          OR (g.phone IS NOT NULL AND REGEXP_REPLACE(r.phone, '[^0-9]', '', 'g') = REGEXP_REPLACE(g.phone, '[^0-9]', '', 'g'))
        )

      WHERE
        -- Optional Event Match
        (
          $4 = ''
          OR (
            ($4 ~ '^[0-9]+$' AND e.id = CAST($4 AS INTEGER))
            OR LOWER(TRIM(e.slug)) = LOWER(TRIM($4))
          )
        )
        AND (
          -- Email Match
          (g.email IS NOT NULL AND LOWER(TRIM(g.email)) = $1)
          OR (r.email IS NOT NULL AND LOWER(TRIM(r.email)) = $1)
          
          -- QR Token Match
          OR (g.qr_token IS NOT NULL AND LOWER(TRIM(g.qr_token)) = $1)
          
          -- Phone Match
          OR (
            LENGTH($2) >= 6
            AND (
              (g.phone IS NOT NULL AND REGEXP_REPLACE(g.phone, '[^0-9]', '', 'g') LIKE '%' || $2 || '%')
              OR (r.phone IS NOT NULL AND REGEXP_REPLACE(r.phone, '[^0-9]', '', 'g') LIKE '%' || $2 || '%')
            )
          )
          
          -- ID Matches
          OR ($3 <> '-1' AND (CAST(g.id AS VARCHAR) = $3 OR CAST(r.id AS VARCHAR) = $3))
          OR ($5 <> '-1' AND CAST(r.id AS VARCHAR) = $5)
        )

      ORDER BY
        g.server_updated_at DESC NULLS LAST,
        r.registration_timestamp DESC NULLS LAST
      LIMIT 1;
    `;

    // $1 = lowerQuery
    // $2 = phoneDigits
    // $3 = guestIdParam
    // $4 = eventParam
    // $5 = registrationIdParam
    const result = await client.query(unifiedLookupQuery, [
      lowerQuery,
      phoneDigits,
      guestIdParam,
      eventParam,
      registrationIdParam,
    ]);

    if (result.rows.length > 0) {
      const row = result.rows[0];

      return NextResponse.json({
        success: true,
        source: row.qr_token ? 'guest_with_registration' : 'registration_only',
        data: {
          registration: {
            id: row.registration_id || row.unified_id,
            registrationId: `REG-${row.registration_id || row.unified_id}`,
            eventId: Number(row.event_id),
            name: row.attendee_name,
            email: row.attendee_email || '',
            phone: row.attendee_phone || '',
            category: row.attendee_category || '',
            status: row.registration_status || 'CONFIRMED',
            customAnswers: row.custom_answers || {},
            basePrice: Number(row.base_price || 0),
            gstAmount: Number(row.gst_amount || 0),
            totalPrice: Number(row.total_price || row.amount_paid || 0),
            registrationTimestamp: row.registration_timestamp ? Number(row.registration_timestamp) : undefined,
            syncStatus: row.sync_status || 'synced',
            competitionId: row.competition_id || null,
            competitionTitle: row.competition_title || null,
            ageGroupId: row.age_group_id || null,
            ageGroupLabel: row.age_group_label || null,
            isAgeVerified: Boolean(row.is_age_verified),
            verifiedAge: row.verified_age !== null && row.verified_age !== undefined ? Number(row.verified_age) : null,
          },

          guest: row.qr_token ? {
            id: row.unified_id,
            guestId: `GUEST-${row.unified_id}`,
            registrationId: `REG-${row.registration_id || row.unified_id}`,
            eventId: Number(row.event_id),
            name: row.attendee_name,
            email: row.attendee_email || '',
            phone: row.attendee_phone || '',
            category: row.attendee_category,
            type: row.attendee_category,
            qrToken: row.qr_token,
            isCheckedIn: Boolean(row.is_check_in),
            checkInTime: row.check_in_time ? Number(row.check_in_time) : undefined,
            hasFoodAccess: Boolean(row.has_food_access),
            amountPaid: Number(row.amount_paid || row.total_price || 0),
            syncStatus: 'synced',
          } : null,

          event: {
            id: Number(row.event_primary_id || row.event_id),
            name: row.event_name || 'Event Pass',
            slug: row.event_slug || '',
            date: row.event_date || '',
            venue: row.event_venue || '',
            coverImageUrl: row.cover_image || null,
            posterImageUrl: row.poster_image || null,
          },
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: `No matching records found for "${query}".`,
        query,
        event: eventParam || null,
      },
      { status: 404 }
    );

  } catch (error: any) {
    console.error('❌ Cloud ticket search failure:', error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal database search failure.',
      },
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}