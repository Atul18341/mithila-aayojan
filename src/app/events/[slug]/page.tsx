// src/app/events/[slug]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import { db } from '../../../lib/db'; 
import PublicEventPortal from './PublicEventPortal';
import { Loader2, AlertCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// 🚀 HELPER UTILITY: Streams remote public assets over network maps into binary Blobs
async function fetchImageAsBlob(url: string | null): Promise<Blob | null> {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.blob();
  } catch (err) {
    console.error(`Failed to fetch and process asset binary conversion for url: ${url}`, err);
    return null;
  }
}

export default function EventDynamicRoutingWrapper({ params }: PageProps) {
  const unwrappedParams = use(params);
  const rawSlug = unwrappedParams.slug;
  const slug = rawSlug ? rawSlug.trim().toLowerCase() : '';

  const [eventRecord, setEventRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Keep track of active Object URLs to safely clear allocations when hooks update
    const createdObjectUrls: string[] = [];

    const createSafeObjectURL = (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      createdObjectUrls.push(url);
      return url;
    };

    async function evaluateHybridDataLayer() {
      try {
        setLoading(true);
        if (!slug) throw new Error("Invalid event identifier supplied.");

        // 🟢 1. STRICT LOCAL LOOKUP BY SLUG
        const cachedLocalEvent = await db.events.where('slug').equals(slug).first();

        if (cachedLocalEvent) {
          // Case A: Local Cache Hits -> Hydrate Object URLs instantly from local storage memory
          const processedLocalData = {
            ...cachedLocalEvent,
            // Normalize registration cutoff date field for child components
            registrationEndDate: cachedLocalEvent.registrationEndDate || cachedLocalEvent.registration_end_date || null,
            coverImageUrl: cachedLocalEvent.coverBlob ? createSafeObjectURL(cachedLocalEvent.coverBlob) : cachedLocalEvent.coverImageUrl,
            posterImageUrl: cachedLocalEvent.posterBlob ? createSafeObjectURL(cachedLocalEvent.posterBlob) : cachedLocalEvent.posterImageUrl,
          };
          
          setEventRecord(processedLocalData);
          setLoading(false);

          // Quiet background reconciliation if internet availability is confirmed
          if (navigator.onLine) {
            fetch(`/api/events/public?slug=${slug}`) 
              .then(res => res.ok ? res.json() : null)
              .then(async (freshCloudData) => {
                if (freshCloudData && Array.isArray(freshCloudData.events) && freshCloudData.events.length > 0) {
                  // Strictly filter matching event by slug
                  const remoteEvent = freshCloudData.events.find(
                    (e: any) => e.slug?.toLowerCase() === slug || String(e.id) === slug
                  ) || freshCloudData.events[0];

                  if (!remoteEvent || (remoteEvent.slug && remoteEvent.slug.toLowerCase() !== slug)) {
                    return;
                  }

                  let updatedCoverBlob = cachedLocalEvent.coverBlob;
                  let updatedPosterBlob = cachedLocalEvent.posterBlob;

                  if (remoteEvent.coverImageUrl && !cachedLocalEvent.coverBlob) {
                    updatedCoverBlob = await fetchImageAsBlob(remoteEvent.coverImageUrl);
                  }
                  if (remoteEvent.posterImageUrl && !cachedLocalEvent.posterBlob) {
                    updatedPosterBlob = await fetchImageAsBlob(remoteEvent.posterImageUrl);
                  }

                  // Preserve exact local primary key ID to prevent overwriting other events
                  await db.events.put({
                    ...remoteEvent,
                    id: cachedLocalEvent.id, 
                    registrationEndDate: remoteEvent.registrationEndDate || remoteEvent.registration_end_date || cachedLocalEvent.registrationEndDate,
                    coverBlob: updatedCoverBlob,
                    posterBlob: updatedPosterBlob,
                    syncStatus: 'synced'
                  });
                }
              })
              .catch(() => console.log("Background synchronization deferred."));
          }
        } else {
          // Case B: Local Cache Misses -> Hydrate from public route
          if (!navigator.onLine) {
            throw new Error("This event ledger isn't cached locally, and your system is currently offline.");
          }

          const response = await fetch(`/api/events/public?slug=${slug}`); 
          if (!response.ok) {
            throw new Error("The requested experience parameters were not found on remote storage targets.");
          }
          
          const onlineCloudData = await response.json();
          
          if (onlineCloudData && Array.isArray(onlineCloudData.events) && onlineCloudData.events.length > 0) {
            // Find the EXACT matching event for this slug instead of defaulting to events[0]
            const remoteEvent = onlineCloudData.events.find(
              (e: any) => e.slug?.toLowerCase() === slug
            ) || onlineCloudData.events[0];

            if (!remoteEvent || (remoteEvent.slug && remoteEvent.slug.toLowerCase() !== slug)) {
              throw new Error(`Event matching slug '${slug}' was not found.`);
            }

            const [coverBlob, posterBlob] = await Promise.all([
              fetchImageAsBlob(remoteEvent.coverImageUrl),
              fetchImageAsBlob(remoteEvent.posterImageUrl)
            ]);

            // Check if a local record already exists under this slug or ID
            const existingRecordBySlug = await db.events.where('slug').equals(slug).first();

            const normalizedCutoffDate = remoteEvent.registrationEndDate || remoteEvent.registration_end_date || null;

            const newLocalRecord = {
              ...remoteEvent,
              id: existingRecordBySlug ? existingRecordBySlug.id : (remoteEvent.id || undefined),
              registrationEndDate: normalizedCutoffDate,
              coverBlob,
              posterBlob,
              syncStatus: 'synced'
            };

            await db.events.put(newLocalRecord);

            const renderedRecordData = {
              ...newLocalRecord,
              registrationEndDate: normalizedCutoffDate,
              coverImageUrl: coverBlob ? createSafeObjectURL(coverBlob) : remoteEvent.coverImageUrl,
              posterImageUrl: posterBlob ? createSafeObjectURL(posterBlob) : remoteEvent.posterImageUrl
            };

            setEventRecord(renderedRecordData);
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

    return () => {
      createdObjectUrls.forEach(url => URL.revokeObjectURL(url));
    };
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