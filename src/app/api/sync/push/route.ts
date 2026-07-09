// src/app/api/sync/push/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { events = [], guests = [], users = [] } = body;

    client = await pool.connect();
    await client.query('BEGIN'); // Start all operations inside an atomic transaction block

    // 1. SYNCHRONIZE EVENTS TABLE DATA FIRST (Prevents Foreign Key Constraint Errors)
    for (const ev of events) {
      const eventUpsertQuery = `
        INSERT INTO events (id, name, type, protocol, status, event_date, created_at, server_updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          protocol = EXCLUDED.protocol,
          status = EXCLUDED.status,
          event_date = EXCLUDED.event_date,
          server_updated_at = NOW();
      `;
      await client.query(eventUpsertQuery, [
        ev.id, ev.name, ev.type, ev.protocol, ev.status, ev.date, BigInt(ev.createdAt)
      ]);
    }

    // 2. SYNCHRONIZE USERS DATA RECORD PROFILES
    for (const usr of users) {
      const userUpsertQuery = `
        INSERT INTO users (id, name, email, role, server_updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (email) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          server_updated_at = NOW();
      `;
      await client.query(userUpsertQuery, [usr.id, usr.name, usr.email, usr.role]);
    }

    // 3. SYNCHRONIZE GUESTS CHECK-IN TRANSACTIONS Last
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
    }

    await client.query('COMMIT'); // Commit all relational changes cleanly
    return NextResponse.json({ success: true, message: 'All matrix profiles successfully synchronized.' });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK'); // Drop dirty patches if a query breaks execution
    console.error('Multi-table sync processing crash:', error);
    return NextResponse.json({ error: 'Sync server routing error', details: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}