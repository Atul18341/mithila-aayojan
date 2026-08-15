// src/app/ticket/page.tsx
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import TicketQR from '@/components/TicketQR';
import { toPng } from 'html-to-image';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db'; // Dexie IndexedDB instance[cite: 17]

interface AttendeeData {
  id: string; 
  qrToken: string; 
  name: string;
  category: string;
  competitionTitle?: string; // 🟢 Sub-Competition Title[cite: 17]
  ageGroupLabel?: string;    // 🟢 Age Group Label for Printing[cite: 17]
  eventId: number;
  eventName: string;
  eventDetails?: {
    eventName: string;
    date: string;
    venue: string;
    coverImageUrl?: string;
  };
}

export default function TicketPage() {
  const ticketRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();

  // 1. Extract query parameters safely[cite: 17]
  const eventIdParam = searchParams.get('eventId') || searchParams.get('id') || '';
  const qrParam = searchParams.get('qrToken') || searchParams.get('qr_token') || searchParams.get('qr') || '';
  const phoneParam = searchParams.get('phone') || '';
  const emailParam = searchParams.get('email') || '';

  const [loading, setLoading] = useState<boolean>(true);
  const [attendee, setAttendee] = useState<AttendeeData | null>(null);

  // 🚀 HYBRID DATA FETCHING: Local IndexedDB -> PostgreSQL Cloud Endpoint Fallback
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

        // STEP 1: Attempt to load guest record from Dexie IndexedDB[cite: 17]
        let localGuest: any = null;
        let localEvent: any = null;
        let localRegistration: any = null;

        if (typeof window !== 'undefined' && db && db.guests) {
          // A. Find by QR Token if provided
          if (qrParam) {
            localGuest = await db.guests
              .where('qrToken')
              .equals(qrParam)
              .or('qr_token')
              .equals(qrParam)
              .first();
          }

          // B. Find by eventId if numeric
          if (!localGuest && numericEventId) {
            localGuest = await db.guests
              .where('eventId')
              .equals(numericEventId)
              .reverse()
              .first();
          }

          // C. Find by phone / email / slug match in guests
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

            // STEP 2: Query db.events[cite: 17]
            if (activeEventId) {
              localEvent = await db.events.get(activeEventId);
            }
            if (!localEvent && db.events) {
              localEvent = await db.events.where('slug').equals(stringEventParam).first();
            }

            // STEP 3: Query db.eventRegistrations[cite: 17]
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
      
        // 🟢 STEP 2: If found in Local IndexedDB with valid details[cite: 17]
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

        // 🌐 STEP 3: Fallback to PostgreSQL Cloud Endpoint if offline lookup yielded nothing
        const lookupQueryParam = qrParam || phoneParam || emailParam || eventIdParam;
        if (typeof window !== 'undefined' && navigator.onLine && lookupQueryParam) {
          const res = await fetch(`/api/ticket/find?q=${encodeURIComponent(lookupQueryParam)}`);
          if (res.ok) {
            const cloudResult = await res.json();
            if (cloudResult.success && cloudResult.data && isMounted) {
              const { registration, guest, event } = cloudResult.data;

              // Cache data into local IndexedDB for future offline access[cite: 15]
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

  // Loading State[cite: 17]
  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-2" />
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Retrieving Pass Details...
        </p>
      </main>
    );
  }

  // Missing or Invalid Query Parameter State[cite: 17]
  if (!attendee) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-lg font-bold text-red-400">Pass Not Found</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          Unable to locate a matching ticket pass on this device or online.
        </p>
        <a 
          href="/find-ticket" 
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
        >
          Search by Phone or Email
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      
      {/* SUCCESS & THANK YOU HEADER[cite: 17] */}
      <div className="text-center max-w-md mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 mb-3">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
          Registration Successful!
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Thank you for registering for <span className="text-slate-200 font-semibold">{attendee.eventName}</span>. 
          Your entry pass has been generated below.
        </p>
      </div>

      {/* TICKET PASS CONTAINER[cite: 17] */}
      <div ref={ticketRef} className="w-full max-w-sm">
        <TicketQR
          userId={attendee.qrToken}
          userName={attendee.name}
          userCategory={attendee.category}
          competitionTitle={attendee.competitionTitle}
          ageGroupLabel={attendee.ageGroupLabel} // 🟢 Injected into TicketQR[cite: 17]
          eventId={attendee.eventId}
          eventDetails={attendee.eventDetails} 
        />
      </div>

      {/* DOWNLOAD BUTTON[cite: 17] */}
      <div className="mt-6 w-full max-w-sm flex flex-col gap-3">
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-3 px-5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm rounded-xl transition duration-150 shadow-lg shadow-blue-600/20 active:scale-[0.98]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download Ticket Pass</span>
        </button>

        <p className="text-[11px] text-center text-slate-500">
          Save this pass to your phone gallery for offline check-in at the entrance gate.
        </p>
      </div>

    </main>
  );
}