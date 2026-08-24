// src/app/ticket/page.tsx
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import TicketQR from '@/components/TicketQR';
import { toPng } from 'html-to-image';
import { Loader2, Ticket, Calendar, ChevronRight, Search, Sun, Moon, ShieldCheck, Download } from 'lucide-react';
import { db } from '@/lib/db';
import { useTheme } from '@/contexts/ThemeContext';

interface AttendeeData {
  id: string; 
  qrToken: string; 
  name: string;
  category: string;
  competitionTitle?: string;
  ageGroupLabel?: string;
  eventId: number;
  eventName: string;
  eventDetails?: {
    eventName: string;
    date: string;
    venue: string;
    coverImageUrl?: string;
  };
}

interface StoredTicketItem {
  id?: string | number;
  guestId?: string;
  name: string;
  category?: string;
  type?: string;
  qrToken?: string | null;
  qr_token?: string | null;
  eventId?: number |string;
  eventName?: string;
  eventDate?: string;
}

export default function TicketPage() {
  const ticketRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();

  const eventIdParam = searchParams.get('eventId') || searchParams.get('id') || '';
  const qrParam = searchParams.get('qrToken') || searchParams.get('qr_token') || searchParams.get('qr') || '';
  const phoneParam = searchParams.get('phone') || '';
  const emailParam = searchParams.get('email') || '';

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [attendee, setAttendee] = useState<AttendeeData | null>(null);

  const storedTickets = useLiveQuery(async () => {
    if (!db.isOpen()) await db.open();
    if (!db.guests) return [];

    const guests = await db.guests.toArray();
    const enrichedGuests: StoredTicketItem[] = [];

    for (const g of guests) {
      let eventName = 'Event Pass';
      let eventDate = '';

      if (g.eventId && db.events) {
        const ev = await db.events.get(Number(g.eventId));
        if (ev) {
          eventName = ev.name || 'Event Pass';
          eventDate = ev.date || '';
        }
      }

      enrichedGuests.push({
        ...g,
        eventName,
        eventDate,
      });
    }

    if (!searchQuery.trim()) return enrichedGuests;
    const q = searchQuery.toLowerCase();
    return enrichedGuests.filter((item: StoredTicketItem) => 
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.eventName && item.eventName.toLowerCase().includes(q)) ||
      (item.qrToken && item.qrToken.toLowerCase().includes(q)) ||
      (item.qr_token && item.qr_token.toLowerCase().includes(q))
    );
  }, [searchQuery]) || [];

  useEffect(() => {
    let isMounted = true;

    async function loadTicketData() {
      if (!eventIdParam && !qrParam && !phoneParam && !emailParam) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        if (!db.isOpen()) await db.open();

        const rawNumeric = Number(decodeURIComponent(eventIdParam));
        const numericEventId = !isNaN(rawNumeric) && rawNumeric > 0 ? rawNumeric : null;
        const stringEventParam = decodeURIComponent(eventIdParam);

        let localGuest: any = null;
        let localEvent: any = null;
        let localRegistration: any = null;

        if (typeof window !== 'undefined' && db && db.guests) {
          if (qrParam) {
            localGuest = await db.guests
              .where('qrToken')
              .equals(qrParam)
              .or('qr_token')
              .equals(qrParam)
              .first();
          }

          if (!localGuest && numericEventId) {
            localGuest = await db.guests
              .where('eventId')
              .equals(numericEventId)
              .reverse()
              .first();
          }

          if (!localGuest) {
            const allGuests = await db.guests.toArray();
            localGuest = allGuests.find((g: any) => {
              const matchesSlug = String(g.eventId) === stringEventParam;
              const matchesPhone = phoneParam && String(g.phone || '').replace(/\D/g, '').includes(phoneParam.replace(/\D/g, ''));
              const matchesEmail = emailParam && String(g.email || '').toLowerCase() === emailParam.toLowerCase();
              return matchesSlug || matchesPhone || matchesEmail;
            }) || (allGuests.length > 0 ? allGuests[allGuests.length - 1] : null);
          }

          if (localGuest) {
            const activeEventId = Number(localGuest.eventId);

            if (activeEventId) {
              localEvent = await db.events.get(activeEventId);
            }
            if (!localEvent && db.events) {
              localEvent = await db.events.where('slug').equals(stringEventParam).first();
            }

            if (db.eventRegistrations) {
              localRegistration = await db.eventRegistrations
                .filter((reg: any) => 
                  Number(reg.eventId) === activeEventId || 
                  String(reg.eventId) === stringEventParam ||
                  (localGuest.phone && reg.phone === localGuest.phone) ||
                  (localGuest.email && reg.email === localGuest.email)
                )
                .first();
            }
          }
        }
      
        if (localGuest && isMounted) {
          const coverImage = 
            localEvent?.coverImageUrl || 
            localEvent?.coverBlob || 
            localEvent?.image || 
            localEvent?.banner || 
            "";

          const resolvedEventName = 
            localEvent?.name || 
            localEvent?.eventName || 
            localGuest?.eventName || 
            "Event Pass";

          const resolvedQrToken = 
            localGuest.qrToken || 
            localGuest.qr_token || 
            localGuest.guestId || 
            `EV26-${localGuest.phone ? localGuest.phone.slice(-4) : '0000'}`;

          const resolvedCompetitionTitle = localRegistration?.competitionTitle || localGuest.competitionTitle || undefined;
          const resolvedAgeGroupLabel = localRegistration?.ageGroupLabel || localGuest.ageGroupLabel || undefined;

          setAttendee({
            id: String(localGuest.id || localGuest.guestId || `GUEST-${Date.now()}`),
            qrToken: resolvedQrToken,
            name: localGuest.name,
            category: localGuest.category || localGuest.type || 'General',
            competitionTitle: resolvedCompetitionTitle, 
            ageGroupLabel: resolvedAgeGroupLabel,
            eventId: Number(localGuest.eventId || numericEventId || 0),
            eventName: resolvedEventName,
            eventDetails: {
              eventName: resolvedEventName,
              date: localEvent?.date || "",
              venue: localEvent?.venueName || localEvent?.venue || localEvent?.location || "",
              coverImageUrl: coverImage,
            }
          });
          setLoading(false);
          return;
        }

        const lookupQueryParam = qrParam || phoneParam || emailParam || eventIdParam;
        if (typeof window !== 'undefined' && navigator.onLine && lookupQueryParam) {
          const res = await fetch(`/api/ticket/find?q=${encodeURIComponent(lookupQueryParam)}`);
          if (res.ok) {
            const cloudResult = await res.json();
            if (cloudResult.success && cloudResult.data && isMounted) {
              const { registration, guest, event } = cloudResult.data;

              await db.transaction('rw', [db.guests, db.eventRegistrations, db.events], async () => {
                if (guest) await db.guests.put(guest);
                if (registration) await db.eventRegistrations.put(registration);
                if (event && event.id) {
                  await db.events.put({
                    id: Number(event.id),
                    name: event.name,
                    slug: event.slug,
                    date: event.date,
                    venueName: event.venue,
                    coverImageUrl: event.coverImageUrl,
                    posterImageUrl: event.posterImageUrl,
                    syncStatus: 'synced',
                    createdAt: Date.now(),
                    hypeThreshold: 0,
                    protocol: 'open-registration',
                    status: 'published',
                    type: 'event',
                    coverBlob: null,
                    posterBlob: null
                  } as any);
                }
              }).catch(() => {});

              setAttendee({
                id: String(guest.guestId || `GUEST-${Date.now()}`),
                qrToken: guest.qrToken,
                name: guest.name,
                category: guest.category || 'General',
                competitionTitle: guest.competitionTitle || registration?.competitionTitle || undefined,
                ageGroupLabel: guest.ageGroupLabel || registration?.ageGroupLabel || undefined,
                eventId: Number(event?.id || registration?.eventId || 0),
                eventName: event?.name || 'Event Pass',
                eventDetails: {
                  eventName: event?.name || 'Event Pass',
                  date: event?.date || "",
                  venue: event?.venue || "",
                  coverImageUrl: event?.coverImageUrl || "",
                }
              });
              setLoading(false);
              return;
            }
          }
        }

      } catch (err) {
        console.error("Failed to query ticket pass details:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadTicketData();

    return () => {
      isMounted = false;
    };
  }, [eventIdParam, qrParam, phoneParam, emailParam]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchError(null);
    setIsSearchingOnline(true);

    try {
      if (!db.isOpen()) await db.open();
      const queryStr = searchQuery.trim();

      let foundGuest = await db.guests
        .where('qrToken')
        .equalsIgnoreCase(queryStr)
        .or('phone')
        .equals(queryStr)
        .or('email')
        .equalsIgnoreCase(queryStr)
        .first();

      if (!foundGuest && db.eventRegistrations) {
        const foundReg = await db.eventRegistrations
          .filter((r: any) => r.phone === queryStr || r.email?.toLowerCase() === queryStr.toLowerCase())
          .first();
        if (foundReg) {
          router.push(`/ticket?phone=${encodeURIComponent(foundReg.phone)}`);
          return;
        }
      }

      if (foundGuest) {
        router.push(`/ticket?qrToken=${encodeURIComponent(foundGuest.qrToken || foundGuest.qr_token ||'')}`);
        return;
      }

      if (typeof window !== 'undefined' && navigator.onLine) {
        const res = await fetch(`/api/ticket/find?q=${encodeURIComponent(queryStr)}`);
        if (res.ok) {
          const cloudResult = await res.json();
          if (cloudResult.success && cloudResult.data) {
            const { registration, guest, event } = cloudResult.data;

            await db.transaction('rw', [db.guests, db.eventRegistrations, db.events], async () => {
              if (guest) await db.guests.put(guest);
              if (registration) await db.eventRegistrations.put(registration);
              if (event && event.id) {
                await db.events.put({
                  id: Number(event.id),
                  name: event.name,
                  slug: event.slug,
                  date: event.date,
                  venueName: event.venue,
                  coverImageUrl: event.coverImageUrl,
                  posterImageUrl: event.posterImageUrl,
                  syncStatus: 'synced',
                  createdAt: Date.now(),
                  hypeThreshold: 0,
                  protocol: 'open-registration',
                  status: 'published',
                  type: 'event',
                  coverBlob: null,
                  posterBlob: null
                } as any);
              }
            });

            if (guest?.qrToken) {
              router.push(`/ticket?qrToken=${encodeURIComponent(guest.qrToken)}`);
              return;
            }
          }
        }
      }

      setSearchError('No matching ticket found locally or online.');
    } catch (err) {
      console.error("Online search lookup failed:", err);
      setSearchError('Failed to fetch ticket from server.');
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleDownload = async () => {
    if (ticketRef.current === null || !attendee) return;

    try {
      const dataUrl = await toPng(ticketRef.current, { cacheBust: true });
      const link = document.createElement('a');
      link.download = `${attendee.name.replace(/\s+/g, '_')}_Event_Ticket.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Failed to generate ticket image:', err);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-4 transition-colors">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mb-3" />
        <p className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
          Verifying Pass Credentials...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-slate-100 to-slate-200 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 flex flex-col items-center justify-between p-4 sm:p-8 transition-colors relative overflow-x-hidden">
      
      {/* THEME TOGGLE BUTTON */}
      <button
        onClick={toggleTheme}
        aria-label="Toggle Theme"
        className="absolute top-5 right-5 p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 text-slate-700 dark:text-slate-200 shadow-lg hover:shadow-xl hover:scale-105 transition-all z-30"
      >
        {isDark ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <div className="w-full max-w-md mx-auto flex flex-col items-center space-y-8 mt-20 mb-10 z-10">
        
        {/* SEARCH FORM BAR */}
        <form onSubmit={handleSearchSubmit} className="w-full relative group">
          <div className="absolute inset-0 bg-blue-500/20 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition duration-300 pointer-events-none" />
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none z-10" />
          <input
            type="text"
            placeholder="Search by Name, Phone, Email, Pass ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200 dark:border-white/10 rounded-2xl pl-11 pr-24 py-3.5 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-all shadow-sm"
          />
          <button
            type="submit"
            disabled={isSearchingOnline}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 shadow-md shadow-blue-600/20 active:scale-95 z-10"
          >
            {isSearchingOnline ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
          </button>
        </form>

        {searchError && (
          <div className="w-full p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
            <p className="text-xs font-semibold text-red-600 dark:text-red-400">{searchError}</p>
          </div>
        )}

        {/* ACTIVE TICKET DISPLAY */}
        {attendee && (
          <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <div className="text-center space-y-2">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm">
                <ShieldCheck size={28} />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Official Entry Pass
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified access for <span className="text-slate-800 dark:text-slate-200 font-bold">{attendee.eventName}</span>
              </p>
            </div>

            <div ref={ticketRef} className="w-full drop-shadow-xl">
              <TicketQR
                userId={attendee.qrToken}
                userName={attendee.name}
                userCategory={attendee.category}
                competitionTitle={attendee.competitionTitle}
                ageGroupLabel={attendee.ageGroupLabel}
                eventId={attendee.eventId}
                eventDetails={attendee.eventDetails} 
              />
            </div>

            <button
              onClick={handleDownload}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98]"
            >
              <Download size={16} />
              <span>Download Secure Pass</span>
            </button>
          </div>
        )}

        {/* STORED TICKETS SECTION */}
        <div className="w-full pt-8 border-t border-slate-200/80 dark:border-white/10 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Ticket size={14} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-300">
                My Stored Passes ({storedTickets.length})
              </h3>
            </div>
          </div>

          {storedTickets.length === 0 ? (
            <div className="p-8 bg-white/40 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-3xl text-center space-y-2">
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 italic">
                No active tickets stored on this device.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {storedTickets.map((gst: any) => (
                <div
                  key={gst.id || gst.guestId}
                  onClick={() => router.push(`/ticket?qrToken=${encodeURIComponent(gst.qrToken || gst.qr_token || '')}`)}
                  className="w-full p-4 bg-white/80 dark:bg-white/[0.04] hover:bg-white dark:hover:bg-white/[0.08] backdrop-blur-md border border-slate-200/80 dark:border-white/10 rounded-2xl flex items-center justify-between cursor-pointer transition-all shadow-sm hover:shadow-md group"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                      <Ticket size={18} />
                    </div>
                    <div className="text-left space-y-1">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {gst.name}
                      </h4>
                      <div className="flex items-center gap-2.5 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-slate-800 dark:text-slate-200 font-semibold truncate max-w-[150px]">
                          {gst.eventName}
                        </span>
                        {gst.eventDate && (
                          <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                            <Calendar size={10} /> {gst.eventDate}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}