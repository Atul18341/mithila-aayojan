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
    
    // 🚀 Select ALL operational parameters including organizer relational fields & multi-competition parameters
    const query = `
      SELECT 
        e.id, e.name, e.type, e.protocol, e.status, e.date, e.slug, 
        e.location, e.tagline, e.description, e.venue_name, e.visibility, 
        e.start_time, e.end_time, e.food_config, e.pricing_config, 
        e.cover_image, e.poster_image, e.organizer_id,
        e.is_multi_competition, e.competitions, -- 🟢 Multi-Competition Fields
        u.name AS organizer_name, -- Dynamic name lookup from users table
        u.identifier AS organizer_email -- Dynamic email/identifier lookup from users table
      FROM events e
      LEFT JOIN users u ON e.organizer_id = u.id -- Relational validation bridge
      WHERE e.visibility->>'rsvp' = 'true'
      ORDER BY e.date DESC;
    `;
    
    const result = await client.query(query);
    
    // 🚀 Format every structural field, handling JSONB conversions and cleaning R2 URL paths
    const formattedEvents = result.rows.map(event => {
      // Stripping trailing slashes safely to prevent invalid double-slash URL errors
      const cleanedBaseUrl = R2_PUBLIC_BASE_URL.replace(/\/$/, '');
      
      // Parse competitions safely if stored as string JSON or JSONB array
      let parsedCompetitions = [];
      if (event.competitions) {
        parsedCompetitions = typeof event.competitions === 'string' 
          ? JSON.parse(event.competitions) 
          : event.competitions;
      }

      // Resolve Organizer Display Name with progressive fallbacks
      const resolvedOrganizerName = event.organizer_name || event.organizer_email || 'Let\'s Inspire Bihar Core Member';

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
        
        // 🟢 ORGANIZER DETAILS FROM POSTGRESQL (users table JOIN)
        organizerId: event.organizer_id ? Number(event.organizer_id) : null,
        organizerName: event.organizer_name || null,
        organizerEmail: event.organizer_email || null,
        organizedBy: resolvedOrganizerName,

        // 🟢 Multi-Competition Payload Mapping
        isMultiCompetition: Boolean(event.is_multi_competition),
        competitions: Array.isArray(parsedCompetitions) ? parsedCompetitions : [],

        // Explicitly ensuring JSONB fields are object structures, not raw string vectors
        visibility: typeof event.visibility === 'string' ? JSON.parse(event.visibility) : event.visibility,
        foodConfig: typeof event.food_config === 'string' ? JSON.parse(event.food_config) : event.food_config,
        pricingConfig: typeof event.pricing_config === 'string' ? JSON.parse(event.pricing_config) : event.pricing_config,
        
        // Standardizing database TIME formats
        start_time: event.start_time,
        end_time: event.end_time,

        // Appending public keys cleanly into final asset references
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
    console.error('❌ Public event fetch failure:', error.message);
    return NextResponse.json(
      { error: 'Public matrix hydration error', details: error.message }, 
      { status: 500 }
    );
  } finally {
    if (client) client.release();
  }
}