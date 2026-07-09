// src/app/layout.tsx
// 🚨 NOTICE: 'use client' is deliberately absent from the top to ensure font-loading compliance.

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import React from 'react';
import dynamic from 'next/dynamic';

// --- SERVER SIDE ASSET CONFIGURATIONS ---
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Mithila Aayojan",
  description: "Platform Infrastructure Matrix",
};

// 1. MAIN EXPORT: ROOT LAYOUT (Server Component)
export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Hand off client routing boundaries safely to our dynamically bound wrapper */}
      <ClientLayoutShell>
        {children}
      </ClientLayoutShell>
    </html>
  );
}

// 2. THE DYNAMIC CLIENT ROUTER BRIDGE
// We dynamically lazy-load this sub-component, telling Next.js it client processing.
const ClientLayoutShell = dynamic(
  () => import('./layout-client-bridge'), // Safely points to a clean inner module
  { 
    ssr: true,
    loading: () => (
      <body className="min-h-full flex flex-col bg-slate-50 animate-pulse" />
    )
  }
);