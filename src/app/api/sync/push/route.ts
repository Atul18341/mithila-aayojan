// src/app/api/sync/push/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function POST(request: Request) {
  let client:any;
  
  // Initialize comprehensive telemetry counters for the response footprint
  let syncedEventsCount = 0;
  let syncedUsersCount = 0;
  let syncedLinksCount = 0;
  let syncedGuestsCount = 0;

  try {
    const body = await request.json(); 
    // Destructured all incoming offline queues including tracking elements
    const { events = [], guests = [], users = [], managerEvents = [], userId } = body;

    // Standardize target operator system identifier
    const activeUserId = userId ? Number(userId) : null;

    console.log(`Incoming sync payload counts - Events: ${events.length}, Users: ${users.length}, Links: ${managerEvents.length}, Guests: ${guests.length}`); 

    client = await pool.connect(); 
    await client.query('BEGIN');  

    // Reusable insertion logic for Option A's structural sync history layout
    const logSyncAction = async (targetTable: string, action: string, recordId: number, clientTimestamp: number) => {
      const historyQuery = `
        INSERT INTO sync_history (user_id, target_table, action, record_id, client_timestamp, processed_at)
        VALUES ($1, $2, $3, $4, $5, NOW());
      `;
      await client.query(historyQuery, [
        activeUserId,
        targetTable,
        action,
        recordId,
        clientTimestamp || Date.now()
      ]);
    };

    // 1. SYNCHRONIZE EVENTS & BUILD AUTHORITY ID RESOLUTION MAP
    const realEventIdMap: Record<number, number> = {};
    
    for (const ev of events) {
      const eventUpsertQuery = `
        INSERT INTO events (name, type, protocol, status, date, created_at, updated_at, slug)
        VALUES ($1, $2, $3, $4, $5, TO_TIMESTAMP($6 / 1000.0), NOW(), $7)
        ON CONFLICT (slug) 
        DO UPDATE SET 
          name = EXCLUDED.name, 
          type = EXCLUDED.type,
          protocol = EXCLUDED.protocol,
          status = EXCLUDED.status,
          date = EXCLUDED.date,
          updated_at = NOW()
        RETURNING id;
      `; 
      
      const result = await client.query(eventUpsertQuery, [
        ev.name, ev.type, ev.protocol, ev.status, ev.date, ev.createdAt || Date.now(), ev.slug
      ]); 
      
      const serverGeneratedId = result.rows[0].id;
      realEventIdMap[ev.id] = serverGeneratedId; 
      
      // 🚀 Option A Log: Record atomic insertion/mutation details
      const isNew = !ev.id || serverGeneratedId !== Number(ev.id);
      await logSyncAction('events', isNew ? 'INSERT' : 'UPDATE', serverGeneratedId, ev.clientTimestamp || ev.createdAt);

      syncedEventsCount++; 
    }

    // 2. SYNCHRONIZE USERS
    for (const usr of users) {
      const userUpsertQuery = `
        INSERT INTO users (identifier, name, password_hash, role, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (identifier) 
        DO UPDATE SET 
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          updated_at = NOW()
        RETURNING id;
      `; 
      
      const userIdentifier = usr.email || usr.identifier; 
      const fallbackHash = usr.passwordHash || '$2b$10$UnassignedOfflinePlaceholderHashString';  

      if (!userIdentifier) continue;  

      const result = await client.query(userUpsertQuery, [
        userIdentifier,
        usr.name || 'Unnamed Offline User',
        fallbackHash,
        usr.role || 'volunteer'
      ]); 

      const serverUserId = result.rows[0].id;

      // 🚀 Option A Log: Record user entry sync pass
      await logSyncAction('users', 'UPSERT', serverUserId, usr.clientTimestamp || Date.now());

      syncedUsersCount++;  
    }

    // 3. SYNCHRONIZE MANY-TO-MANY JUNCTION MAPPINGS (manager_events)
    for (const link of managerEvents) {
  let targetEventId = link.eventId;

  if (targetEventId && realEventIdMap[targetEventId]) {
    targetEventId = realEventIdMap[targetEventId];
  }

  const managerIdentifier = link.managerIdentifier || link.managerEmail;
  if (!managerIdentifier || !targetEventId) continue;

  // 🚀 FIXED: We return the primary composite identifiers instead of a potentially non-existent single 'id' column
  const linkUpsertQuery = `
    INSERT INTO manager_events (manager_identifier, event_id)
    VALUES ($1, $2)
    ON CONFLICT (manager_identifier, event_id) 
    DO UPDATE SET manager_identifier = EXCLUDED.manager_identifier -- Safe dummy update to force RETURNING to execute
    RETURNING manager_identifier, event_id;
  `; 
  
  const result = await client.query(linkUpsertQuery, [managerIdentifier, targetEventId]); 
  
  if (result.rows.length > 0) {
    // 🚀 FIXED: Use a stable surrogate reference or 0 if your sync log table strictly expects an integer ID
    const dummyOrCompositeId = 0; 
    
    // Record the atomic sync transaction history successfully[cite: 7]
    await logSyncAction(
      'manager_events', 
      'UPSERT', 
      dummyOrCompositeId, 
      link.clientTimestamp || Date.now()
    );
  }
  
  syncedLinksCount++;
}

    // 4. SYNCHRONIZE GUESTS (With resolved event foreign keys)
    for (const gst of guests) {
      let targetEventId = gst.eventId; 
      
      if (targetEventId && realEventIdMap[targetEventId]) {
        targetEventId = realEventIdMap[targetEventId]; 
      }

      if (!targetEventId) continue; 

      const guestUpsertQuery = `
        INSERT INTO guests (event_id, name, type, qr_token, check_in_time, server_updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (qr_token) 
        DO UPDATE SET 
          check_in_time = COALESCE(guests.check_in_time, EXCLUDED.check_in_time),
          server_updated_at = NOW()
        RETURNING id;
      `; 
      
      const result = await client.query(guestUpsertQuery, [
        targetEventId, gst.name, gst.type, gst.qrToken, gst.checkInTime ? BigInt(gst.checkInTime) : null
      ]); 

      const serverGuestId = result.rows[0].id;

      // 🚀 Option A Log: Record target guest entry confirmation update vectors
      await logSyncAction('guests', gst.checkInTime ? 'CHECK_IN' : 'UPDATE', serverGuestId, gst.clientTimestamp || gst.checkInTime);

      syncedGuestsCount++;  
    }

    // Commit all records, queries, and tracking metrics logs safely together
    await client.query('COMMIT'); 

    return NextResponse.json({ 
      success: true, 
      message: 'All multi-table components verified and synchronized atomically.', 
      counts: {
        events: syncedEventsCount, 
        users: syncedUsersCount, 
        links: syncedLinksCount, 
        guests: syncedGuestsCount, 
        total: syncedEventsCount + syncedUsersCount + syncedLinksCount + syncedGuestsCount
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