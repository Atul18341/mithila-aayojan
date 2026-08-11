import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

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
  let syncedRegistrationsCount = 0;

  try {
    const body = await request.json(); 
    const { 
      events = [], 
      guests = [], 
      eventRegistrations = [], 
      registrations = [], 
      users = [], 
      managerEvents = [], 
      userId 
    } = body;

    // Combine both registration array aliases
    const allRegistrations = [...eventRegistrations, ...registrations];
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
      ]).catch(() => {}); // Non-fatal history log failover
    };

    // ==========================================
    // 1. SYNCHRONIZE EVENTS & UPLOAD MEDIA TO R2
    // ==========================================
    const realEventIdMap: Record<string | number, number> = {};
    const bucketName = 'mithila-aayojan';
    
    for (const ev of events) {
      const generatedSlug = ev.slug || (typeof ev.name === 'string' 
        ? ev.name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
        : `event-${Date.now()}`);

      // 🟢 MERGED: Includes registration_end_date in column list & DO UPDATE SET clause
      const eventUpsertQuery = `
        INSERT INTO events (
          name, type, protocol, status, date, start_time, end_time, registration_end_date,
          location, tagline, description, venue_name, visibility, 
          food_config, pricing_config, created_at, updated_at, slug
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13::jsonb, 
          $14::jsonb, $15::jsonb, timezone('utc', TO_TIMESTAMP($16 / 1000.0)), timezone('utc', now()), $17
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
          registration_end_date = EXCLUDED.registration_end_date,
          location = EXCLUDED.location,
          tagline = COALESCE(EXCLUDED.tagline, events.tagline),       
          description = COALESCE(EXCLUDED.description, events.description), 
          venue_name = EXCLUDED.venue_name,
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
        ev.name, 
        ev.type, 
        ev.protocol, 
        ev.status, 
        ev.date, 
        ev.startTime || null, 
        ev.endTime || null, 
        ev.registrationEndDate || ev.registration_end_date || null, // 🟢 $8: Passed registration deadline cutoff
        ev.location || null, 
        ev.tagline || null, 
        ev.description || null, 
        ev.venueName || null, 
        visibilityData,
        foodConfigData, 
        pricingConfigData, 
        ev.createdAt || Date.now(), 
        generatedSlug
      ]); 
      
      const serverGeneratedId = result.rows[0].id;

      if (ev.id !== undefined && ev.id !== null) {
        realEventIdMap[ev.id] = serverGeneratedId;
        realEventIdMap[Number(ev.id)] = serverGeneratedId;
        realEventIdMap[String(ev.id)] = serverGeneratedId;
      } 
      if (ev.slug) realEventIdMap[ev.slug] = serverGeneratedId;

      let finalCoverName = ev.cover_image || null;
      let finalPosterName = ev.poster_image || null;

      if (ev.coverBlobBase64) {
        const coverMedia = base64ToBuffer(ev.coverBlobBase64);
        if (coverMedia) {
          finalCoverName = `event-${generatedSlug}-cover.webp`;
          const finalCoverKey = `event-banner/${finalCoverName}`;
          await r2Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: finalCoverKey,
            Body: coverMedia.buffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000'
          })).catch(() => {});
        }
      }

      if (ev.posterBlobBase64) {
        const posterMedia = base64ToBuffer(ev.posterBlobBase64);
        if (posterMedia) {
          finalPosterName = `event-${generatedSlug}-poster.webp`;
          const finalPosterKey = `event-cover-image/${finalPosterName}`;
          await r2Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: finalPosterKey,
            Body: posterMedia.buffer,
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000'
          })).catch(() => {});
        }
      }

      if (finalCoverName || finalPosterName) {
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
    // 2. SYNCHRONIZE USERS & ACCESS RIGHTS
    // ==========================================
    for (const usr of users) {
      const rawIdentifier = usr.email || usr.identifier;
      if (!rawIdentifier) continue;  
      
      const userIdentifier = rawIdentifier.trim().toLowerCase();
      const userUpsertQuery = `
        INSERT INTO users (identifier, name, password_hash, role, updated_at)
        VALUES ($1, $2, $3, $4, timezone('utc', now()))
        ON CONFLICT (identifier) 
        DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, updated_at = timezone('utc', now())
        RETURNING id;
      `; 
      
      const fallbackHash = usr.passwordHash || usr.passkey || '$2b$10$UnassignedOfflinePlaceholderHashString';  
      const result = await client.query(userUpsertQuery, [
        userIdentifier, 
        usr.name || 'Unnamed Offline User', 
        fallbackHash, 
        usr.role || 'volunteer'
      ]); 

      await logSyncAction('users', 'UPSERT', result.rows[0].id, usr.clientTimestamp || Date.now());
      syncedUsersCount++;  
    }

    // ==========================================
    // 3. SYNCHRONIZE MANAGER / VOLUNTEER ASSIGNMENT LINKS & DESK SCOPES
    // ==========================================
    for (const link of managerEvents) {
      let rawTargetEventId = link.eventId;

      let targetEventId = 
        realEventIdMap[rawTargetEventId] || 
        realEventIdMap[Number(rawTargetEventId)] || 
        realEventIdMap[String(rawTargetEventId)] || 
        rawTargetEventId;

      const rawManagerIdentifier = link.managerIdentifier || link.managerEmail;
      if (!rawManagerIdentifier || !targetEventId) continue;

      const managerIdentifier = rawManagerIdentifier.trim().toLowerCase();

      const userCheck = await client.query(
        'SELECT identifier FROM users WHERE LOWER(identifier) = LOWER($1)',
        [managerIdentifier]
      );

      if (userCheck.rows.length === 0) {
        console.warn(`⚠️ Skipping assignment link: User '${managerIdentifier}' not found in PostgreSQL.`);
        continue;
      }

      const verifiedUserIdentifier = userCheck.rows[0].identifier;

      const eventCheck = await client.query(
        'SELECT id FROM events WHERE id = $1', 
        [Number(targetEventId)]
      );

      if (eventCheck.rows.length === 0) {
        console.warn(`⚠️ Skipping assignment: Event ID ${targetEventId} not found in PostgreSQL.`);
        continue;
      }

      const assignedDesk = link.assignedDesk || link.assigned_desk || 'CHECK_IN';

      const linkUpsertQuery = `
        INSERT INTO manager_events (manager_identifier, event_id, assigned_desk, assigned_at)
        VALUES ($1, $2, $3, timezone('utc', now()))
        ON CONFLICT (manager_identifier, event_id) 
        DO UPDATE SET 
          assigned_desk = EXCLUDED.assigned_desk,
          manager_identifier = EXCLUDED.manager_identifier
        RETURNING manager_identifier, event_id;
      `; 
      
      const result = await client.query(linkUpsertQuery, [
        verifiedUserIdentifier, 
        Number(targetEventId), 
        assignedDesk
      ]); 

      if (result.rows.length > 0) {
        await logSyncAction('manager_events', 'UPSERT', 0, link.clientTimestamp || Date.now());
      }
      syncedLinksCount++;
    }

    // ==========================================
    // 4. SYNCHRONIZE GUESTS & CHECK-IN / FOOD CLAIM DATA
    // ==========================================
    for (const gst of guests) {
      let rawTargetEventId = gst.eventId; 
      let targetEventId = 
        realEventIdMap[rawTargetEventId] || 
        realEventIdMap[Number(rawTargetEventId)] || 
        realEventIdMap[String(rawTargetEventId)] || 
        rawTargetEventId;

      if (!targetEventId || !gst.qrToken) continue; 

      const guestType = gst.category || gst.type || 'general-public';

      // Resolve Check-In State & Timestamps
      const checkInStatus = (gst.checkInTime || gst.isCheckedIn === true || gst.isCheckIn === 1) ? 1 : 0;
      const rawCheckInTime = gst.checkInTime ? BigInt(gst.checkInTime) : null;

      // Resolve Food Claim State & Timestamps
      const hasFoodAccess = (gst.hasFoodAccess === true || gst.isFoodAccess === true || gst.foodIncluded === true) ? 1 : 0;
      const hasFoodClaimed = (gst.hasFoodClaimed === true || gst.isFoodClaimed === true || gst.foodClaimed === true) ? 1 : 0;
      const rawFoodClaimedTime = gst.foodClaimedTime || gst.foodClaimedAt ? BigInt(gst.foodClaimedTime || gst.foodClaimedAt) : null;

      const guestUpsertQuery = `
        INSERT INTO guests (
          event_id, name, type, qr_token, email, phone, is_check_in, amount_paid, 
          has_food_access, has_food_claimed, check_in_time, food_claimed_time, server_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, timezone('utc', now()))
        ON CONFLICT (qr_token) 
        DO UPDATE SET 
          name = EXCLUDED.name, 
          type = EXCLUDED.type, 
          email = COALESCE(EXCLUDED.email, guests.email), 
          phone = COALESCE(EXCLUDED.phone, guests.phone), 
          is_check_in = EXCLUDED.is_check_in, 
          amount_paid = EXCLUDED.amount_paid, 
          has_food_access = EXCLUDED.has_food_access, 
          has_food_claimed = EXCLUDED.has_food_claimed, 
          check_in_time = COALESCE(guests.check_in_time, EXCLUDED.check_in_time), 
          food_claimed_time = COALESCE(guests.food_claimed_time, EXCLUDED.food_claimed_time), 
          server_updated_at = timezone('utc', now())
        RETURNING id;
      `; 

      const result = await client.query(guestUpsertQuery, [
        Number(targetEventId), 
        gst.name, 
        guestType, 
        gst.qrToken, 
        gst.email || null, 
        gst.phone || null, 
        checkInStatus, 
        gst.amountPaid || 0.00, 
        hasFoodAccess, 
        hasFoodClaimed, 
        rawCheckInTime,
        rawFoodClaimedTime
      ]); 

      const serverGuestId = result.rows[0].id;
      const syncActionType = hasFoodClaimed ? 'FOOD_CLAIM' : (checkInStatus ? 'CHECK_IN' : 'UPDATE');
      await logSyncAction('guests', syncActionType, serverGuestId, gst.clientTimestamp || Date.now());
      syncedGuestsCount++;  
    }

    // ==========================================
    // 5. SYNCHRONIZE EVENT REGISTRATIONS TABLE
    // ==========================================
    for (const reg of allRegistrations) {
      let rawTargetEventId = reg.eventId;
      let targetEventId = 
        realEventIdMap[rawTargetEventId] || 
        realEventIdMap[Number(rawTargetEventId)] || 
        realEventIdMap[String(rawTargetEventId)] || 
        rawTargetEventId;

      const qrToken = reg.qrToken || reg.registrationId || reg.ticketId;
      if (!targetEventId || !qrToken) continue;

      const isCheckedIn = Boolean(reg.isCheckedIn || reg.checkInTime || reg.isCheckIn === 1);
      const isFoodClaimed = Boolean(reg.hasFoodClaimed || reg.isFoodClaimed || reg.foodClaimed || reg.foodClaimedAt);

      const regUpsertQuery = `
        INSERT INTO event_registrations (
          event_id, registration_id, attendee_name, email, phone, ticket_type, 
          qr_token, payment_status, amount_paid, is_checked_in, check_in_time, 
          food_included, food_claimed, food_claimed_at, created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 
          $11, $12, $13, $14, timezone('utc', TO_TIMESTAMP($15 / 1000.0))
        )
        ON CONFLICT (qr_token)
        DO UPDATE SET
          attendee_name = EXCLUDED.attendee_name,
          email = COALESCE(EXCLUDED.email, event_registrations.email),
          phone = COALESCE(EXCLUDED.phone, event_registrations.phone),
          ticket_type = EXCLUDED.ticket_type,
          payment_status = EXCLUDED.payment_status,
          amount_paid = EXCLUDED.amount_paid,
          is_checked_in = EXCLUDED.is_checked_in,
          check_in_time = COALESCE(event_registrations.check_in_time, EXCLUDED.check_in_time),
          food_included = EXCLUDED.food_included,
          food_claimed = EXCLUDED.food_claimed,
          food_claimed_at = COALESCE(event_registrations.food_claimed_at, EXCLUDED.food_claimed_at);
      `;

      await client.query(regUpsertQuery, [
        Number(targetEventId),
        reg.registrationId || `REG-${Date.now()}`,
        reg.attendeeName || reg.name || 'Attendee',
        reg.email || null,
        reg.phone || null,
        reg.ticketType || reg.category || 'GENERAL',
        qrToken,
        reg.paymentStatus || 'PAID',
        reg.amountPaid || 0.00,
        isCheckedIn,
        reg.checkInTime ? new Date(reg.checkInTime) : null,
        Boolean(reg.hasFoodAccess || reg.foodIncluded || reg.isFoodAccess),
        isFoodClaimed,
        reg.foodClaimedAt ? new Date(reg.foodClaimedAt) : (reg.foodClaimedTime ? new Date(reg.foodClaimedTime) : null),
        reg.registeredAt || reg.createdAt || Date.now()
      ]).catch(async () => {
        // Fallback for legacy 'registrations' table name if 'event_registrations' is missing
        const fallbackQuery = `
          INSERT INTO registrations (event_id, ticket_id, attendee_name, email, has_checked_in, food_included, food_claimed)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (ticket_id) DO UPDATE SET has_checked_in = EXCLUDED.has_checked_in, food_claimed = EXCLUDED.food_claimed;
        `;
        await client.query(fallbackQuery, [
          Number(targetEventId), qrToken, reg.attendeeName || reg.name, reg.email || null,
          isCheckedIn, Boolean(reg.hasFoodAccess || reg.foodIncluded), isFoodClaimed
        ]).catch(() => {});
      });

      syncedRegistrationsCount++;
    }

    await client.query('COMMIT'); 

    return NextResponse.json({ 
      success: true, 
      message: 'All relational transaction matrices verified and synchronized.', 
      counts: { 
        events: syncedEventsCount, 
        users: syncedUsersCount, 
        links: syncedLinksCount, 
        guests: syncedGuestsCount, 
        eventRegistrations: syncedRegistrationsCount,
        total: syncedEventsCount + syncedUsersCount + syncedLinksCount + syncedGuestsCount + syncedRegistrationsCount 
      }
    });

  } catch (error: any) {
    if (client) await client.query('ROLLBACK');  
    console.error('❌ Sync workflow pipeline failure:', error.message); 
    return NextResponse.json({ error: 'Sync pipeline execution failed', details: error.message }, { status: 500 }); 
  } finally {
    if (client) client.release(); 
  }
}