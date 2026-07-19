// src/app/api/sync/push/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});
const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};
// Helper utility to convert base64 image strings to standard binary Buffers for R2 transfer
function base64ToBuffer(base64Data: string): { buffer: Buffer; contentType: string } | null {
  if (!base64Data) return null;
  const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  return {
    buffer: Buffer.from(matches[2], 'base64'),
    contentType: matches[1]
  };
}

export async function POST(request: Request) {
  let client: any;
  
  let syncedEventsCount = 0;
  let syncedUsersCount = 0;
  let syncedLinksCount = 0;
  let syncedGuestsCount = 0;

  try {
    const body = await request.json(); 
    const { events = [], guests = [], users = [], managerEvents = [], userId } = body;
    const activeUserId = userId ? Number(userId) : null;

    client = await pool.connect(); 
    await client.query('BEGIN');  

    const logSyncAction = async (targetTable: string, action: string, recordId: number, clientTimestamp: number) => {
      let verifiedUserId = null;
      if (activeUserId) {
        const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [activeUserId]);
        if (userCheck.rows.length > 0) {
          verifiedUserId = activeUserId;
        }
      }

      const historyQuery = `
        INSERT INTO sync_history (user_id, target_table, action, record_id, client_timestamp, processed_at)
        VALUES ($1, $2, $3, $4, $5, timezone('utc', now()));
      `;
      await client.query(historyQuery, [
        verifiedUserId,
        targetTable,
        action,
        recordId,
        clientTimestamp || Date.now()
      ]);
    };

    // ==========================================
    // 1. SYNCHRONIZE EVENTS & UPLOAD MEDIA TO R2
    // ==========================================
    const realEventIdMap: Record<number, number> = {};
    const bucketName = 'mithila-aayojan';
    
    for (const ev of events) {
      const eventUpsertQuery = `
        INSERT INTO events (
          name, type, protocol, status, date, start_time, end_time, 
          location, tagline, description, venue_name, visibility, 
          food_config, pricing_config, created_at, updated_at, slug
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, 
          $8, $9, $10, $11, $12::jsonb, 
          $13::jsonb, $14::jsonb, timezone('utc', TO_TIMESTAMP($15 / 1000.0)), timezone('utc', now()), $16
        )
        ON CONFLICT (slug) 
        DO UPDATE SET 
          name = EXCLUDED.name, 
          type = EXCLUDED.type,
          protocol = EXCLUDED.protocol,
          status = EXCLUDED.status,
          date = EXCLUDED.date,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          location = EXCLUDED.location,
          tagline = COALESCE(EXCLUDED.tagline, events.tagline),       
          description = COALESCE(EXCLUDED.description, events.description), 
          venue_name = EXCLUDED.venue_Name,
          visibility = EXCLUDED.visibility,
          food_config = EXCLUDED.food_config,
          pricing_config = EXCLUDED.pricing_config,
          updated_at = timezone('utc', now())
        RETURNING id;
      `; 

      const visibilityData = ev.visibility ? JSON.stringify(ev.visibility) : '{"map": true, "rsvp": true, "gallery": true, "schedule": true}';
      const foodConfigData = ev.foodConfig ? JSON.stringify(ev.foodConfig) : '{"enabled": false, "strategy": "complimentary", "vendorDetails": "", "availableForAll": "yes", "allowedCategories": []}';
      const pricingConfigData = ev.pricingConfig ? JSON.stringify(ev.pricingConfig) : '{"isRequired": false, "baseFee": 0, "gstApplicable": false, "applicableForAll": "yes", "categoryFees": {}}';
      
      const result = await client.query(eventUpsertQuery, [
        ev.name, ev.type, ev.protocol, ev.status, ev.date, ev.startTime || null, ev.endTime || null,
        ev.location || null, ev.tagline || null, ev.description || null, ev.venueName || null, visibilityData,
        foodConfigData, pricingConfigData, ev.createdAt || Date.now(), ev.slug
      ]); 
      
      const serverGeneratedId = result.rows[0].id;
      realEventIdMap[ev.id] = serverGeneratedId; 

      // Initialize keys with fallback to existing clean tracking variables if present
      let finalCoverKey = ev.cover_image || null;
      let finalPosterKey = ev.poster_image || null;
      let finalCoverName;
      let finalPosterName;
      // Safe URL naming fallback
      const safeEventSlug = ev.slug || 
  (typeof ev.name === 'string' 
    ? ev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') 
    : `event-${serverGeneratedId || Math.floor(Math.random() * 100000)}`);

      // 🚀 Check if a new cover image base64 data string exists for processing
      if (ev.coverBlobBase64) {
        const coverMedia = base64ToBuffer(ev.coverBlobBase64);
        if (coverMedia) {
          // FIX: Assign directly to outer scope variable and place in event-banner/
          finalCoverKey = `event-banner/event-${safeEventSlug}-cover.webp`;
          finalCoverName = `event-${safeEventSlug}-cover.webp`;
          await r2Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: finalCoverKey,
            Body: coverMedia.buffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000'
          }));
        }
      }

      // 🚀 Check if a new poster image base64 data string exists for processing
      if (ev.posterBlobBase64) {
        const posterMedia = base64ToBuffer(ev.posterBlobBase64);
        if (posterMedia) {
          // FIX: Assign directly to outer scope variable and place in event-cover-image/
          finalPosterKey = `event-cover-image/event-${safeEventSlug}-poster.webp`;
          finalPosterName= `event-${safeEventSlug}-poster.webp`;
          await r2Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: finalPosterKey,
            Body: posterMedia.buffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000'
          }));
        }
      }

      // 🚀 FIX: Evaluates the corrected outer-scope path keys cleanly
      if (finalCoverKey || finalPosterKey) {
        await client.query(
          `UPDATE events 
           SET cover_image = COALESCE($1, cover_image), 
               poster_image = COALESCE($2, poster_image) 
           WHERE id = $3;`,
          [finalCoverName, finalPosterName, serverGeneratedId]
        );
      }
      
      const isNew = !ev.id || serverGeneratedId !== Number(ev.id);
      await logSyncAction('events', isNew ? 'INSERT' : 'UPDATE', serverGeneratedId, ev.clientTimestamp || ev.createdAt);
      syncedEventsCount++; 
    }

    // ==========================================
    // 2. SYNCHRONIZE USERS, JUNCTION MAPPINGS, GUESTS (Kept pristine below)
    // ==========================================
    for (const usr of users) {
      const userUpsertQuery = `
        INSERT INTO users (identifier, name, password_hash, role, updated_at)
        VALUES ($1, $2, $3, $4, timezone('utc', now()))
        ON CONFLICT (identifier) 
        DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, updated_at = timezone('utc', now())
        RETURNING id;
      `; 
      const userIdentifier = usr.email || usr.identifier; 
      const fallbackHash = usr.passwordHash || '$2b$10$UnassignedOfflinePlaceholderHashString';  
      if (!userIdentifier) continue;  
      const result = await client.query(userUpsertQuery, [userIdentifier, usr.name || 'Unnamed Offline User', fallbackHash, usr.role || 'volunteer']); 
      await logSyncAction('users', 'UPSERT', result.rows[0].id, usr.clientTimestamp || Date.now());
      syncedUsersCount++;  
    }

    for (const link of managerEvents) {
      let targetEventId = link.eventId;
      if (targetEventId && realEventIdMap[targetEventId]) {
        targetEventId = realEventIdMap[targetEventId];
      }
      const managerIdentifier = link.managerIdentifier || link.managerEmail;
      if (!managerIdentifier || !targetEventId) continue;
      const linkUpsertQuery = `
        INSERT INTO manager_events (manager_identifier, event_id, assigned_at)
        VALUES ($1, $2, timezone('utc', now()))
        ON CONFLICT (manager_identifier, event_id) DO UPDATE SET manager_identifier = EXCLUDED.manager_identifier 
        RETURNING manager_identifier, event_id;
      `; 
      const result = await client.query(linkUpsertQuery, [managerIdentifier, targetEventId]); 
      if (result.rows.length > 0) {
        await logSyncAction('manager_events', 'UPSERT', 0, link.clientTimestamp || Date.now());
      }
      syncedLinksCount++;
    }

    for (const gst of guests) {
      let targetEventId = gst.eventId; 
      if (targetEventId && realEventIdMap[targetEventId]) {
        targetEventId = realEventIdMap[targetEventId]; 
      }
      if (!targetEventId) continue; 
      const guestUpsertQuery = `
        INSERT INTO guests (
          event_id, name, type, qr_token, email, phone, is_check_in, amount_paid, has_food_access, check_in_time, server_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, timezone('utc', now()))
        ON CONFLICT (qr_token) 
        DO UPDATE SET name = EXCLUDED.name, type = EXCLUDED.type, email = EXCLUDED.email, phone = EXCLUDED.phone, is_check_in = EXCLUDED.is_check_in, amount_paid = EXCLUDED.amount_paid, has_food_access = EXCLUDED.has_food_access, check_in_time = COALESCE(guests.check_in_time, EXCLUDED.check_in_time), server_updated_at = timezone('utc', now())
        RETURNING id;
      `; 
      const checkInStatus = gst.checkInTime || gst.isCheckIn === 1 ? 1 : 0;
      const result = await client.query(guestUpsertQuery, [targetEventId, gst.name, gst.type || 'general-public', gst.qrToken, gst.email || null, gst.phone || null, checkInStatus, gst.amountPaid || 0.00, gst.hasFoodAccess || 0, gst.checkInTime ? BigInt(gst.checkInTime) : null]); 
      const serverGuestId = result.rows[0].id;
      await logSyncAction('guests', gst.checkInTime ? 'CHECK_IN' : 'UPDATE', serverGuestId, gst.clientTimestamp || gst.checkInTime);
      syncedGuestsCount++;  
    }

    await client.query('COMMIT'); 
    return NextResponse.json({ 
      success: true, 
      message: 'All relational transaction matrices verified and synchronized.', 
      counts: { events: syncedEventsCount, users: syncedUsersCount, links: syncedLinksCount, guests: syncedGuestsCount, total: syncedEventsCount + syncedUsersCount + syncedLinksCount + syncedGuestsCount }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK');  
    console.error('❌ Sync workflow pipeline failure:', error.message); 
    return NextResponse.json({ error: 'Sync pipeline execution failed', details: error.message }, { status: 500 }); 
  } finally {
    if (client) client.release(); 
  }
}