// src/app/events/[slug]/PublicEventPortal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Calendar, MapPin, Share2, ShieldCheck, Sun, Moon,
  Clock, Award, Users, CheckCircle2, ChevronDown, 
  Trophy, HelpCircle, Check, Hourglass, Sparkles, 
  AlertCircle, ArrowUpRight, FileText, ChevronUp, 
  AlertTriangle, IdCard
} from 'lucide-react';
import UniversalRegistrationForm from '../../../components/EventRegistration';
import { LinkedinIcon } from '@/lib/SocialIcons';
import { translations, Locale } from '@/lib/translations';

export interface AgeGroup {
  id: string;
  label: string;
  code: string;
  minAge?: number;
  maxAge?: number;
}

export interface SubCompetition {
  id: string;
  title: string;
  code: string;
  category?: string;
  ageGroups?: AgeGroup[];
  rules?: string;
}

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
    competitions?: SubCompetition[];
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
  const [lang, setLang] = useState<Locale>('en');
  const [isDark, setIsDark] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [openRulesCompId, setOpenRulesCompId] = useState<string | null>(null);
  const [copiedShare, setCopiedShare] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number; totalMs: number } | null>(null);

  const t = translations[lang] || translations.en;

  useEffect(() => {
    const rawDateStr = event?.registrationEndDate || event?.registration_end_date || event?.date;
    if (!rawDateStr || typeof rawDateStr !== 'string') return;

    let targetTimestamp: number;

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
      } catch {}
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
  const finalVenueName = event?.venue_name || t.portalMainVenue;

  const resolvedPosterUrl = 
    event?.posterImageUrl || 
    event?.poster_image || 
    event?.poster || 
    event?.image || 
    DEFAULT_POSTER_SVG;

  const resolvedCoverUrl = event?.coverImageUrl || DEFAULT_COVER_SVG;
  const rawCount = event?.registrationCount ?? 0;
  const threshold = event?.hypeThreshold ?? 20;
  const displayCountText = rawCount >= threshold ? `${rawCount}+ ${t.portalConfirmedAttendees}` : t.portalRegActive;

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
    : `${formattedStart || '09:30 AM'} ${t.portalOnwards}`;

  const activeFaqs = event?.faqs || t.portalDefaultFaqs;

  const formatAgeBadge = (min?: number, max?: number) => {
    if (min !== undefined && max !== undefined) return `${min}–${max} yrs`;
    if (min !== undefined) return `≥ ${min} yrs`;
    if (max !== undefined) return `≤ ${max} yrs`;
    return t.portalOpenAge;
  };

  const isFinalCountdown = !!(timeLeft && timeLeft.totalMs > 0 && timeLeft.totalMs <= 24 * 60 * 60 * 1000);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 ${isDark ? 'bg-[#090D16] text-slate-100 dark' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* 🚀 TOP STICKY NOTIFICATION BANNER (<= 24 Hours) */}
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
                <span>{t.portalClosingSoon}</span>
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
              <span>{t.portalSecureSpot}</span>
            </div>
          </div>
        </aside>
      )}

      {/* HERO COVER BANNER */}
      <div className="relative w-full h-56 sm:h-72 md:h-80 lg:h-96 overflow-hidden bg-slate-950">
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
      </div>

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-20 md:-mt-32 relative z-20 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT CONTENT COLUMN */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* HERO OVERVIEW CARD */}
            <div className={`p-6 sm:p-8 rounded-3xl border transition-all duration-200 backdrop-blur-md relative overflow-hidden ${
              isDark ? 'bg-slate-900/80 border-slate-800/80 shadow-2xl' : 'bg-white/95 border-slate-200 shadow-xl'
            }`}>
              <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl ${activeTheme.accentGlow} rounded-full blur-3xl pointer-events-none`} />

              {/* CARD TOP TOOLBAR: Badges & Header Action Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${activeTheme.badge}`}>
                    {event?.type || 'Conference'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    isDark ? 'bg-slate-800/60 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}>
                    {event?.protocol ? event.protocol.replace('-', ' ') : t.portalOpenAccess}
                  </span>
                </div>

                {/* 🟢 HEADER ACTION BAR */}
                <div className="flex items-center gap-2">
                  {/* Language Switcher */}
                  <div className={`flex items-center p-1 rounded-full border shadow-sm text-[11px] font-bold ${
                    isDark ? 'bg-slate-800/90 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setLang('en')}
                      className={`px-2 py-0.5 rounded-full transition-all ${lang === 'en' ? 'bg-blue-600 text-white shadow' : 'hover:text-blue-500'}`}
                    >
                      EN
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('hi')}
                      className={`px-2 py-0.5 rounded-full transition-all ${lang === 'hi' ? 'bg-blue-600 text-white shadow' : 'hover:text-blue-500'}`}
                    >
                      हिन्दी
                    </button>
                    <button
                      type="button"
                      onClick={() => setLang('mai')}
                      className={`px-2 py-0.5 rounded-full transition-all ${lang === 'mai' ? 'bg-blue-600 text-white shadow' : 'hover:text-blue-500'}`}
                    >
                      मैथिली
                    </button>
                  </div>

                  {/* Dark Mode Toggle */}
                  <button 
                    type="button" 
                    onClick={() => setIsDark(!isDark)}
                    aria-label="Toggle Theme"
                    className={`p-2 rounded-full border transition-all ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {isDark ? <Sun size={15} /> : <Moon size={15} />}
                  </button>
                  
                  {/* Share Button */}
                  <button 
                    type="button" 
                    onClick={handleShare}
                    aria-label="Share Event"
                    className={`px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5 text-xs font-semibold ${
                      isDark ? 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {copiedShare ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
                    <span className="hidden sm:inline">{copiedShare ? t.portalCopied : t.portalShare}</span>
                  </button>
                </div>
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
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">{t.portalDateLabel}</span>
                    <span className="text-sm font-semibold">{event?.date || t.portalTba}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'} shadow-sm`}>
                    <Clock size={18} className={activeTheme.textAccent} />
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">{t.portalTimeLabel}</span>
                    <span className="text-sm font-semibold">{timeDisplay}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3 sm:col-span-2">
                  <div className={`p-2.5 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-white border-slate-200 text-slate-700'} shadow-sm shrink-0`}>
                    <MapPin size={18} className={activeTheme.textAccent} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">{t.portalVenueLabel}</span>
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

              {/* 🔴 MANDATORY DOCUMENTATION ALERT BOX */}
              <div className="mt-6 p-4 sm:p-4.5 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-3.5 shadow-sm">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
                  <IdCard size={20} />
                </div>
                <div className="space-y-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide text-xs">
                    <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400" />
                    <span>{t.portalMandatoryNoticeTitle}</span>
                  </div>
                  <p className="leading-relaxed font-medium">
                    {t.portalMandatoryNoticeBody}
                  </p>
                </div>
              </div>

              {/* ABOUT SECTION */}
              {event?.description && (
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800/80">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">{t.portalAboutHeading}</h2>
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
                <div className="text-xs sm:text-sm font-bold">{t.portalVerifiedEntry}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{t.portalOfficialPass}</div>
              </div>

              <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <Users size={20} className={`mx-auto mb-2 ${activeTheme.textAccent}`} />
                <div className="text-xs sm:text-sm font-bold truncate px-1">{displayCountText}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{t.portalAttendeeStatus}</div>
              </div>

              <div className={`p-4 rounded-2xl border text-center ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <ShieldCheck size={20} className={`mx-auto mb-2 ${activeTheme.textAccent}`} />
                <div className="text-xs sm:text-sm font-bold">{t.portalGuaranteed}</div>
                <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">{t.portalSecureCheckin}</div>
              </div>
            </div>

            {/* 🏆 COMPETITION TRACKS & NESTED AGE GROUPS */}
            {event?.isMultiCompetition && event.competitions && event.competitions.length > 0 && (
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <div className="flex items-center justify-between gap-3 mb-6">
                  <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    <Trophy size={20} className="text-amber-500" />
                    <span>{t.portalCompTitle}</span>
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                    {event.competitions.length} {t.portalTracksAvailable}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {event.competitions.map((comp) => {
                    const isRulesOpen = openRulesCompId === comp.id;
                    const hasAgeGroups = comp.ageGroups && comp.ageGroups.length > 0;

                    return (
                      <div 
                        key={comp.id} 
                        className={`p-5 rounded-2xl border transition-all space-y-3.5 ${
                          isDark ? 'bg-slate-800/30 border-slate-800 hover:border-slate-700' : 'bg-slate-50/80 border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        {/* Title & Category Line */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5">
                            <span className="text-[11px] font-black font-mono uppercase px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                              {comp.code}
                            </span>
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                              {comp.title}
                            </h4>
                          </div>

                          {comp.category && (
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {comp.category}
                            </span>
                          )}
                        </div>

                        {/* Nested Age Groups Section */}
                        {hasAgeGroups && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              <Users size={12} className="text-blue-500" />
                              <span>{t.portalEligibleAgeGroups}</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {comp.ageGroups!.map(grp => (
                                <div 
                                  key={grp.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                >
                                  <span>{grp.label}</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/10 dark:bg-black/30 font-bold">
                                    {formatAgeBadge(grp.minAge, grp.maxAge)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Expandable Rules & Regulations */}
                        {comp.rules && (
                          <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => setOpenRulesCompId(isRulesOpen ? null : comp.id)}
                              className="flex items-center justify-between w-full text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <FileText size={13} className="text-blue-500" />
                                <span>{t.portalRulesBtn}</span>
                              </span>
                              {isRulesOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isRulesOpen && (
                              <div className="mt-2.5 p-3.5 rounded-xl border bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-xs leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap animate-in fade-in duration-200">
                                {comp.rules}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SPEAKERS / GUESTS */}
            {event?.speakers && event.speakers.length > 0 && (
              <div className={`p-6 sm:p-8 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
                <h3 className="text-lg font-bold tracking-tight mb-5 flex items-center gap-2">
                  <Users size={20} className={activeTheme.textAccent} />
                  <span>{t.portalFeaturedSpeakers}</span>
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
                  <span>{t.portalEventSchedule}</span>
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

            {/* FAQ ACCORDION */}
            <div className={`p-6 sm:p-8 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200'}`}>
              <h3 className="text-lg font-bold tracking-tight mb-5 flex items-center gap-2">
                <HelpCircle size={20} className={activeTheme.textAccent} />
                <span>{t.portalFaqHeading}</span>
              </h3>
              <div className="space-y-3">
                {activeFaqs.map((faq, idx) => (
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
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">{t.portalOrganizedBy}</span>
                <span className="text-sm font-bold mt-0.5 block">{organizerText}</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 size={14} />
                <span>{t.portalVerifiedHost}</span>
              </div>
            </div>

          </div>

          {/* RIGHT STICKY REGISTRATION SIDEBAR */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
            
            {/* POSTER CARD */}
            <div className={`rounded-3xl border overflow-hidden shadow-xl ${
              isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
            }`}>
              <div className="aspect-[4/5] w-full overflow-hidden bg-slate-950 relative group flex items-center justify-center p-2">
                <img 
                  src={resolvedPosterUrl} 
                  alt="" 
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover blur-xl opacity-40 scale-110 pointer-events-none" 
                />

                <img 
                  src={resolvedPosterUrl} 
                  alt={`${event?.name} Poster`} 
                  className="relative z-10 max-w-full max-h-full w-auto h-auto object-contain rounded-2xl shadow-md group-hover:scale-[1.02] transition-transform duration-300" 
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
              <div className="mb-4">
                <h3 className="text-lg font-bold tracking-tight">{t.portalReserveSpot}</h3>
                <p className="text-xs text-slate-400 mt-1">{t.portalReserveSub}</p>
              </div>

              {/* 🔴 SIDEBAR COMPULSORY IDENTITY CARD NOTICE BOX */}
              <div className="mb-5 p-3 rounded-2xl border bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="font-bold text-amber-800 dark:text-amber-300 block mb-0.5">{t.portalSidebarNoticeTitle}</strong>
                  {t.portalSidebarNoticeBody}
                </div>
              </div>

              {/* SIDEBAR COUNTDOWN BADGE */}
              {timeLeft && (
                <div className={`mb-5 p-3 rounded-2xl border flex items-center justify-between ${
                  isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Hourglass size={14} className={activeTheme.textAccent} />
                    <span>{t.portalClosingIn}</span>
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
                {event && <UniversalRegistrationForm event={event} lang={lang} />}
              </div>

              {/* SECURITY NOTE */}
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500 shrink-0" />
                <span>{t.portalInstantPass}</span>
              </div>
            </div>

          </div>

        </div>
      </main>
    </div>
  );
}