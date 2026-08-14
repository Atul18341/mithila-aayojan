// src/app/events/[slug]/PublicEventPortal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, MapPin, Share2, ShieldCheck, Sun, Moon,
  Clock, Award, Users, CheckCircle2, ChevronDown, 
  Trophy, ExternalLink, HelpCircle, Navigation,
  Check, Hourglass, Sparkles, AlertCircle,
  ArrowUpRight, Bookmark
} from 'lucide-react';
import UniversalRegistrationForm from '../../../components/EventRegistration';
import { LinkedinIcon } from '@/lib/SocialIcons';

interface Speaker {
  name: string;
  role: string;
  company: string;
  imageUrl?: string;
  linkedin?: string;
}

interface AgendaItem {
  time: string;
  title: string;
  description?: string;
  speaker?: string;
}

interface FAQItem {
  question: string;
  answer: string;
}

interface PublicEventPageProps {
  event: {
    name: string;
    tagline: string;
    description: string;
    venue_name?: string;   
    location: string;
    date: string;
    registrationEndDate?: string;
    registration_end_date?: string;
    start_time?: string;
    end_time?: string;
    registrationCount?: number;
    type: 'event' | 'celebration' | 'summit' | 'workshop' | 'conference';
    protocol: 'open-registration' | 'ticketed' | 'invite-only';
    hypeThreshold: number;
    coverImageUrl?: string; 
    posterImageUrl?: string;
    poster_image?: string;
    poster?: string;
    image?: string;
    organizedBy?: string;
    isMultiCompetition?: boolean;
    competitions?: Array<{ id: string; title: string; code: string; category?: string }>;
    speakers?: Speaker[];
    agenda?: AgendaItem[];
    faqs?: FAQItem[];
    branding?: {
      primaryColor: string; 
      accentColor: 'blue' | 'emerald' | 'purple' | 'amber';
    };
  };
}

const DEFAULT_POSTER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='500' viewBox='0 0 400 500'%3E%3Crect width='400' height='500' fill='%230f172a'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='16'%3EEvent Poster%3C/text%3E%3C/svg%3E";
const DEFAULT_COVER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='400' viewBox='0 0 1200 400'%3E%3Crect width='1200' height='400' fill='%230f172a'/%3E%3C/svg%3E";

