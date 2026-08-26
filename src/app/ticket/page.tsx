// src/app/ticket/page.tsx
'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import TicketQR from '@/components/TicketQR';
import { toPng } from 'html-to-image';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db'; // Dexie IndexedDB instance

interface AttendeeData {
  id: string; 
  qrToken: string; 
  name: string;
  category: string;
  competitionTitle?: string;
  ageGroupLabel?: string;
  hasFoodAccess?: boolean; // 🟢 Added food access property
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

  // 1. Extract query parameters safely
  const eventIdParam = searchParams.get('eventId') || searchParams.get('id') || '';
  const qrParam = searchParams.get('qrToken') || searchParams.get('qr_token') || searchParams.get('qr') || '';
  const phoneParam = searchParams.get('phone') || '';
  const emailParam = searchParams.get('email') || '';

  const [loading, setLoading] = useState<boolean>(true);
  const [attendee, setAttendee] = useState<AttendeeData | null>(null);

  // ⚡ HYBRID DATA FETCHING: Local IndexedDB -> PostgreSQL Online Cloud Endpoint Fallback
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

        const cleanPhone = phoneParam ? phoneParam.replace(/\D/g, '') : '';
        const cleanEmail = emailParam ? emailParam.toLowerCase().trim() : '';
        const cleanQr = qrParam ? qrParam.trim() : '';

        // =========================================================================
        // STEP 1: Attempt to load & merge records from local IndexedDB (guests & eventRegistrations)
        // =========================================================================
        let localGuest: any = null;
        let localRegistration: any = null;
        let localEvent: any = null;

        if (typeof window !== 'undefined' && db) {
          // A. Find in local db.guests
          if (db.guests) {
            if (cleanQr) {
              localGuest = await db.guests
                .where('qrToken').equals(cleanQr)
                .or('qr_token').equals(cleanQr)
                .first();
            }

            if (!localGuest && cleanPhone) {
              const allGuests = await db.guests.toArray();
              localGuest = allGuests.find((g: any) => 
                g.phone && String(g.phone).replace(/\D/g, '').includes(cleanPhone)
              );
            }

            if (!localGuest && cleanEmail) {
              const allGuests = await db.guests.toArray();
              localGuest = allGuests.find((g: any) => 
                g.email && String(g.email).toLowerCase().trim() === cleanEmail
              );
            }
          }

          // B. Find in local db.eventRegistrations to cross-populate missing fields
          if (db.eventRegistrations) {
            if (cleanPhone) {
              localRegistration = await db.eventRegistrations
                .filter((reg: any) => reg.phone && String(reg.phone).replace(/\D/g, '').includes(cleanPhone))
                .first();
            }
            if (!localRegistration && cleanEmail) {
              localRegistration = await db.eventRegistrations
                .filter((reg: any) => reg.email && String(reg.email).toLowerCase().trim() === cleanEmail)
                .first();
            }
            if (!localRegistration && cleanQr && localGuest?.registrationId) {
              localRegistration = await db.eventRegistrations
                .where('registrationId').equals(localGuest.registrationId)
                .first();
            }
          }

          // C. Cross-merge localGuest if registration was found first
          if (!localGuest && localRegistration) {
            localGuest = {
              name: localRegistration.name,
              email: localRegistration.email,
              phone: localRegistration.phone,
              category: localRegistration.category,
              eventId: localRegistration.eventId,
              competitionTitle: localRegistration.competitionTitle,
              ageGroupLabel: localRegistration.ageGroupLabel,
              hasFoodAccess: localRegistration.hasFoodAccess,
              qrToken: localRegistration.qrToken || `EV26-${localRegistration.phone?.slice(-4) || '0000'}`
            };
          }

          // D. Resolve event metadata locally
          if (localGuest) {
            const activeEventId = Number(localGuest.eventId || numericEventId);
            if (activeEventId && db.events) {
              localEvent = await db.events.get(activeEventId);
            }
            if (!localEvent && db.events && stringEventParam) {
              localEvent = await db.events.where('slug').equals(stringEventParam).first();
            }
          }
        }

