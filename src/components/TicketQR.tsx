'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { db } from '@/lib/db'; // Integrated Dexie IndexedDB instance

const FOOD_ELIGIBLE_CATEGORIES = ['VIP', 'DELEGATE', 'SPEAKER', 'EXHIBITOR', 'PRESS', 'PATRON', 'DIGNITARY', 'OPS-TEAM'];

interface EventDetails {
  eventName: string;
  date: string;
  venue: string;
  coverImageUrl?: string; // Optional event banner header image
}

interface TicketQRProps {
  userId: string;
  userName: string;
  userCategory: string;
  eventId: number;
  eventDetails?: EventDetails;
}

export default function TicketQR({
  userId,
  userName,
  userCategory,
  eventId,
  eventDetails: defaultEventDetails = {
    eventName: "",
    date: "",
    venue: "",
    coverImageUrl: "", // Banner image link
  },
}: TicketQRProps) {
  const [eventDetails, setEventDetails] = useState<EventDetails>(defaultEventDetails);
  const [loading, setLoading] = useState<boolean>(true);

  // Normalize category for food access check
  const normalizedCategory = userCategory ? userCategory.trim().toUpperCase() : 'GENERAL';
  const isFoodIncluded = FOOD_ELIGIBLE_CATEGORIES.includes(normalizedCategory);

  // 🚀 HYBRID DATA FETCHING: IndexedDB (Offline) -> Online API -> Props Fallback
  useEffect(() => {
    let isMounted = true;

    async function loadEventData() {
      try {
        if (!eventId) {
          setLoading(false);
          return;
        }

        // 1. Try reading event details from local IndexedDB (Fast / Offline)
        let localEvent: any = null;
        if (typeof window !== 'undefined' && db && db.events) {
          localEvent = await db.events
            .where('id')
            .equals(eventId)
            .or('slug')
            .equals(eventId)
            .first();
        }

        if (localEvent && isMounted) {
          console.log("⚡ Loaded Event Details from IndexedDB (Offline-Ready)");
          setEventDetails({
            eventName: localEvent.name || localEvent.eventName || defaultEventDetails.eventName,
            date: localEvent.date || defaultEventDetails.date,
            venue: localEvent.venue || localEvent.location || defaultEventDetails.venue,
            coverImageUrl: localEvent.coverImageUrl || localEvent.image || defaultEventDetails.coverImageUrl,
          });
          setLoading(false);
          return;
        }

        // 2. If not found locally and device is online, fetch from backend server
        if (typeof window !== 'undefined' && navigator.onLine) {
          console.log("🌐 Event not found in IndexedDB. Fetching from online server...");
          const res = await fetch(`/api/events/${encodeURIComponent(eventId)}`);
          
          if (res.ok) {
            const remoteData = await res.json();
            const fetchedEvent = remoteData.event || remoteData;

            const mappedDetails: EventDetails = {
              eventName: fetchedEvent.name || fetchedEvent.title || defaultEventDetails.eventName,
              date: fetchedEvent.date || defaultEventDetails.date,
              venue: fetchedEvent.venue || fetchedEvent.location || defaultEventDetails.venue,
              coverImageUrl: fetchedEvent.coverImageUrl || fetchedEvent.image || defaultEventDetails.coverImageUrl,
            };

            if (isMounted) {
              setEventDetails(mappedDetails);
            }

            // Save to IndexedDB for future offline usage
            if (db && db.events) {
              await db.events.put({
                id: eventId,
                ...fetchedEvent,
                updatedAt: Date.now()
              });
              console.log("💾 Cached fetched event data into IndexedDB");
            }
          }
        }
      } catch (error) {
        console.warn("⚠️ Could not load remote event details, falling back to default props:", error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadEventData();

    return () => {
      isMounted = false;
    };
  }, [eventId, defaultEventDetails]);

  // QR Payload data structure
  const qrPayload = JSON.stringify({
    uid: userId,
    eid: eventId,
    cat: normalizedCategory,
    food: isFoodIncluded,
    ts: Date.now(),
  });

  return (
    <div className="flex flex-col items-center bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-2xl max-w-sm mx-auto overflow-hidden transition-all duration-300">
      
      {/* 🖼️ EVENT BANNER HEADER */}
      {eventDetails.coverImageUrl ? (
        <div className="w-full h-32 bg-slate-100 overflow-hidden relative border-b border-slate-200">
          <img
            src={eventDetails.coverImageUrl}
            alt={eventDetails.eventName}
            className="w-full h-full object-cover"
          />
        </div>
      ) : null}

      <div className="p-6 w-full flex flex-col items-center">
        {/* EVENT DETAILS */}
        <div className="w-full text-center pb-4 mb-4 border-b border-dashed border-slate-200">
          <h2 className="text-base font-black text-slate-900 tracking-tight leading-snug">
            {eventDetails.eventName}
          </h2>
          <div className="flex flex-col items-center text-xs font-semibold text-slate-500 mt-1 gap-0.5">
            <span>📅 {eventDetails.date}</span>
            <span className="truncate max-w-[260px]">📍 {eventDetails.venue}</span>
          </div>
        </div>

        {/* ATTENDEE INFO */}
        <div className="text-center mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Pass Holder</p>
          <h3 className="text-lg font-black text-slate-800 tracking-tight leading-tight mt-0.5">
            {userName}
          </h3>
          <span className="inline-block px-3 py-0.5 mt-2 text-xs font-bold rounded-full bg-blue-100 text-blue-700 border border-blue-200 tracking-wide uppercase">
            {normalizedCategory} PASS
          </span>
        </div>

        {/* QR CODE CONTAINER */}
        <div className="p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
          <QRCodeSVG
            value={qrPayload}
            size={190}
            level="H"
            includeMargin={false}
          />
        </div>

        {/* ENTITLEMENT TAG */}
        <div className="mt-5 w-full">
          {isFoodIncluded ? (
            <div>
            <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-black tracking-wide uppercase shadow-sm">
              <span>🍱</span>
              <span>Food Included</span>
              
            </div>
            <p className="text-[10px] text-slate-400 mt-4 text-center font-medium">
          Scan at entry gates & food counters • ID: {userId}
        </p>
            </div>
            
          ) : (
            <div>
            <div className="flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-xs font-bold tracking-wide uppercase">
              <span>🚫</span>
              <span>Standard Entry (No Food)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-4 text-center font-medium">
                Scan at entry gates<br/>• ID: {}
            </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        
      </div>
    </div>
  );
}