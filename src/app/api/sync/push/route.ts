import { NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client } from '@/lib/r2';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

// Helper to convert base64 image data to buffer for Cloudflare R2[cite: 8]
function base64ToBuffer(base64Data: string): { buffer: Buffer; contentType: string } | null {
  if (!base64Data) return null;
  const matches = base64Data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  return {
    buffer: Buffer.from(matches[2], 'base64'),
    contentType: matches[1]
  };
}

// Helper to safely convert any date string or timestamp to a valid numeric epoch (BIGINT)
function toEpochMillis(val: any): number {
  if (val === null || val === undefined || val === '') return Date.now();
  if (typeof val === 'number') return isNaN(val) ? Date.now() : Math.floor(val);
  const parsed = new Date(val).getTime();
  return isNaN(parsed) ? Date.now() : parsed;
}

// Helper to safely convert amounts to decimal NUMERIC(10, 2)
function toNumeric(val: any): number {
  if (val === null || val === undefined || val === '') return 0.00;
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0.00 : parsed;
}

export async function POST(request: Request) {
  let client: PoolClient | null = null;
  
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

    const allRegistrations = [...eventRegistrations, ...registrations];
    const activeUserId = userId ? Number(userId) : null;

    client = await pool.connect(); 
    await client.query('BEGIN');  

    const logSyncAction = async (targetTable: string, action: string, recordId: number, clientTimestamp: any) => {
      if (!client) return;
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
        toEpochMillis(clientTimestamp)
      ]).catch(() => {});
    };

    // ==========================================
    // 1. SYNCHRONIZE USERS & ACCESS RIGHTS FIRST[cite: 8]
    // ==========================================
    for (const usr of users) {
      const rawIdentifier = usr.email || usr.identifier;
      if (!rawIdentifier) continue;  
      
      const userIdentifier = rawIdentifier.trim().toLowerCase();
      const userUpsertQuery = `
        INSERT INTO users (identifier, name, password_hash, role, updated_at)
        VALUES ($1, $2, $3, $4, timezone('utc', now()))
        ON CONFLICT (identifier) 
        DO UPDATE SET 
          name = COALESCE(EXCLUDED.name, users.name), 
          password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
          role = COALESCE(EXCLUDED.role, users.role), 
          updated_at = timezone('utc', now())
        RETURNING id;
      `; 
      
      const fallbackHash = usr.passwordHash || usr.passkey || '$2b$10$UnassignedOfflinePlaceholderHashString';  
      const result = await client.query(userUpsertQuery, [
        userIdentifier, 
        usr.name || null, 
        fallbackHash, 
        usr.role || 'volunteer'
      ]); 

      await logSyncAction('users', 'UPSERT', result.rows[0].id, usr.clientTimestamp);
      syncedUsersCount++;  
    }

    // ==========================================
    // 2. SYNCHRONIZE EVENTS & UPLOAD MEDIA TO R2[cite: 8]
    // ==========================================
    const realEventIdMap: Record<string | number, number> = {};
    const bucketName = 'mithila-aayojan';
    
    for (const ev of events) {
      const generatedSlug = ev.slug || (typeof ev.name === 'string' 
        ? ev.name.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '')
        : `event-${Date.now()}`);

      let verifiedOrganizerId: number | null = null;

      if (ev.organizerEmail) {
        const userLookup = await client.query(
          'SELECT id FROM users WHERE LOWER(identifier) = LOWER($1)',
          [ev.organizerEmail.trim()]
        );
        if (userLookup.rows.length > 0) {
          verifiedOrganizerId = userLookup.rows[0].id;
        }
      }

      if (!verifiedOrganizerId && ev.organizerId) {
        const idCheck = await client.query('SELECT id FROM users WHERE id = $1', [Number(ev.organizerId)]);
        if (idCheck.rows.length > 0) {
          verifiedOrganizerId = Number(ev.organizerId);
        }
      }

      if (!verifiedOrganizerId && activeUserId) {
        const activeCheck = await client.query('SELECT id FROM users WHERE id = $1', [activeUserId]);
        if (activeCheck.rows.length > 0) {
          verifiedOrganizerId = activeUserId;
        }
      }

      // Updated query with whatsapp_number and helpline_number columns
      const eventUpsertQuery = `
        INSERT INTO events (
          name, type, protocol, status, date, start_time, end_time, registration_end_date,
          location, tagline, description, venue_name, whatsapp_number, helpline_number, visibility, 
          food_config, pricing_config, is_multi_competition, competitions, organizer_id,
          created_at, updated_at, slug
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15::jsonb, 
          $16::jsonb, $17::jsonb, $18, $19::jsonb, $20,
          timezone('utc', TO_TIMESTAMP($21 / 1000.0)), timezone('utc', now()), $22
        )
        ON CONFLICT (slug) 
        DO UPDATE SET 
          name = COALESCE(EXCLUDED.name, events.name), 
          type = COALESCE(EXCLUDED.type, events.type),
          protocol = COALESCE(EXCLUDED.protocol, events.protocol),
          status = COALESCE(EXCLUDED.status, events.status),
          date = COALESCE(EXCLUDED.date, events.date),
          start_time = COALESCE(EXCLUDED.start_time, events.start_time),
          end_time = COALESCE(EXCLUDED.end_time, events.end_time),
          registration_end_date = COALESCE(EXCLUDED.registration_end_date, events.registration_end_date),
          location = COALESCE(EXCLUDED.location, events.location),
          tagline = COALESCE(EXCLUDED.tagline, events.tagline),       
          description = COALESCE(EXCLUDED.description, events.description), 
          venue_name = COALESCE(EXCLUDED.venue_name, events.venue_name),
          whatsapp_number = COALESCE(EXCLUDED.whatsapp_number, events.whatsapp_number),
          helpline_number = COALESCE(EXCLUDED.helpline_number, events.helpline_number),
          visibility = COALESCE(EXCLUDED.visibility, events.visibility),
          food_config = COALESCE(EXCLUDED.food_config, events.food_config),
          pricing_config = COALESCE(EXCLUDED.pricing_config, events.pricing_config),
          is_multi_competition = COALESCE(EXCLUDED.is_multi_competition, events.is_multi_competition),
          competitions = COALESCE(EXCLUDED.competitions, events.competitions),
          organizer_id = COALESCE(EXCLUDED.organizer_id, events.organizer_id),
          updated_at = timezone('utc', now())
        RETURNING id;
      `; 

      const cleanWhatsAppNumber = ev.whatsappNumber || ev.whatsapp_number 
        ? String(ev.whatsappNumber || ev.whatsapp_number).replace(/\D/g, '').slice(0, 15) 
        : null;

      const cleanHelplineNumber = ev.helplineNumber || ev.helpline_number 
        ? String(ev.helplineNumber || ev.helpline_number).replace(/\D/g, '').slice(0, 15) 
        : null;

      const visibilityData = ev.visibility ? JSON.stringify(ev.visibility) : null;
      const foodConfigData = ev.foodConfig ? JSON.stringify(ev.foodConfig) : null;
      const pricingConfigData = ev.pricingConfig ? JSON.stringify(ev.pricingConfig) : null;
      const isMultiCompetition = ev.isMultiCompetition !== undefined ? Boolean(ev.isMultiCompetition) : null;
      const competitionsData = Array.isArray(ev.competitions) ? JSON.stringify(ev.competitions) : null;
      const eventCreationEpoch = toEpochMillis(ev.createdAt);

      const result = await client.query(eventUpsertQuery, [
        ev.name || null, 
        ev.type || null, 
        ev.protocol || null, 
        ev.status || 'draft', 
        ev.date || null, 
        ev.startTime || null, 
        ev.endTime || null, 
        ev.registrationEndDate || ev.registration_end_date || null,
        ev.location || null, 
        ev.tagline || null, 
        ev.description || null, 
        ev.venueName || ev.venue_name || null, 
        cleanWhatsAppNumber,
        cleanHelplineNumber,
        visibilityData,
        foodConfigData, 
        pricingConfigData, 
        isMultiCompetition,
        competitionsData,
        verifiedOrganizerId,
        eventCreationEpoch, 
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
      await logSyncAction('events', isNew ? 'INSERT' : 'UPDATE', serverGeneratedId, ev.clientTimestamp || eventCreationEpoch);
      syncedEventsCount++; 
    }

    // ==========================================
    // 3. SYNCHRONIZE MANAGER / VOLUNTEER LINKS[cite: 8]
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

      if (userCheck.rows.length === 0) continue;

      const verifiedUserIdentifier = userCheck.rows[0].identifier;

      const eventCheck = await client.query(
        'SELECT id FROM events WHERE id = $1', 
        [Number(targetEventId)]
      );

      if (eventCheck.rows.length === 0) continue;

      const assignedDesk = link.assignedDesk || link.assigned_desk || 'CHECK_IN';

      const linkUpsertQuery = `
        INSERT INTO manager_events (manager_identifier, event_id, assigned_desk, assigned_at)
        VALUES ($1, $2, $3, timezone('utc', now()))
        ON CONFLICT (manager_identifier, event_id) 
        DO UPDATE SET 
          assigned_desk = COALESCE(EXCLUDED.assigned_desk, manager_events.assigned_desk),
          manager_identifier = EXCLUDED.manager_identifier
        RETURNING manager_identifier, event_id;
      `; 
      
      const result = await client.query(linkUpsertQuery, [
        verifiedUserIdentifier, 
        Number(targetEventId), 
        assignedDesk
      ]); 

      if (result.rows.length > 0) {
        await logSyncAction('manager_events', 'UPSERT', 0, link.clientTimestamp);
      }
      syncedLinksCount++;
    }

    // ==========================================
    // 4. SYNCHRONIZE GUESTS TABLE[cite: 8]
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
      const checkInStatus = (gst.checkInTime || gst.isCheckedIn === true || gst.isCheckIn === 1) ? true : false;
      const rawCheckInTime = gst.checkInTime ? toEpochMillis(gst.checkInTime) : null;
      const hasFoodAccess = Boolean(gst.hasFoodAccess || gst.isFoodAccess || gst.foodIncluded);
      const amountPaid = toNumeric(gst.amountPaid || gst.amount_paid);

      const guestUpsertQuery = `
        INSERT INTO guests (
          event_id, name, type, qr_token, email, phone, is_check_in, amount_paid, 
          has_food_access, check_in_time, server_updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, timezone('utc', now()))
        ON CONFLICT (qr_token) 
        DO UPDATE SET 
          name = COALESCE(EXCLUDED.name, guests.name), 
          type = COALESCE(EXCLUDED.type, guests.type), 
          email = COALESCE(EXCLUDED.email, guests.email), 
          phone = COALESCE(EXCLUDED.phone, guests.phone), 
          is_check_in = EXCLUDED.is_check_in OR guests.is_check_in, 
          amount_paid = COALESCE(EXCLUDED.amount_paid, guests.amount_paid), 
          has_food_access = COALESCE(EXCLUDED.has_food_access, guests.has_food_access), 
          check_in_time = COALESCE(guests.check_in_time, EXCLUDED.check_in_time), 
          server_updated_at = timezone('utc', now())
        RETURNING id;
      `; 

      const result = await client.query(guestUpsertQuery, [
        Number(targetEventId), 
        gst.name || 'Event Attendee', 
        guestType, 
        gst.qrToken, 
        gst.email || null, 
        gst.phone || null, 
        checkInStatus, 
        amountPaid, 
        hasFoodAccess, 
        rawCheckInTime
      ]); 

      const serverGuestId = result.rows[0].id;
      await logSyncAction('guests', checkInStatus ? 'CHECK_IN' : 'UPDATE', serverGuestId, gst.clientTimestamp);
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

      if (!targetEventId) continue;

      const regName = reg.name || reg.attendeeName || '';
      const regEmail = reg.email || '';
      const regPhone = reg.phone || '';
      if (!regName || !regEmail || !regPhone) continue;

      const basePrice = toNumeric(reg.basePrice || reg.base_price);
      const gstAmount = toNumeric(reg.gstAmount || reg.gst_amount);
      const totalPrice = toNumeric(reg.totalPrice || reg.total_price || reg.amountPaid);
      const registrationTimestamp = toEpochMillis(reg.registrationTimestamp || reg.registeredAt || reg.createdAt);

      const customAnswersData = typeof reg.customAnswers === 'object' 
        ? JSON.stringify(reg.customAnswers) 
        : (typeof reg.customAnswers === 'string' ? reg.customAnswers : '{}');

      const verifiedAge = reg.verifiedAge !== null && reg.verifiedAge !== undefined && !isNaN(Number(reg.verifiedAge)) 
        ? Number(reg.verifiedAge) 
        : null;

      const hasNumericId = reg.id && !isNaN(Number(reg.id)) && Number(reg.id) > 0;

      let regQuery: string;
      let regParams: any[];

      if (hasNumericId) {
        regQuery = `
          INSERT INTO event_registrations (
            id, event_id, name, email, phone, category, custom_answers,
            base_price, gst_amount, total_price, registration_timestamp,
            status, sync_status, competition_id, competition_title,
            age_group_id, age_group_label, is_age_verified, verified_age
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7::jsonb,
            $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, $18, $19
          )
          ON CONFLICT (id) 
          DO UPDATE SET
            name = COALESCE(EXCLUDED.name, event_registrations.name),
            email = COALESCE(EXCLUDED.email, event_registrations.email),
            phone = COALESCE(EXCLUDED.phone, event_registrations.phone),
            category = COALESCE(EXCLUDED.category, event_registrations.category),
            custom_answers = COALESCE(EXCLUDED.custom_answers, event_registrations.custom_answers),
            base_price = EXCLUDED.base_price,
            gst_amount = EXCLUDED.gst_amount,
            total_price = EXCLUDED.total_price,
            status = COALESCE(EXCLUDED.status, event_registrations.status),
            competition_id = COALESCE(EXCLUDED.competition_id, event_registrations.competition_id),
            competition_title = COALESCE(EXCLUDED.competition_title, event_registrations.competition_title),
            age_group_id = COALESCE(EXCLUDED.age_group_id, event_registrations.age_group_id),
            age_group_label = COALESCE(EXCLUDED.age_group_label, event_registrations.age_group_label),
            is_age_verified = EXCLUDED.is_age_verified,
            verified_age = EXCLUDED.verified_age,
            sync_status = 'synced'
          RETURNING id;
        `;
        regParams = [
          Number(reg.id),
          Number(targetEventId),
          regName,
          regEmail,
          regPhone,
          reg.category || reg.ticketType || 'general-public',
          customAnswersData,
          basePrice,
          gstAmount,
          totalPrice,
          registrationTimestamp,
          reg.status || 'CONFIRMED',
          'synced',
          reg.competitionId || null,
          reg.competitionTitle || null,
          reg.ageGroupId || null,
          reg.ageGroupLabel || null,
          Boolean(reg.isAgeVerified),
          verifiedAge
        ];
      } else {
        regQuery = `
          INSERT INTO event_registrations (
            event_id, name, email, phone, category, custom_answers,
            base_price, gst_amount, total_price, registration_timestamp,
            status, sync_status, competition_id, competition_title,
            age_group_id, age_group_label, is_age_verified, verified_age
          )
          VALUES (
            $1, $2, $3, $4, $5, $6::jsonb,
            $7, $8, $9, $10,
            $11, $12, $13, $14,
            $15, $16, $17, $18
          )
          RETURNING id;
        `;
        regParams = [
          Number(targetEventId),
          regName,
          regEmail,
          regPhone,
          reg.category || reg.ticketType || 'general-public',
          customAnswersData,
          basePrice,
          gstAmount,
          totalPrice,
          registrationTimestamp,
          reg.status || 'CONFIRMED',
          'synced',
          reg.competitionId || null,
          reg.competitionTitle || null,
          reg.ageGroupId || null,
          reg.ageGroupLabel || null,
          Boolean(reg.isAgeVerified),
          verifiedAge
        ];
      }

      const regResult = await client.query(regQuery, regParams);
      const serverRegId = regResult.rows[0]?.id || (hasNumericId ? Number(reg.id) : 0);

      await logSyncAction('event_registrations', 'UPSERT', serverRegId, registrationTimestamp);
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
    console.error('❌ Sync workflow pipeline failure:', error?.message || error); 
    return NextResponse.json({ error: 'Sync pipeline execution failed', details: error?.message || String(error) }, { status: 500 }); 
  } finally {
    if (client) {
      client.release(); 
    }
  }
}