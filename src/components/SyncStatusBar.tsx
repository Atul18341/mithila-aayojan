'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
    const pendingRegistrations = await db.eventRegistrations.where('syncStatus').equals('pending').toArray();

    const activeSession = await db.users.toCollection().first();
    
    return {
      events: pendingEvents,
      guests: pendingGuests,
      users: pendingUsers,
      managerEvents: pendingLinks,
      registrations: pendingRegistrations,
      managerEmail: activeSession?.identifier || 'unknown_offline_worker',
      userId: activeSession?.id || null,
      totalCount: pendingEvents.length + pendingGuests.length + pendingUsers.length + pendingLinks.length + pendingRegistrations.length
    };
  }) || { 
    events: [], 
    guests: [], 
    users: [], 
    managerEvents: [], 
    registrations: [], 
    managerEmail: 'unknown_offline_worker', 
    userId: null, 
    totalCount: 0 
  };

  // PULL OPERATION: Fetch latest updates from online database
  const executePullSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing || isSyncMutexLocked) return;

    try {
      const userIdentifier = telemetryData.managerEmail;
      if (!userIdentifier || userIdentifier === 'unknown_offline_worker') return;

      const lastSyncTime = localStorage.getItem('last_pull_timestamp') || '0';
      
      const res = await fetch(
        `/api/sync/pull?volunteerIdentifier=${encodeURIComponent(userIdentifier)}&since=${lastSyncTime}`
      );
      const result = await res.json();

      if (result.success && result.data) {
        await db.transaction('rw', [db.events, db.guests, db.eventRegistrations, db.managerEvents, db.users], async () => {
          if (result.data.events) await db.events.bulkPut(result.data.events);
          if (result.data.guests) await db.guests.bulkPut(result.data.guests);
          if (result.data.eventRegistrations) await db.eventRegistrations.bulkPut(result.data.eventRegistrations);
          if (result.data.managerEvents) await db.managerEvents.bulkPut(result.data.managerEvents);
          if (result.data.users) await db.users.bulkPut(result.data.users);
        });

        localStorage.setItem('last_pull_timestamp', String(result.timestamp || Date.now()));
        console.log("⚡ Pull sync: Local database updated successfully.");
      }
    } catch (err) {
      console.warn("⚠️ Pull sync failed:", err);
    }
  }, [telemetryData.managerEmail, isSyncing]);

  // PUSH OPERATION: Send pending local mutations to online database
  const handleGlobalSync = useCallback(async () => {
    if (isSyncing || isSyncMutexLocked || telemetryData.totalCount === 0) return;
    
    setIsSyncing(true);
    isSyncMutexLocked = true;
    setSyncError(null);
    setLastSyncCounts(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const pendingEventsOnly = telemetryData.events.filter(ev => ev.syncStatus === 'pending');
      const sanitizedEvents = [];

      if (pendingEventsOnly.length > 0) {
        for (const ev of pendingEventsOnly) {
          const eventPayload: any = {
            ...ev,
            ...(ev.isMultiCompetition !== undefined ? { isMultiCompetition: Boolean(ev.isMultiCompetition) } : {}),
            ...(Array.isArray(ev.competitions) ? { competitions: ev.competitions } : {}),
            ...(ev.organizerId ? { organizerId: ev.organizerId } : (telemetryData.userId ? { organizerId: telemetryData.userId } : {})),
            ...(ev.organizerName ? { organizerName: ev.organizerName } : {}),
            ...(ev.organizerEmail ? { organizerEmail: ev.organizerEmail } : (telemetryData.managerEmail ? { organizerEmail: telemetryData.managerEmail } : {})),

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
      }

      const sanitizedGuests = telemetryData.guests
        .filter(gst => gst.syncStatus === 'pending')
        .map(gst => ({
          ...gst,
          name: gst.name || undefined,
          email: gst.email || undefined,
          phone: gst.phone || undefined,
          checkInTime: gst.checkInTime || undefined,
          isCheckedIn: Boolean(gst.isCheckedIn || gst.checkInTime),
          isCheckIn: (gst.checkInTime || gst.isCheckedIn) ? 1 : 0,
          hasFoodAccess: Boolean(gst.hasFoodAccess || (gst as any).isFoodAccess || (gst as any).foodIncluded),
          hasFoodClaimed: Boolean(gst.hasFoodClaimed || (gst as any).isFoodClaimed || (gst as any).foodClaimed),
          isFoodClaimed: Boolean(gst.hasFoodClaimed || (gst as any).isFoodClaimed || (gst as any).foodClaimed),
          foodClaimedTime: (gst as any).foodClaimedTime || (gst as any).foodClaimedAt || undefined,
          clientTimestamp: gst.checkInTime || (gst as any).foodClaimedTime || (gst as any).foodClaimedAt || Date.now()
        }));

      const sanitizedRegistrations = telemetryData.registrations
        .filter(reg => reg.syncStatus === 'pending')
        .map(reg => ({
          ...reg,
          ...(reg.competitionId ? { competitionId: reg.competitionId } : {}),
          ...(reg.competitionTitle ? { competitionTitle: reg.competitionTitle } : {}),
          clientTimestamp: reg.registrationTimestamp || Date.now()
        }));

      const sanitizedLinks = telemetryData.managerEvents
        .filter(link => link.syncStatus === 'pending')
        .map(link => ({
          ...link,
          clientTimestamp: Date.now()
        }));

      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          events: sanitizedEvents,
          guests: sanitizedGuests,
          registrations: sanitizedRegistrations,
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
        await db.transaction('rw', [db.events, db.guests, db.users, db.managerEvents, db.eventRegistrations], async () => {
          for (const ev of pendingEventsOnly) {
            if (ev.id) await db.events.update(ev.id, { syncStatus: 'synced' });
          }
          for (const gst of telemetryData.guests) {
            if (gst.id) await db.guests.update(gst.id, { syncStatus: 'synced' });
          }
          for (const reg of telemetryData.registrations) {
            if (reg.id) await db.eventRegistrations.update(reg.id, { syncStatus: 'synced' });
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
      clearTimeout(timeoutId);
      setIsSyncing(false);
      isSyncMutexLocked = false; 
    }
  }, [telemetryData, isSyncing]);

  // 🟢 COMBINED MANUAL ACTION: Push pending items (if any) then immediately pull latest updates
  const handleManualSyncClick = async () => {
    if (isSyncing || isSyncMutexLocked) return;

    if (telemetryData.totalCount > 0) {
      await handleGlobalSync();
    } else {
      // If no items are pending to push, manually trigger a pull right away
      setIsSyncing(true);
      isSyncMutexLocked = true;
      setSyncError(null);
      try {
        await executePullSync();
      } catch (err: any) {
        setSyncError(err?.message || "Pull sync failed.");
      } finally {
        setIsSyncing(false);
        isSyncMutexLocked = false;
      }
    }
  };

  // AUTOMATIC SYNCHRONIZATION ENGINE (Push on pending/online & Pull every 30 minutes)
  useEffect(() => {
    const triggerAutoPush = async () => {
      if (navigator.onLine && telemetryData.totalCount > 0 && !isSyncing) {
        await handleGlobalSync();
      }
    };

    window.addEventListener('online', triggerAutoPush);
    triggerAutoPush();

    // Set up 30-minute periodic pull interval
    const THIRTY_MINUTES_MS = 30 * 60 * 1000;
    const pullIntervalId = setInterval(() => {
      if (navigator.onLine) {
        executePullSync();
      }
    }, THIRTY_MINUTES_MS);

    return () => {
      window.removeEventListener('online', triggerAutoPush);
      clearInterval(pullIntervalId);
    };
  }, [telemetryData.totalCount, isSyncing, handleGlobalSync, executePullSync]);

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
      onClick={handleManualSyncClick}
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
              : 'Sync Data'}
          </span>
        </>
      )}
    </button>
  );
}