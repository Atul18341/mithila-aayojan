// src/app/api/auth/logout/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // 1. Delete your session token cookie parameter configuration completely
    cookieStore.delete('auth_token'); 
    
    // If you use alternative session trackers, clear them out here as well
    // cookieStore.set('session', '', { expires: new Date(0) });

    return NextResponse.json({ success: true, message: 'Server session tracking links destroyed.' });
  } catch (error) {
    return NextResponse.json({ error: 'Logout endpoint processing failed' }, { status: 500 });
  }
}