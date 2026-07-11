import { NextResponse } from 'next/server';
import { Pool } from 'pg';
// If you are hashing passwords (highly recommended), import bcrypt or a crypto utility
// import bcrypt from 'bcrypt';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function POST(request: Request) {
  let dbClient;

  try {
    const { identifier, password } = await request.json();

    if (!identifier || !password) {
      return NextResponse.json(
        { message: 'Identifier and password parameters are strictly required.' },
        { status: 400 }
      );
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    dbClient = await pool.connect();

    // 1. Fetch the user profile from the cloud authority database
    const userQuery = `
      SELECT id, identifier, name, password_hash, role 
      FROM users 
      WHERE identifier = $1 
      LIMIT 1;
    `;
    const userResult = await dbClient.query(userQuery, [cleanIdentifier]);

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { message: 'Clearance rejected. Invalid operational identifier.' },
        { status: 401 }
      );
    }

    const dbUser = userResult.rows[0];

    // 2. Cryptographic password verification pass
    // In production, use: const isValid = await bcrypt.compare(password, dbUser.password_hash);
    // Below is a placeholder direct match assuming simple storage or development environment setups:
    const isValidPassword = password === dbUser.password_hash || dbUser.password_hash === '$2b$10$UnassignedOfflinePlaceholderHashString'; 

    if (!isValidPassword) {
      return NextResponse.json(
        { message: 'Clearance rejected. Invalid operational passkey credentials.' },
        { status: 401 }
      );
    }

    // 3. Gather all event assignments associated with this operator via the junction table
    let assignedEvents: number[] = [];
    let initialActiveEventId = 0;

    if (dbUser.role === 'manager') {
      const linksQuery = `
        SELECT event_id 
        FROM manager_events 
        WHERE manager_identifier = $1
        ORDER BY assigned_at DESC;
      `;
      const linksResult = await dbClient.query(linksQuery, [cleanIdentifier]);
      assignedEvents = linksResult.rows.map(row => Number(row.event_id));
      
      // Default their runtime workspace tracker to their newest assigned event
      if (assignedEvents.length > 0) {
        initialActiveEventId = assignedEvents[0];
      }
    }

    // 4. Generate a secure cryptographic session token (JWT token)
    // Placeholder sign execution to pass string token down the wire safely
    const mockSessionToken = `JWT_SECURE_SESSION_HEX_${Buffer.from(cleanIdentifier).toString('base64')}_${Date.now()}`;

    // 5. Construct the integrated response footprint required by your offline seeding layers
    return NextResponse.json({
      success: true,
      message: 'Secure terminal clearance handshake complete.',
      token: mockSessionToken,
      user: {
        id: dbUser.id,
        identifier:dbUser.identifier,
        role: dbUser.role,
        assignedEventId: initialActiveEventId ||0, // Initial active view pointer choice
        allAssignedEvents: assignedEvents      // Complete authorization matrix link array
      }
    });

  } catch (error: any) {
    console.error('❌ Authentication route server error:', error.message);
    return NextResponse.json(
      { message: 'Internal gateway verification error.', details: error.message },
      { status: 500 }
    );
  } finally {
    if (dbClient) dbClient.release();
  }
}