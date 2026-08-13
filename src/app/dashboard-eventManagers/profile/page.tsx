'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  User, Mail, Shield, Save, KeyRound, CheckCircle2, 
  Loader2, HardDrive, ArrowLeft, Crown, Sparkles, AlertCircle
} from 'lucide-react';
import { db } from '@/lib/db';

export default function ManagerProfilePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [profile, setProfile] = useState({
    id: undefined as number | undefined,
    name: '',
    identifier: '',
    role: 'manager' as 'manager' | 'volunteer',
    activeEventId: 0,
    passkey: '',
    syncStatus: 'synced'
  });

  const [activeEventName, setActiveEventName] = useState<string>('Unassigned Event');

  // 1. Fetch current manager session from IndexedDB on mount
  useEffect(() => {
    async function loadManagerProfile() {
      try {
        if (!db.isOpen()) await db.open();

        const activeUser = await db.users.toCollection().first();
        if (activeUser) {
          setProfile({
            id: activeUser.id,
            name: activeUser.name || '',
            identifier: activeUser.identifier || '',
            role: activeUser.role || 'manager',
            activeEventId: activeUser.activeEventId || 0,
            passkey: activeUser.passkey || '',
            syncStatus: activeUser.syncStatus || 'synced'
          });

          // Fetch active event name if bound
          if (activeUser.activeEventId) {
            const ev = await db.events.get(activeUser.activeEventId);
            if (ev) setActiveEventName(ev.name);
          }
        }
      } catch (err) {
        console.error('Failed to load manager profile from Dexie DB:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadManagerProfile();
  }, []);

  // 2. Persist profile changes locally and queue for push sync
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.id) return;

    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await db.users.update(profile.id, {
        name: profile.name.trim(),
        passkey: profile.passkey.trim(),
        syncStatus: 'pending', // 🟢 Sets syncStatus to pending for SyncStatusBar background push
      });

      setProfile(prev => ({ ...prev, syncStatus: 'pending' }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err) {
      console.error('Failed to save profile changes to local storage:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-blue-500" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 animate-in fade-in duration-200">
      {/* NAVIGATION & TOP HEADER */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
        <div className="space-y-1">
          <Link
            href="/dashboard-eventManagers/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-500 transition-colors mb-1"
          >
            <ArrowLeft size={14} />
            <span>Back to Dashboard</span>
          </Link>
          <h1 className="text-xl font-black italic tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <span>Manager Account Credentials</span>
            <Crown size={18} className="text-amber-500" />
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Configure your administrative identity, security passkeys, and event ownership metadata.
          </p>
        </div>
      </div>

      {/* READ-ONLY ACCOUNT BADGES & SYNC TELEMETRY */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl border bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Shield size={12} className="text-blue-500" />
            <span>Privilege Clearance</span>
          </span>
          <p className="text-xs font-bold capitalize text-slate-900 dark:text-white flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {profile.role} Level Access
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <HardDrive size={12} className="text-amber-500" />
            <span>Active Bound Event</span>
          </span>
          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
            {activeEventName}
          </p>
        </div>

        <div className="p-4 rounded-2xl border bg-slate-50/50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 space-y-1">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
            <Sparkles size={12} className="text-purple-500" />
            <span>Local Sync Status</span>
          </span>
          <p className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            {profile.syncStatus === 'pending' ? (
              <span className="inline-flex items-center gap-1 text-amber-500">
                <AlertCircle size={12} />
                <span>Queued for Sync</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <CheckCircle2 size={12} />
                <span>Synced with Cloud</span>
              </span>
            )}
          </p>
        </div>
      </div>

      {/* EDITABLE CREDENTIALS FORM */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950 space-y-4 shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">
            Identity & Authentication Parameters
          </h3>

          <div className="space-y-4">
            {/* Account Identifier (Email / Unique Login) - Read Only */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Account Identifier (Email)
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  disabled
                  value={profile.identifier}
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                />
              </div>
              <span className="text-[10px] text-slate-400 block ml-1">
                Account identifiers serve as primary keys for event ownership links and cannot be edited.
              </span>
            </div>

            {/* Display Name (Public Badges & Event Cards) */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Public Organizer Name
              </label>
              <div className="relative group">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="Ex: Atul Kumar"
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all"
                />
              </div>
              <span className="text-[10px] text-slate-400 block ml-1">
                This display name appears as the official host on public event pages ("Organized by: [Name]").
              </span>
            </div>

            {/* Passkey / Secret PIN */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                Passkey / Security Access PIN
              </label>
              <div className="relative group">
                <KeyRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                <input
                  type="password"
                  value={profile.passkey}
                  onChange={(e) => setProfile({ ...profile, passkey: e.target.value })}
                  placeholder="Enter security access passkey..."
                  className="w-full pl-10 pr-4 py-2.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-800 dark:text-white outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all"
                />
              </div>
              <span className="text-[10px] text-slate-400 block ml-1">
                Used to unlock manager controls during offline terminal sessions.
              </span>
            </div>
          </div>
        </div>

        {/* SUBMIT ACTION BAR */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-slate-400 font-medium">
            Changes save locally first and auto-sync when online.
          </p>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Caching Changes...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 size={14} />
                <span>Profile Cached</span>
              </>
            ) : (
              <>
                <Save size={14} />
                <span>Save Profile Changes</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}