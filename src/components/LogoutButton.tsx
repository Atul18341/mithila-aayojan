// src/components/LogoutButton.tsx
'use client';

import React, { useState } from 'react';
import { LogOut, AlertTriangle, Loader2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  // 1. Check if any tables still contain un-synced data items
  const pendingCount = useLiveQuery(async () => {
    if (!db.isOpen()) await db.open();
    const e = await db.events.where('syncStatus').equals('pending').count();
    const g = await db.guests.where('syncStatus').equals('pending').count();
    const u = await db.users.where('syncStatus').equals('pending').count();
    return e + g + u;
  }) || 0;

  const handleLogoutAttempt = () => {
    // Block logout if there are dirty offline rows waiting to go to PostgreSQL
    if (pendingCount > 0) {
      setShowWarning(true);
      return;
    }
    executeSafeLogout();
  };

  const executeSafeLogout = async () => {
    setIsLoggingOut(true);
    setShowWarning(false);

    try {
      // 2. Clear out your local volatile runtime user data store (if you have a users table)
      // We clear the active session/profile configuration but keep core events/guests cache
      await db.users.where('role').equals('volunteer').delete(); 

      // 3. Clear your Next.js Server Cookie / Auth session token via an API route or server action
      const response = await fetch('/api/auth/logout', { method: 'POST' });

      if (response.ok) {
        // Redirect back to login view portal
        router.refresh();
        router.push('/login');
      }
    } catch (err) {
      console.error("Logout pipeline execution drop:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleLogoutAttempt}
        disabled={isLoggingOut}
        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
      >
        {isLoggingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
        <span>Exit Terminal</span>
      </button>

      {/* WARNING MODAL OVERLAY: Triggers only if offline data is trapped on browser disk */}
      {showWarning && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl p-6 bg-[#020617] border border-red-500/30 text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-400">
              <AlertTriangle size={24} className="animate-pulse" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-base font-black text-white tracking-tight">Unsynced Logs Active</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                There are still <span className="text-amber-400 font-bold">{pendingCount} updates</span> stored locally that haven't hit the cloud. Logging out now on a shared device could lock this data away.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowWarning(false)}
                className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
              >
                Cancel & Sync
              </button>
              <button
                type="button"
                onClick={executeSafeLogout}
                className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/10 transition-colors"
              >
                Force Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}