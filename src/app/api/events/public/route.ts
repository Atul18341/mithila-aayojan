// src/app/api/events/public/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

// Fallback distribution link configuration
const R2_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL || 'https://pub-f6007cb4960a4dd98733c35982b7b8cd.r2.dev';

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    
    // 🚀 Query selecting all operational parameters + registration count
    const query = `
      SELECT 
        e.id, e.name, e.type, e.protocol, e.status, e.date, e.slug, 
        e.location, e.tagline, e.description, e.venue_name, e.visibility, 
        e.start_time, e.end_time, e.food_config, e.pricing_config, 
        e.cover_image, e.poster_image, e.organizer_id,
        e.is_multi_competition, e.competitions,
        u.name AS organizer_name,
        u.identifier AS organizer_email,
        COALESCE(r.reg_count, 0) AS registration_count
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id
      LEFT JOIN (
        SELECT event_id, COUNT(*) AS reg_count
        FROM event_registrations
        GROUP BY event_id
      ) r ON e.id = r.event_id
      WHERE e.visibility->>'rsvp' = 'true'
      ORDER BY e.date DESC;
    `;
    
    const result = await client.query(query);
    
    // 🚀 Format response payload
    const formattedEvents = result.rows.map(event => {
      const cleanedBaseUrl = R2_PUBLIC_BASE_URL.replace(/\/$/, '');
      
      let parsedCompetitions = [];
      if (event.competitions) {
        try {
          parsedCompetitions = typeof event.competitions === 'string' 
            ? JSON.parse(event.competitions) 
            : event.competitions;
        } catch {
          parsedCompetitions = [];
        }
      }

      const resolvedOrganizerName = event.organizer_name || event.organizer_email || "Let's Inspire Bihar Core Member";

      // Helper to parse potential stringified JSONB fields safely
      const parseJsonField = (field: any) => {
        if (!field) return null;
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch {
            return field;
          }
        }
        return field;
      };

      return {
        id: event.id,
        name: event.name,
        type: event.type,
        protocol: event.protocol,
        status: event.status,
        date: event.date,
        createdAt: event.created_at,
        updatedAt: event.updated_at,
        slug: event.slug,
        isCountPublic: event.is_count_public,
        hypeThreshold: event.hype_threshold,
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

        // 🟢 MULTI-COMPETITION
        isMultiCompetition: Boolean(event.is_multi_competition),
        competitions: Array.isArray(parsedCompetitions) ? parsedCompetitions : [],

        // 🟢 JSONB OBJECT PARSING
        visibility: parseJsonField(event.visibility),
        foodConfig: parseJsonField(event.food_config),
        pricingConfig: parseJsonField(event.pricing_config),
        
        start_time: event.start_time,
        end_time: event.end_time,

        coverImageUrl: event.cover_image 
          ? `${cleanedBaseUrl}/event-cover-image/${event.cover_image}` 
          : null,
        posterImageUrl: event.poster_image 
          ? `${cleanedBaseUrl}/event-banner/${event.poster_image}` 
          : null
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