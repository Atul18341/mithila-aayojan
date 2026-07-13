// src/app/events/[slug]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react'; // 🚀 Added 'use'
import { db } from '../../../lib/db'; 
import PublicEventPortal from './PublicEventPortal';
import { Loader2, AlertCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>; // 🚀 typed params explicitly as a Promise
}

export default function EventDynamicRoutingWrapper({ params }: PageProps) {
  // 🚀 STEP 1: Unwrap the dynamic params Promise using React's use() hook
  const unwrappedParams = use(params);
  const slug = unwrappedParams.slug;

  const [eventRecord, setEventRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function evaluateHybridDataLayer() {
      try {
        setLoading(true);
        // 🚀 STEP 2: Interrogate the Local IndexedDB (Dexie) Instance First
        const cachedLocalEvent = await db.events.where('slug').equals(slug).first();

        if (cachedLocalEvent) {
          const processedLocalData = {
            ...cachedLocalEvent,
            coverImageUrl: cachedLocalEvent.coverBlob ? URL.createObjectURL(cachedLocalEvent.coverBlob) : cachedLocalEvent.coverImageUrl,
            posterImageUrl: cachedLocalEvent.posterBlob ? URL.createObjectURL(cachedLocalEvent.posterBlob) : cachedLocalEvent.posterImageUrl,
          };
          
          setEventRecord(processedLocalData);
          setLoading(false);

          // 🔄 Quiet background reconciliation if internet availability is confirmed
          if (navigator.onLine) {
            fetch(`/api/events/get?slug=${slug}`)
              .then(res => res.ok ? res.json() : null)
              .then(freshCloudRecord => {
                if (freshCloudRecord) {
                  db.events.update(cachedLocalEvent.id, freshCloudRecord);
                }
              })
              .catch(() => console.log("Background synchronization deferred."));
          }
        } else {
          // 🚀 STEP 3: Fallback to Remote Database API Router since local memory returned empty
          if (!navigator.onLine) {
            throw new Error("This event ledger isn't cached locally, and your system is currently offline.");
          }

          const response = await fetch(`/api/events/get?slug=${slug}`);
          if (!response.ok) {
            throw new Error("The requested experience parameters were not found on remote storage targets.");
          }
          
          const onlineCloudData = await response.json();
          
          if (onlineCloudData) {
            await db.events.add({ ...onlineCloudData, syncStatus: 'synced' });
            setEventRecord(onlineCloudData);
          } else {
            throw new Error("Empty target signature returned from remote records.");
          }
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Hybrid network routing pipeline failure:", err);
        setErrorMessage(err.message || "An exception occurred during target data aggregation.");
        setLoading(false);
      }
    }

    if (slug) {
      evaluateHybridDataLayer();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="animate-spin text-blue-500" size={28} />
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Resolving Data Layer Matrix...</p>
      </div>
    );
  }

  if (errorMessage || !eventRecord) {
    return (
      <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
          <AlertCircle size={24} />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Resolution Failure Boundary</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {errorMessage || "The event configuration matrix could not be resolved from any active storage targets."}
          </p>
        </div>
      </div>
    );
  }

  return <PublicEventPortal event={eventRecord} />;
}