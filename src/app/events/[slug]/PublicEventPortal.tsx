// src/app/events/[slug]/PublicEventPortal.tsx
'use client';

import React, { useState } from 'react';
import { 
  Calendar, MapPin, Share2, ShieldCheck, Sun, Moon,
  Clock, Award, Users, ShieldCheck as VerifiedIcon, FileText 
} from 'lucide-react';
import UniversalRegistrationForm from '../../../components/EventRegistration';

interface PublicEventPageProps {
  event: {
    name: string;
    tagline: string;
    description: string;
    venue_name?: string;   
    location: string;
    date: string;
    start_time?: string; // 🚀 Added start_time reference type mapping
    end_time?: string;   // 🚀 Added end_time reference type mapping
    type: 'event' | 'celebration' | 'summit' | 'workshop' | 'conference';
    protocol: 'open-registration' | 'ticketed' | 'invite-only';
    hypeThreshold: number;
    coverImageUrl?: string; 
    posterImageUrl?: string;
    organizedBy?: string;
    branding?: {
      primaryColor: string; 
      accentColor: 'blue' | 'emerald' | 'purple' | 'amber';
    };
  };
}

export default function PublicEventPortal({ event }: PublicEventPageProps) {
  const [isDark, setIsDark] = useState(false);

  const accentColors = {
    blue: { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', text: 'text-blue-500 dark:text-blue-400', border: 'border-blue-500/20', lightBg: 'bg-blue-500/10', shadow: 'shadow-blue-500/10' },
    emerald: { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', text: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-500/20', lightBg: 'bg-emerald-500/10', shadow: 'shadow-emerald-500/10' },
    purple: { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', text: 'text-purple-500 dark:text-purple-400', border: 'border-purple-500/20', lightBg: 'bg-purple-500/10', shadow: 'shadow-purple-500/10' },
    amber: { bg: 'bg-amber-600', hover: 'hover:bg-amber-700', text: 'text-amber-500 dark:text-amber-400', border: 'border-amber-500/20', lightBg: 'bg-amber-500/10', shadow: 'shadow-amber-500/10' },
  };
  
  const theme = accentColors[event?.branding?.accentColor || 'blue'];
  const organizerText = event?.organizedBy || "Authorized Administrative Tenant";
  
  const parsedProtocolString = typeof event?.protocol === 'string' 
    ? event.protocol.replace('-', ' ') 
    : 'general access';

  const finalVenueName = event?.venue_name || "Venue Confirmed Upon Request";

  // 🚀 FIX: Fallback condition formatting time-window dynamically based on database availability bounds
  const formatTimeString = (timeStr?: string) => {
                if (!timeStr) return '';
                
                // Split the hours and minutes out, ignoring the seconds column
                const [hoursStr, minutesStr] = timeStr.split(':');
                let hours = parseInt(hoursStr, 10);
                const minutes = minutesStr || '00';
                
                if (isNaN(hours)) return timeStr; // Fallback safety check

                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; // The hour '0' should be converted to '12'
                
                // Pads single digits with a leading zero (e.g., "5" becomes "05")
                const paddedHours = hours < 10 ? `0${hours}` : hours; 

                return `${paddedHours}:${minutes} ${ampm}`;
              };

              // 🚀 Update your loop logic inside the component to use the helper:
              const formattedStart = formatTimeString(event.start_time);
              const formattedEnd = formatTimeString(event.end_time);

              const timeDisplay = formattedEnd 
                ? `${formattedStart} - ${formattedEnd}` 
                : `${formattedStart || '09:30 AM'} onwards`;
  return (
    <div className={`min-h-screen font-sans selection:bg-blue-500 selection:text-white transition-colors duration-300 ${isDark ? 'bg-[#020617] text-slate-100 dark' : 'bg-slate-50 text-slate-800'}`}>
      
      {/* COVER IMAGE BANNER */}
      <div className={`relative w-full h-[30vh] md:h-[45vh] overflow-hidden border-b ${isDark ? 'border-white/5' : 'border-slate-200'}`}>
        <img src={event?.coverImageUrl || '/assets/default-cover-placeholder.webp'} alt="Event Canvas Cover" className="w-full h-full object-cover filter brightness-[0.5] saturate-[1.1]" />
        <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-black/40 ${isDark ? 'from-[#020617]' : 'from-slate-50'}`} />
        
        <div className="absolute top-6 right-6 flex gap-3 z-30">
          <button 
            type="button" 
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle visual theme template mode"
            className={`p-3 backdrop-blur-md rounded-xl border transition-all cursor-pointer shadow-md select-none z-40
              ${isDark 
                ? 'bg-black/40 border-white/10 text-slate-300 hover:text-white hover:bg-black/60' 
                : 'bg-white/90 border-slate-200/80 text-slate-750 hover:text-slate-900 hover:bg-white shadow-sm'
              }`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          
          <button 
            type="button" 
            className={`p-3 backdrop-blur-md rounded-xl border transition-all cursor-pointer shadow-md select-none z-40
              ${isDark 
                ? 'bg-black/40 border-white/10 text-slate-300 hover:text-white hover:bg-black/60' 
                : 'bg-white/90 border-slate-200/80 text-slate-750 hover:text-slate-900 hover:bg-white shadow-sm'
              }`}
          >
            <Share2 size={16} />
          </button>
        </div>
      </div>

      {/* MAIN CONTENT GRID */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 md:-mt-32 relative z-20 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-8">
            <div className={`p-6 md:p-8 backdrop-blur-xl rounded-3xl border shadow-2xl space-y-5 ${isDark ? 'bg-[#070f2e]/60 border-white/10 shadow-black/40' : 'bg-white/80 border-slate-200 shadow-slate-200/50'}`}>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${theme.lightBg} ${theme.text} ${theme.border}`}>{event?.type || 'event'}</span>
                <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>{parsedProtocolString}</span>
              </div>
              
              <div className="space-y-2">
                <h1 className={`text-3xl md:text-4xl font-black tracking-tight italic leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{event?.name}</h1>
                <p className={`text-base font-medium border-l-2 pl-4 italic ${isDark ? 'text-slate-400 border-slate-700' : 'text-slate-600 border-slate-300'}`}>"{event?.tagline || 'Join us for this special experience.'}"</p>
              </div>

              <div className={`pt-2 space-y-2 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-wider text-slate-400 dark:text-slate-500">
                  <FileText size={12} className={theme.text} />
                  <span>Overview Brief</span>
                </div>
                <p className={`text-sm text-justify leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {event?.description || 'No descriptive outline parameter logged for this configuration entry.'}
                </p>
              </div>
              
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t text-sm ${isDark ? 'border-white/5 text-slate-300' : 'border-slate-100 text-slate-600'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}><Calendar size={16} /></div>
                  <div>
                    <p className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Date Matrix</p>
                    <p className="font-semibold">{event?.date || 'To be updated'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}><MapPin size={16} /></div>
                  <div>
                    <p className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Venue</p>
                    <p className="font-semibold truncate max-w-[240px]">{finalVenueName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}><MapPin size={16} /></div>
                  <div>
                    <p className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Location</p>
                    <p className="font-semibold truncate max-w-[240px]">{event?.location}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* 🚀 FIXED: Swapped out Reporting Loop parameters for dynamic schedule calculations */}
              <div className={`p-5 border rounded-2xl text-center space-y-1 ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`}>
                <Clock size={20} className={`mx-auto mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <h5 className={`text-[10px] uppercase font-black tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Timeline Scope</h5>
                <p className={`text-xs font-bold whitespace-nowrap ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{timeDisplay}</p>
              </div>
              <div className={`p-5 border rounded-2xl text-center space-y-1 ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`}>
                <Award size={20} className={`mx-auto mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <h5 className={`text-[10px] uppercase font-black tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Certification</h5>
                <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Verified Credentials</p>
              </div>
              <div className={`p-5 border rounded-2xl text-center space-y-1 ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`}>
                <Users size={20} className={`mx-auto mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                <h5 className={`text-[10px] uppercase font-black tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Registration Status</h5>
                <p className={`text-xs font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{event?.hypeThreshold || 0}+ people shown interest/registered.</p>
              </div>
            </div>

            {/* BOTTOM LEFT ORGANIZER STAMP */}
            <div className={`p-6 border rounded-3xl flex items-center justify-between gap-4 ${isDark ? 'bg-[#070f2e]/40 border-white/5' : 'bg-white border-slate-200'}`}>
              <div>
                <p className={`text-[9px] uppercase font-black tracking-[0.15em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Organized & Programmed By</p>
                <p className={`text-sm font-bold tracking-wide mt-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{organizerText}</p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-xl text-[10px] font-bold ${isDark ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <VerifiedIcon size={12} className={theme.text} />
                <span>Verified Entity</span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6 lg:sticky lg:top-6">
            <div className={`hidden lg:block w-full aspect-[4/5] rounded-3xl border overflow-hidden group relative shadow-2xl ${isDark ? 'border-white/10 shadow-black/40' : 'border-slate-200 shadow-slate-200/40'}`}>
              <img src={event?.posterImageUrl || '/assets/default-poster-placeholder.webp'} alt="Printable Event Poster" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 filter saturate-[1.05]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-60" />
            </div>

            <div className={`p-6 md:p-8 border rounded-3xl shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[420px] ${isDark ? 'bg-[#091133] border-blue-500/20 shadow-black/40' : 'bg-white border-slate-200 shadow-slate-200/30'}`}>
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full filter blur-xl pointer-events-none" />
              
              <div className="space-y-4 w-full">
                <div className="space-y-1 mb-2">
                  <h3 className={`text-lg font-black tracking-tight italic flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>Secure Entry Access</h3>
                  <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fill accurate details parameters to request verification.</p>
                </div>

                <div className={`universal-form-wrapper ${isDark ? 'theme-dark-injections' : 'theme-light-injections'}`}>
                  {event && <UniversalRegistrationForm event={event} />}
                </div>

                <div className={`p-3 border rounded-xl flex gap-2.5 items-start text-[10px] ${isDark ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <ShieldCheck size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <p>{event?.protocol === 'open-registration' ? "Open configuration active. Confirmation strings pass instantly over edge layers." : "Verification required. Core committee audit checks apply before gate ledger generation."}</p>
                </div>
              </div>

              <div className={`mt-8 pt-4 border-t ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                <span className={`text-[8px] uppercase font-black tracking-[0.2em] block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Host Signature Authority</span>
                <span className={`text-xs font-bold mt-1 block truncate px-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{organizerText}</span>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}