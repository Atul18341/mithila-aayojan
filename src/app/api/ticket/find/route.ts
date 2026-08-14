// src/app/api/ticket/find/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function GET(request: Request) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';

    if (!query) {
      return NextResponse.json({ success: false, error: 'Query parameter "q" is required.' }, { status: 400 });
    }

    const lowerQuery = query.toLowerCase();
    const sanitizedPhone = query.replace(/\D/g, '');

    client = await pool.connect();

    // 🚀 Robust Query: Safely handles text/int comparisons and joins by registration_id
    const lookupQuery = `
      SELECT 
        r.id AS registration_db_id,
        r.registration_id,
        r.event_id,
        r.name,
        r.email,
        r.phone,
        r.category,
        r.competition_id,
        r.competition_title,
        r.age_group_id,
        r.age_group_label,
        r.is_age_verified,
        r.verified_age,
        r.status,
        r.total_price,
        g.guest_id,
        COALESCE(g.qr_token, r.registration_id) AS qr_token,
        COALESCE(g.is_check_in, false) AS is_check_in,
        COALESCE(g.has_food_access, false) AS has_food_access,
        e.id AS event_primary_id,
        e.name AS event_name,
        e.slug AS event_slug,
        e.date AS event_date,
        COALESCE(e.venue_name, e.location) AS event_venue,
        e.cover_image,
        e.poster_image
      FROM event_registrations r
      LEFT JOIN guests g ON (g.registration_id = r.registration_id OR g.email = r.email)
      LEFT JOIN events e ON (CAST(e.id AS VARCHAR) = CAST(r.event_id AS VARCHAR) OR e.slug = CAST(r.event_id AS VARCHAR))
      WHERE 
        LOWER(r.email) = $1
        OR g.qr_token = $2
        OR r.registration_id = $2
        OR (length($3) >= 7 AND REGEXP_REPLACE(r.phone, '\\D', '', 'g') LIKE '%' || $3 || '%')
        OR (length($3) >= 7 AND REGEXP_REPLACE(g.phone, '\\D', '', 'g') LIKE '%' || $3 || '%')
      ORDER BY r.registration_timestamp DESC
      LIMIT 1;
    `;

    const result = await client.query(lookupQuery, [lowerQuery, query, sanitizedPhone]);

    if (result.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No matching ticket found in database.' }, { status: 404 });
    }

    const row = result.rows[0];

    return NextResponse.json({
      success: true,
      data: {
        registration: {
          id: row.registration_db_id,
          registrationId: row.registration_id,
          eventId: row.event_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          category: row.category,
          competitionId: row.competition_id,
          competitionTitle: row.competition_title,
          ageGroupId: row.age_group_id,
          ageGroupLabel: row.age_group_label,
          isAgeVerified: Boolean(row.is_age_verified),
          verifiedAge: row.verified_age,
          status: row.status,
          totalPrice: parseFloat(row.total_price || '0'),
          syncStatus: 'synced',
        },
        guest: {
          guestId: row.guest_id || `GUEST-${Date.now()}`,
          registrationId: row.registration_id,
          eventId: row.event_id,
          name: row.name,
          email: row.email,
          phone: row.phone,
          category: row.category,
          competitionTitle: row.competition_title,
          ageGroupLabel: row.age_group_label,
          qrToken: row.qr_token,
          isCheckedIn: Boolean(row.is_check_in),
          hasFoodAccess: Boolean(row.has_food_access),
          syncStatus: 'synced',
        },
        event: {
          id: row.event_primary_id || row.event_id,
          name: row.event_name,
          slug: row.event_slug,
          date: row.event_date,
          venue: row.event_venue,
          coverImageUrl: row.cover_image,
          posterImageUrl: row.poster_image,
        }
      }
    });

  } catch (error: any) {
    console.error('❌ Cloud ticket search error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal database search failure.' 
    }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}