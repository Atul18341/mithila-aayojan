'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { 
  QrCode, Clock, Loader, Bell, Sun, Moon, 
  LogOut, Calendar, Sparkles, LogIn, Utensils, RefreshCw, Lock
} from 'lucide-react';
import { db } from '../../lib/db';
import EntryDeskCameraScanner from '../../components/Scanner';

type ScanMode = 'CHECK_IN' | 'FOOD_CLAIM';

export default function VolunteerCheckInPanel() {
  const [isDark, setIsDark] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('CHECK_IN');

  const router = useRouter();

  // 1. RESOLVE ACTIVE VOLUNTEER IDENTITY AND EVENT ID FROM LOCAL DEXIE SESSION
  const activeUser = useLiveQuery(async () => {
    if (!db.isOpen()) await db.open();
    return await db.users.toCollection().first();
  });

  const activeEventId = activeUser?.activeEventId || null;

  // 2. DEXIE LIVE QUERIES FOR ACTIVE WORKSPACE & ASSIGNED DESK PERMISSIONS
  const activeEvent = useLiveQuery(
    async () => {
      if (!activeEventId) {
        if (activeUser?.identifier) {
          const assignment = await db.managerEvents
            .where('managerIdentifier')
            .equals(activeUser.identifier)
            .first();
          if (assignment?.eventId) {
            return await db.events.get(assignment.eventId);
          }
        }
        return null;
      }
      return await db.events.get(activeEventId);
    },
    [activeEventId, activeUser?.identifier]
  );

  const resolvedEventId = activeEvent?.id || activeEventId || null;

  // FETCH VOLUNTEER'S ASSIGNED DESK SCOPE FROM managerEvents TABLE
  const activeAssignment = useLiveQuery(
    async () => {
      if (!activeUser?.identifier || !resolvedEventId) return null;
      return await db.managerEvents
        .where('managerIdentifier')
        .equals(activeUser.identifier.toLowerCase())
        .filter(link => Number(link.eventId) === Number(resolvedEventId))
        .first();
    },
    [activeUser?.identifier, resolvedEventId]
  );

  const assignedDesk = activeAssignment?.assignedDesk || 'CHECK_IN';

  // 🟢 AUTOMATICALLY LOCK AND SYNC SCAN MODE BASED ON ASSIGNED DESK PERMISSION
  useEffect(() => {
    if (assignedDesk === 'CHECK_IN') {
      setScanMode('CHECK_IN');
    } else if (assignedDesk === 'FOOD_CLAIM') {
      setScanMode('FOOD_CLAIM');
    }
  }, [assignedDesk]);

  const recentCheckIns = useLiveQuery(
    async () => {
      if (!resolvedEventId) return [];
      return await db.guests
        .where('eventId')
        .equals(resolvedEventId)
        .reverse()
        .limit(5)
        .toArray();
    },
    [resolvedEventId]
  ) || [];

  const totalCheckedIn = useLiveQuery(
    async () => {
      if (!resolvedEventId) return 0;
      return await db.guests
        .where('eventId')
        .equals(resolvedEventId)
        .filter(g => Boolean(g.checkInTime || g.isCheckedIn === true))
        .count();
    },
    [resolvedEventId]
  ) || 0;

  // 3. HYDRATION ENGINE: FETCH FROM POSTGRESQL IF DATA IS MISSING IN INDEXEDDB
  const hydrateWorkspaceFromPostgres = async (identifier: string, targetEventId?: number | null) => {
    if (!navigator.onLine) return;
    setIsHydrating(true);
    setSyncMessage('Fetching event data & guest manifests from cloud...');

    try {
      const response = await fetch(`/api/sync/pull?identifier=${encodeURIComponent(identifier)}`);
      if (!response.ok) throw new Error('Cloud dataset fetch failed.');

      const data = await response.json();
      const { events = [], guests = [], managerEvents = [] } = data;

      await db.transaction('rw', [db.events, db.guests, db.managerEvents, db.users], async () => {
        for (const ev of events) {
          if (ev.id) await db.events.put(ev);
        }

        for (const link of managerEvents) {
          const existing = await db.managerEvents
            .where('[managerIdentifier+eventId]')
            .equals([link.managerIdentifier, link.eventId])
            .first();
          if (!existing) {
            await db.managerEvents.add(link);
          }
        }

        for (const gst of guests) {
          if (gst.qrToken) {
            const existingGuest = await db.guests.where('qrToken').equals(gst.qrToken).first();
            if (existingGuest) {
              await db.guests.update(existingGuest.id!, gst);
            } else {
              await db.guests.add(gst);
            }
          }
        }

        const effectiveEventId = targetEventId || (events[0] ? events[0].id : null);
        if (effectiveEventId) {
          await db.users.where('identifier').equals(identifier).modify({
            activeEventId: Number(effectiveEventId)
          });
        }
      });

      console.log('✅ Local IndexedDB successfully populated from PostgreSQL.');
    } catch (err) {
      console.error('❌ Sync hydration error:', err);
    } finally {
      setIsHydrating(false);
      setSyncMessage('');
    }
  };

  useEffect(() => {
    const verifyAndHydrate = async () => {
      if (!activeUser?.identifier) return;

      const hasEventLocal = Boolean(activeEvent);
      let localGuestCount = 0;

      if (resolvedEventId) {
        localGuestCount = await db.guests.where('eventId').equals(resolvedEventId).count();
      }

      if ((!hasEventLocal || localGuestCount === 0) && navigator.onLine && !isHydrating) {
        await hydrateWorkspaceFromPostgres(activeUser.identifier, resolvedEventId);
      }
    };

    verifyAndHydrate();
  }, [activeUser?.identifier, activeEvent, resolvedEventId]);

  const handleLogout = async () => {
    try {
      if (!db.isOpen()) await db.open();
      await db.users.clear();
      router.push('/login');
    } catch (err) {
      console.error("Failed to disconnect gate terminal node:", err);
    }
  };

  if (isHydrating || (!activeEvent && isLoadingState(activeUser))) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center p-6 ${isDark ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Loader className="animate-spin text-purple-500 mb-3" size={36} />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
          {syncMessage || 'Initializing Gate Terminal Records...'}
        </p>
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center p-6 text-center ${isDark ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Sparkles className="text-purple-500 mb-4 animate-pulse" size={48} />
        <h2 className="text-2xl font-black italic">No Event Assigned</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">
          Your account is not currently provisioned for an active event gate desk.
        </p>
        <button 
          onClick={() => activeUser?.identifier && hydrateWorkspaceFromPostgres(activeUser.identifier, null)}
          className="mt-6 px-6 py-3 bg-purple-600 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center gap-2 hover:bg-purple-500 transition-all"
        >
          <RefreshCw size={14} /> Refresh Cloud Assignments
        </button>
      </div>
    );
  }

  const theme = {
    bg: isDark ? 'bg-[#020617]' : 'bg-slate-50',
    card: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm',
    inputBg: isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200',
    textMain: isDark ? 'text-white' : 'text-slate-900',
    dropdownMenu: isDark ? 'bg-[#0a0f1d] border-white/10' : 'bg-white border-slate-200 shadow-2xl'
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 flex flex-col justify-between overflow-x-hidden custom-scrollbar`}>
      
      {/* HEADER */}
      <header className={`sticky top-0 z-40 w-full px-6 py-4 border-b ${isDark ? 'border-white/5' : 'border-slate-200'} backdrop-blur-xl bg-inherit/80 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
          <div className="text-left space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              <h1 className={`text-xl font-black italic tracking-tight ${activeEvent.type === 'celebration' ? 'font-serif' : 'font-sans'}`}>
                {activeEvent.name}
              </h1>
            </div>
            <div className="flex items-center gap-3 text-slate-500 text-[9px] font-black uppercase tracking-[0.15em]">
              <span className="flex items-center gap-1"><Calendar size={11} className="text-purple-500" /> {activeEvent.date || 'Live Gate'}</span>
              <span className="flex items-center gap-1"><Sparkles size={11} className="text-purple-500" /> {activeEvent.protocol || 'open'}</span>
            </div>
          </div>
        </div>

        {/* RIGHT HEADER ACTION UTILITIES */}
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => activeUser?.identifier && hydrateWorkspaceFromPostgres(activeUser.identifier, resolvedEventId)}
            className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center ${theme.inputBg}`}
            title="Sync Latest Data from Cloud"
          >
            <RefreshCw size={16} className={`text-purple-400 ${isHydrating ? 'animate-spin' : ''}`} />
          </button>

          <button 
            onClick={() => setIsDark(!isDark)} 
            className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden ${theme.inputBg}`}
          >
            <div className={`transition-all duration-500 transform ${isDark ? 'translate-y-0' : 'translate-y-10 opacity-0'}`}>
              <Moon size={16} className="text-purple-400 fill-purple-400/10" />
            </div>
            <div className={`absolute transition-all duration-500 transform ${!isDark ? 'translate-y-0' : '-translate-y-10 opacity-0'}`}>
              <Sun size={16} className="text-amber-500 fill-amber-500/20" />
            </div>
          </button>

          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center relative transition-all ${theme.inputBg}`}
            >
              <Bell size={16} className={isNotificationsOpen ? 'text-purple-500' : 'text-slate-400'} />
              {recentCheckIns.length > 0 && (
                <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-inherit" />
              )}
            </button>

            {isNotificationsOpen && (
              <div className={`absolute top-full right-0 mt-3 w-72 rounded-3xl border p-4 z-50 animate-in fade-in zoom-in-95 ${theme.dropdownMenu}`}>
                <div className="flex justify-between items-center mb-3 px-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Your Recent Scans</span>
                  <span className="text-[8px] font-mono font-bold bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded-md">Live</span>
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                  {recentCheckIns.slice(0, 3).map((g: any) => (
                    <div key={g.id} className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[10px] flex flex-col gap-0.5">
                      <p className="font-bold truncate">
                        ✓ <span className="text-purple-400">{g.name}</span> verified.
                      </p>
                      <span className="text-[8px] text-slate-500 font-mono">
                        {new Date(g.checkInTime || g.foodClaimedTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                  {recentCheckIns.length === 0 && (
                    <p className="text-[11px] text-center py-4 text-slate-500 font-medium">No passes processed yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={handleLogout}
            className={`w-10 h-10 rounded-xl border flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors ${theme.inputBg}`}
            title="Disconnect Gate Terminal Node"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* CORE CONTROL COUNTER SUB-PANEL */}
      <div className="px-6 pt-6 flex flex-col items-center gap-4">
        
        {/* 🟢 RESTRICTED MODE SELECTOR BRIDGE */}
        <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl border w-full max-w-xs ${theme.card}`}>
          <button
            disabled={assignedDesk !== 'ALL' && assignedDesk !== 'CHECK_IN'}
            onClick={() => setScanMode('CHECK_IN')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'CHECK_IN' 
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn size={14} />
            Gate Check-In
          </button>
          <button
            disabled={assignedDesk !== 'ALL' && assignedDesk !== 'FOOD_CLAIM'}
            onClick={() => setScanMode('FOOD_CLAIM')}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'FOOD_CLAIM' 
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Utensils size={14} />
            Food Counter
          </button>
        </div>

        <div className={`inline-flex items-center gap-4 px-6 py-3 rounded-2xl border ${theme.card}`}>
          <div className="space-y-0.5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Desk Stream Count</p>
            <p className="text-2xl font-black text-purple-500 tracking-tight">{totalCheckedIn}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-left flex items-center gap-1.5">
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border tracking-wider transition-colors flex items-center gap-1 ${
              scanMode === 'CHECK_IN' 
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {assignedDesk !== 'ALL' && <Lock size={10} />}
              {scanMode === 'CHECK_IN' ? 'Gate Operator Node' : 'Food Stall Scanner'}
            </span>
          </div>
        </div>
      </div>

      {/* TARGETED SCAN TOUCH ZONE */}
      <div className="flex-1 flex flex-col justify-center items-center p-6">
        <button 
          onClick={() => setIsScanning(true)}
          className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 shadow-2xl active:scale-95 transition-all border-4 border-white/10 group ${
            scanMode === 'CHECK_IN' 
              ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-500/20' 
              : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
          }`}
        >
          <QrCode size={36} className="animate-pulse group-hover:scale-110 transition-transform text-white" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/90">Scan QR Code</span>
        </button>
      </div>

      {/* FOOTER BAR */}
      <footer className={`p-4 text-center border-t ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-400'} text-[8px] font-black uppercase tracking-[0.2em]`}>
        Mithila Aayojan Encryption Lock Edge Terminal Secure Active
      </footer>

      {/* DETACHED CAMERA SCANNER ENGINE PORTAL */}
      {isScanning && resolvedEventId && (
        <EntryDeskCameraScanner 
          currentEventId={resolvedEventId}
          variant={scanMode === 'CHECK_IN' ? 'purple' : 'amber'}
          isDark={isDark}
          scanMode={scanMode}
          onClose={() => setIsScanning(false)}
          onScanExecute={async (token) => {
            const guest = await db.guests.where('qrToken').equals(token).first();
            
            if (!guest || guest.eventId !== resolvedEventId) {
              return { status: 'error', message: 'Access Denied: Invalid credential for this venue.' };
            }

            // GATE CHECK-IN EVALUATION
            if (scanMode === 'CHECK_IN') {
              if (guest.checkInTime || guest.isCheckedIn === true) {
                return { status: 'warning', message: 'Pass duplicate scan exception.', name: guest.name };
              }
              
              await db.guests.update(guest.id!, { 
                checkInTime: Date.now(),
                isCheckedIn: true,
                syncStatus: 'pending'
              });
              return { status: 'success', message: `${(guest.category || 'General').toUpperCase()} pass authenticated.`, name: guest.name };
            }

            // FOOD COUNTER VOUCHER EVALUATION
            if (scanMode === 'FOOD_CLAIM') {
              if (!guest.hasFoodAccess) {
                return { status: 'error', message: 'Denied: Food not included with this pass tier.', name: guest.name };
              }
              
              if (guest.hasFoodClaimed) {
                return { status: 'warning', message: 'Food already claimed for this pass reference.', name: guest.name };
              }

              await db.guests.update(guest.id!, { 
                hasFoodClaimed: true, 
                foodClaimedTime: Date.now(),
                syncStatus: 'pending'
              });
              
              return { status: 'success', message: 'Meal Plate Allocation Approved.', name: guest.name };
            }

            return { status: 'error', message: 'System processing fault.' };
          }}
        />
      )}
    </div>
  );
}

function isLoadingState(user: any): boolean {
  return user === undefined;
}