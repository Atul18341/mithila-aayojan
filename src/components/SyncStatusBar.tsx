// src/components/SyncStatusBar.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudSync, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '../lib/db';

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
    if (isSyncing || telemetryData.totalCount === 0) return;
    setIsSyncing(true);
    setSyncError(null);
    setLastSyncCounts(null);

    try {
      // 🚀 HARDENING STEP: Inject transaction timestamp metadata onto rows before payload sequence transmission
      // This guarantees your Option A 'client_timestamp' column can evaluate safely without falling back to system defaults.
      const sanitizedEvents = telemetryData.events.map(ev => ({
        ...ev,
        clientTimestamp: ev.createdAt || Date.now()
      }));

      const sanitizedGuests = telemetryData.guests.map(gst => ({
        ...gst,
        clientTimestamp: gst.checkInTime || Date.now()
      }));

      const sanitizedLinks = telemetryData.managerEvents.map(link => ({
        ...link,
        clientTimestamp: Date.now()
      }));

      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: sanitizedEvents,
          guests: sanitizedGuests,
          users: telemetryData.users,
          managerEvents: sanitizedLinks, 
          managerEmail: telemetryData.managerEmail,
          userId: telemetryData.userId
        }),
      });

      // 🚀 SAFELY PARSE DB EXCEPTION ERROR FOOTPRINTS
      if (!response.ok) {
        let serverErrorMessage = "Cloud synchronization interface rejected payload sequence.";
        try {
          const errData = await response.json();
          if (errData.details || errData.error) {
            serverErrorMessage = `Sync Rejected: ${errData.details || errData.error}`;
          }
        } catch {
          // Fallback if response is not JSON
        }
        throw new Error(serverErrorMessage);
      }

      const result = await response.json();
      
      if (result.success && result.counts) {
        // UNIFIED MULTI-TABLE TRANSACTION: Clears local queues ONLY after server confirmation
        await db.transaction('rw', [db.events, db.guests, db.users, db.managerEvents], async () => {
          for (const ev of telemetryData.events) {
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
      // Display the actual error description text directly inside the status button for quick debugging
      setSyncError(err.message || "Network link issue. Tap to retry.");
    } finally {
      setIsSyncing(false);
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