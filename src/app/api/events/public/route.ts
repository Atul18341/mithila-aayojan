// src/app/api/events/public/route.ts
import { NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

// Fallback distribution link configuration
const R2_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-f6007cb4960a4dd98733c35982b7b8cd.r2.dev';

export async function GET() {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    
    // 🚀 Cleaned SQL query without non-existent columns
    const query = `
      SELECT 
        e.id, 
        e.name, 
        e.type, 
        e.protocol, 
        e.status, 
        e.date, 
        e.slug, 
        e.location, 
        e.tagline, 
        e.description, 
        e.venue_name, 
        e.visibility, 
        e.start_time, 
        e.end_time, 
        e.registration_end_date,
        e.food_config, 
        e.pricing_config, 
        e.cover_image, 
        e.poster_image, 
        e.organizer_id,
        e.is_multi_competition, 
        e.competitions,
        e.is_count_public,
        e.hype_threshold,
        e.created_at,
        e.updated_at,
        u.name AS organizer_name,
        u.identifier AS organizer_email,
        COALESCE(r.reg_count, 0) AS registration_count
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS reg_count
        FROM event_registrations
        GROUP BY event_id
      ) r ON (CAST(e.id AS VARCHAR) = CAST(r.event_id AS VARCHAR) OR e.slug = CAST(r.event_id AS VARCHAR))
      WHERE 
        COALESCE((e.visibility->>'rsvp')::boolean, true) = true
        AND (e.status IS NULL OR e.status != 'unpublished')
      ORDER BY e.date DESC;
    `;
    
    const result = await client.query(query);
    
    // 🚀 Format response payload
    const formattedEvents = result.rows.map(event => {
      const cleanedBaseUrl = R2_PUBLIC_BASE_URL.replace(/\/$/, '');

      // Helper to parse potential stringified JSON/JSONB or array fields safely
      const parseJsonField = (field: any, fallback: any = null) => {
        if (!field) return fallback;
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch {
            return fallback;
          }
        }
        return field;
      };

      // Helper to resolve cover/poster image paths safely
      const resolveImageUrl = (imgKey: string | null | undefined, folder: 'event-cover-image' | 'event-banner') => {
        if (!imgKey) return null;
        if (imgKey.startsWith('http://') || imgKey.startsWith('https://') || imgKey.startsWith('data:')) {
          return imgKey;
        }
        return `${cleanedBaseUrl}/${folder}/${imgKey}`;
      };

      const resolvedOrganizerName = event.organizer_name || event.organizer_email || "Event Organizing Committee";
      const parsedCompetitions = parseJsonField(event.competitions, []);

      return {
        id: event.id,
        name: event.name,
        type: event.type,
        protocol: event.protocol || 'open-registration',
        status: event.status || 'published',
        date: event.date,
        start_time: event.start_time || null,
        end_time: event.end_time || null,
        registrationEndDate: event.registration_end_date || null,
        registration_end_date: event.registration_end_date || null,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        slug: event.slug,
        isCountPublic: Boolean(event.is_count_public),
        hypeThreshold: Number(event.hype_threshold || 20),
        location: event.location,
        tagline: event.tagline,
        description: event.description,
        venue_name: event.venue_name,
        
        // 🟢 REGISTRATION COUNT
        registrationCount: parseInt(event.registration_count || '0', 10),

        // 🟢 ORGANIZER DETAILS
        organizerId: event.organizer_id ? Number(event.organizer_id) : null,
        organizerName: event.organizer_name || null,
        organizerEmail: event.organizer_email || null,
        organizedBy: resolvedOrganizerName,

        // 🟢 MULTI-COMPETITION ARRAY
        isMultiCompetition: Boolean(event.is_multi_competition),
        competitions: Array.isArray(parsedCompetitions) ? parsedCompetitions : [],

        // 🟢 JSONB CONFIGURATIONS
        visibility: parseJsonField(event.visibility, { map: true, rsvp: true, schedule: true, gallery: false }),
        foodConfig: parseJsonField(event.food_config, {}),
        pricingConfig: parseJsonField(event.pricing_config, {}),

        // 🟢 PROPERLY RESOLVED IMAGES
        coverImageUrl: resolveImageUrl(event.cover_image, 'event-cover-image'),
        posterImageUrl: resolveImageUrl(event.poster_image, 'event-banner')
      };
    });

    return NextResponse.json({ 
      success: true, 
      events: formattedEvents 
    });

  } catch (error: any) {
    console.error('❌ Public event fetch failure:', error?.message || error);
    return NextResponse.json(
      { error: 'Public matrix hydration error', details: error?.message || String(error) }, 
      { status: 500 }
    );
  } finally {
    if (client) {
      client.release();
    }
  }
}