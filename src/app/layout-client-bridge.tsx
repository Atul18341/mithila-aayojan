'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import SplashScreenLight from '@/components/SplashScreen';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function ClientLayoutShell({ children }: { children: React.ReactNode }) {
  const currentPath = usePathname();
  const [isInitializing, setIsInitializing] = useState(true);
  
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
    <ThemeProvider>
      <LanguageProvider>
        {/* 1. The body tag stays static at the root level to prevent hydration errors */}
        <body className="min-h-full flex flex-col bg-white">
          
          {isInitializing ? (
            /* 2. Splash screen loads standalone inside the body wrapper */
            <SplashScreenLight 
              eventName="Mithila Aayojan" 
              onComplete={() => setIsInitializing(false)} 
            />
          ) : (
            /* 3. Main core app layout initializes cleanly after loading finishes */
            <>
              {!shouldHideNavbar && <Navbar />}
              <main className="flex-1 flex flex-col w-full relative animate-in fade-in duration-300">
                {children}
              </main>
              {!shouldHideNavbar && <Footer />}
            </>
          )}
          
        </body>
      </LanguageProvider>
    </ThemeProvider>
  );
}