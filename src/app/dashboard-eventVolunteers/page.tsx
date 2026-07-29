'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { 
  QrCode, Clock, Loader, Bell, Sun, Moon, 
  LogOut, Calendar, Sparkles, LogIn, Utensils, RefreshCw, Lock,
  MoreVertical, X
} from 'lucide-react';
import { db } from '../../lib/db';
import EntryDeskCameraScanner from '../../components/Scanner';
import SyncStatusBar from '@/components/SyncStatusBar';
import LogoutButton from '@/components/LogoutButton';

type ScanMode = 'CHECK_IN' | 'FOOD_CLAIM';

export default function VolunteerCheckInPanel() {
  const [isDark, setIsDark] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUtilitiesOpen, setIsUtilitiesOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('CHECK_IN');

  // HYDRATION GUARD REF: Prevents infinite re-hydration loops across device screen sizes
  const hasHydratedRef = useRef(false);

  const router = useRouter();

  // 1. RESOLVE ACTIVE VOLUNTEER IDENTITY AND EVENT ID FROM LOCAL DEXIE SESSION
  const activeUser = useLiveQuery(async () => {
    if (!db.isOpen()) await db.open();
    return await db.users.toCollection().first();
  });

  const activeEventId = activeUser?.activeEventId || null;

  // 2. DEXIE LIVE QUERIES FOR ACTIVE WORKSPACE
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

  // FETCH ASSIGNED DESK SCOPE FROM INDEXEDDB managerEvents TABLE
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

  // Read assignedDesk stored in IndexedDB (defaulting to CHECK_IN)
  const assignedDesk = activeAssignment?.assignedDesk || 'CHECK_IN';

  // AUTOMATICALLY LOCK AND SYNC SCAN MODE BASED ON ASSIGNED DESK PERMISSION
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

  // 3. CONTEXTUAL METRICS FOR VOLUNTEER DESK (ADAPTS TO ACTIVE SCAN MODE)
  const deskMetrics = useLiveQuery(
    async () => {
      if (!resolvedEventId) {
        return { totalRegistered: 0, totalCheckedIn: 0, totalFoodEligible: 0, totalFoodClaimed: 0 };
      }

      const guests = await db.guests.where('eventId').equals(resolvedEventId).toArray();

      const totalRegistered = guests.length;
      const totalCheckedIn = guests.filter(g => Boolean(g.checkInTime || g.isCheckedIn === true)).length;
      const totalFoodEligible = guests.filter(g => Boolean(g.hasFoodAccess || (g as any).foodIncluded)).length;
      const totalFoodClaimed = guests.filter(g => Boolean(g.hasFoodClaimed || (g as any).foodClaimed)).length;

      return { totalRegistered, totalCheckedIn, totalFoodEligible, totalFoodClaimed };
    },
    [resolvedEventId]
  ) || { totalRegistered: 0, totalCheckedIn: 0, totalFoodEligible: 0, totalFoodClaimed: 0 };

  // Calculate percentage progress for active mode
  const currentCount = scanMode === 'CHECK_IN' ? deskMetrics.totalCheckedIn : deskMetrics.totalFoodClaimed;
  const currentTotal = scanMode === 'CHECK_IN' ? deskMetrics.totalRegistered : deskMetrics.totalFoodEligible;
  const progressPercent = currentTotal > 0 ? Math.min(100, Math.round((currentCount / currentTotal) * 100)) : 0;

  // 4. HYDRATION ENGINE: FETCH FROM POSTGRESQL AND STORE assignedDesk IN INDEXEDDB
  const hydrateWorkspaceFromPostgres = async (identifier: string, targetEventId?: number | null, forceRefresh = false) => {
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
          const managerIdentifier = (link.managerIdentifier || link.manager_identifier || '').toLowerCase();
          const eventId = Number(link.eventId || link.event_id);
          const desk = link.assignedDesk || link.assigned_desk || 'CHECK_IN';

          if (managerIdentifier && eventId) {
            const existing = await db.managerEvents
              .where('managerIdentifier')
              .equals(managerIdentifier)
              .filter(l => Number(l.eventId) === eventId)
              .first();

            if (existing && existing.id) {
              await db.managerEvents.update(existing.id, {
                assignedDesk: desk,
                assignedAt: link.assignedAt || link.assigned_at || Date.now(),
                syncStatus: 'synced'
              });
            } else {
              await db.managerEvents.add({
                managerIdentifier,
                eventId,
                assignedDesk: desk,
                assignedAt: link.assignedAt || link.assigned_at || Date.now(),
                syncStatus: 'synced'
              });
            }
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

      console.log('✅ Local IndexedDB successfully populated from PostgreSQL (including assignedDesk).');
    } catch (err) {
      console.error('❌ Sync hydration error:', err);
    } finally {
      setIsHydrating(false);
      setSyncMessage('');
    }
  };

  useEffect(() => {
    const verifyAndHydrate = async () => {
      if (!activeUser?.identifier || hasHydratedRef.current || isHydrating) return;

      const hasEventLocal = Boolean(activeEvent);
      let localGuestCount = 0;

      if (resolvedEventId) {
        localGuestCount = await db.guests.where('eventId').equals(resolvedEventId).count();
      }

      if ((!hasEventLocal || localGuestCount === 0) && navigator.onLine) {
        hasHydratedRef.current = true;
        await hydrateWorkspaceFromPostgres(activeUser.identifier, resolvedEventId);
      }
    };

    verifyAndHydrate();
  }, [activeUser?.identifier, Boolean(activeEvent), resolvedEventId]);

  if (activeUser === undefined) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center p-6 ${isDark ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Loader className="animate-spin text-purple-500 mb-3" size={36} />
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 animate-pulse">
          Initializing Terminal Session...
        </p>
      </div>
    );
  }

  // Non-blocking fallback: Render main shell with loading overlay if needed rather than unmounting entire layout
  if (!activeEvent && !isHydrating) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center p-6 text-center ${isDark ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Sparkles className="text-purple-500 mb-4 animate-pulse" size={48} />
        <h2 className="text-2xl font-black italic">No Event Assigned</h2>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">
          Your account is not currently provisioned for an active event gate desk.
        </p>
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
              <h1 className={`text-xl font-black italic tracking-tight ${activeEvent?.type === 'celebration' ? 'font-serif' : 'font-sans'}`}>
                {activeEvent?.name || 'Gate Terminal'}
              </h1>
            </div>
            <div className="flex items-center gap-3 text-slate-500 text-[9px] font-black uppercase tracking-[0.15em]">
              <span className="flex items-center gap-1"><Calendar size={11} className="text-purple-500" /> {activeEvent?.date || 'Live Gate'}</span>
              <span className="flex items-center gap-1"><Sparkles size={11} className="text-purple-500" /> {activeEvent?.protocol || 'open'}</span>
            </div>
          </div>
        </div>

        {/* SMALL SCREEN HEADER CONTROLS */}
        <div className="flex sm:hidden items-center gap-2">
          <SyncStatusBar />

          <button
            onClick={() => setIsUtilitiesOpen(!isUtilitiesOpen)}
            className={`p-2 rounded-xl border transition-all ${theme.inputBg}`}
            aria-label="Toggle Header Menu"
          >
            {isUtilitiesOpen ? <X size={18} /> : <MoreVertical size={18} />}
          </button>
        </div>

        {/* DESKTOP HEADER ACTION UTILITIES */}
        <div className="hidden sm:flex items-center gap-2.5">
          <SyncStatusBar />

          <button 
            onClick={() => setIsDark(!isDark)} 
            className={`w-12 h-10 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden ${theme.inputBg}`}
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

          <LogoutButton />
        </div>

        {/* COLLAPSIBLE SECONDARY MENU FOR SMALL SCREENS */}
        {isUtilitiesOpen && (
          <div className={`sm:hidden absolute top-full right-6 mt-2 p-4 rounded-2xl border z-50 shadow-2xl flex flex-col gap-3 animate-in slide-in-from-top-2 duration-200 ${theme.dropdownMenu}`}>
            <div className="flex items-center justify-between gap-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Theme Switch</span>
              <button 
                onClick={() => setIsDark(!isDark)} 
                className={`w-9 h-9 rounded-xl border flex items-center justify-center relative overflow-hidden ${theme.inputBg}`}
              >
                {isDark ? <Moon size={15} className="text-purple-400" /> : <Sun size={15} className="text-amber-500" />}
              </button>
            </div>

            <div className="flex items-center justify-between gap-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Recent Scans</span>
              <button 
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsUtilitiesOpen(false);
                }}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center relative ${theme.inputBg}`}
              >
                <Bell size={15} className="text-purple-500" />
                {recentCheckIns.length > 0 && (
                  <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-red-500 rounded-full" />
                )}
              </button>
            </div>

            <div className="pt-2 border-t border-inherit flex items-center justify-between gap-6">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Terminal Exit</span>
              <LogoutButton />
            </div>
          </div>
        )}
      </header>

      {/* CORE CONTROL COUNTER SUB-PANEL */}
      <div className="px-6 pt-6 flex flex-col items-center gap-4">
        
        {/* RESTRICTED MODE SELECTOR BRIDGE */}
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

        {/* CONTEXTUAL RATIO STAT CARD (ADAPTS TO CHECK_IN VS FOOD_CLAIM) */}
        <div className={`w-full max-w-xs p-5 rounded-2xl border flex flex-col gap-3 ${theme.card}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-xl text-white ${scanMode === 'CHECK_IN' ? 'bg-purple-600' : 'bg-amber-600'}`}>
                {scanMode === 'CHECK_IN' ? <LogIn size={16} /> : <Utensils size={16} />}
              </span>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {scanMode === 'CHECK_IN' ? 'Gate Stream Count' : 'Meals Served'}
              </p>
            </div>
            
            <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
              scanMode === 'CHECK_IN' 
                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}>
              {progressPercent}%
            </span>
          </div>

          <div className="flex items-baseline justify-between">
            <h3 className={`text-2xl font-black tracking-tight ${scanMode === 'CHECK_IN' ? 'text-purple-500' : 'text-amber-500'}`}>
              {currentCount} 
              <span className="text-xs font-bold text-slate-500 uppercase ml-1">
                / {currentTotal} {scanMode === 'CHECK_IN' ? 'Verified' : 'Claimed'}
              </span>
            </h3>
            
            {assignedDesk !== 'ALL' && (
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Lock size={10} /> Locked Node
              </span>
            )}
          </div>

          {/* STREAM PROGRESS BAR */}
          <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${scanMode === 'CHECK_IN' ? 'bg-purple-500' : 'bg-amber-500'}`} 
              style={{ width: `${progressPercent}%` }} 
            />
          </div>
        </div>
      </div>

      {/* TARGETED SCAN TOUCH ZONE (ENLARGED TOUCH TARGET WITH PULSE EFFECT) */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 my-auto">
        <div className="relative flex items-center justify-center">
          
          {/* OUTER RADAR PULSE GLOW */}
          <div className={`absolute -inset-4 rounded-full opacity-30 animate-ping ${
            scanMode === 'CHECK_IN' ? 'bg-purple-500' : 'bg-amber-500'
          }`} />

          {/* MAIN ENLARGED BUTTON */}
          <button 
            onClick={() => setIsScanning(true)}
            className={`relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all border-4 border-white/20 group hover:scale-105 ${
              scanMode === 'CHECK_IN' 
                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/40 ring-8 ring-purple-500/20' 
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/40 ring-8 ring-amber-500/20'
            }`}
          >
            <QrCode size={56} className="group-hover:scale-110 transition-transform text-white drop-shadow-md" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-white/90 drop-shadow">
              Scan QR Code
            </span>
          </button>
        </div>
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