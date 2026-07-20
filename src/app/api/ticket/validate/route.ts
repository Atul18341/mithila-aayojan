import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

export async function POST(request: Request) {
  let client;
  try {
    const { ticketId, mode } = await request.json();
    client = await pool.connect();

    // 1. Fetch current ticket allocation record
    const ticketQuery = `SELECT * FROM registrations WHERE ticket_id = $1;`;
    const ticketResult = await client.query(ticketQuery, [ticketId]);

    if (ticketResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid Ticket QR Code' }, { status: 404 });
    }

    const ticket = ticketResult.rows[0];

    // 🚀 GATE CHECK-IN MODE BUSINESS LOGIC
    if (mode === 'CHECK_IN') {
      if (ticket.has_checked_in) {
        return NextResponse.json({ success: false, error: `Already Checked In!` });
      }

      await client.query(`UPDATE registrations SET has_checked_in = true WHERE ticket_id = $1;`, [ticketId]);
      return NextResponse.json({ success: true, message: `Welcome, ${ticket.attendee_name}! Entry Approved.` });
    }

    // 🚀 FOOD COUNTER MODE BUSINESS LOGIC
    if (mode === 'FOOD_CLAIM') {
      if (!ticket.food_included) {
        return NextResponse.json({ success: false, error: 'Food not included with this ticket type.' });
      }
      if (ticket.food_claimed) {
        return NextResponse.json({ success: false, error: 'Food already claimed!' });
      }

      await client.query(`UPDATE registrations SET food_claimed = true, food_claimed_at = now() WHERE ticket_id = $1;`, [ticketId]);
      return NextResponse.json({ success: true, message: `Plate Approved for ${ticket.attendee_name}.` });
    }

    return NextResponse.json({ success: false, error: 'Invalid operational route parameter.' }, { status: 400 });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}