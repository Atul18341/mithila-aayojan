// src/app/api/sync/push/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function POST(request: Request) {
  let client;
  
  // 🚀 Initialize telemetry counters
  let syncedEventsCount = 0;
  let syncedUsersCount = 0;
  let syncedGuestsCount = 0;

  try {
    const body = await request.json();
    const { events = [], guests = [], users = [] } = body;

    console.log(`Incoming sync payload counts - Events: ${events.length}, Users: ${users.length}, Guests: ${guests.length}`);

    client = await pool.connect();
    await client.query('BEGIN'); 

    // 1. SYNCHRONIZE EVENTS
    for (const ev of events) {
      const eventUpsertQuery = `
        INSERT INTO events (id, name, type, protocol, status, date, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, TO_TIMESTAMP($7 / 1000.0), NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          protocol = EXCLUDED.protocol,
          status = EXCLUDED.status,
          date = EXCLUDED.date,
          updated_at = NOW();
      `;
      await client.query(eventUpsertQuery, [
        ev.id, ev.name, ev.type, ev.protocol, ev.status, ev.date, ev.createdAt ? BigInt(ev.createdAt) : Date.now()
      ]);
      
      syncedEventsCount++; // 🚀 Increment on successful query execution
    }

    // 2. SYNCHRONIZE USERS
    for (const usr of users) {
      const userUpsertQuery = `
        INSERT INTO users (identifier, name, password_hash, role, assigned_event_id, updated_at)
        VALUES ($1, $2, $3, $4, $5::INTEGER, NOW())
        ON CONFLICT (identifier) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          assigned_event_id = EXCLUDED.assigned_event_id,
          updated_at = NOW();
      `;
      
      const userIdentifier = usr.email || usr.identifier;
      const fallbackHash = usr.passwordHash || '$2b$10$UnassignedOfflinePlaceholderHashString'; 
      const assignedEvent = usr.assignedEventId || null;

      if (!userIdentifier) continue; 

      await client.query(userUpsertQuery, [
        userIdentifier,
        usr.name || 'Unnamed Offline User',
        fallbackHash,
        usr.role || 'volunteer',
        assignedEvent
      ]);

      syncedUsersCount++; // 🚀 Increment on successful query execution
    }

    // 3. SYNCHRONIZE GUESTS
    for (const gst of guests) {
      const guestUpsertQuery = `
        INSERT INTO guests (event_id, name, type, qr_token, check_in_time, server_updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (qr_token) 
        DO UPDATE SET 
          check_in_time = COALESCE(guests.check_in_time, EXCLUDED.check_in_time),
          server_updated_at = NOW();
      `;
      await client.query(guestUpsertQuery, [
        gst.eventId, gst.name, gst.type, gst.qrToken, gst.checkInTime ? BigInt(gst.checkInTime) : null
      ]);

      syncedGuestsCount++; // 🚀 Increment on successful query execution
    }

    // Commit only if all operations succeeded completely
    await client.query('COMMIT'); 

    // 🚀 Return the counts back to the client frontend response body
    return NextResponse.json({ 
      success: true, 
      message: 'All tables verified and synchronized successfully.',
      counts: {
        events: syncedEventsCount,
        users: syncedUsersCount,
        guests: syncedGuestsCount,
        total: syncedEventsCount + syncedUsersCount + syncedGuestsCount
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK'); 
    console.error('❌ Multi-table sync processing crash:', error.message);
    return NextResponse.json({ error: 'Sync server routing error', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}