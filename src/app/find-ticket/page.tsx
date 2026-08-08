'use client';

import React, { useState, useRef } from 'react';
import TicketQR from '@/components/TicketQR';
import { toPng } from 'html-to-image';
import { Loader2, Search, ArrowLeft, Ticket, AlertCircle, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { useTheme } from '@/contexts/ThemeContext';

interface MatchedAttendee {
  id: string;
  qrToken: string;
  name: string;
  category: string;
  eventId: number;
  eventName: string;
  eventDetails?: {
    eventName: string;
    date: string;
    venue: string;
    coverImageUrl?: string;
  };
}

export default function FindTicketPage() {
  const ticketRef = useRef<HTMLDivElement>(null);

  // Theme Context integration with fallback state
  let themeContext: { isDark: boolean; toggleTheme: () => void } | null = null;
  try {
    themeContext = useTheme();
  } catch (e) {
    // Graceful fallback if context provider is not wrapped higher up
  }

  const [localIsDark, setLocalIsDark] = useState<boolean>(true);
  const isDark = themeContext ? themeContext.isDark : localIsDark;
  const toggleTheme = themeContext
    ? themeContext.toggleTheme
    : () => setLocalIsDark((prev) => !prev);

  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);
  const [matchedAttendee, setMatchedAttendee] = useState<MatchedAttendee | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setSearched(true);
    setErrorMessage('');
    setMatchedAttendee(null);

    try {
      if (!db.isOpen()) await db.open();

      let guestRecord: any = null;
      const lowerQuery = cleanQuery.toLowerCase();
      const sanitizedPhone = cleanQuery.replace(/\D/g, '');

      // 🔍 1. Smart Multi-Field Indexed Lookup Sequence
      guestRecord = await db.guests
        .where('qrToken')
        .equals(cleanQuery)
        .or('qr_token')
        .equals(cleanQuery)
        .first();

      if (!guestRecord && cleanQuery.includes('@')) {
        guestRecord = await db.guests
          .where('email')
          .equals(lowerQuery)
          .first();
      }

      if (!guestRecord) {
        guestRecord = await db.guests
          .where('phone')
          .equals(cleanQuery)
          .or('phone')
          .equals(sanitizedPhone)
          .first();
      }

      // 🔍 2. Universal Fallback Matcher
      if (!guestRecord) {
        const allGuests = await db.guests.toArray();
        guestRecord = allGuests.find((g: any) => {
          const gPhone = String(g.phone || '').replace(/\D/g, '');
          const gEmail = String(g.email || '').toLowerCase();
          const gToken = String(g.qrToken || g.qr_token || g.guestId || '').toLowerCase();

          return (
            (sanitizedPhone && gPhone.includes(sanitizedPhone)) ||
            (gEmail && gEmail === lowerQuery) ||
            (gToken && gToken === lowerQuery)
          );
        });
      }

      if (!guestRecord) {
        setErrorMessage(`No pass found matching "${cleanQuery}". Please check your details and try again.`);
        return;
      }

      // 🟢 3. Fetch event banner/details from db.events
      let localEvent: any = null;
      if (guestRecord.eventId) {
        localEvent = await db.events
          .where('id')
          .equals(Number(guestRecord.eventId))
          .or('slug')
          .equals(guestRecord.eventId)
          .first();
      }

      const coverImage = 
        localEvent?.coverImageUrl || 
        localEvent?.coverBlob || 
        localEvent?.image || 
        localEvent?.banner || 
        "";

      const resolvedEventName = 
        localEvent?.name || 
        localEvent?.eventName || 
        guestRecord?.eventName || 
        "Event Pass";

      const resolvedQrToken = 
        guestRecord.qrToken || 
        guestRecord.qr_token || 
        guestRecord.guestId || 
        `PASS-${guestRecord.id}`;

      setMatchedAttendee({
        id: String(guestRecord.id || guestRecord.guestId || `GUEST-${Date.now()}`),
        qrToken: resolvedQrToken,
        name: guestRecord.name,
        category: guestRecord.category || guestRecord.type || 'General',
        eventId: Number(guestRecord.eventId),
        eventName: resolvedEventName,
        eventDetails: {
          eventName: resolvedEventName,
          date: localEvent?.date || "",
          venue: localEvent?.venue || localEvent?.location || "",
          coverImageUrl: coverImage,
        }
      });

    } catch (err: any) {
      console.error("Failed to query IndexedDB for ticket:", err);
      setErrorMessage("An error occurred while retrieving your pass details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (ticketRef.current === null || !matchedAttendee) return;

    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `${matchedAttendee.name.replace(/\s+/g, '_')}_Ticket.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate ticket image:', err);
    }
  };

  // Dynamic theme mapping
  const theme = {
    bg: isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900',
    card: isDark ? 'bg-slate-900 border-white/10' : 'bg-white border-slate-200 shadow-xl',
    headerText: isDark ? 'text-white' : 'text-slate-900',
    subText: isDark ? 'text-slate-400' : 'text-slate-500',
    inputBg: isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400',
    toggleBtn: isDark ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm',
    badge: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200',
  };

  return (
    <main className={`min-h-screen ${theme.bg} transition-colors duration-300 flex flex-col items-center justify-center p-4 sm:p-6`}>
      {/* SEARCH CARD CONTAINER */}
      <div className={`w-full max-w-md rounded-3xl p-6 border transition-colors duration-300 ${theme.card} mb-8`}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 mb-3">
            <Ticket size={24} />
          </div>
          <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${theme.headerText}`}>
            Find Your Event Pass
          </h1>
          <p className={`text-xs ${theme.subText} mt-1`}>
            Search registered passes saved in local device storage.
          </p>
        </div>

        {/* SINGLE UNIFIED SEARCH INPUT FORM */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-1.5">
            <label className={`text-[10px] font-black uppercase tracking-widest ${theme.subText} ml-1`}>
              Search by Phone, Email, or Pass Code
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. 9876543210, guest@example.com, or MI26-9122"
                className={`w-full rounded-2xl px-4 py-3.5 pl-11 text-xs sm:text-sm font-semibold outline-none focus:border-blue-500 transition-all border ${theme.inputBg}`}
              />
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search size={16} />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Search size={16} />
                <span>Locate My Pass</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* ERROR / NOT FOUND FEEDBACK */}
      {searched && !loading && errorMessage && (
        <div className="w-full max-w-md p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-3 text-red-400 text-xs font-semibold mb-6 animate-in fade-in">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* MATCHED PASS RESULTS & TICKET QR */}
      {matchedAttendee && (
        <div className="w-full max-w-sm flex flex-col items-center animate-in zoom-in-95 duration-300">
          
          <div className="text-center mb-4">
            <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
              ✓ Registration Match Found
            </span>
          </div>

          {/* TICKET PASS DISPLAY */}
          <div ref={ticketRef} className="w-full">
            <TicketQR
              userId={matchedAttendee.id}
              qrToken={matchedAttendee.qrToken}
              userName={matchedAttendee.name}
              userCategory={matchedAttendee.category}
              eventId={matchedAttendee.eventId}
              eventDetails={matchedAttendee.eventDetails}
            />
          </div>

          {/* DOWNLOAD ACTION BUTTON */}
          <div className="mt-6 w-full flex flex-col gap-3">
            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition duration-150 shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Download Ticket Pass</span>
            </button>

            <p className={`text-[11px] text-center ${theme.subText}`}>
              Save this ticket image to your mobile gallery for offline gate scanning.
            </p>
          </div>

        </div>
      )}

    </main>
  );
}