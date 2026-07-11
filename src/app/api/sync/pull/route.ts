// src/app/api/sync/pull/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const managerEmail = searchParams.get('managerEmail');

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
    const assignedEvents = eventsResult.rows;

    // Extract assigned event IDs to pull corresponding guests
    const eventIds = assignedEvents.map(e => e.id);

    let associatedGuests: any[] = [];
    let managerLinks: any[] = [];

    if (eventIds.length > 0) {
      // 2. Fetch all guests belonging to the manager's assigned events
      const guestsQuery = `
        SELECT * FROM guests 
        WHERE event_id = ANY($1);
      `;
      const guestsResult = await client.query(guestsQuery, [eventIds]);
      associatedGuests = guestsResult.rows;

      // 3. Fetch the raw junction rows to rebuild local indexing constraints
      const linksQuery = `
        SELECT * FROM manager_events 
        WHERE manager_identifier = $1;
      `;
      const linksResult = await client.query(linksQuery, [managerEmail]);
      managerLinks = linksResult.rows;
    }

    return NextResponse.json({
      success: true,
      data: {
        events: assignedEvents,
        guests: associatedGuests,
        managerEvents: managerLinks
      }
    });

  } catch (error: any) {
    console.error('❌ Cloud sync pull failure:', error.message);
    return NextResponse.json({ error: 'Failed to retrieve cloud data state', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}