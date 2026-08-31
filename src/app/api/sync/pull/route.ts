// src/app/api/sync/pull/route.ts
import { NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  const userIdentifier = (
    searchParams.get('volunteerIdentifier') || 
    searchParams.get('volunteerEmail') || 
    searchParams.get('identifier') || 
    searchParams.get('managerEmail') || 
    searchParams.get('managerIdentifier') || ''
  ).trim();

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    if (!client) throw new Error('Failed to acquire database connection.');

    let rawEvents: any[] = [];
    let rawGuests: any[] = [];
    let rawRegistrations: any[] = [];
    let rawLinks: any[] = [];
    let rawUsers: any[] = [];

    // 1. Fetch events assigned to this manager or fallback to all events if none explicitly linked
    if (userIdentifier && userIdentifier !== 'undefined') {
      const eventsQuery = `
        SELECT DISTINCT e.*, me.assigned_desk FROM events e
        LEFT JOIN manager_events me ON e.id = me.event_id
        WHERE LOWER(me.manager_identifier) = LOWER($1)
           OR LOWER(e.organizer_email) = LOWER($1)
           OR e.organizer_id::text = $1;
      `;
      const eventsResult = await client.query(eventsQuery, [userIdentifier]);
      rawEvents = eventsResult.rows;
    }

    if (rawEvents.length === 0) {
      const allEventsResult = await client.query(`SELECT * FROM events;`);
      rawEvents = allEventsResult.rows;
    }

    const eventIds = rawEvents.map(e => Number(e.id)).filter(id => !isNaN(id) && id > 0);

    // 2. Fetch the COMPLETE roster of guests and registrations for these events (or all records if events aren't restricted)
    if (eventIds.length > 0) {
      const guestsQuery = `SELECT * FROM guests WHERE event_id = ANY($1) OR event_id IS NULL;`;
      const guestsResult = await client.query(guestsQuery, [eventIds]);
      rawGuests = guestsResult.rows;

      const registrationsQuery = `
        SELECT 
          id,
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
          sync_status,
          competition_id,
          competition_title,
          age_group_id,
          age_group_label,
          is_age_verified,
          verified_age
        FROM event_registrations 
        WHERE event_id = ANY($1) OR event_id IS NULL;
      `;
      const registrationsResult = await client.query(registrationsQuery, [eventIds]).catch(async () => {
        if (!client) return { rows: [] };
        return await client.query(`SELECT * FROM event_registrations;`);
      });
      rawRegistrations = registrationsResult.rows;
    } else {
      const guestsResult = await client.query(`SELECT * FROM guests;`);
      rawGuests = guestsResult.rows;

      const registrationsResult = await client.query(`SELECT * FROM event_registrations;`).catch(() => ({ rows: [] }));
      rawRegistrations = registrationsResult.rows;
    }

    // 3. Fetch all manager links and users to ensure complete offline visibility
    const linksResult = await client.query(`SELECT * FROM manager_events;`).catch(() => ({ rows: [] }));
    rawLinks = linksResult.rows;

    const usersResult = await client.query(`SELECT * FROM users;`).catch(() => ({ rows: [] }));
    rawUsers = usersResult.rows;

    // Format events with full multi-competition mapping
    const formattedEvents = rawEvents.map(e => {
      let parsedCompetitions = [];
      if (e.competitions) {
        try {
          parsedCompetitions = typeof e.competitions === 'string' ? JSON.parse(e.competitions) : e.competitions;
        } catch {
          parsedCompetitions = [];
        }
      }

      return {
        id: Number(e.id),
        name: e.name || '',
        type: e.type || 'conference',
        protocol: e.protocol || 'ticketed',
        status: e.status || 'draft',
        date: e.date || '',
        startTime: e.start_time || '',
        endTime: e.end_time || '',
        registrationEndDate: e.registration_end_date || e.registrationEndDate || '',
        location: e.location || '',
        tagline: e.tagline || '',
        description: e.description || '',
        venueName: e.venue_name || '',
        slug: e.slug || '',
        hypeThreshold: Number(e.hype_threshold || 0),
        isMultiCompetition: Boolean(e.is_multi_competition),
        competitions: Array.isArray(parsedCompetitions) ? parsedCompetitions : [],
        visibility: typeof e.visibility === 'string' ? JSON.parse(e.visibility) : (e.visibility || { map: true, rsvp: true, schedule: true, gallery: false }),
        foodConfig: typeof e.food_config === 'string' ? JSON.parse(e.food_config) : (e.food_config || { enabled: false, strategy: 'complimentary', vendorDetails: '', availableForAll: 'yes', allowedCategories: [] }),
        pricingConfig: typeof e.pricing_config === 'string' ? JSON.parse(e.pricing_config) : (e.pricing_config || { isRequired: false, baseFee: 0, gstApplicable: false, applicableForAll: 'yes', categoryFees: {} }),
        coverImageUrl: e.cover_image || e.cover_image_url || null,
        posterImageUrl: e.poster_image || e.poster_image_url || null,
        createdAt: e.created_at ? new Date(e.created_at).getTime() : Date.now(),
        syncStatus: 'synced'
      };
    });

    // Format guests with full metadata mapping
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
      competitionTitle: g.competition_title || g.competitionTitle || null,
      ageGroupLabel: g.age_group_label || g.ageGroupLabel || null,
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

    // Format event registrations with custom answers and age verifications
    const formattedRegistrations = rawRegistrations.map(r => {
      let parsedCustomAnswers = {};
      if (r.custom_answers) {
        try {
          parsedCustomAnswers = typeof r.custom_answers === 'string' ? JSON.parse(r.custom_answers) : r.custom_answers;
        } catch {
          parsedCustomAnswers = {};
        }
      }

      return {
        id: Number(r.id),
        registrationId: `REG-${r.id}`,
        eventId: Number(r.event_id),
        name: r.name || '',
        email: r.email || '',
        phone: r.phone || '',
        category: r.category || 'general-public',
        competitionId: r.competition_id || null,
        competitionTitle: r.competition_title || null,
        ageGroupId: r.age_group_id || null,
        ageGroupLabel: r.age_group_label || null,
        isAgeVerified: Boolean(r.is_age_verified),
        verifiedAge: r.verified_age !== null && r.verified_age !== undefined ? Number(r.verified_age) : null,
        customAnswers: parsedCustomAnswers,
        basePrice: parseFloat(r.base_price || 0),
        gstAmount: parseFloat(r.gst_amount || 0),
        totalPrice: parseFloat(r.total_price || 0),
        status: r.status || 'pending',
        syncStatus: r.sync_status || 'synced',
        registrationTimestamp: Number(r.registration_timestamp || Date.now())
      };
    });

    // Format manager_events junction links
    const formattedLinks = rawLinks.map(l => ({
      id: l.id ? Number(l.id) : undefined,
      managerIdentifier: l.manager_identifier,
      eventId: Number(l.event_id),
      assignedDesk: l.assigned_desk || 'CHECK_IN',
      assignedAt: l.assigned_at ? new Date(l.assigned_at).getTime() : Date.now(),
      syncStatus: 'synced'
    }));

    // Format users & volunteers
    const formattedUsers = rawUsers.map(u => ({
      id: u.id ? Number(u.id) : undefined,
      name: u.name || (u.email ? u.email.split('@')[0] : 'User'),
      email: u.email || '',
      identifier: u.email || u.identifier || '',
      phone: u.phone || '',
      role: u.role || 'volunteer',
      passkey: u.passkey || u.password_hash || '',
      passwordHash: u.password_hash || u.passkey || '',
      assignedDesk: u.assigned_desk || 'CHECK_IN',
      activeEventId: u.assigned_event_id ? Number(u.assigned_event_id) : undefined,
      syncStatus: 'synced'
    }));

    return NextResponse.json({
      success: true,
      timestamp: Date.now(),
      data: {
        events: formattedEvents,
        guests: formattedGuests,
        eventRegistrations: formattedRegistrations,
        managerEvents: formattedLinks,
        users: formattedUsers
      }
    });

  } catch (error: any) {
    console.error('❌ Pull sync error:', error);
    return NextResponse.json({ error: error?.message || 'Pull failed' }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}