export default function PublicEventPortal({ event }: PublicEventPageProps) {
  const [isDark, setIsDark] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [copiedShare, setCopiedShare] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; totalMs: number } | null>(null);

  // ⏳ Robust Date Resolver & Real-time Countdown
  useEffect(() => {
    const rawDateStr = event?.registrationEndDate || event?.registration_end_date || event?.date;
    if (!rawDateStr || typeof rawDateStr !== 'string') return;

    let targetTimestamp: number;

    // Check if format is pure date (YYYY-MM-DD) or already contains time/ISO specifiers
    if (rawDateStr.includes('T') || rawDateStr.includes(':')) {
      targetTimestamp = new Date(rawDateStr).getTime();
    } else {
      targetTimestamp = new Date(`${rawDateStr}T23:59:59`).getTime();
    }

    if (isNaN(targetTimestamp)) return;

    const updateCountdown = () => {
      const now = Date.now();
      const difference = targetTimestamp - now;

      if (difference <= 0) {
        setTimeLeft(null);
        return;
      }

      setTimeLeft({
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
        totalMs: difference,
      });
    };

    // Run immediately on mount
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [event]);

  const handleShare = async () => {
    if (typeof window !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: event?.name,
          text: event?.tagline || `Join ${event?.name}`,
          url: window.location.href,
        });
      } catch (err) {
        // Handled fallback
      }
    } else if (typeof window !== 'undefined') {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  const accentStyles = {
    blue: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/60',
      accentGlow: 'from-blue-600/10 to-transparent',
      textAccent: 'text-blue-600 dark:text-blue-400',
      dot: 'bg-blue-500',
    },
    emerald: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/60',
      accentGlow: 'from-emerald-600/10 to-transparent',
      textAccent: 'text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-500',
    },
    purple: {
      badge: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60',
      accentGlow: 'from-purple-600/10 to-transparent',
      textAccent: 'text-purple-600 dark:text-purple-400',
      dot: 'bg-purple-500',
    },
    amber: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/60',
      accentGlow: 'from-amber-600/10 to-transparent',
      textAccent: 'text-amber-600 dark:text-amber-400',
      dot: 'bg-amber-500',
    },
  };

  const activeTheme = accentStyles[event?.branding?.accentColor || 'blue'];
  const organizerText = event?.organizedBy || "Event Organizing Committee";
  const finalVenueName = event?.venue_name || "Main Event Venue";

  const resolvedPosterUrl = 
    event?.posterImageUrl || 
    event?.poster_image || 
    event?.poster || 
    event?.image || 
    DEFAULT_POSTER_SVG;

  const resolvedCoverUrl = event?.coverImageUrl || DEFAULT_COVER_SVG;
  const rawCount = event?.registrationCount ?? 0;
  const threshold = event?.hypeThreshold ?? 20;
  const displayCountText = rawCount >= threshold ? `${rawCount}+ Confirmed Attendees` : 'Registration Active';

  const formatTimeString = (timeStr?: string) => {
    if (!timeStr) return '';
    const [hoursStr, minutesStr] = timeStr.split(':');
    let hours = parseInt(hoursStr, 10);
    const minutes = minutesStr || '00';
    if (isNaN(hours)) return timeStr;

    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const paddedHours = hours < 10 ? `0${hours}` : hours;
    return `${paddedHours}:${minutes} ${ampm}`;
  };

  const formattedStart = formatTimeString(event?.start_time);
  const formattedEnd = formatTimeString(event?.end_time);
  const timeDisplay = formattedEnd 
    ? `${formattedStart} - ${formattedEnd}` 
    : `${formattedStart || '09:30 AM'} Onwards`;

  const defaultFaqs: FAQItem[] = event?.faqs || [
    {
      question: "How do I receive my pass after registering?",
      answer: "Your entry pass with a unique QR code is generated right after registration. You can download it immediately or retrieve it anytime from the check-in portal."
    },
    {
      question: "Will physical verification be conducted at the entrance?",
      answer: "Yes, present your digital QR pass on your mobile device or bring a printed copy to check-in smoothly at the desk."
    },
    {
      question: "Can I register for multiple tracks or sub-events?",
      answer: "Yes, if multiple tracks are available, you will have the option to pick your preferred category during form submission."
    }
  ];

  // 🚀 Sticky Countdown Alert: Triggers when remaining time is less than or equal to 24 hours (86,400,000 ms)
  const isFinalCountdown = !!(timeLeft && timeLeft.totalMs > 0 && timeLeft.totalMs <= 24 * 60 * 60 * 1000);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${isDark ? 'bg-[#090D16] text-slate-100 dark' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* 🚀 TOP STICKY NOTIFICATION BANNER (Appears when ≤ 24 Hours remain) */}
      {isFinalCountdown && (
        <aside aria-label="Final registration countdown alert" className="sticky top-0 z-50 w-full backdrop-blur-md bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white shadow-xl border-b border-white/15 animate-in slide-in-from-top duration-300">
          <div className="max-w-6xl mx-auto px-4 py-2 flex items-center justify-between flex-wrap gap-2 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
              </span>
              <span className="uppercase tracking-wider font-bold text-[11px] flex items-center gap-1.5">
                <AlertCircle size={14} className="text-amber-200" />
                <span>Registrations Closing Soon:</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
              <div className="bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded border border-white/20 min-w-[34px] text-center">
                {String(timeLeft.hours).padStart(2, '0')}<span className="text-[9px] font-sans font-normal opacity-80 ml-0.5">h</span>
              </div>
              <span>:</span>
              <div className="bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded border border-white/20 min-w-[34px] text-center">
                {String(timeLeft.minutes).padStart(2, '0')}<span className="text-[9px] font-sans font-normal opacity-80 ml-0.5">m</span>
              </div>
              <span>:</span>
              <div className="bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded border border-white/20 min-w-[34px] text-center text-amber-200">
                {String(timeLeft.seconds).padStart(2, '0')}<span className="text-[9px] font-sans font-normal opacity-80 ml-0.5">s</span>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-1 text-[11px] text-white/90">
              <Sparkles size={13} className="text-amber-200" />
              <span>Secure your entry spot before deadline</span>
            </div>
          </div>
        </aside>
      )}

      {/* HERO COVER BANNER */}
      <div className="relative w-full h-64 md:h-80 lg:h-96 overflow-hidden bg-slate-950">
        <img 
          src={resolvedCoverUrl} 
          alt="Event Header" 
          className="w-full h-full object-cover opacity-60 filter saturate-125" 
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DEFAULT_COVER_SVG;
          }}
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${isDark ? 'from-[#090D16] via-[#090D16]/50' : 'from-slate-50 via-slate-50/40'} to-transparent`} />
        
        {/* TOP CONTROLS */}
        <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-30">
          <button 
            type="button" 
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle Theme"
            className="p-2.5 rounded-full backdrop-blur-md bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-lg"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button 
            type="button" 
            onClick={handleShare}
            aria-label="Share Event"
            className="px-3.5 py-2.5 rounded-full backdrop-blur-md bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-lg flex items-center gap-2 text-xs font-semibold"
          >
            {copiedShare ? <Check size={16} className="text-emerald-400" /> : <Share2 size={16} />}
            <span className="hidden sm:inline">{copiedShare ? 'Copied' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-24 md:-mt-36 relative z-20 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT CONTENT COLUMN */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* HERO OVERVIEW CARD */}
            <div className={`p-6 sm:p-8 rounded-3xl border transition-all duration-200 backdrop-blur-md relative overflow-hidden ${
              isDark ? 'bg-slate-900/80 border-slate-800/80 shadow-2xl' : 'bg-white/95 border-slate-200 shadow-xl'
            }`}>
              <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl ${activeTheme.accentGlow} rounded-full blur-3xl pointer-events-none`} />

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${activeTheme.badge}`}>
                  {event?.type || 'Conference'}
                </span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                  isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}>
                  {event?.protocol ? event.protocol.replace('-', ' ') : 'Open Access'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight mb-3">
                {event?.name}
              </h1>
              
              {event?.tagline && (
                <p className={`text-base sm:text-lg font-medium mb-6 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {event.tagline}
                </p>
              )}

              {/* QUICK INFO BAR */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl border ${
                isDark ? 'bg-slate-800/40 border-slate-800' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'} shadow-sm`}>
                    <Calendar size={18} className={activeTheme.textAccent} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Date</span>
                    <span className="text-sm font-semibold">{event?.date || 'To be announced'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'} shadow-sm`}>
                    <Clock size={18} className={activeTheme.textAccent} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Time</span>
                    <span className="text-sm font-semibold">{timeDisplay}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:col-span-2">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'} shadow-sm shrink-0`}>
                    <MapPin size={18} className={activeTheme.textAccent} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">Venue & Location</span>
                    <span className="text-sm font-semibold block truncate">{finalVenueName}</span>
                    <a 
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${finalVenueName}, ${event?.location}`)}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-blue-500 hover:text-blue-600 mt-0.5"
                    >
                      <span>{event?.location}</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              </div>

              {/* ABOUT SECTION */}
              {event?.description && (
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800/80">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">About This Event</h2>
                  <p className={`text-sm sm:text-base leading-relaxed whitespace-pre-line ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                    {event.description}
                  </p>
                </div>
              )}
            </div>

            {/* EVENT HIGHLIGHT STATS */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <Award size={20} className={`mx-auto mb-2 ${activeTheme.textAccent}`} />
                <div className="text-xs sm:text-sm font-bold">Verified Entry</div>
                <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Official Pass</div>
              </div>

              <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <Users size={20} className={`mx-auto mb-2 ${activeTheme.textAccent}`} />
                <div className="text-xs sm:text-sm font-bold truncate px-1">{displayCountText}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Attendee Status</div>
              </div>

              <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <ShieldCheck size={20} className={`mx-auto mb-2 ${activeTheme.textAccent}`} />
                <div className="text-xs sm:text-sm font-bold">Guaranteed</div>
                <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">Secure Check-in</div>
              </div>
            </div>

            {/* SPEAKERS / GUESTS */}
            {event?.speakers && event.speakers.length > 0 && (
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <h3 className="text-lg font-bold tracking-tight mb-5 flex items-center gap-2">
                  <Users size={20} className={activeTheme.textAccent} />
                  <span>Featured Speakers</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.speakers.map((speaker, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-2xl border flex items-center justify-between gap-4 transition-all hover:border-slate-400/50 ${
                        isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <img 
                          src={speaker.imageUrl || DEFAULT_POSTER_SVG} 
                          alt={speaker.name} 
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = DEFAULT_POSTER_SVG;
                          }}
                        />
                        <div className="min-w-0">
                          <h4 className="text-sm font-bold truncate">{speaker.name}</h4>
                          <p className="text-xs text-slate-400 truncate">{speaker.role}</p>
                          <p className="text-[11px] font-medium text-slate-500 truncate">{speaker.company}</p>
                        </div>
                      </div>
                      {speaker.linkedin && (
                        <a 
                          href={speaker.linkedin} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                        >
                          <LinkedinIcon size={16} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AGENDA / TIMELINE */}
            {event?.agenda && event.agenda.length > 0 && (
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <h3 className="text-lg font-bold tracking-tight mb-6 flex items-center gap-2">
                  <Clock size={20} className={activeTheme.textAccent} />
                  <span>Event Schedule</span>
                </h3>
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                  {event.agenda.map((item, idx) => (
                    <div key={idx} className="relative group">
                      <div className={`absolute -left-[29px] top-1.5 w-3 h-3 rounded-full border-2 ${isDark ? 'border-slate-900 bg-blue-500' : 'border-white bg-blue-600'}`} />
                      <div className={`p-4 rounded-2xl border transition-all ${
                        isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/70 border-slate-100'
                      }`}>
                        <span className={`text-xs font-bold tracking-wide uppercase ${activeTheme.textAccent}`}>{item.time}</span>
                        <h4 className="text-sm font-bold mt-1 text-slate-900 dark:text-slate-100">{item.title}</h4>
                        {item.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COMPETITION TRACKS */}
            {event?.isMultiCompetition && event.competitions && event.competitions.length > 0 && (
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <h3 className="text-lg font-bold tracking-tight mb-5 flex items-center gap-2">
                  <Trophy size={20} className="text-amber-500" />
                  <span>Competition Categories</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.competitions.map((comp) => (
                    <div 
                      key={comp.id} 
                      className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50 border-slate-100'}`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                          {comp.code}
                        </span>
                        {comp.category && <span className="text-xs text-slate-400">{comp.category}</span>}
                      </div>
                      <h4 className="text-sm font-bold">{comp.title}</h4>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ ACCORDION */}
            <div className={`p-6 sm:p-8 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
              <h3 className="text-lg font-bold tracking-tight mb-5 flex items-center gap-2">
                <HelpCircle size={20} className={activeTheme.textAccent} />
                <span>Frequently Asked Questions</span>
              </h3>
              <div className="space-y-3">
                {defaultFaqs.map((faq, idx) => (
                  <div 
                    key={idx} 
                    className={`rounded-2xl border transition-all overflow-hidden ${
                      isDark ? 'bg-slate-800/20 border-slate-800' : 'bg-slate-50/60 border-slate-100'
                    }`}
                  >
                    <button
                      onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
                      className="w-full text-left p-4 flex justify-between items-center text-sm font-semibold gap-4"
                    >
                      <span>{faq.question}</span>
                      <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${openFaqIndex === idx ? 'rotate-180' : ''}`} />
                    </button>
                    {openFaqIndex === idx && (
                      <div className={`px-4 pb-4 text-xs sm:text-sm leading-relaxed border-t pt-3 ${
                        isDark ? 'text-slate-400 border-slate-800' : 'text-slate-600 border-slate-100'
                      }`}>
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* ORGANIZER BADGE */}
            <div className={`p-5 rounded-2xl border flex items-center justify-between gap-4 ${
              isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Organized by</span>
                <span className="text-sm font-bold mt-0.5 block">{organizerText}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={14} />
                <span>Verified Host</span>
              </div>
            </div>

          </div>

          {/* RIGHT STICKY REGISTRATION SIDEBAR */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
            
            {/* POSTER CARD */}
            <div className={`rounded-3xl border overflow-hidden shadow-xl ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="aspect-[4/5] w-full overflow-hidden bg-slate-950 relative group">
                <img 
                  src={resolvedPosterUrl} 
                  alt={`${event?.name} Poster`} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = DEFAULT_POSTER_SVG;
                  }}
                />
              </div>
            </div>

            {/* REGISTRATION ACTION FORM */}
            <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden ${
              isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="mb-5">
                <h3 className="text-lg font-bold tracking-tight">Reserve Your Spot</h3>
                <p className="text-xs text-slate-400 mt-1">Register below to receive instant access confirmation.</p>
              </div>

              {/* SIDEBAR COUNTDOWN BADGE */}
              {timeLeft && (
                <div className={`mb-5 p-3 rounded-2xl border flex items-center justify-between ${
                  isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Hourglass size={14} className={activeTheme.textAccent} />
                    <span>Closing in</span>
                  </div>
                  <div className="font-mono text-xs font-bold flex items-center gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">{timeLeft.days}d</span>
                    <span>:</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">{String(timeLeft.hours).padStart(2, '0')}h</span>
                    <span>:</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700">{String(timeLeft.minutes).padStart(2, '0')}m</span>
                    <span>:</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-blue-500">{String(timeLeft.seconds).padStart(2, '0')}s</span>
                  </div>
                </div>
              )}

              {/* EMBEDDED UNIVERSAL FORM */}
              <div className="universal-form-wrapper">
                {event && <UniversalRegistrationForm event={event} />}
              </div>

              {/* SECURITY NOTE */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <span>Instant QR pass issue upon submission</span>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}