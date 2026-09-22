// src/app/dashboard-eventManagers/volunteers/panel/page.tsx
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { 
  QrCode, Clock, Loader, Bell, Sun, Moon, 
  LogOut, Calendar, Sparkles, LogIn, Utensils, RefreshCw, Lock,
  MoreVertical, X, Search, CheckCircle2, Trophy, Eye
} from 'lucide-react';
import { db } from '../../../lib/db';
import EventScanner from '../../../components/Scanner';
import SyncStatusBar from '@/components/SyncStatusBar';
import LogoutButton from '@/components/LogoutButton';
import UniversalRegistrationForm from '@/components/EventRegistration';

type ScanMode = 'CHECK_IN' | 'FOOD_CLAIM' | 'REGISTRATION';

export default function VolunteerCheckInPanel() {
  const [isDark, setIsDark] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isUtilitiesOpen, setIsUtilitiesOpen] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [scanMode, setScanMode] = useState<ScanMode>('CHECK_IN');

  // Modal List Inspector State for Volunteers ('checkin' | 'food' | null)
  const [activeModalList, setActiveModalList] = useState<'checkin' | 'food' | null>(null);

  // Fast-Tap Search State for Food Claim Desk
  const [foodSearchQuery, setFoodSearchQuery] = useState('');
  const [claimActionLoadingId, setClaimActionLoadingId] = useState<number | string | null>(null);

  // HYDRATION GUARD REF
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

  const isMultiCompEvent = Boolean(
    activeEvent?.isMultiCompetition || 
    activeEvent?.type === 'exam' || 
    (activeEvent?.competitions && activeEvent.competitions.length > 0)
  );

  // FETCH ASSIGNED DESK SCOPE
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

  useEffect(() => {
    if (assignedDesk === 'CHECK_IN') {
      setScanMode('CHECK_IN');
    } else if (assignedDesk === 'FOOD_CLAIM') {
      setScanMode('FOOD_CLAIM');
    } else if (assignedDesk === 'REGISTRATION') {
      setScanMode('REGISTRATION');
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

  // FETCH ALL GUESTS FOR LIST INSPECTORS & FOOD CLAIM FILTERING
  const allEventGuests = useLiveQuery(
    async () => {
      if (!resolvedEventId) return [];
      return await db.guests.where('eventId').equals(resolvedEventId).toArray();
    },
    [resolvedEventId]
  ) || [];

  // SORTED & FILTERED LISTS FOR MODAL INSPECTORS (Descending Order)
  const checkedInGuestsList = useMemo(() => {
    return allEventGuests
      .filter(g => Boolean(g.checkInTime || g.isCheckedIn))
      .sort((a, b) => (b.checkInTime || 0) - (a.checkInTime || 0));
  }, [allEventGuests]);

  const foodScannedGuestsList = useMemo(() => {
    return allEventGuests
      .filter(g => Boolean(g.hasFoodClaimed || (g as any).foodClaimed))
      .sort((a, b) => (b.foodClaimedTime || 0) - (a.foodClaimedTime || 0));
  }, [allEventGuests]);

  // 3. CONTEXTUAL METRICS
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

  const currentCount = scanMode === 'CHECK_IN' ? deskMetrics.totalCheckedIn : scanMode === 'FOOD_CLAIM' ? deskMetrics.totalFoodClaimed : deskMetrics.totalRegistered;
  const currentTotal = scanMode === 'CHECK_IN' ? deskMetrics.totalRegistered : scanMode === 'FOOD_CLAIM' ? deskMetrics.totalFoodEligible : deskMetrics.totalRegistered;
  const progressPercent = currentTotal > 0 ? Math.min(100, Math.round((currentCount / currentTotal) * 100)) : 0;

  // FAST-TAP FOOD CLAIM CONFIRMATION HANDLER
  const handleConfirmFoodClaim = async (guest: any) => {
    const recordId = guest.id || guest.guestId;
    if (!recordId) return;

    setClaimActionLoadingId(recordId);
    try {
      if (!db.isOpen()) await db.open();

      const timestamp = Date.now();
      await db.guests.update(Number(recordId) || recordId, {
        hasFoodClaimed: true,
        foodClaimedTime: timestamp,
        syncStatus: 'pending'
      });

      if (navigator.onLine && guest.qrToken) {
        await fetch('/api/sync/food-claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrToken: guest.qrToken, eventId: resolvedEventId })
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to confirm food claim locally:', err);
    } finally {
      setClaimActionLoadingId(null);
    }
  };

  // FILTERED & DESCENDING SORTED GUESTS FOR FOOD CLAIM DESK SEARCH
  const checkedInGuestsForFood = useMemo(() => {
    return checkedInGuestsList.filter(g => {
      if (foodSearchQuery.trim()) {
        const query = foodSearchQuery.toLowerCase();
        const nameMatch = g.name?.toLowerCase().includes(query);
        const tokenMatch = (g.qrToken || g.qr_token)?.toLowerCase().includes(query);
        if (!nameMatch && !tokenMatch) return false;
      }
      return true;
    });
  }, [checkedInGuestsList, foodSearchQuery]);

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
    <div className={`min-h-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 flex flex-col justify-between overflow-x-hidden custom-scrollbar pt-12 sm:pt-16`}>
      
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

        <div className="flex sm:hidden items-center gap-2">
          <SyncStatusBar />
          <button
            onClick={() => setIsUtilitiesOpen(!isUtilitiesOpen)}
            className={`p-2 rounded-xl border transition-all ${theme.inputBg}`}
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

          <LogoutButton />
        </div>
      </header>

      {/* CORE CONTROL COUNTER SUB-PANEL WITH DIRECTORY INSPECTION BUTTONS */}
      <div className="px-6 pt-6 flex flex-col items-center gap-4">
        
        {/* RESTRICTED 3-WAY MODE SELECTOR BRIDGE */}
        <div className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl border w-full max-w-sm ${theme.card}`}>
          <button
            disabled={assignedDesk !== 'ALL' && assignedDesk !== 'CHECK_IN'}
            onClick={() => setScanMode('CHECK_IN')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'CHECK_IN' 
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LogIn size={13} />
            Check-In
          </button>
          <button
            disabled={assignedDesk !== 'ALL' && assignedDesk !== 'FOOD_CLAIM'}
            onClick={() => setScanMode('FOOD_CLAIM')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'FOOD_CLAIM' 
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Utensils size={13} />
            Food
          </button>
          <button
            disabled={assignedDesk !== 'ALL' && assignedDesk !== 'REGISTRATION'}
            onClick={() => setScanMode('REGISTRATION')}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
              scanMode === 'REGISTRATION' 
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={13} />
            Registration
          </button>
        </div>

        {/* CONTEXTUAL RATIO STAT CARD WITH QUICK DIRECTORY BUTTONS */}
        <div className={`w-full max-w-xs p-5 rounded-2xl border flex flex-col gap-3 ${theme.card}`}>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className={`p-2 rounded-xl text-white ${
                scanMode === 'CHECK_IN' ? 'bg-purple-600' : 
                scanMode === 'FOOD_CLAIM' ? 'bg-amber-600' : 'bg-emerald-600'
              }`}>
                {scanMode === 'CHECK_IN' ? <LogIn size={16} /> : 
                 scanMode === 'FOOD_CLAIM' ? <Utensils size={16} /> : <Sparkles size={16} />}
              </span>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                {scanMode === 'CHECK_IN' ? 'Gate Stream Count' : 
                 scanMode === 'FOOD_CLAIM' ? 'Meals Served' : 'Registrations'}
              </p>
            </div>
            
            <div className="flex items-center gap-1.5">
              {scanMode === 'CHECK_IN' && (
                <button
                  onClick={() => setActiveModalList('checkin')}
                  className="px-2 py-0.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                  title="View Checked-in List"
                >
                  <Eye size={11} /> List
                </button>
              )}
              {scanMode === 'FOOD_CLAIM' && (
                <button
                  onClick={() => setActiveModalList('food')}
                  className="px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1 transition cursor-pointer"
                  title="View Food Claimed List"
                >
                  <Eye size={11} /> List
                </button>
              )}
              <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                scanMode === 'CHECK_IN' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                scanMode === 'FOOD_CLAIM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {scanMode === 'REGISTRATION' ? deskMetrics.totalRegistered : `${progressPercent}%`}
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <h3 className={`text-2xl font-black tracking-tight ${
              scanMode === 'CHECK_IN' ? 'text-purple-500' : 
              scanMode === 'FOOD_CLAIM' ? 'text-amber-500' : 'text-emerald-500'
            }`}>
              {scanMode === 'REGISTRATION' ? deskMetrics.totalRegistered : currentCount} 
              <span className="text-xs font-bold text-slate-500 uppercase ml-1">
                / {scanMode === 'REGISTRATION' ? 'Total' : `${currentTotal} ${scanMode === 'CHECK_IN' ? 'Verified' : 'Claimed'}`}
              </span>
            </h3>
            
            {assignedDesk !== 'ALL' && (
              <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Lock size={10} /> Locked Node
              </span>
            )}
          </div>

          <div className="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                scanMode === 'CHECK_IN' ? 'bg-purple-500' : 
                scanMode === 'FOOD_CLAIM' ? 'bg-amber-500' : 'bg-emerald-500'
              }`} 
              style={{ width: scanMode === 'REGISTRATION' ? '100%' : `${progressPercent}%` }} 
            />
          </div>
        </div>
      </div>

      {/* TARGETED CENTRAL ZONE */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 my-auto w-full max-w-xl mx-auto">
        {scanMode === 'REGISTRATION' ? (
          <div className={`w-full rounded-[2.5rem] p-6 sm:p-8 border shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${theme.card}`}>
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-inherit">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
                  <Sparkles size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-wider">Spot-Registration</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Issue New Pass on-spot on event day.</p>
                </div>
              </div>
            </div>

            {activeEvent && (
              <UniversalRegistrationForm 
                event={{ 
                  ...activeEvent, 
                  id: String(activeEvent.id),
                  type: (activeEvent.type as any) || 'event'
                }} 
              />
            )}
          </div>
        ) : scanMode === 'FOOD_CLAIM' ? (
          /* CHECKED-IN GUESTS LIST WITH TOKEN SEARCH & CONFIRM MEAL */
          <div className={`w-full rounded-[2.5rem] p-5 sm:p-6 border shadow-2xl flex flex-col h-[60vh] max-h-[550px] animate-in fade-in duration-200 ${theme.card}`}>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-inherit">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-600 text-white">
                  <Utensils size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">Food Claim Desk (Checked-In List)</h3>
                  <p className="text-[9px] text-slate-400">Search by Token ID or name to issue meal voucher</p>
                </div>
              </div>
            </div>

            {/* TOKEN ID & NAME SEARCH INPUT */}
            <div className="relative mb-3">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Token ID (e.g. TICKET-...) or name..."
                value={foodSearchQuery}
                onChange={(e) => setFoodSearchQuery(e.target.value)}
                className={`w-full border rounded-xl pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-amber-500 ${theme.inputBg}`}
              />
            </div>

            {/* STREAM OF CHECKED-IN ATTENDEES */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {checkedInGuestsForFood.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs font-semibold italic">
                  No checked-in guests found matching token or name.
                </div>
              ) : (
                checkedInGuestsForFood.map((guest) => {
                  const hasClaimed = Boolean(guest.hasFoodClaimed || (guest as any).foodClaimed);
                  const isActionLoading = claimActionLoadingId === (guest.id || guest.guestId);
                  const tokenDisplay = guest.qrToken || guest.qr_token || 'N/A';

                  return (
                    <div 
                      key={guest.id || guest.guestId} 
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 transition-all ${
                        hasClaimed ? 'bg-amber-500/5 border-amber-500/25 opacity-75' : 'bg-white/5 border-white/5 hover:border-amber-500/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-black truncate">{guest.name}</h4>
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold shrink-0">
                            {guest.category || 'General'}
                          </span>
                        </div>

                        {/* COMPETITION & AGE CATEGORY DISPLAY */}
                        {isMultiCompEvent && (guest.category === 'event-participant' || guest.competitionTitle) && (
                          <p className="text-[10px] font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                            <Trophy size={10} />
                            <span>{guest.competitionTitle || 'General Track'}</span>
                            {guest.ageGroupLabel && <span className="text-slate-400 font-normal">({guest.ageGroupLabel})</span>}
                          </p>
                        )}

                        {/* TOKEN ID DISPLAY */}
                        <div className="text-[10px] text-slate-400 font-mono mt-1 flex items-center gap-1.5">
                          <span className="bg-white/10 px-1.5 py-0.5 rounded text-slate-300 font-bold">Token: {tokenDisplay}</span>
                        </div>
                      </div>

                      <button
                        disabled={hasClaimed || isActionLoading}
                        onClick={() => handleConfirmFoodClaim(guest)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed ${
                          hasClaimed 
                            ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' 
                            : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/30'
                        }`}
                      >
                        {isActionLoading ? (
                          <Loader size={13} className="animate-spin" />
                        ) : hasClaimed ? (
                          <>
                            <CheckCircle2 size={13} /> Claimed
                          </>
                        ) : (
                          <>
                            <Utensils size={13} /> Give Food
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="relative flex items-center justify-center">
            <div className="absolute -inset-4 rounded-full opacity-30 animate-ping bg-purple-500" />
            <button 
              onClick={() => setIsScanning(true)}
              className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all border-4 border-white/20 group hover:scale-105 bg-purple-600 hover:bg-purple-700 shadow-purple-600/40 ring-8 ring-purple-500/20"
            >
              <QrCode size={56} className="group-hover:scale-110 transition-transform text-white drop-shadow-md" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/90 drop-shadow">
                Scan QR Code
              </span>
            </button>
          </div>
        )}
      </div>

      {/* MODAL LIST INSPECTOR (CHECK-IN LIST VS FOOD CLAIMED LIST) */}
      {activeModalList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-[2.5rem] border p-6 shadow-2xl flex flex-col max-h-[85vh] ${isDark ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            
            <div className="flex items-center justify-between pb-4 border-b border-inherit mb-4">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${activeModalList === 'checkin' ? 'bg-purple-500/10 text-purple-400' : 'bg-amber-500/10 text-amber-500'}`}>
                  {activeModalList === 'checkin' ? <QrCode size={18} /> : <Utensils size={18} />}
                </div>
                <h3 className="text-base font-black uppercase tracking-wider">
                  {activeModalList === 'checkin' ? 'Checked-In Guests Directory' : 'Food Claimed Vouchers Directory'}
                </h3>
              </div>
              <button
                onClick={() => setActiveModalList(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
              {(activeModalList === 'checkin' ? checkedInGuestsList : foodScannedGuestsList).length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                  No records found in this category yet.
                </div>
              ) : (
                (activeModalList === 'checkin' ? checkedInGuestsList : foodScannedGuestsList).map((guest: any, idx: number) => (
                  <div key={guest.id || idx} className={`p-3.5 rounded-2xl border flex items-center justify-between ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-slate-400">#{idx + 1}</span>
                        <h4 className="text-xs font-bold">{guest.name}</h4>
                        <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-bold">
                          {guest.category || 'General'}
                        </span>
                      </div>
                      
                      {isMultiCompEvent && (guest.category === 'event-participant' || guest.competitionTitle) && (
                        <p className="text-[10px] font-bold text-blue-500 flex items-center gap-1 mt-1">
                          <Trophy size={10} />
                          <span>Track: {guest.competitionTitle || 'General Track'}</span>
                          {guest.ageGroupLabel && <span className="text-slate-400 font-normal">({guest.ageGroupLabel})</span>}
                        </p>
                      )}

                      <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        Token: {guest.qrToken || guest.qr_token || 'N/A'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-lg ${activeModalList === 'checkin' ? 'bg-purple-500/10 text-purple-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      {activeModalList === 'checkin' 
                        ? (guest.checkInTime ? new Date(guest.checkInTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Verified') 
                        : (guest.foodClaimedTime ? new Date(guest.foodClaimedTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Claimed')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-inherit mt-4 flex justify-end">
              <button
                onClick={() => setActiveModalList(null)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition cursor-pointer shadow-md"
              >
                Close Directory
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FOOTER BAR */}
      <footer className={`p-4 text-center border-t ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-400'} text-[8px] font-black uppercase tracking-[0.2em]`}>
        Mithila Aayojan Encryption Lock Edge Terminal Secure Active
      </footer>

      {/* CAMERA SCANNER ENGINE PORTAL (CHECK-IN DESK ONLY) */}
      {isScanning && resolvedEventId && scanMode === 'CHECK_IN' && (
        <EventScanner 
          currentEventId={resolvedEventId}
          variant="purple"
          isDark={isDark}
          scanMode={scanMode}
          onClose={() => setIsScanning(false)}
        />
      )}
    </div>
  );
}