import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // 🟢 Accept volunteer/manager identifier dynamically
  const userIdentifier = 
    searchParams.get('volunteerIdentifier') || 
    searchParams.get('volunteerEmail') || 
    searchParams.get('identifier') || 
    searchParams.get('managerEmail') || 
    searchParams.get('managerIdentifier');

  if (!userIdentifier) {
    return NextResponse.json({ error: 'Missing user identity lock identifier' }, { status: 400 });
  }

  let client;
  try {
    client = await pool.connect();

    // 1. Fetch all events assigned to this volunteer/manager through the junction table
    const eventsQuery = `
      SELECT DISTINCT e.*, me.assigned_desk FROM events e
      JOIN manager_events me ON e.id = me.event_id
      WHERE LOWER(me.manager_identifier) = LOWER($1);
    `;
    const eventsResult = await client.query(eventsQuery, [userIdentifier]);
    const rawEvents = eventsResult.rows;

    // Extract assigned event IDs
    const eventIds = rawEvents.map(e => Number(e.id)).filter(id => !isNaN(id) && id > 0);

    let rawGuests: any[] = [];
    let rawRegistrations: any[] = [];
    let rawLinks: any[] = [];

    if (eventIds.length > 0) {
      // 2. Fetch all guests belonging to the assigned events
      const guestsQuery = `
        SELECT * FROM guests 
        WHERE event_id = ANY($1);
      `;
      const guestsResult = await client.query(guestsQuery, [eventIds]);
      rawGuests = guestsResult.rows;

      // 3. Fetch all event registrations belonging to the assigned events
      const registrationsQuery = `
        SELECT * FROM event_registrations 
        WHERE event_id = ANY($1);
      `;
      
      try {
        const registrationsResult = await client.query(registrationsQuery, [eventIds]);
        rawRegistrations = registrationsResult.rows;
      } catch (regErr) {
        // Fallback: Query 'registrations' if table is named differently
        const altQuery = `SELECT * FROM registrations WHERE event_id = ANY($1);`;
        const altResult = await client.query(altQuery, [eventIds]).catch(() => ({ rows: [] }));
        rawRegistrations = altResult.rows;
      }

      // 4. Fetch assignment records to preserve user desk rights
      const linksQuery = `
        SELECT * FROM manager_events 
        WHERE LOWER(manager_identifier) = LOWER($1);
      `;
      const linksResult = await client.query(linksQuery, [userIdentifier]);
      rawLinks = linksResult.rows;
    }

    // =========================================================
    // MAP POSTGRESQL SNAKE_CASE FIELDS TO DEXIE CAMELCASE
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
      cover_image: e.cover_image || e.cover_image_url || null,
      poster_image: e.poster_image || e.poster_image_url || null,
      createdAt: e.created_at ? new Date(e.created_at).getTime() : Date.now(),
      syncStatus: 'synced'
    }));

    // Map Guests to IndexedDB Guest interface
    const formattedGuests = rawGuests.map(g => ({
      id: Number(g.id),
      guestId: g.guest_id || `GUEST-${g.id}`,
      registrationId: g.registration_id || `REG-${g.id}`,
      eventId: Number(g.event_id),
      name: g.name || g.attendee_name || '',
      email: g.email || '',
      phone: g.phone || '',
      category: g.type || g.category || 'general-public',
      type: g.type || g.category || 'general-public',
      qrToken: g.qr_token || g.ticket_id || '',
      isCheckedIn: Boolean(g.is_check_in || g.is_checked_in || g.has_checked_in),
      checkInTime: g.check_in_time ? Number(g.check_in_time) : undefined,
      hasFoodAccess: Boolean(g.has_food_access || g.food_included),
      hasFoodClaimed: Boolean(g.has_food_claimed || g.food_claimed),
      foodClaimedTime: g.food_claimed_time ? Number(g.food_claimed_time) : undefined,
      amountPaid: parseFloat(g.amount_paid || 0),
      syncStatus: 'synced',
      registeredAt: g.server_updated_at ? new Date(g.server_updated_at).getTime() : Date.now()
    }));

    // Map Event Registrations to IndexedDB EventRegistration interface
    const formattedRegistrations = rawRegistrations.map(r => ({
      id: Number(r.id),
      registrationId: r.registration_id || r.ticket_id || `REG-${r.id}`,
      eventId: Number(r.event_id),
      attendeeName: r.attendee_name || r.name || '',
      email: r.email || '',
      phone: r.phone || '',
      ticketType: r.ticket_type || r.category || 'GENERAL',
      qrToken: r.qr_token || r.ticket_id || '',
      paymentStatus: r.payment_status || 'PAID',
      amountPaid: parseFloat(r.amount_paid || r.price || 0),
      isCheckedIn: Boolean(r.is_checked_in || r.has_checked_in),
      checkInTime: r.check_in_time ? new Date(r.check_in_time).getTime() : undefined,
      foodIncluded: Boolean(r.food_included || r.has_food_access),
      foodClaimed: Boolean(r.food_claimed || r.has_food_claimed),
      foodClaimedAt: r.food_claimed_at ? new Date(r.food_claimed_at).getTime() : undefined,
      registeredAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      syncStatus: 'synced'
    }));

    // Map Manager Events Junction Table
    const formattedLinks = rawLinks.map(l => ({
      managerIdentifier: l.manager_identifier,
      eventId: Number(l.event_id),
      assignedDesk: l.assigned_desk || 'CHECK_IN',
      assignedAt: l.assigned_at ? new Date(l.assigned_at).getTime() : Date.now()
    }));

    return NextResponse.json({
      success: true,
      events: formattedEvents,
      guests: formattedGuests,
      eventRegistrations: formattedRegistrations,
      managerEvents: formattedLinks,
      data: {
        events: formattedEvents,
        guests: formattedGuests,
        eventRegistrations: formattedRegistrations,
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