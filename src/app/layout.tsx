'use client';

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from '@/contexts/LanguageContext';
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { usePathname } from 'next/navigation';
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});



export default function RootLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {

  // If the URL starts with /dashboard, we hide the public Navbar
  const rulesEngineRoutes = ['/dashboard-eventVolunteers', '/dashboard-eventManager', '/login'];
const currentPath = usePathname();

// Returns true if currentPath starts with any item in the array
const shouldHideNavbar = rulesEngineRoutes.some(route => 
    currentPath?.startsWith(route)
  );

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <LanguageProvider>
      <body className="min-h-full flex flex-col">
       {!shouldHideNavbar && <Navbar />}
        {children}
        <Footer/>
        </body>

      
      </LanguageProvider>
    </html>
  );
}
