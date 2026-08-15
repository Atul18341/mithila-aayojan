// src/app/api/ticket/find/route.ts
import { NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

// IMPORTANT:
// This code assumes the registration table is named `event_registrations`.
// If your actual table name is different, change the table name in the
// registration query below.

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const query = searchParams.get('q')?.trim() || '';

  // Optional event filter:
  // /api/ticket/find?q=GUEST-12&eventId=5
  // /api/ticket/find?q=abc@example.com&event=my-event-slug
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

    // Extract digits for phone matching.
    // Last 10 digits normalize Indian/international prefixes.
    const allDigits = query.replace(/\D/g, '');
    const phoneDigits =
      allDigits.length >= 10 ? allDigits.slice(-10) : allDigits;

    /*
     * Keep the identifier type separate.
     *
     * GUEST-12 / PASS-12 -> guest ID
     * REG-12             -> registration ID
     * 12                 -> guest ID for backward compatibility
     */
    const guestIdMatch = query.match(/^(?:GUEST|PASS)-(\d+)$/i);
    const registrationIdMatch = query.match(/^REG-(\d+)$/i);
    const numericIdMatch = query.match(/^\d+$/);

    const guestIdParam =
      guestIdMatch?.[1] ||
      numericIdMatch?.[0] ||
      '-1';

    const registrationIdParam =
      registrationIdMatch?.[1] || '-1';

    client = await pool.connect();

    /*
     * ------------------------------------------------------------
     * 1. SEARCH GUEST / PASS
     * ------------------------------------------------------------
     *
     * Guests contain:
     *   qr_token
     *   is_check_in
     *   check_in_time
     *   amount_paid
     *   has_food_access
     *
     * This is the correct source for ticket/pass QR lookups.
     */
    const guestLookupQuery = `
      SELECT
        g.id AS guest_id_raw,
        g.event_id,
        g.name AS attendee_name,
        g.email AS attendee_email,
        g.phone AS attendee_phone,
        g.type AS attendee_category,
        g.qr_token,
        COALESCE(g.is_check_in, false) AS is_check_in,
        g.check_in_time,
        COALESCE(g.amount_paid, 0.00) AS amount_paid,
        COALESCE(g.has_food_access, false) AS has_food_access,
        g.server_updated_at,

        -- Event Metadata
        e.id AS event_primary_id,
        e.name AS event_name,
        e.slug AS event_slug,
        e.date AS event_date,
        COALESCE(e.venue_name, e.location, 'Main Venue') AS event_venue,
        e.cover_image,
        e.poster_image

      FROM guests g
      JOIN events e
        ON e.id = g.event_id

      WHERE

        -- Optional Event Match
        (
          $4 = ''
          OR (
            ($4 ~ '^[0-9]+$'
              AND g.event_id = CAST($4 AS INTEGER))
            OR LOWER(TRIM(e.slug)) = LOWER(TRIM($4))
          )
        )

        AND (

          -- Email
          (
            g.email IS NOT NULL
            AND LOWER(TRIM(g.email)) = $1
          )

          -- QR Token
          OR (
            g.qr_token IS NOT NULL
            AND LOWER(TRIM(g.qr_token)) = $1
          )

          -- Phone
          OR (
            LENGTH($2) >= 6
            AND g.phone IS NOT NULL
            AND REGEXP_REPLACE(
              g.phone,
              '[^0-9]',
              '',
              'g'
            ) LIKE '%' || $2 || '%'
          )

          -- Guest ID
          OR (
            $3 <> '-1'
            AND CAST(g.id AS VARCHAR) = $3
          )
        )

      ORDER BY
        g.server_updated_at DESC NULLS LAST,
        g.id DESC

      LIMIT 1;
    `;

    // $1 = normalized query
    // $2 = normalized phone
    // $3 = guest ID
    // $4 = optional event ID/slug
    const guestResult = await client.query(guestLookupQuery, [
      lowerQuery,
      phoneDigits,
      guestIdParam,
      eventParam,
    ]);

    console.log(
      'Guest lookup:',
      query,
      'event:',
      eventParam,
      'rows:',
      guestResult.rowCount
    );

    if (guestResult.rows.length > 0) {
      const row = guestResult.rows[0];

      return NextResponse.json({
        success: true,
        source: 'guest',
        data: {
          registration: {
            id: row.guest_id_raw,
            registrationId: `PASS-${row.guest_id_raw}`,
            eventId: Number(row.event_id),
            name: row.attendee_name,
            email: row.attendee_email || '',
            phone: row.attendee_phone || '',
            category: row.attendee_category,
            status: 'CONFIRMED',
            totalPrice: Number(row.amount_paid || 0),
            syncStatus: 'synced',
          },

          guest: {
            id: row.guest_id_raw,
            guestId: `GUEST-${row.guest_id_raw}`,
            registrationId: `PASS-${row.guest_id_raw}`,
            eventId: Number(row.event_id),
            name: row.attendee_name,
            email: row.attendee_email || '',
            phone: row.attendee_phone || '',
            category: row.attendee_category,
            type: row.attendee_category,
            qrToken: row.qr_token,
            isCheckedIn: Boolean(row.is_check_in),
            checkInTime: row.check_in_time
              ? Number(row.check_in_time)
              : undefined,
            hasFoodAccess: Boolean(row.has_food_access),
            amountPaid: Number(row.amount_paid || 0),
            syncStatus: 'synced',
          },

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

    /*
     * ------------------------------------------------------------
     * 2. SEARCH EVENT REGISTRATION
     * ------------------------------------------------------------
     *
     * Registration rows contain:
     *   competition_id
     *   competition_title
     *   age_group_id
     *   age_group_label
     *   is_age_verified
     *   verified_age
     *
     * They do NOT contain qr_token/check-in fields.
     *
     * REG-12 is therefore explicitly searched by registration ID.
     *
     * Email/phone can also find a registration when a guest/pass
     * record has not yet been created.
     */
    const registrationLookupQuery = `
      SELECT
        r.id AS registration_id,
        r.event_id,
        r.name AS attendee_name,
        r.email AS attendee_email,
        r.phone AS attendee_phone,
        r.category AS attendee_category,
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

      FROM event_registrations r
      JOIN events e
        ON e.id = r.event_id

      WHERE

        -- Optional Event Match
        (
          $4 = ''
          OR (
            ($4 ~ '^[0-9]+$'
              AND r.event_id = CAST($4 AS INTEGER))
            OR LOWER(TRIM(e.slug)) = LOWER(TRIM($4))
          )
        )

        AND (

          -- Explicit REG-123 lookup
          (
            $3 <> '-1'
            AND CAST(r.id AS VARCHAR) = $3
          )

          -- Email
          OR (
            r.email IS NOT NULL
            AND LOWER(TRIM(r.email)) = $1
          )

          -- Phone
          OR (
            LENGTH($2) >= 6
            AND r.phone IS NOT NULL
            AND REGEXP_REPLACE(
              r.phone,
              '[^0-9]',
              '',
              'g'
            ) LIKE '%' || $2 || '%'
          )
        )

      ORDER BY
        r.registration_timestamp DESC,
        r.id DESC

      LIMIT 1;
    `;

    /*
     * IMPORTANT:
     * The registration query above intentionally does NOT search
     * competition_id or custom_answers because those are not reliable
     * attendee identifiers.
     *
     * If the actual registration table is named something other than
     * `event_registrations`, change it above.
     */

    // NOTE:
    // This query is only executed if no guest/pass was found.
    // $1 = normalized query
    // $2 = normalized phone
    // $3 = registration ID
    // $4 = optional event ID/slug
    const registrationResult = await client.query(
      registrationLookupQuery,
      [
        lowerQuery,
        phoneDigits,
        registrationIdParam,
        eventParam,
      ]
    );

    console.log(
      'Registration lookup:',
      query,
      'event:',
      eventParam,
      'rows:',
      registrationResult.rowCount
    );

    if (registrationResult.rows.length > 0) {
      const row = registrationResult.rows[0];

      return NextResponse.json({
        success: true,
        source: 'registration',
        data: {
          registration: {
            id: row.registration_id,
            registrationId: `REG-${row.registration_id}`,
            eventId: Number(row.event_id),
            name: row.attendee_name,
            email: row.attendee_email || '',
            phone: row.attendee_phone || '',
            category: row.attendee_category || '',
            status: row.registration_status || 'pending',
            customAnswers: row.custom_answers || {},
            basePrice: Number(row.base_price || 0),
            gstAmount: Number(row.gst_amount || 0),
            totalPrice: Number(row.total_price || 0),
            registrationTimestamp: row.registration_timestamp
              ? Number(row.registration_timestamp)
              : undefined,
            syncStatus: row.sync_status || 'synced',
            competitionId: row.competition_id || null,
            competitionTitle: row.competition_title || null,
            ageGroupId: row.age_group_id || null,
            ageGroupLabel: row.age_group_label || null,
            isAgeVerified: Boolean(row.is_age_verified),
            verifiedAge:
              row.verified_age !== null &&
              row.verified_age !== undefined
                ? Number(row.verified_age)
                : null,
          },

          // No guest/pass row exists yet, so these fields are null.
          guest: null,

          event: {
            id: Number(row.event_primary_id || row.event_id),
            name: row.event_name || 'Event',
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
        error: `No matching guest, ticket pass, or registration found for "${query}".`,
        query,
        event: eventParam || null,
      },
      { status: 404 }
    );

  } catch (error: any) {
    console.error(
      '❌ Cloud ticket search failure:',
      error?.message || error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          'Internal database search failure.',
      },
      { status: 500 }
    );

  } finally {
    if (client) {
      client.release();
    }
  }
}