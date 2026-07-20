'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface SplashScreenProps {
  onComplete?: () => void;
  eventName?: string;
}

export default function SplashScreenLight({ onComplete, eventName = "Mithila Aayojan" }: SplashScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // 1. Simulate system initialization progress (IndexedDB sync, Service Worker check)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 4;
      });
    }, 80);

    // 2. Trigger fade out and exit layout
    const exitTimeout = setTimeout(() => {
      setIsVisible(false);
      if (onComplete) onComplete();
    }, 2600);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(exitTimeout);
    };
  }, [onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-white text-slate-900 select-none overflow-hidden animate-in fade-in duration-500">
      
      {/* 🎨 TOP BORDER: Traditional Mithila Painting Border Motif (Kachni Style - Crisp Cyan) */}
      <div className="w-full opacity-40 h-14 text-cyan-600">
        <svg width="100%" height="100%" viewBox="0 0 1200 60" preserveAspectRatio="none">
          <defs>
            <pattern id="mithilaWaveLight" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 0,20 Q 10,5 20,20 Q 30,35 40,20" fill="none" stroke="currentColor" strokeWidth="2.5" />
              <path d="M 0,25 Q 10,10 20,25 Q 30,40 40,25" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="0" y1="40" x2="40" y2="40" stroke="currentColor" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mithilaWaveLight)" />
        </svg>
      </div>

      {/* 🌟 MAIN CENTRAL BRANDING MATRIX */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 text-center space-y-8 relative">
        
        {/* Ambient Cultural Fish Motif Watermark (Optimized Contrast for Light BG) */}
        <div className="absolute opacity-[0.04] transform -translate-x-32 -translate-y-12 rotate-12 pointer-events-none text-slate-900">
          <svg width="240" height="240" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10,50 Q30,20 70,35 Q90,50 70,65 Q30,80 10,50 Z" />
            <path d="M70,35 Q60,50 70,65" />
            <path d="M15,50 C25,40 35,40 45,50 C35,60 25,60 15,50" strokeDasharray="1 2" />
            <path d="M75,45 Q85,35 90,40 Q85,50 90,60 Q85,65 75,55" fill="currentColor" opacity="0.1" />
          </svg>
        </div>

        {/* 🚀 THE MA COMPASS PNG LOGO CONTAINER (Responsive Fluid Geometry) */}
        <div className="relative w-72 h-72 sm:w-40 sm:h-40 md:w-48 md:h-48 transform hover:scale-105 transition-transform duration-700 filter drop-shadow-[0_10px_20px_rgba(37,99,235,0.12)]">
          <Image 
            src="/icons/splash-icon.png" 
            alt={`${eventName} Logo`}
            fill // Replaced fixed width/height parameters with fluid absolute parent filling
            sizes="(max-width: 640px) 128px, (max-width: 768px) 160px, 192px" // Instructs the engine to serve correct source allocations
            priority 
            className="object-contain"
          />
        </div>

        {/* METRIC INITIALIZATION LOADER TRACK */}
        <div className="w-44 h-[3px] bg-slate-100 rounded-full overflow-hidden relative border border-slate-200/50">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-500 rounded-full transition-all duration-100 ease-out shadow-[0_0_4px_rgba(59,130,246,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 🎨 BOTTOM BORDER: Heritage Floral Mandala Motif (Bharni Style - Rich Indigo) */}
      <div className="w-full opacity-35 h-16 text-indigo-600 flex items-end">
        <svg width="100%" height="100%" viewBox="0 0 1200 60" preserveAspectRatio="none">
          <defs>
            <pattern id="mithilaFloralLight" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="6" fill="currentColor" />
              <path d="M 30,10 C 25,20 35,20 30,10 Z" fill="currentColor" />
              <path d="M 30,50 C 25,40 35,40 30,50 Z" fill="currentColor" />
              <path d="M 10,30 C 20,25 20,35 10,30 Z" fill="currentColor" />
              <path d="M 50,30 C 40,25 40,35 50,30 Z" fill="currentColor" />
              <line x1="0" y1="0" x2="60" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
              <line x1="60" y1="0" x2="0" y2="60" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mithilaFloralLight)" />
        </svg>
      </div>

    </div>
  );
}