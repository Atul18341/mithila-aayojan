// src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Users, Box, QrCode, Loader,
  Settings, Bell, Clock, Calendar, Sparkles, Plus,
  Heart, Briefcase, Globe, X, ShieldCheck, UserCheck,
  Pencil, Sun, Moon, ChevronDown, Layers, Menu, Utensils, Ticket,
  User, Crown, ChevronRight
} from 'lucide-react';

import { db } from '../../lib/db';
import EventDetailEditor from './_components/event-details';
import VolunteerManager from './_components/volunteer-manager';
import EntryDeskCameraScanner from '../../components/Scanner';
import SyncStatusBar from '@/components/SyncStatusBar';
import LogoutButton from '@/components/LogoutButton';

const EVENT_TYPES = [
  { id: 'summit', label: 'Summit', icon: Briefcase, protocol: 'invite-only', color: 'blue', threshold: 0 },
  { id: 'conference', label: 'Conference', icon: Briefcase, protocol: 'ticketed', color: 'blue', threshold: 100 },
  { id: 'event', label: 'Sanwaad / Event', icon: Globe, protocol: 'open-registration', color: 'amber', threshold: 50 },
  { id: 'celebration', label: 'Celebration', icon: Heart, protocol: 'invite-only', color: 'emerald', threshold: 0 },
  { id: 'workshop', label: 'Workshop', icon: ShieldCheck, protocol: 'open-registration', color: 'purple', threshold: 20 }
];

