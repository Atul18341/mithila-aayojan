// src/app/layout-client-bridge.tsx
'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { LanguageProvider } from '@/contexts/LanguageContext';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const currentPath = usePathname();

  // Route matching metrics matrix
  const rulesEngineRoutes = [
    '/dashboard-eventVolunteers', 
    '/dashboard-eventManager', 
    '/login', 
    '/signup'
  ];

  const shouldHideNavbar = rulesEngineRoutes.some(route => 
    currentPath?.startsWith(route)
  );

  return (
    <LanguageProvider>
      <body className="min-h-full flex flex-col">
        {!shouldHideNavbar && <Navbar />}
        <main className="flex-1 flex flex-col w-full relative">
          {children}
        </main>
        {!shouldHideNavbar && <Footer />}
      </body>
    </LanguageProvider>
  );
}