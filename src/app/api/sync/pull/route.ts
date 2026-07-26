// src/app/api/sync/pull/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const managerEmail = searchParams.get('managerEmail') || searchParams.get('managerIdentifier');

  if (!managerEmail) {
    return NextResponse.json({ error: 'Missing manager identity lock identifier' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();

    // 1. Fetch all events assigned to this manager through the junction table
    const eventsQuery = `
      SELECT e.* FROM events e
      JOIN manager_events me ON e.id = me.event_id
      WHERE me.manager_identifier = $1;
    `;
    const eventsResult = await client.query(eventsQuery, [managerEmail]);
    const rawEvents = eventsResult.rows;

    // Extract assigned event IDs to pull corresponding guests
    const eventIds = rawEvents.map(e => e.id);

    let rawGuests: any[] = [];
    let rawLinks: any[] = [];

    if (eventIds.length > 0) {
      // 2. Fetch all guests belonging to the manager's assigned events
      const guestsQuery = `
        SELECT * FROM guests 
        WHERE event_id = ANY($1);
      `;
      const guestsResult = await client.query(guestsQuery, [eventIds]);
      rawGuests = guestsResult.rows;

      // 3. Fetch junction records to maintain manager assignments
      const linksQuery = `
        SELECT * FROM manager_events 
        WHERE manager_identifier = $1;
      `;
      const linksResult = await client.query(linksQuery, [managerEmail]);
      rawLinks = linksResult.rows;
    }

    // =========================================================
    // 4. MAP POSTGRESQL SNAKE_CASE FIELDS TO DEXIE CAMELCASE
    // =========================================================
    
    // Map Events to IndexedDB EventData interface
    const formattedEvents = rawEvents.map(e => ({
      id: Number(e.id),
      name: e.name || '',
      type: e.type || 'conference',
      protocol: e.protocol || 'ticketed',
      status: e.status || 'draft',
      date: e.date || '',
      startTime: e.start_time || '',
      endTime: e.end_time || '',
      location: e.location || '',
      tagline: e.tagline || '',
      description: e.description || '',
      venueName: e.venue_name || '',
      slug: e.slug || '',
      hypeThreshold: Number(e.hype_threshold || 0),
      visibility: typeof e.visibility === 'string' ? JSON.parse(e.visibility) : (e.visibility || { map: true, rsvp: true, schedule: true, gallery: false }),
      foodConfig: typeof e.food_config === 'string' ? JSON.parse(e.food_config) : (e.food_config || { enabled: false, strategy: 'complimentary', vendorDetails: '', availableForAll: 'yes', allowedCategories: [] }),
      pricingConfig: typeof e.pricing_config === 'string' ? JSON.parse(e.pricing_config) : (e.pricing_config || { isRequired: false, baseFee: 0, gstApplicable: false, applicableForAll: 'yes', categoryFees: {} }),
      cover_image: e.cover_image || null,
      poster_image: e.poster_image || null,
      createdAt: e.created_at ? new Date(e.created_at).getTime() : Date.now(),
      syncStatus: 'synced'
    }));

    // Map Guests to IndexedDB Guest interface
    const formattedGuests = rawGuests.map(g => ({
      id: Number(g.id),
      guestId: g.guest_id || `GUEST-${g.id}`,
      registrationId: g.registration_id || `REG-${g.id}`,
      eventId: Number(g.event_id),
      name: g.name || '',
      email: g.email || '',
      phone: g.phone || '',
      category: g.type || 'general-public', // Map Postgres 'type' to IndexedDB 'category'
      type: g.type || 'general-public',
      qrToken: g.qr_token || '',
      isCheckedIn: Boolean(g.is_check_in || g.is_checked_in),
      checkInTime: g.check_in_time ? Number(g.check_in_time) : undefined,
      hasFoodAccess: Boolean(g.has_food_access),
      hasFoodClaimed: Boolean(g.has_food_claimed),
      amountPaid: parseFloat(g.amount_paid || 0),
      syncStatus: 'synced',
      registeredAt: g.server_updated_at ? new Date(g.server_updated_at).getTime() : Date.now()
    }));

    // Map Manager Events Junction Table
    const formattedLinks = rawLinks.map(l => ({
      managerIdentifier: l.manager_identifier,
      eventId: Number(l.event_id),
      assignedAt: l.assigned_at ? new Date(l.assigned_at).getTime() : Date.now()
    }));

    return NextResponse.json({
      success: true,
      data: {
        events: formattedEvents,
        guests: formattedGuests,
        managerEvents: formattedLinks
      }
    });

  } catch (error: any) {
    console.error('❌ Cloud sync pull failure:', error.message);
    return NextResponse.json({ error: 'Failed to retrieve cloud data state', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}