        // =========================================================================
        // STEP 2: If found locally in IndexedDB, mount state and exit
        // =========================================================================
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

          const resolvedFoodAccess = Boolean(localGuest.hasFoodAccess || localRegistration?.hasFoodAccess);

          setAttendee({
            id: String(localGuest.id || localGuest.guestId || `GUEST-${Date.now()}`),
            qrToken: resolvedQrToken,
            name: localGuest.name,
            category: localGuest.category || localGuest.type || 'General',
            competitionTitle: localRegistration?.competitionTitle || localGuest.competitionTitle || undefined, 
            ageGroupLabel: localRegistration?.ageGroupLabel || localGuest.ageGroupLabel || undefined,
            hasFoodAccess: resolvedFoodAccess, // 🟢 Passed to attendee state
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

        // =========================================================================
        // STEP 3: Fallback to Online PostgreSQL Server API if not found locally
        // =========================================================================
        const lookupQueryParam = cleanQr || cleanPhone || cleanEmail || eventIdParam;
        if (typeof window !== 'undefined' && navigator.onLine && lookupQueryParam) {
          const queryUrl = `/api/ticket/find?q=${encodeURIComponent(lookupQueryParam)}${cleanPhone ? `&phone=${encodeURIComponent(cleanPhone)}` : ''}${cleanEmail ? `&email=${encodeURIComponent(cleanEmail)}` : ''}${eventIdParam ? `&eventId=${encodeURIComponent(eventIdParam)}` : ''}`;
          
          const res = await fetch(queryUrl);
          if (res.ok) {
            const cloudResult = await res.json();
            if (cloudResult.success && cloudResult.data && isMounted) {
              const { registration, guest, event } = cloudResult.data;

              // Cache fetched data into local IndexedDB for future offline usage
              await db.transaction('rw', [db.guests, db.eventRegistrations, db.events], async () => {
                if (guest) await db.guests.put(guest);
                if (registration) await db.eventRegistrations.put(registration);
                if (event && event.id) {
                  await db.events.put({
                    id: Number(event.id),
                    name: event.name,
                    slug: event.slug,
                    date: event.date,
                    venueName: event.venue || event.venueName,
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
              }).catch((e) => console.warn("Caching error in IndexedDB:", e));

              const resolvedName = guest?.name || registration?.name || 'Event Attendee';
              const resolvedToken = guest?.qrToken || registration?.qrToken || cleanQr || `EV26-${(guest?.phone || registration?.phone || '0000').slice(-4)}`;
              const resolvedCategory = guest?.category || registration?.category || 'General';
              const resolvedFoodAccess = Boolean(guest?.hasFoodAccess || registration?.hasFoodAccess);

              setAttendee({
                id: String(guest?.id || guest?.guestId || `GUEST-${Date.now()}`),
                qrToken: resolvedToken,
                name: resolvedName,
                category: resolvedCategory,
                competitionTitle: guest?.competitionTitle || registration?.competitionTitle || undefined,
                ageGroupLabel: guest?.ageGroupLabel || registration?.ageGroupLabel || undefined,
                hasFoodAccess: resolvedFoodAccess, // 🟢 Passed from server response
                eventId: Number(event?.id || registration?.eventId || guest?.eventId || 0),
                eventName: event?.name || 'Event Pass',
                eventDetails: {
                  eventName: event?.name || 'Event Pass',
                  date: event?.date || "",
                  venue: event?.venue || event?.venueName || "",
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

  // Loading State
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

  // Missing or Invalid Query Parameter State
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
      
      {/* SUCCESS & THANK YOU HEADER */}
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

      {/* TICKET PASS CONTAINER */}
      <div ref={ticketRef} className="w-full max-w-sm">
        <TicketQR
          userId={attendee.qrToken}
          userName={attendee.name}
          userCategory={attendee.category}
          competitionTitle={attendee.competitionTitle}
          ageGroupLabel={attendee.ageGroupLabel}
          hasFoodAccess={attendee.hasFoodAccess} // 🟢 Injected into TicketQR component
          eventId={attendee.eventId}
          eventDetails={attendee.eventDetails} 
        />
      </div>

      {/* DOWNLOAD BUTTON */}
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