'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { 
  ChevronDown, 
  Globe, 
  LayoutGrid, 
  Check, 
  Menu, 
  X,
  ShieldCheck,
  Sun,
  Moon
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const { t, lang, selectLang } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isSolutionsOpen, setIsSolutionsOpen] = useState(false);
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 🚀 Added native dark mode binary state tracking framework
  
  const langRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
  if ('serviceWorker' in navigator && window.location.hostname === 'localhost') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('🚀 Service Worker successfully registered with scope: ', reg.scope))
        .catch((err) => console.error('❌ Service Worker registration failed: ', err));
    });
  }
}, []);
  useEffect(() => {
    setMounted(true);
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setIsLangOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!mounted) {
    return <nav className="h-20 bg-white border-b border-gray-100" />;
  }

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'mai', label: 'मैथिली' },
  ];

  return (
    <>
      <div className="h-20 w-full lg:hidden block" /> 

      {/* 🚀 FIXED: Dynamic framework container adapts base color arrays per state toggle */}
      <nav className={`fixed top-0 left-0 w-full z-[100] backdrop-blur-md border-b transition-colors duration-300 ${
        isDark ? 'bg-slate-950/90 border-slate-900 text-slate-100' : 'bg-white/90 border-gray-100 text-gray-800'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          
          {/* --- LOGO SECTION --- */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex flex-col leading-tight">
              <span className={`text-[10px] uppercase tracking-[0.2em] font-medium ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Mithila</span>
              <span className="text-2xl font-black text-orange-600 tracking-tight">
                {t.title?.split(' ')[1] || 'Aayojan'}
              </span>
            </div>
            <div className={`ml-1 w-8 h-8 rounded-lg flex items-center justify-center transform rotate-45 group-hover:rotate-0 transition-all duration-300 ${
              isDark ? 'bg-slate-800' : 'bg-gray-900'
            }`}>
              <LayoutGrid size={16} className="text-white -rotate-45 group-hover:rotate-0 transition-transform" />
            </div>
          </Link>

          {/* --- DESKTOP NAV --- */}
          <div className="hidden lg:flex items-center gap-10">
            <ul className={`flex items-center gap-8 text-sm font-semibold ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
              <li><Link href="/" className="hover:text-orange-600 transition-colors">Home</Link></li>
              <li><Link href="#features" className="hover:text-orange-600 transition-colors">{t.navFeatures}</Link></li>
              
             <li><Link href="/events" className="hover:text-orange-600 transition-colors">{t.navEvents}</Link></li>
              <li><Link href="#pricing" className="hover:text-orange-600 transition-colors">{t.navPricing}</Link></li>
            </ul>

            <div className={`flex items-center gap-5 border-l pl-8 ${isDark ? 'border-slate-800' : 'border-gray-200'}`}>
              
              {/* 🚀 DESKTOP THEME TOGGLE ACCESS NODE */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label="Toggle structural layout visual tone"
                className={`p-2.5 rounded-xl border transition-all cursor-pointer shadow-sm active:scale-95 ${
                  isDark 
                    ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800 hover:text-amber-300' 
                    : 'bg-slate-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700'
                }`}
              >
                {isDark ? <Sun size={15} /> : <Moon size={15} />}
              </button>

              <Link 
                href="/login" 
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                  isDark ? 'text-slate-400 hover:text-orange-500' : 'text-gray-500 hover:text-orange-600'
                }`}
              >
                <ShieldCheck size={15} className={isDark ? 'text-slate-500' : 'text-gray-400'} />
                <span>Console Login</span>
              </Link>

              {/* DESKTOP LANGUAGE DROPDOWN */}
              <div className="relative" ref={langRef}>
                <button
                  onClick={() => setIsLangOpen(!isLangOpen)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-lg transition-all focus:outline-none ${
                    isDark ? 'text-slate-400 hover:text-orange-500' : 'text-gray-500 hover:text-orange-600'
                  }`}
                >
                  <Globe size={16} className="text-orange-600" />
                  <span className="uppercase">{lang}</span>
                  <ChevronDown size={12} className={`transition-transform ${isLangOpen ? 'rotate-180' : ''}`} />
                </button>

                {isLangOpen && (
                  <div className={`absolute right-0 mt-2 w-40 border shadow-2xl rounded-xl py-2 z-[110] animate-in fade-in zoom-in-95 ${
                    isDark ? 'bg-slate-900 border-slate-800 shadow-black/50' : 'bg-white border-gray-100'
                  }`}>
                    {languages.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => { selectLang(l.code); setIsLangOpen(false); }}
                        className={`w-full flex items-center justify-between px-4 py-2 text-sm transition-colors ${
                          lang === l.code 
                            ? 'bg-orange-50 dark:bg-slate-800 text-orange-700 dark:text-orange-400 font-bold' 
                            : `${isDark ? 'text-slate-300 hover:bg-slate-800' : 'text-gray-600 hover:bg-gray-50'}`
                        }`}
                      >
                        {l.label}
                        {lang === l.code && <Check size={14} className="text-orange-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className="bg-orange-600 text-white px-7 py-3 rounded-full text-sm font-bold shadow-lg shadow-orange-200/50 hover:bg-gray-900 dark:hover:bg-slate-800 transition-all active:scale-95" onClick={() => router.push('/register')}>
                Request a Demo
              </button>
            </div>
          </div>

          {/* --- MOBILE TOGGLE --- */}
          <button className={`lg:hidden p-2 ${isDark ? 'text-slate-300' : 'text-gray-600'}`} onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* --- MOBILE MENU --- */}
        {mobileMenuOpen && (
          <div className={`lg:hidden border-t px-6 py-8 space-y-8 animate-in slide-in-from-top-5 max-h-[calc(100vh-5rem)] overflow-y-auto ${
            isDark ? 'bg-slate-950 border-slate-900' : 'bg-white border-gray-100'
          }`}>
             <ul className={`space-y-4 text-lg font-semibold ${isDark ? 'text-slate-200' : 'text-gray-700'}`}>
               <li><Link href="#features" onClick={() => setMobileMenuOpen(false)}>{t.navFeatures}</Link></li>
               <li><Link href="#solutions" onClick={() => setMobileMenuOpen(false)}>{t.navSolutions}</Link></li>
               <li><Link href="#pricing" onClick={() => setMobileMenuOpen(false)}>{t.navPricing}</Link></li>
               
               <li className="pt-2">
                 <Link 
                   href="/login" 
                   onClick={() => setMobileMenuOpen(false)}
                   className="flex items-center gap-2 text-orange-600 font-bold"
                 >
                   <ShieldCheck size={20} />
                   <span>Terminal Portal</span>
                 </Link>
               </li>
             </ul>

             {/* 🚀 MOBILE INTEGRATED EXPLICIT THEME PANEL */}
             <div className={`pt-6 border-t flex items-center justify-between ${isDark ? 'border-slate-900' : 'border-gray-100'}`}>
               <span className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>Template Scheme Appearance</span>
               <button
                 type="button"
                onClick={toggleTheme}
                 className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                   isDark 
                     ? 'bg-slate-900 border-slate-800 text-amber-400' 
                     : 'bg-slate-50 border-gray-200 text-gray-600'
                 }`}
               >
                 {isDark ? (
                   <>
                     <Sun size={14} /> <span>Switch Light</span>
                   </>
                 ) : (
                   <>
                     <Moon size={14} /> <span>Switch Dark</span>
                   </>
                 )}
               </button>
             </div>

             <div className={`pt-6 border-t ${isDark ? 'border-slate-900' : 'border-gray-100'}`}>
                <div className={`flex items-center gap-2 mb-4 text-xs font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  <Globe size={14} /> Select Language
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => { selectLang(l.code); setMobileMenuOpen(false); }}
                      className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
                        lang === l.code 
                          ? 'bg-orange-50 dark:bg-slate-900 border-orange-200 dark:border-orange-500/30 text-orange-700 dark:text-orange-400 font-bold shadow-sm' 
                          : `${isDark ? 'bg-slate-900 border-transparent text-slate-400' : 'bg-gray-50 border-transparent text-gray-500'}`
                      }`}
                    >
                      <span className="text-xs uppercase opacity-60 mb-1">{l.code}</span>
                      <span className="text-sm">{l.label}</span>
                    </button>
                  ))}
                </div>
             </div>

             <button className="w-full bg-orange-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-orange-100" onClick={() => router.push('/register')}>
               Request a Demo
             </button>
          </div>
        )}
      </nav>
    </>
  );
}