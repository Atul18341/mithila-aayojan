// src/app/api/checkout/route.ts
import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: Request) {
  try {
    const { amount, currency = "INR", receipt } = await request.json();

    // Razorpay expects amounts in the smallest currency unit (paise for INR). 
    // e.g., ₹215 becomes 21500 paise.
    const options = {
      amount: Math.round(amount * 100), 
      currency,
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error("Razorpay order generation error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to initiate payment gateway order." },
      { status: 500 }
    );
  }
}