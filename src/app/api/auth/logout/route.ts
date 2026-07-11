// src/app/api/auth/logout/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const cookieStore = await cookies();

    // 1. Delete your master session authentication token cookie parameter configuration completely
    cookieStore.delete('auth_token'); 
    
    // 2. Clear out any alternative authorization tracker cookies safely if set by mid-tier middlewares
    cookieStore.set('auth_token', '', { 
      expires: new Date(0),
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Server session tracking links destroyed successfully.' 
    });
  } catch (error: any) {
    console.error('❌ Backend logout sequence dropped:', error.message);
    return NextResponse.json(
      { error: 'Logout endpoint processing failed', details: error.message }, 
      { status: 500 }
    );
  }
}