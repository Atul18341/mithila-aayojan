// src/app/api/sync/push/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

// Instantiate a persistent connection pool to your cloud PostgreSQL database (Neon/Aiven)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }, // Required for secure connections to cloud providers
});

export async function POST(request: Request) {
  let client;
  try {
    const body = await request.json();
    const { mutations } = body;

    if (!mutations || !Array.isArray(mutations)) {
      return NextResponse.json({ error: 'Malformed payload: Mutations array missing.' }, { status: 400 });
    }

    if (mutations.length === 0) {
      return NextResponse.json({ success: true, message: 'Empty outbox payload processed.' });
    }

    // Acquire a single connection instance from the pool to wrap operations in a safe ACID transaction block
    client = await pool.connect();
    await client.query('BEGIN');

    // Iterate through each offline mutation record sent up from IndexedDB
    for (const record of mutations) {
      const { id, eventId, name, type, qrToken, checkInTime } = record;

      // 1. Process Upsert Operation on the main guests table core
      // Uses ON CONFLICT to target unique QR validation strings
      const guestUpsertQuery = `
        INSERT INTO guests (event_id, name, type, qr_token, check_in_time, server_updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (qr_token) 
        DO UPDATE SET 
          check_in_time = COALESCE(guests.check_in_time, EXCLUDED.check_in_time),
          server_updated_at = NOW()
        RETURNING id;
      `;

      const guestResult = await client.query(guestUpsertQuery, [
        eventId,
        name,
        type,
        qrToken,
        checkInTime ? BigInt(checkInTime) : null // Matches the epoch millisecond format precisely
      ]);

      const committedRecordId = guestResult.rows[0]?.id;

      // 2. Append a tracking metric entry to sync_history for system audit trails
      const historyLogQuery = `
        INSERT INTO sync_history (target_table, action, record_id, client_timestamp)
        VALUES ($1, $2, $3, $4);
      `;
      
      // We label these as 'UPDATE' vectors since they reflect device synchronization updates
      await client.query(historyLogQuery, [
        'guests',
        'UPDATE',
        committedRecordId,
        Date.now()
      ]);
    }

    // If all array items parse correctly without exception breaks, commit the transaction firmly
    await client.query('COMMIT');
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully processed ${mutations.length} records into central database schemas.` 
    });

  } catch (error: any) {
    // Rollback changes completely if any database error occurs to protect data integrity
    if (client) await client.query('ROLLBACK');
    console.error('Fatal backend sync routing trace crash:', error);
    
    return NextResponse.json({ 
      error: 'Internal Synchronizer Server Error', 
      details: error.message 
    }, { status: 500 });
    
  } finally {
    // Release the active connection client thread back to the main resource pool safely
    if (client) client.release();
  }
}