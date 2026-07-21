import { Geist, Geist_Mono } from "next/font/google";
import { Metadata, Viewport } from 'next';
import "./globals.css";
import React from 'react';
import ClientLayoutShell from './layout-client-bridge'; // 🚀 Direct import!

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Mithila Aayojan',
  description: 'Multi-Tenant Offline-First Event Registry Ledger',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mithila Aayojan',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

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
      <ClientLayoutShell>
          {children}
        </ClientLayoutShell>
    </html>
  );
}