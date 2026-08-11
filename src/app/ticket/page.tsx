'use client';

import React, { useState, useRef } from 'react';
import TicketQR from '@/components/TicketQR';
import { toPng } from 'html-to-image';
import { 
  Loader2, Search, ArrowLeft, Ticket, AlertCircle, Sun, Moon, 
  ChevronDown, ChevronUp, Download, Calendar, MapPin, CheckCircle2, Globe 
} from 'lucide-react';
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
  const ticketRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Theme Context integration
  let themeContext: { isDark: boolean; toggleTheme: () => void } | null = null;
  try {
    themeContext = useTheme();
  } catch (e) {
    // Graceful fallback
  }

  const [localIsDark, setLocalIsDark] = useState<boolean>(true);
  const isDark = themeContext ? themeContext.isDark : localIsDark;
  const toggleTheme = themeContext
    ? themeContext.toggleTheme
    : () => setLocalIsDark((prev) => !prev);

  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);
  const [matchedTickets, setMatchedTickets] = useState<MatchedAttendee[]>([]);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isRemoteSource, setIsRemoteSource] = useState<boolean>(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setSearched(true);
    setErrorMessage('');
    setMatchedTickets([]);
    setExpandedTicketId(null);
    setIsRemoteSource(false);

    try {
      if (!db.isOpen()) await db.open();

      const lowerQuery = cleanQuery.toLowerCase();
      const sanitizedPhone = cleanQuery.replace(/\D/g, '');

      // 🔍 STEP 1: Query Local IndexedDB First (Offline-First)
      let localGuestRecords: any[] = [];

      // Query by qrToken / qr_token
      const tokenMatches = await db.guests
        .where('qrToken')
        .equals(cleanQuery)
        .or('qr_token')
        .equals(cleanQuery)
        .toArray();

      if (tokenMatches.length > 0) {
        localGuestRecords.push(...tokenMatches);
      }

      // Query by email
      if (cleanQuery.includes('@')) {
        const emailMatches = await db.guests
          .where('email')
          .equals(lowerQuery)
          .toArray();
        localGuestRecords.push(...emailMatches);
      }

      // Query by phone
      if (sanitizedPhone) {
        const phoneMatches = await db.guests
          .where('phone')
          .equals(cleanQuery)
          .or('phone')
          .equals(sanitizedPhone)
          .toArray();
        localGuestRecords.push(...phoneMatches);
      }

      // Universal fallback scan if no indexed records returned
      if (localGuestRecords.length === 0) {
        const allGuests = await db.guests.toArray();
        const fallbackMatches = allGuests.filter((g: any) => {
          const gPhone = String(g.phone || '').replace(/\D/g, '');
          const gEmail = String(g.email || '').toLowerCase();
          const gToken = String(g.qrToken || g.qr_token || g.guestId || '').toLowerCase();

          return (
            (sanitizedPhone && gPhone.includes(sanitizedPhone)) ||
            (gEmail && gEmail === lowerQuery) ||
            (gToken && gToken === lowerQuery)
          );
        });
        localGuestRecords.push(...fallbackMatches);
      }

      // Deduplicate local matches by ID / qrToken
      const uniqueLocalMap = new Map();
      localGuestRecords.forEach(g => {
        const key = g.qrToken || g.qr_token || g.id;
        if (!uniqueLocalMap.has(key)) uniqueLocalMap.set(key, g);
      });
      let matchedRecords = Array.from(uniqueLocalMap.values());

      // 🌐 STEP 2: Fetch Remote Online DB if Local DB yields zero results
      if (matchedRecords.length === 0 && navigator.onLine) {
        console.log(`🌐 Ticket not found locally. Searching online database for "${cleanQuery}"...`);
        
        const response = await fetch(`/api/sync/pull?query=${encodeURIComponent(cleanQuery)}`);
        
        if (response.ok) {
          const remoteData = await response.json();
          const fetchedGuests = remoteData.guests || (Array.isArray(remoteData) ? remoteData : []);

          if (fetchedGuests.length > 0) {
            matchedRecords = fetchedGuests;
            setIsRemoteSource(true);

            // Cache fetched guests into local IndexedDB for future offline usage
            await db.transaction('rw', [db.guests, db.events], async () => {
              for (const remoteGst of fetchedGuests) {
                if (remoteGst.qrToken) {
                  const existing = await db.guests.where('qrToken').equals(remoteGst.qrToken).first();
                  if (existing) {
                    await db.guests.update(existing.id!, remoteGst);
                  } else {
                    await db.guests.add(remoteGst);
                  }
                }
              }
              if (remoteData.events && Array.isArray(remoteData.events)) {
                for (const ev of remoteData.events) {
                  if (ev.id) await db.events.put(ev);
                }
              }
            });
            console.log("💾 Cached online ticket records into local IndexedDB.");
          }
        }
      }

      if (matchedRecords.length === 0) {
        setErrorMessage(`No tickets found matching "${cleanQuery}". Please verify your details.`);
        return;
      }

      // 🟢 STEP 3: Map and build ticket passes with event details
      const formattedTickets: MatchedAttendee[] = [];

      for (const record of matchedRecords) {
        let localEvent: any = null;
        if (record.eventId) {
          localEvent = await db.events
            .where('id')
            .equals(Number(record.eventId))
            .or('slug')
            .equals(record.eventId)
            .first();
        }

        const coverImage = 
          localEvent?.coverImageUrl || 
          localEvent?.coverBlob || 
          record?.coverImageUrl || 
          "";

        const resolvedEventName = 
          localEvent?.name || 
          localEvent?.eventName || 
          record?.eventName || 
          "Event Pass";

        const resolvedQrToken = 
          record.qrToken || 
          record.qr_token || 
          record.guestId || 
          `PASS-${record.id}`;

        const ticketId = String(record.id || record.guestId || resolvedQrToken);

        formattedTickets.push({
          id: ticketId,
          qrToken: resolvedQrToken,
          name: record.name,
          category: record.category || record.type || 'General',
          eventId: Number(record.eventId),
          eventName: resolvedEventName,
          eventDetails: {
            eventName: resolvedEventName,
            date: localEvent?.date || record.date || "",
            venue: localEvent?.venue || localEvent?.location || record.venue || "",
            coverImageUrl: coverImage,
          }
        });
      }

      setMatchedTickets(formattedTickets);
      
      // Auto-expand the first ticket in list
      if (formattedTickets.length > 0) {
        setExpandedTicketId(formattedTickets[0].id);
      }

    } catch (err: any) {
      console.error("Failed to query ticket repository:", err);
      setErrorMessage("An error occurred while retrieving your pass details.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (ticketId: string, attendeeName: string) => {
    const node = ticketRefs.current[ticketId];
    if (!node) return;

    try {
      const dataUrl = await toPng(node, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `${attendeeName.replace(/\s+/g, '_')}_TicketPass.png`;
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
    accordionCard: isDark ? 'bg-slate-900/90 border-white/10 hover:border-blue-500/30' : 'bg-white border-slate-200 shadow-md hover:border-blue-500/30',
    headerText: isDark ? 'text-white' : 'text-slate-900',
    subText: isDark ? 'text-slate-400' : 'text-slate-500',
    inputBg: isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-900 placeholder:text-slate-400',
    toggleBtn: isDark ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm',
    badge: isDark ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200',
  };

  return (
    <main className={`min-h-screen ${theme.bg} transition-colors duration-300 flex flex-col items-center justify-start p-4 sm:p-6 py-10`}>
      
      {/* HEADER NAVIGATION & THEME TOGGLE */}
      <div className="w-full max-w-md mb-6 flex items-center justify-between">
        <Link 
          href="/" 
          className={`inline-flex items-center gap-2 text-xs font-bold transition-colors ${theme.subText} hover:text-blue-500`}
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${theme.badge}`}>
            Pass Lookup
          </span>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className={`p-2 rounded-xl border transition-all active:scale-95 ${theme.toggleBtn}`}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </div>

      {/* SEARCH CARD CONTAINER */}
      <div className={`w-full max-w-md rounded-3xl p-6 border transition-colors duration-300 ${theme.card} mb-6`}>
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 mb-3">
            <Ticket size={24} />
          </div>
          <h1 className={`text-xl sm:text-2xl font-black tracking-tight ${theme.headerText}`}>
            Find Your Event Pass
          </h1>
          <p className={`text-xs ${theme.subText} mt-1`}>
            Enter details to locate and download your ticket passes.
          </p>
        </div>

        {/* UNIFIED SEARCH INPUT FORM */}
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
                <span>Locate My Passes</span>
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

      {/* MULTI-TICKET LIST / ACCORDION RESULTS */}
      {matchedTickets.length > 0 && (
        <div className="w-full max-w-md flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
          
          <div className="w-full flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-xs font-bold text-emerald-500">
                {matchedTickets.length} {matchedTickets.length === 1 ? 'Pass' : 'Passes'} Found
              </span>
            </div>

            {isRemoteSource && (
              <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Globe size={11} /> Cloud Synchronized
              </span>
            )}
          </div>

          {/* ACCORDION EXPANDABLE TICKET LIST */}
          <div className="w-full space-y-3">
            {matchedTickets.map((ticket) => {
              const isExpanded = expandedTicketId === ticket.id;

              return (
                <div 
                  key={ticket.id}
                  className={`w-full rounded-2xl border transition-all overflow-hidden ${theme.accordionCard}`}
                >
                  {/* TICKET SUMMARY ROW (CLICK TO EXPAND/COLLAPSE) */}
                  <button
                    type="button"
                    onClick={() => setExpandedTicketId(isExpanded ? null : ticket.id)}
                    className="w-full p-4 flex items-center justify-between text-left transition-colors"
                  >
                    <div className="flex flex-col gap-1 pr-2">
                      <span className="text-xs font-black uppercase tracking-wider text-blue-500">
                        {ticket.category} PASS
                      </span>
                      <h3 className={`text-base font-bold leading-tight ${theme.headerText}`}>
                        {ticket.eventName}
                      </h3>
                      
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                        {ticket.eventDetails?.date && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} /> {ticket.eventDetails.date}
                          </span>
                        )}
                        {ticket.eventDetails?.venue && (
                          <span className="flex items-center gap-1 truncate max-w-[180px]">
                            <MapPin size={12} /> {ticket.eventDetails.venue}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={`p-2 rounded-xl border shrink-0 transition-transform ${
                      isExpanded ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : `${theme.inputBg}`
                    }`}>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {/* EXPANDED TICKET QR VIEW & DOWNLOAD */}
                  {isExpanded && (
                    <div className="p-4 pt-2 border-t border-white/5 flex flex-col items-center bg-black/5 dark:bg-white/5 animate-in fade-in duration-200">
                      
                      <div 
                        ref={(el) => { ticketRefs.current[ticket.id] = el; }} 
                        className="w-full max-w-xs my-2"
                      >
                        <TicketQR
                          userId={ticket.id}
                          qrToken={ticket.qrToken}
                          userName={ticket.name}
                          userCategory={ticket.category}
                          eventId={ticket.eventId}
                          eventDetails={ticket.eventDetails}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDownload(ticket.id, ticket.name)}
                        className="w-full max-w-xs mt-4 flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:scale-[0.98]"
                      >
                        <Download size={15} />
                        <span>Download Ticket Pass</span>
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

        </div>
      )}

    </main>
  );
}