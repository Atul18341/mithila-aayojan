// src/components/SyncStatusBar.tsx
'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CloudSync, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { db } from '../lib/db'; // Adjust this path to match your Dexie instance location

export default function SyncStatusBar() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  // Reactively track how many guests have a pending sync status in IndexedDB
  const pendingCount = useLiveQuery(
    async () => {
      if (!db.isOpen()) await db.open();
      return await db.guests.where('syncStatus').equals('pending').count();
    },
    []
  ) || 0;

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncError(null);

    try {
      // Gather all locally queued items
      const unsyncedData = await db.guests.where('syncStatus').equals('pending').toArray();
      
      if (unsyncedData.length === 0) {
        setIsSyncing(false);
        return;
      }

      // Flush to your Next.js PostgreSQL-backed API route
      const response = await fetch('/api/sync/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mutations: unsyncedData }),
      });

      if (!response.ok) throw new Error("Synchronization rejected by cloud destination.");
      
      // Update local ledger records to 'synced' on a successful server response
      await db.transaction('rw', db.guests, async () => {
        for (const guest of unsyncedData) {
          if (guest.id) {
            await db.guests.update(guest.id, { syncStatus: 'synced' });
          }
        }
      });

    } catch (err: any) {
      console.error("Manual sync pipeline execution trace failed:", err);
      setSyncError("Sync failed. Tap to retry.");
    } finally {
      setIsSyncing(false);
    }
  };

  // 🚀 DYNAMIC COLOR ENGINE GENERATOR
  const getColorScheme = () => {
    if (isSyncing) {
      return 'bg-blue-500/10 border-blue-500/30 text-blue-400 cursor-not-allowed';
    }
    if (syncError) {
      return 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20';
    }
    if (pendingCount > 0) {
      return 'bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse hover:bg-amber-500/20';
    }
    // Default: Fully Synced
    return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20';
  };

  return (
    <button
      type="button"
      onClick={handleManualSync}
      disabled={isSyncing}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all w-full h-full ${getColorScheme()}`}
    >
      {isSyncing ? (
        <>
          <RefreshCw size={40} className="animate-spin" />
          <span>Syncing...</span>
        </>
      ) : syncError ? (
        <>
          <CloudSync size={40} />
          <span>Retry Sync</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <AlertCircle size={40} />
          <span>Push {pendingCount} Logs</span>
        </>
      ) : (
        <>
          <CheckCircle size={40} />
          <span>Database Synced</span>
        </>
      )}
    </button>
  );
}