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

    return {
      events: pendingEvents,
      guests: pendingGuests,
      users: pendingUsers,
      totalCount: pendingEvents.length + pendingGuests.length + pendingUsers.length
    };
  }) || { events: [], guests: [], users: [], totalCount: 0 };

  const handleGlobalSync = async () => {
    if (isSyncing || telemetryData.totalCount === 0) return;
    setIsSyncing(true);
    setSyncError(null);
    setLastSyncCounts(null);

    try {
      // Package up local updates into an envelope structure
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: telemetryData.events,
          guests: telemetryData.guests,
          users: telemetryData.users
        }),
      });

      if (!response.ok) throw new Error("Cloud synchronization interface rejected payload sequence.");

      // 🚀 Parse the verified successful counts returned by the PostgreSQL server transaction
      const result = await response.json();
      
      if (result.success && result.counts) {
        // 🚀 UNIFIED MULTI-TABLE TRANSACTION: Clears local queues ONLY after server confirmation
        await db.transaction('rw', [db.events, db.guests, db.users], async () => {
          for (const ev of telemetryData.events) {
            if (ev.id) await db.events.update(ev.id, { syncStatus: 'synced' });
          }
          for (const gst of telemetryData.guests) {
            if (gst.id) await db.guests.update(gst.id, { syncStatus: 'synced' });
          }
          for (const usr of telemetryData.users) {
            if (usr.id) await db.users.update(usr.id, { syncStatus: 'synced' });
          }
        });

        // Store the server's confirmed transaction metrics locally
        setLastSyncCounts(result.counts);
        console.log(`Successfully synced ${result.counts.total} rows confirmed by Postgres server.`);
      }
    } catch (err: any) {
      console.error("Global sync flush failed:", err);
      setSyncError("Network link issue. Tap to retry.");
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

  // 🚀 REFRACTORED COLOR STATE ENGINE: Checks server confirmation data points explicitly
  const getColorScheme = () => {
    if (isSyncing) return 'bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-not-allowed';
    if (syncError) return 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20';
    
    // Check if there are outstanding client updates waiting to go out
    if (telemetryData.totalCount > 0) {
      return 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse hover:bg-amber-500/20';
    }
    
    // Shows solid emerald green only when current local updates equal 0
    return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20';
  };

  return (
    <button
      type="button"
      onClick={handleGlobalSync}
      disabled={isSyncing}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all w-full h-full ${getColorScheme()}`}
    >
      {isSyncing ? (
        <>
          <RefreshCw size={14} className="animate-spin" />
          <span>Syncing Workspace...</span>
        </>
      ) : syncError ? (
        <>
          <CloudSync size={14} />
          <span>Retry Sync</span>
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