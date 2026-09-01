// src/app/api/visitors/route.ts
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
});

async function ensureTableAndRecordExists(client: any) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS site_visitors (
      id SERIAL PRIMARY KEY,
      count INT DEFAULT 0,
      daily_count INT DEFAULT 0,
      last_reset_date TEXT
    );
  `);
  const today = new Date().toISOString().split('T')[0];
  const res = await client.query(`SELECT * FROM site_visitors WHERE id = 1;`);
  if (res.rows.length === 0) {
    await client.query(`
      INSERT INTO site_visitors (id, count, daily_count, last_reset_date) 
      VALUES (1, 0, 0, $1);
    `, [today]);
  }
}

export async function GET() {
  let client;
  try {
    client = await pool.connect();
    await ensureTableAndRecordExists(client);
    
    const today = new Date().toISOString().split('T')[0];
    const res = await client.query(`SELECT count, daily_count, last_reset_date FROM site_visitors WHERE id = 1;`);
    let row = res.rows[0] || { count: 0, daily_count: 0, last_reset_date: today };

    // Lazily reset daily count if the date has rolled over since the last visit
    if (row.last_reset_date !== today) {
      await client.query(`
        UPDATE site_visitors 
        SET daily_count = 0, last_reset_date = $1 
        WHERE id = 1;
      `, [today]);
      row.daily_count = 0;
    }

    return NextResponse.json({ 
      success: true, 
      count: row.count, 
      dailyCount: row.daily_count 
    });
  } catch (error: any) {
    console.error('Failed to fetch visitor count:', error);
    return NextResponse.json({ success: false, count: 0, dailyCount: 0 }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}

export async function POST() {
  let client;
  try {
    client = await pool.connect();
    await ensureTableAndRecordExists(client);
    
    const today = new Date().toISOString().split('T')[0];
    
    const checkRes = await client.query(`SELECT last_reset_date FROM site_visitors WHERE id = 1;`);
    const lastDate = checkRes.rows[0]?.last_reset_date;

    let updateQuery = '';
    let values: string[] = [];

    if (lastDate === today) {
      updateQuery = `
        UPDATE site_visitors 
        SET count = count + 1, daily_count = daily_count + 1 
        WHERE id = 1 
        RETURNING count, daily_count;
      `;
    } else {
      updateQuery = `
        UPDATE site_visitors 
        SET count = count + 1, daily_count = 1, last_reset_date = $1 
        WHERE id = 1 
        RETURNING count, daily_count;
      `;
      values = [today];
    }

    const res = await client.query(updateQuery, values);
    const row = res.rows[0] || { count: 1, daily_count: 1 };

    return NextResponse.json({ 
      success: true, 
      count: row.count, 
      dailyCount: row.daily_count 
    });
  } catch (error: any) {
    console.error('Failed to increment visitor count:', error);
    return NextResponse.json({ success: false, count: 0, dailyCount: 0 }, { status: 500 });
  } finally {
    if (client) client.release();
  }
}