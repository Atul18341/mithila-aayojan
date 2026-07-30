// src/components/SyncStatusBar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudSync, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '../lib/db';

// 🚀 UTILITY: Reads binary blobs from local storage and translates them to serialized text paths
const convertBlobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
};

let isSyncMutexLocked = false;

export default function SyncStatusBar() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncCounts, setLastSyncCounts] = useState<{ total: number } | null>(null);

  // Aggregated live tracker watching mutations across all local storage targets
  const telemetryData = useLiveQuery(async () => {
    if (!db.isOpen()) await db.open();

    const pendingEvents = await db.events.where('syncStatus').equals('pending').toArray();
    const pendingGuests = await db.guests.where('syncStatus').equals('pending').toArray();
    const pendingUsers = await db.users.where('syncStatus').equals('pending').toArray();
    const pendingLinks = await db.managerEvents.where('syncStatus').equals('pending').toArray();

    const activeSession = await db.users.toCollection().first();
    
    return {
      events: pendingEvents,
      guests: pendingGuests,
      users: pendingUsers,
      managerEvents: pendingLinks,
      managerEmail: activeSession?.identifier || 'unknown_offline_worker',
      userId: activeSession?.id || null,
      totalCount: pendingEvents.length + pendingGuests.length + pendingUsers.length + pendingLinks.length
    };
  }) || { 
    events: [], 
    guests: [], 
    users: [], 
    managerEvents: [], 
    managerEmail: 'unknown_offline_worker', 
    userId: null, 
    totalCount: 0 
  };

  const handleGlobalSync = async () => {
    // 🚀 Enforce mutual exclusion lock structures immediately
    if (isSyncing || isSyncMutexLocked || telemetryData.totalCount === 0) return;
    
    setIsSyncing(true);
    isSyncMutexLocked = true; // Engage lock
    setSyncError(null);
    setLastSyncCounts(null);

    // 🟢 Fix 1: Initialize AbortController for 10-second request timeout limit
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      // 🚀 HARDENING: Strictly isolate and process ONLY pending items
      const pendingEventsOnly = telemetryData.events.filter(ev => ev.syncStatus === 'pending');
      const sanitizedEvents = [];

      // 🟢 Fix 2: Only perform heavy base64 Blob conversion IF there are actual pending events!
      // This prevents image encoding loops when volunteers are purely scanning check-ins/food passes.
      if (pendingEventsOnly.length > 0) {
        for (const ev of pendingEventsOnly) {
          const eventPayload: any = {
            ...ev,
            clientTimestamp: ev.createdAt || Date.now(),
            coverBlobBase64: false,
            posterBlobBase64: false
          };

          if (ev.coverBlob instanceof Blob) {
            try {
              eventPayload.coverBlobBase64 = await convertBlobToBase64(ev.coverBlob);
            } catch (e) {
              console.error(`Failed to encode cover file string for event: ${ev.id}`, e);
            }
          }

          if (ev.posterBlob instanceof Blob) {
            try {
              eventPayload.posterBlobBase64 = await convertBlobToBase64(ev.posterBlob);
            } catch (e) {
              console.error(`Failed to encode poster file string for event: ${ev.id}`, e);
            }
          }

          sanitizedEvents.push(eventPayload);
        }
      } else {
        console.log("⚡ Fast-Path: No pending event media to encode. Syncing guest passes directly.");
      }

      const sanitizedGuests = telemetryData.guests
        .filter(gst => gst.syncStatus === 'pending')
        .map(gst => ({
          ...gst,
          clientTimestamp: gst.checkInTime || Date.now()
        }));

      const sanitizedLinks = telemetryData.managerEvents
        .filter(link => link.syncStatus === 'pending')
        .map(link => ({
          ...link,
          clientTimestamp: Date.now()
        }));

      // 🟢 Fix 1: Attach AbortSignal to prevent network requests from hanging forever
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          events: sanitizedEvents,
          guests: sanitizedGuests,
          users: telemetryData.users.filter(usr => usr.syncStatus === 'pending'),
          managerEvents: sanitizedLinks, 
          managerEmail: telemetryData.managerEmail,
          userId: telemetryData.userId
        }),
      });

      if (!response.ok) {
        let serverErrorMessage = "Cloud synchronization interface rejected payload sequence.";
        try {
          const errData = await response.json();
          if (errData.details || errData.error) {
            serverErrorMessage = `Sync Rejected: ${errData.details || errData.error}`;
          }
        } catch {
          // Fallback
        }
        throw new Error(serverErrorMessage);
      }

      const result = await response.json();
      
      if (result.success && result.counts) {
        // UNIFIED MULTI-TABLE TRANSACTION
        await db.transaction('rw', [db.events, db.guests, db.users, db.managerEvents], async () => {
          for (const ev of pendingEventsOnly) {
            if (ev.id) await db.events.update(ev.id, { syncStatus: 'synced' });
          }
          for (const gst of telemetryData.guests) {
            if (gst.id) await db.guests.update(gst.id, { syncStatus: 'synced' });
          }
          for (const usr of telemetryData.users) {
            if (usr.id) await db.users.update(usr.id, { syncStatus: 'synced' });
          }
          for (const link of telemetryData.managerEvents) {
            if (link.id) await db.managerEvents.update(link.id, { syncStatus: 'synced' });
          }
        });

        setLastSyncCounts(result.counts);
        console.log(`Successfully synced ${result.counts.total} rows confirmed by Postgres server.`);
      }
    } catch (err: any) {
      console.error("Global sync flush failed:", err);
      if (err.name === 'AbortError') {
        setSyncError("Sync Timeout: Spotty connection. Tap to retry.");
      } else {
        setSyncError(err.message || "Network link issue. Tap to retry.");
      }
    } finally {
      // 🟢 Clear timer and release locks safely in all execution paths
      clearTimeout(timeoutId);
      setIsSyncing(false);
      isSyncMutexLocked = false; 
    }
  };

  // AUTOMATIC BACKGROUND SYNCHRONIZATION ENGINE
  useEffect(() => {
    const triggerAutoSync = async () => {
      if (navigator.onLine && telemetryData.totalCount > 0 && !isSyncing) {
        await handleGlobalSync();
      }
    };
    window.addEventListener('online', triggerAutoSync);
    triggerAutoSync();

    return () => {
      window.removeEventListener('online', triggerAutoSync);
    };
  }, [telemetryData.totalCount, isSyncing]);

  const getColorScheme = () => {
    if (isSyncing) return 'bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-not-allowed';
    if (syncError) return 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20';
    if (telemetryData.totalCount > 0) {
      return 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse hover:bg-amber-500/20';
    }
    return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20';
  };

  return (
    <button
      type="button"
      onClick={handleGlobalSync}
      disabled={isSyncing}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all w-full h-full ${getColorScheme()}`}
      title={syncError || undefined}
    >
      {isSyncing ? (
        <>
          <RefreshCw size={14} className="animate-spin" />
          <span>Syncing Workspace...</span>
        </>
      ) : syncError ? (
        <>
          <CloudSync size={14} />
          <span className="truncate max-w-[120px]">{syncError.includes("Sync Rejected") ? "Schema Error" : "Retry Sync"}</span>
        </>
      ) : telemetryData.totalCount > 0 ? (
        <>
          <AlertCircle size={14} />
          <span>Push {telemetryData.totalCount} Updates</span>
        </>
      ) : (
        <>
          <CheckCircle size={14} />
          <span>
            {lastSyncCounts && lastSyncCounts.total > 0 
              ? `Synced +${lastSyncCounts.total} Rows` 
              : 'Data Synced'}
          </span>
        </>
      )}
    </button>
  );
}