const GUEST_COLOR_MAP = {
  vip: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20', dot: 'bg-red-500' },
  speaker: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20', dot: 'bg-purple-500' },
  delegate: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  organizer: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

export default function ManagerDashboard() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isManagingVolunteers, setIsManagingVolunteers] = useState(false);
  
  // 🟢 Manager Profile Session State
  const [managerSession, setManagerSession] = useState<{
    id?: number;
    name: string;
    email: string;
    role: string;
  }>({ name: 'Manager', email: '', role: 'manager' });

  useEffect(() => {
    async function resolveActiveSession() {
      try {
        if (!db.isOpen()) await db.open();
        const loggedInUser = await db.users.toCollection().first();
        if (loggedInUser) {
          setManagerSession({
            id: loggedInUser.id,
            name: loggedInUser.name || 'Core Manager',
            email: loggedInUser.identifier || '',
            role: loggedInUser.role || 'manager'
          });
        }
      } catch (err) {
        console.error("❌ Failed to parse offline session identity indexes:", err);
      }
    }
    resolveActiveSession();
  }, []);

  const currentManagerEmail = managerSession.email || null;

  const sessionData = useLiveQuery(async () => {
    if (!currentManagerEmail) return [];
    if (!db.isOpen()) await db.open();
    const links = await db.managerEvents.where('managerIdentifier').equals(currentManagerEmail).toArray();
    const eventIds = links.map(l => l.eventId);
    const fetchedEvents = await db.events.where('id').anyOf(eventIds).toArray();
    return fetchedEvents.sort((a, b) => b.createdAt - a.createdAt);
  }, [currentManagerEmail]) || [];

  const currentWorkspace = useLiveQuery(async () => {
    if (!currentManagerEmail) return null;
    if (!db.isOpen()) await db.open();
    
    const session = await db.users.where('identifier').equals(currentManagerEmail).first();
    if (!session || !session.activeEventId) return null;

    const targetEvent = await db.events.get(session.activeEventId);
    if (!targetEvent) return null;

    // FETCH GUEST MANIFEST FOR ACTIVE EVENT FROM INDEXEDDB
    const targetGuests = await db.guests.where('eventId').equals(session.activeEventId).toArray();
    
    const recentCheckIns = await db.guests
      .where('eventId')
      .equals(session.activeEventId)
      .reverse()
      .limit(10)
      .toArray();

    // COMPUTING REAL-TIME METRICS FROM INDEXEDDB DATA
    const totalRegistrations = targetGuests.length;
    const liveCheckIns = targetGuests.filter(g => Boolean(g.checkInTime || g.isCheckedIn)).length;
    const foodIssued = targetGuests.filter(g => Boolean(g.hasFoodAccess || (g as any).foodIncluded)).length;
    const foodScanned = targetGuests.filter(g => Boolean(g.hasFoodClaimed || (g as any).foodClaimed)).length;

    return {
      event: targetEvent,
      guests: targetGuests,
      totalRegistrations,
      liveCheckIns,
      foodIssued,
      foodScanned,
      recentCheckIns
    };
  }, [currentManagerEmail]);

  const activeEvent = currentWorkspace?.event || sessionData[0] || null;
  const recentCheckIns = currentWorkspace?.recentCheckIns || [];
  
  // METRICS DIRECTLY SOURCED FROM INDEXEDDB
  const totalRegistrationCount = currentWorkspace?.totalRegistrations || 0;
  const totalCheckInCount = currentWorkspace?.liveCheckIns || 0;
  const foodIssuedCount = currentWorkspace?.foodIssued || 0;
  const foodScannedCount = currentWorkspace?.foodScanned || 0;

  // PERCENTAGE COMPUTATIONS
  const gateCheckInPercent = totalRegistrationCount > 0 
    ? Math.min(100, Math.round((totalCheckInCount / totalRegistrationCount) * 100)) 
    : 0;

  const mealClaimPercent = foodIssuedCount > 0 
    ? Math.min(100, Math.round((foodScannedCount / foodIssuedCount) * 100)) 
    : 0;

  const handleWorkspaceChange = async (nextId: number) => {
    if (!currentManagerEmail) return;
    await db.users.where('identifier').equals(currentManagerEmail).modify({
      activeEventId: nextId
    });
    setIsDropdownOpen(false);
    setIsEditing(false);
    setIsCreatingNew(false);
    setIsManagingVolunteers(false);
  };

  if (currentManagerEmail === null) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
        <Loader className="animate-spin text-blue-500 mb-2" size={32} />
        <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Synchronizing Local Session...</p>
      </div>
    );
  }

  if (sessionData.length === 0 && !isEditing && !isCreatingNew) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center ${isDark ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Sparkles className="text-blue-500 mb-4 animate-pulse" size={48} />
        <h2 className="text-2xl font-black italic">Welcome to Mithila Aayojan</h2>
        <button 
          onClick={() => {
            setIsCreatingNew(true);
            setIsEditing(false);
            setIsManagingVolunteers(false);
          }} 
          className="mt-6 px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl shadow-blue-600/10"
        >
          Create Your First Event
        </button>
      </div>
    );
  }

  const getEventAccent = (type: string) => {
    if (!type) return 'text-orange-600';
    const found = EVENT_TYPES.find(t => t.id === type);
    return found ? `text-${found.color}-500` : 'text-orange-600';
  };

  const currentAccent = activeEvent?.type ? getEventAccent(activeEvent.type) : 'text-blue-500';
  const currentAccentBg = activeEvent?.type === 'celebration' ? 'bg-emerald-600' : 'bg-blue-600';

  const theme = {
    bg: isDark ? 'bg-[#020617]' : 'bg-slate-50',
    sidebar: isDark ? 'bg-[#020617] border-white/5' : 'bg-white border-slate-200',
    card: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm',
    inputBg: isDark ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200',
    textMain: isDark ? 'text-white' : 'text-slate-900',
    textMuted: 'text-slate-500',
    accent: currentAccent,
    accentBg: currentAccentBg,
    dropdownMenu: isDark ? 'bg-[#0a0f1d] border-white/10' : 'bg-white border-slate-200 shadow-2xl'
  };

  const showEditorScreen = isEditing || isCreatingNew;

  return (
    <div className={`flex h-screen w-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 overflow-hidden relative`}>
      
      {/* MOBILE BACKDROP OVERLAY */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" 
        />
      )}

      {/* CONSOLIDATED SIDEBAR DRAWER (DESKTOP FIXED + MOBILE SLIDE-OVER) */}
      <aside className={`
        fixed lg:static top-0 left-0 bottom-0 z-50 w-72 lg:w-64 border-r ${theme.sidebar} p-6 flex flex-col justify-between h-full shrink-0 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="space-y-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${theme.accentBg} rounded-lg flex items-center justify-center font-black text-white`}>
                {activeEvent?.name ? activeEvent.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <span className="font-black tracking-tighter text-lg uppercase">Mithila <span className={theme.accent}>Aayojan</span></span>
            </div>
            
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* 🟢 PROFILE PROFILE BOX BANNER IN NAVBAR/SIDEBAR */}
          <Link
            href="/dashobard-eventManagers/profile"
            onClick={() => setIsSidebarOpen(false)}
            className={`p-3 rounded-2xl border transition-all flex items-center justify-between group ${
              isDark 
                ? 'bg-white/5 border-white/10 hover:border-blue-500/50 hover:bg-blue-500/10' 
                : 'bg-slate-50 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-md shadow-blue-600/20">
                {managerSession.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold truncate text-slate-900 dark:text-white group-hover:text-blue-500 transition-colors">
                    {managerSession.name}
                  </span>
                  <Crown size={12} className="text-amber-500 shrink-0" />
                </div>
                <p className="text-[10px] text-slate-400 truncate">
                  {managerSession.email || 'Manager Workspace'}
                </p>
              </div>
            </div>
            <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </Link>
          
          {/* PRIMARY NAVIGATION */}
          <nav className="space-y-1">
            {[
              { icon: LayoutDashboard, label: 'Overview', active: !showEditorScreen && !isManagingVolunteers },
              { icon: Users, label: 'Guest List' },
              { icon: UserCheck, label: 'Volunteers', active: isManagingVolunteers },
              { icon: QrCode, label: 'Check-in Desk' },
              { icon: Settings, label: 'Event Edit/Settings', active: isEditing && !isCreatingNew },
              { icon: User, label: 'Manager Profile' } // 🟢 Direct Profile Route Button
            ].map((item) => (
              <button 
                key={item.label} 
                onClick={() => { 
                  if (item.label === 'Manager Profile') {
                    router.push('/dashboard-eventManagers/profile');
                  } else if (item.label === 'Volunteers') {
                    setIsManagingVolunteers(true);
                    setIsEditing(false);
                    setIsCreatingNew(false);
                  } else if (item.label === 'Event Edit/Settings' && activeEvent) {
                    setIsEditing(true); 
                    setIsCreatingNew(false);
                    setIsManagingVolunteers(false);
                  } else if (item.label === 'Overview') {
                    setIsEditing(false); 
                    setIsCreatingNew(false);
                    setIsManagingVolunteers(false);
                  } else if (item.label === 'Check-in Desk' && activeEvent) {
                    setIsScanning(true);
                  }
                  setIsSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${item.active ? `${theme.accentBg} text-white shadow-lg` : 'text-slate-500 hover:bg-white/5'}`}
              >
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </nav>

          {/* MOBILE-ONLY UTILITIES SECTION INSIDE SIDEBAR */}
          <div className="lg:hidden pt-4 border-t border-inherit space-y-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 px-4">Preferences</span>
            
            <button 
              onClick={() => setIsDark(!isDark)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-white/5 ${theme.inputBg}`}
            >
              <span className="flex items-center gap-3">
                {isDark ? <Sun size={18} className="text-blue-400" /> : <Moon size={18} className="text-amber-500" />}
                Theme Mode
              </span>
              <span className="text-xs uppercase font-mono">{isDark ? 'Dark' : 'Light'}</span>
            </button>

            <button 
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-white/5 ${theme.inputBg}`}
            >
              <span className="flex items-center gap-3">
                <Bell size={18} className={theme.accent} />
                Notifications
              </span>
              {recentCheckIns.length > 0 && (
                <span className="bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">
                  {recentCheckIns.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-inherit">
          <LogoutButton/>
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className={`flex-1 flex flex-col space-y-8 overflow-hidden h-full ${showEditorScreen || isManagingVolunteers ? 'p-4 sm:p-6 overflow-y-auto custom-scrollbar' : 'p-4 sm:p-8 overflow-y-auto custom-scrollbar'}`}>
        
        {/* UNIFIED HEADER BAR */}
        {!showEditorScreen && !isManagingVolunteers && (
          <header className={`shrink-0 w-full py-4 border-b ${theme.bg} flex items-center justify-between z-40 relative gap-3`}>
            
            <div className="flex items-center gap-3 sm:gap-6">
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className={`lg:hidden p-2.5 rounded-xl border ${theme.inputBg} shrink-0`}
                aria-label="Open Navigation Menu"
              >
                <Menu size={18} />
              </button>

              <div className="relative">
                {activeEvent && !isCreatingNew ? (
                  <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="group text-left space-y-1 focus:outline-none">
                    <h1 className={`text-lg sm:text-2xl font-black italic flex items-center gap-2 ${activeEvent.type === 'celebration' ? 'font-serif' : 'font-sans'}`}>
                      <span className="truncate max-w-[150px] sm:max-w-xs">{activeEvent.name}</span>
                      <ChevronDown size={18} className="text-slate-500 shrink-0" />
                    </h1>
                    <div className="flex items-center gap-3 text-slate-500 text-[9px] font-black uppercase tracking-[0.2em]">
                      <span className="flex items-center gap-1.5"><Calendar size={11} className={theme.accent} /> {activeEvent.date || 'No Date'}</span>
                      <span className="hidden sm:flex items-center gap-1.5"><Sparkles size={11} className={theme.accent} /> {activeEvent.protocol || 'open'}</span>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-1">
                    <h1 className="text-xl sm:text-2xl font-black italic text-white flex items-center gap-2">Setup Engine</h1>
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
                      {isCreatingNew ? 'Configuring new event attributes' : 'No active matrix files found on local device storage links'}
                    </p>
                  </div>
                )}

                {/* DROPDOWN SWITCHER */}
                {isDropdownOpen && sessionData.length > 0 && (
                  <div className={`absolute top-full left-0 mt-4 w-72 sm:w-80 rounded-[2.5rem] border ${theme.dropdownMenu} p-3 z-50`}>
                    <div className="px-4 py-2 border-b border-white/5 mb-2 flex items-center gap-2 text-slate-500">
                      <Layers size={12} />
                      <span className="text-[9px] font-black uppercase tracking-wider">Switch Matrix Context</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                      {sessionData.map((ev) => (
                        <button 
                          key={ev.id} 
                          onClick={() => handleWorkspaceChange(ev.id!)} 
                          className={`w-full flex items-center justify-between p-4 rounded-2xl text-left ${activeEvent?.id === ev.id && !isCreatingNew ? 'bg-white/5 border border-white/10 text-blue-400' : 'hover:bg-white/5 text-slate-300'}`}
                        >
                          <span className="text-xs font-black">{ev.name}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200/10 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNew(true);
                          setIsEditing(false);
                          setIsManagingVolunteers(false);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all hover:scale-[1.02] shadow-sm ${
                          isDark ? 'bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600/20' : 'bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100/80'
                        }`}
                      >
                        <Plus size={12} className="stroke-[3]" />
                        Add New Event
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* HEADER RIGHT SIDE: PINNED SYNC STATUS BAR + DESKTOP UTILITIES */}
            <div className="flex items-center gap-3 shrink-0">
              {/* ALWAYS VISIBLE: PINNED SYNC STATUS */}
              <SyncStatusBar />

              {/* DESKTOP-ONLY UTILITIES ROW */}
              <div className="hidden lg:flex items-center gap-3">
                {activeEvent && !showEditorScreen && (
                  <button 
                    onClick={() => setIsScanning(true)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105 shadow-md ${
                      isDark ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    <QrCode size={14} className="animate-pulse" />
                    Camera Desk
                  </button>
                )}
                {(activeEvent || sessionData.length > 0) && (
                  <button 
                    onClick={() => {
                      if (isCreatingNew) {
                        setIsCreatingNew(false);
                        setIsEditing(false);
                      } else {
                        setIsEditing(!isEditing);
                      }
                    }} 
                    className={`p-2.5 rounded-xl border transition-all ${showEditorScreen ? 'bg-red-500 text-white' : `${theme.inputBg} text-slate-400`}`}
                    title="Edit Event Configuration"
                  >
                    {showEditorScreen ? <X size={18} /> : <Pencil size={18} />}
                  </button>
                )}

                <button 
                  type="button"
                  onClick={() => setIsDark(!isDark)} 
                  className={`w-10 h-10 rounded-xl border transition-all flex items-center justify-center relative overflow-hidden ${theme.inputBg}`}
                >
                  <div className={`transition-all duration-500 transform ${isDark ? 'translate-y-0' : 'translate-y-10 opacity-0'}`}>
                    <Sun size={18} className="text-blue-400 fill-blue-400/10" />
                  </div>
                  <div className={`absolute transition-all duration-500 transform ${!isDark ? 'translate-y-0' : '-translate-y-10 opacity-0'}`}>
                    <Moon size={18} className="text-amber-500 fill-amber-500/20" />
                  </div>
                </button>

                {/* 🟢 TOP DESKTOP MANAGER PROFILE QUICK BUTTON */}
                <Link
                  href="/dashboard-eventManagers/profile"
                  className={`w-10 h-10 rounded-xl border flex items-center justify-center font-black text-xs transition-all ${theme.inputBg} hover:border-blue-500 text-blue-500`}
                  title="Open Manager Profile"
                >
                  {managerSession.name.charAt(0).toUpperCase()}
                </Link>

                <div className="relative">
                  <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center relative transition-all ${theme.inputBg}`}
                  >
                    <Bell size={18} className={isNotificationsOpen ? theme.accent : 'text-slate-400'} />
                    {recentCheckIns.length > 0 && (
                      <div className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-inherit" />
                    )}
                  </button>

                  {isNotificationsOpen && (
                    <div className={`absolute top-full right-0 mt-4 w-80 rounded-[2.5rem] border ${theme.dropdownMenu} p-4 z-50 animate-in fade-in zoom-in-95`}>
                      <div className="flex justify-between items-center mb-4 px-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Notifications</span>
                      </div>
                      <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                        {recentCheckIns.slice(0, 3).map((g: any) => (
                          <div key={g.id} className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] flex flex-col gap-1">
                            <p className="font-bold">🎉 <span className={theme.accent}>{g.name}</span> verified entry.</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>
        )}

        {/* WORKSPACE LAYER TOGGLE ROUTER */}
        {isManagingVolunteers ? (
          <div className="flex-1 flex items-center justify-center py-6">
            <VolunteerManager 
              isDark={isDark} 
              events={sessionData} 
              onClose={() => setIsManagingVolunteers(false)} 
            />
          </div>
        ) : showEditorScreen ? (
          <div className="flex-1 overflow-hidden min-h-0 w-full flex flex-col pt-0">
            <EventDetailEditor 
              event={isCreatingNew ? null : (activeEvent as any)}
              isDark={isDark} 
              onClose={() => {
                setIsEditing(false);
                setIsCreatingNew(false);
              }}
              onCreationSuccess={async (newEventId) => {
                const targetedId = Number(newEventId);
                if (isNaN(targetedId)) return;
                try {
                  await db.managerEvents.add({
                    managerIdentifier: currentManagerEmail,
                    eventId: targetedId,
                    assignedDesk:'ALL',
                    assignedAt:Date.now(),
                    syncStatus: 'pending'
                  });
                  await db.users.where('identifier').equals(currentManagerEmail).modify({
                    activeEventId: targetedId
                  });
                  setIsEditing(false);
                  setIsCreatingNew(false);
                } catch (err) {
                  console.error("Failed to establish creation link constraints:", err);
                }
              }}
            />
          </div>
        ) : (
          <>
            {/* 🟢 PAIRED PROGRESS CARDS (GATE ATTENDANCE & MEAL CATERING) */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              
              {/* GATE ATTENDANCE CARD */}
              <div className={`border p-6 rounded-[2rem] flex flex-col justify-between ${theme.card}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'} text-emerald-500`}>
                      <QrCode size={18} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Gate Attendance Stream
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                    {gateCheckInPercent}%
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-3xl font-black uppercase tracking-tight flex items-baseline gap-2">
                    {totalCheckInCount}
                    <span className="text-sm font-bold text-slate-500 uppercase">
                      / {totalRegistrationCount} Verified
                    </span>
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="w-full h-2.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                    style={{ width: `${gateCheckInPercent}%` }} 
                  />
                </div>
              </div>

              {/* MEAL CATERING CARD */}
              <div className={`border p-6 rounded-[2rem] flex flex-col justify-between ${theme.card}`}>
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2.5 rounded-xl ${isDark ? 'bg-white/5' : 'bg-slate-100'} text-amber-500`}>
                      <Utensils size={18} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                      Meal Catering Vouchers
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                    {mealClaimPercent}%
                  </span>
                </div>

                <div className="mb-4">
                  <div className="text-3xl font-black uppercase tracking-tight flex items-baseline gap-2">
                    {foodScannedCount}
                    <span className="text-sm font-bold text-slate-500 uppercase">
                      / {foodIssuedCount} Claimed
                    </span>
                  </div>
                </div>

                {/* PROGRESS BAR */}
                <div className="w-full h-2.5 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                    style={{ width: `${mealClaimPercent}%` }} 
                  />
                </div>
              </div>

            </section>

            {/* REAL-TIME COLLAPSED ACTIVITY REGISTRY */}
            <section className={`border p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] animate-in slide-in-from-bottom-6 duration-500 ${theme.card}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base sm:text-lg font-black italic">Recent Entry Streams</h3>
              </div>
              {recentCheckIns.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-bold italic">Awaiting system entries...</div>
              ) : (
                <div className="divide-y divide-white/5 border border-white/5 rounded-3xl overflow-hidden">
                  {recentCheckIns.map((guest: any) => {
                    const colors = GUEST_COLOR_MAP[guest.type as keyof typeof GUEST_COLOR_MAP] || GUEST_COLOR_MAP.delegate;
                    return (
                      <div key={guest.id} className={`p-4 flex items-center justify-between transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} shrink-0`} />
                          <p className="text-sm font-black tracking-tight">{guest.name}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {isScanning && activeEvent && (
        <EntryDeskCameraScanner 
          currentEventId={activeEvent.id!} 
          variant={activeEvent.type === 'celebration' ? 'emerald' : 'blue'}
          isDark={isDark}
          onClose={() => setIsScanning(false)}
          onScanExecute={async (token) => {
            const guest = await db.guests.where('qrToken').equals(token).first();
            
            if (!guest || guest.eventId !== activeEvent.id) {
              return { status: 'error', message: 'Ticket doesn\'t match layout files.' };
            }
            if (guest.checkInTime) {
              return { status: 'warning', message: 'Duplicate Ticket Scan.', name: guest.name };
            }
            
            await db.guests.update(guest.id!, { checkInTime: Date.now() });
            return { status: 'success', message: `${guest.category.toUpperCase()} badge verified.`, name: guest.name };
          }}
        />
      )}
    </div>
  );
}