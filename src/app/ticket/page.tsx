'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import TicketQR from '@/components/TicketQR';
import { toPng } from 'html-to-image';
import { Loader2 } from 'lucide-react';
import { db } from '@/lib/db'; // Dexie IndexedDB instance

interface AttendeeData {
  id: string; 
  qrToken: string; // 🟢 Dedicated pass QR Token property
  name: string;
  category: string;
  competitionTitle?: string; // 🟢 Added Sub-Competition Title field
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

  // 1. Extract eventId safely from query parameters (/ticket?eventId=...)
  const eventIdFromQuery = searchParams.get('eventId');

  const [loading, setLoading] = useState<boolean>(true);
  const [attendee, setAttendee] = useState<AttendeeData | null>(null);

  // 🚀 LOCAL-ONLY DATA FETCHING: Strictly IndexedDB
  useEffect(() => {
    let isMounted = true;

    async function loadTicketData() {
      if (!eventIdFromQuery) {
        setLoading(false);
        return;
      }

      const activeEventId = Number(decodeURIComponent(eventIdFromQuery));
      console.log("Active Event Query ID:", typeof activeEventId);

      try {
        setLoading(true);

        // STEP 1: Load guest record directly from Dexie IndexedDB
        let localGuest: any = null;
        let localEvent: any = null;
        let localRegistration: any = null;

        if (typeof window !== 'undefined' && db && db.guests) {
          localGuest = await db.guests
            .where('eventId')
            .equals(activeEventId)
            .reverse()
            .first();

          if (localGuest) {
            // 🟢 STEP 2: Query db.events to get event details and banner image
            localEvent = await db.events
              .where('id')
              .equals(activeEventId)
              .or('slug')
              .equals(activeEventId)
              .first();

            // 🟢 STEP 3: Query db.eventRegistrations ONLY if category is participant
            const categoryUpper = (localGuest.category || '').trim().toUpperCase();
            const isParticipant = 
              categoryUpper.includes('PARTICIPANT') || 
              categoryUpper.includes('COMPETITOR') ||
              categoryUpper === 'EVENT-PARTICIPANT';

            if (isParticipant && db.eventRegistrations) {
              localRegistration = await db.eventRegistrations
                .filter((reg: any) => Number(reg.eventId) === activeEventId)
                .first();
            }
          }
        }
      
        if (localGuest && isMounted) {
          console.log("⚡ Loaded Guest & Event Details directly from local IndexedDB");

          // Extract cover image string, blob URL, or fallbacks
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
            "the event";

          // 🟢 Resolve exact qrToken from localGuest record
          const resolvedQrToken = 
            localGuest.qrToken || 
            localGuest.qr_token || 
            localGuest.guestId || 
            `EV26-${localGuest.phone ? localGuest.phone.slice(-4) : '0000'}`;

          // 🟢 Extract Competition Name conditionally if localRegistration exists
          const resolvedCompetitionTitle = localRegistration ? (
            localRegistration?.competitionTitle || 
            localRegistration?.competition_title || 
            localRegistration?.competitionName ||
            localRegistration?.competition ||
            localGuest.competitionTitle || 
            localGuest.competition_title || 
            localGuest.competitionName ||
            undefined
          ) : undefined;

          console.log("Competition-title(Page):", resolvedCompetitionTitle);

          setAttendee({
            id: String(localGuest.id || localGuest.guestId || `GUEST-${Date.now()}`),
            qrToken: resolvedQrToken,
            name: localGuest.name,
            category: localGuest.category || 'General',
            competitionTitle: resolvedCompetitionTitle, // 🟢 Set Competition Name
            eventId: activeEventId,
            eventName: resolvedEventName,
            eventDetails: {
              eventName: resolvedEventName,
              date: localEvent?.date || "",
              venue: localEvent?.venue || localEvent?.location || "",
              coverImageUrl: coverImage,
            }
          });
        } else {
          console.warn("⚠️ No local guest record matching eventId found in IndexedDB");
        }

      } catch (err) {
        console.error("Failed to query IndexedDB for ticket details:", err);
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
  }, [eventIdFromQuery]);

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

  // Missing or Invalid eventId Query Parameter State / No local guest found
  if (!eventIdFromQuery || !attendee) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-lg font-bold text-red-400">Invalid Pass Request</h1>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          No registration record found in local storage for this pass. Please verify your registration or retry.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
      
      {/* 🚀 SUCCESS & THANK YOU HEADER */}
      <div className="text-center max-w-md mb-6 my">
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

      {/* TICKET PASS CONTAINER (Target for Download Screenshot) */}
      <div ref={ticketRef} className="w-full max-w-sm">
        <TicketQR
          userId={attendee.qrToken}
          userName={attendee.name}
          userCategory={attendee.category}
          competitionTitle={attendee.competitionTitle} // 🟢 Pass competition title to TicketQR component
          eventId={attendee.eventId}
          eventDetails={attendee.eventDetails} 
        />
      </div>

      {/* 📥 DOWNLOAD BUTTON BELOW TICKET */}
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