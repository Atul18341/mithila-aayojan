// src/app/events/[slug]/page.tsx
'use client';

import React, { useState, useEffect, use } from 'react';
import { db } from '../../../lib/db'; 
import PublicEventPortal from './PublicEventPortal';
import { Loader2, AlertCircle } from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

// Track attempt counts to restrict fallbacks to max 2 attempts per URL
const MAX_IMAGE_RETRIES = 2;
const imageFetchAttempts = new Map<string, number>();

// 🟢 Helper utility to fetch remote public assets as Blobs with retry limiting (1-2 times)
async function fetchImageAsBlob(url: string | null | undefined): Promise<Blob | null> {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return null;
  }

  const currentAttempts = imageFetchAttempts.get(url) || 0;
  if (currentAttempts >= MAX_IMAGE_RETRIES) {
    return null;
  }

  // Increment attempt count
  imageFetchAttempts.set(url, currentAttempts + 1);
  
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      return null;
    }
    const blob = await response.blob();
    if (blob && blob.size > 0) {
      return blob;
    }
    return null;
  } catch (err) {
    return null;
  }
}

function resolveImageUrl(data: any, keys: string[]): string | undefined {
  if (!data) return undefined;
  for (const key of keys) {
    if (data[key] && typeof data[key] === 'string' && data[key].trim()) {
      return data[key].trim();
    }
  }
  return undefined;
}

export default function EventDynamicRoutingWrapper({ params }: PageProps) {
  const unwrappedParams = use(params);
  const rawSlug = unwrappedParams.slug;
  const slug = rawSlug ? rawSlug.trim().toLowerCase() : '';

  const [eventRecord, setEventRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const createdObjectUrls: string[] = [];

    const createSafeObjectURL = (blobData: any) => {
      if (!blobData) return undefined;
      if (blobData instanceof Blob && blobData.size > 0) {
        try {
          const url = URL.createObjectURL(blobData);
          createdObjectUrls.push(url);
          return url;
        } catch {
          return undefined;
        }
      }
      return undefined;
    };

    async function evaluateHybridDataLayer() {
      try {
        setLoading(true);
        if (!slug) throw new Error("Invalid event identifier supplied.");

        // 1. Local Dexie Lookup
        const cachedLocalEvent = await db.events.where('slug').equals(slug).first();

        if (cachedLocalEvent) {
          const coverObjectUrl = createSafeObjectURL(cachedLocalEvent.coverBlob);
          const posterObjectUrl = createSafeObjectURL(cachedLocalEvent.posterBlob);

          const coverUrl = coverObjectUrl || resolveImageUrl(cachedLocalEvent, ['coverImageUrl', 'cover_image', 'coverImage', 'banner']);
          const posterUrl = posterObjectUrl || resolveImageUrl(cachedLocalEvent, ['posterImageUrl', 'poster_image', 'posterImage', 'poster', 'image']);

          const processedLocalData = {
            ...cachedLocalEvent,
            registrationEndDate: cachedLocalEvent.registrationEndDate || null,
            coverImageUrl: coverUrl,
            posterImageUrl: posterUrl,
          };
          
          setEventRecord(processedLocalData);
          setLoading(false);

          // Quiet background reconciliation
          if (navigator.onLine) {
            fetch(`/api/events/public?slug=${encodeURIComponent(slug)}`)
              .then(res => res.ok ? res.json() : null)
              .then(async (freshCloudData) => {
                if (freshCloudData && Array.isArray(freshCloudData.events) && freshCloudData.events.length > 0) {
                  const remoteEvent = freshCloudData.events.find(
                    (e: any) => e.slug?.toLowerCase() === slug || String(e.id) === slug
                  ) || freshCloudData.events[0];

                  if (!remoteEvent || (remoteEvent.slug && remoteEvent.slug.toLowerCase() !== slug)) {
                    return;
                  }

                  const remoteCoverUrl = resolveImageUrl(remoteEvent, ['coverImageUrl', 'cover_image', 'coverImage', 'banner']);
                  const remotePosterUrl = resolveImageUrl(remoteEvent, ['posterImageUrl', 'poster_image', 'posterImage', 'poster', 'image']);

                  let updatedCoverBlob = cachedLocalEvent.coverBlob;
                  let updatedPosterBlob = cachedLocalEvent.posterBlob;

                  if (remoteCoverUrl && !cachedLocalEvent.coverBlob) {
                    updatedCoverBlob = await fetchImageAsBlob(remoteCoverUrl);
                  }
                  if (remotePosterUrl && !cachedLocalEvent.posterBlob) {
                    updatedPosterBlob = await fetchImageAsBlob(remotePosterUrl);
                  }

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
              .catch(() => {});
          }
        } else {
          // 2. Cloud Fallback Fetch
          if (!navigator.onLine) {
            throw new Error("This event is not cached locally, and your device is currently offline.");
          }

          const response = await fetch(`/api/events/public?slug=${encodeURIComponent(slug)}`); 
          if (!response.ok) {
            throw new Error("The requested event details were not found on the server.");
          }
          
          const onlineCloudData = await response.json();
          
          if (onlineCloudData && Array.isArray(onlineCloudData.events) && onlineCloudData.events.length > 0) {
            const remoteEvent = onlineCloudData.events.find(
              (e: any) => e.slug?.toLowerCase() === slug
            ) || onlineCloudData.events[0];

            if (!remoteEvent || (remoteEvent.slug && remoteEvent.slug.toLowerCase() !== slug)) {
              throw new Error(`Event matching slug '${slug}' was not found.`);
            }

            const targetCoverUrl = resolveImageUrl(remoteEvent, ['coverImageUrl', 'cover_image', 'coverImage', 'banner']);
            const targetPosterUrl = resolveImageUrl(remoteEvent, ['posterImageUrl', 'poster_image', 'posterImage', 'poster', 'image']);

            const [coverBlob, posterBlob] = await Promise.all([
              fetchImageAsBlob(targetCoverUrl),
              fetchImageAsBlob(targetPosterUrl)
            ]);

            const existingRecordBySlug = await db.events.where('slug').equals(slug).first();
            const normalizedCutoffDate = remoteEvent.registrationEndDate || remoteEvent.registration_end_date || null;

            const newLocalRecord = {
              ...remoteEvent,
              id: existingRecordBySlug ? existingRecordBySlug.id : (remoteEvent.id || undefined),
              registrationEndDate: normalizedCutoffDate,
              coverBlob: coverBlob || undefined,
              posterBlob: posterBlob || undefined,
              syncStatus: 'synced'
            };

            await db.events.put(newLocalRecord);

            const finalCoverUrl = coverBlob ? createSafeObjectURL(coverBlob) : targetCoverUrl;
            const finalPosterUrl = posterBlob ? createSafeObjectURL(posterBlob) : targetPosterUrl;

            setEventRecord({
              ...newLocalRecord,
              registrationEndDate: normalizedCutoffDate,
              coverImageUrl: finalCoverUrl,
              posterImageUrl: finalPosterUrl
            });
          } else {
            throw new Error("Empty response returned from event service.");
          }
          setLoading(false);
        }
      } catch (err: any) {
        setErrorMessage(err.message || "An error occurred while loading the event.");
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
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Loading Event Details...</p>
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
          <h4 className="text-sm font-bold text-white uppercase tracking-wider">Event Not Found</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            {errorMessage || "The event could not be resolved."}
          </p>
        </div>
      </div>
    );
  }

  return <PublicEventPortal event={eventRecord} />;
}