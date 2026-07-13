// src/app/dashboard/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  LayoutDashboard, Users, Box, QrCode, Loader,
  Settings, Bell, Clock, Calendar, Sparkles, Plus,
  Heart, Briefcase, Globe, X, ShieldCheck, UserCheck,
  Pencil, Sun, Moon, ChevronDown, Layers, Menu, Trash2, Shield
} from 'lucide-react';

import { db } from '../../lib/db';
import EventDetailEditor from './_components/event-details';
import EntryDeskCameraScanner from '../../components/CheckIn-Scanner';
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
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [currentManagerEmail, setCurrentManagerEmail] = useState<string | null>(null);

  // 🚀 SIDEBAR NAVIGATION STATE LAYER
  const [activeTab, setActiveTab] = useState<'overview' | 'volunteers'>('overview');

  // VOLUNTEER SYSTEM CONTROL STATES
  const [vName, setVName] = useState('');
  const [vEmail, setVEmail] = useState('');
  const [vAssignedEventId, setVAssignedEventId] = useState<string>('');
  const [vPersistence, setVPersistence] = useState<'temporary' | 'permanent'>('temporary');

  useEffect(() => {
    async function resolveActiveSession() {
      try {
        if (!db.isOpen()) await db.open();
        const loggedInUser = await db.users.toCollection().first();
        if (loggedInUser && loggedInUser.identifier) {
          setCurrentManagerEmail(loggedInUser.identifier);
        }
      } catch (err) {
        console.error("❌ Failed to parse offline session identity indexes:", err);
      }
    }
    resolveActiveSession();
  }, []);

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

    const targetGuests = await db.guests.where('eventId').equals(session.activeEventId).toArray();
    
    const recentCheckIns = await db.guests
      .where('eventId')
      .equals(session.activeEventId)
      .reverse()
      .limit(10)
      .toArray();

    return {
      event: targetEvent,
      guests: targetGuests,
      count: targetGuests.length,
      recentCheckIns: recentCheckIns
    };
  }, [currentManagerEmail]);

  const volunteersList = useLiveQuery(async () => {
    if (!db.isOpen()) await db.open();
    return await db.guests.where('type').equals('volunteer').toArray();
  }) || [];

  const activeEvent = currentWorkspace?.event || sessionData[0] || null;
  const recentCheckIns = currentWorkspace?.recentCheckIns || [];
  const totalCheckInCount = currentWorkspace?.count || 0;

  useEffect(() => {
    if (activeEvent && !vAssignedEventId) {
      setVAssignedEventId(activeEvent.id!.toString());
    }
  }, [activeEvent, vAssignedEventId]);

  const handleWorkspaceChange = async (nextId: number) => {
    if (!currentManagerEmail) return;
    await db.users.where('identifier').equals(currentManagerEmail).modify({
      activeEventId: nextId
    });
    setIsDropdownOpen(false);
    setIsEditing(false);
    setIsCreatingNew(false);
  };

  const handleIssueVolunteer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName || !vEmail || !vAssignedEventId) return;

    try {
      await db.guests.add({
        name: vName,
        email: vEmail,
        type: 'volunteer',
        eventId: Number(vAssignedEventId),
        qrToken: `VOL-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        persistence: vPersistence,
       // checkInTime: null,
      });

      setVName('');
      setVEmail('');
    } catch (err) {
      console.error("Failed to inject volunteer index criteria:", err);
    }
  };

  const handlePurgeTemporaryVolunteers = async () => {
    try {
      const targets = await db.guests
        .where('type').equals('volunteer')
        .filter(g => g.persistence === 'temporary')
        .toArray();
      
      for (const t of targets) {
        await db.guests.delete(t.id!);
      }
    } catch (err) {
      console.error("Purge operations crashed across structural stores:", err);
    }
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
    inputText: isDark ? 'text-white' : 'text-slate-900',
    textMain: isDark ? 'text-white' : 'text-slate-900',
    textMuted: 'text-slate-500',
    accent: currentAccent,
    accentBg: currentAccentBg,
    dropdownMenu: isDark ? 'bg-[#0a0f1d] border-white/10' : 'bg-white border-slate-200 shadow-2xl'
  };

  const showEditorScreen = isEditing || isCreatingNew;

  return (
    <div className={`flex h-screen w-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 overflow-hidden relative`}>
      
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR CONTAINER */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r ${theme.sidebar} p-6 flex flex-col justify-between h-full shrink-0
        transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${theme.accentBg} rounded-lg flex items-center justify-center font-black text-white`}>
                {activeEvent?.name ? activeEvent.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <span className="font-black tracking-tighter text-lg uppercase">Mithila <span className={theme.accent}>Aayojan</span></span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 lg:hidden"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
          
          <nav className="space-y-1">
            {[
              { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
              { id: 'volunteers', icon: Shield, label: 'Volunteers' },
              { id: 'guests', icon: Users, label: 'Guest List' },
              { id: 'desk', icon: QrCode, label: 'Check-in Desk' },
              { id: 'settings', icon: Settings, label: 'Settings' }
            ].map((item) => {
              // Determine highlighted state
              const isItemActive = 
                (item.id === 'overview' && activeTab === 'overview' && !showEditorScreen) ||
                (item.id === 'volunteers' && activeTab === 'volunteers' && !showEditorScreen) ||
                (item.id === 'settings' && isEditing && !isCreatingNew);

              return (
                <button 
                  key={item.id} 
                  onClick={() => { 
                    if (item.id === 'settings' && activeEvent) {
                      setIsEditing(true); 
                      setIsCreatingNew(false);
                    } else if (item.id === 'overview' || item.id === 'volunteers') {
                      setActiveTab(item.id);
                      setIsEditing(false); 
                      setIsCreatingNew(false);
                    }
                    setIsSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${isItemActive ? `${theme.accentBg} text-white shadow-lg` : 'text-slate-500 hover:bg-white/5'}`}
                >
                  <item.icon size={18} /> {item.label}
                </button>
              );
            })}
          </nav>
        </div>
        <LogoutButton/>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className={`flex-1 flex flex-col space-y-8 overflow-hidden h-full ${showEditorScreen ? 'p-0' : 'p-4 md:p-8 overflow-y-auto custom-scrollbar'}`}>
        
        {!showEditorScreen && (
          <header className={`shrink-0 w-full py-4 border-b ${theme.bg} flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between z-40`}>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className={`p-3 rounded-xl border ${theme.inputBg} text-slate-400 lg:hidden`}
              >
                <Menu size={20} />
              </button>

              <div className="relative">
                {activeEvent && !isCreatingNew ? (
                  <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="group text-left space-y-1 focus:outline-none">
                    <h1 className={`text-xl md:text-2xl font-black italic flex items-center gap-2 ${activeEvent.type === 'celebration' ? 'font-serif' : 'font-sans'}`}>
                      {activeEvent.name} 
                      <ChevronDown size={20} className="text-slate-500" />
                    </h1>
                    <div className="flex items-center gap-4 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
                      <span className="flex items-center gap-1.5"><Calendar size={12} className={theme.accent} /> {activeEvent.date || 'No Date'}</span>
                      <span className="flex items-center gap-1.5"><Sparkles size={12} className={theme.accent} /> {activeEvent.protocol || 'open'}</span>
                    </div>
                  </button>
                ) : (
                  <div className="space-y-1">
                    <h1 className="text-2xl font-black italic text-white flex items-center gap-2">Setup Engine</h1>
                    <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
                      {isCreatingNew ? 'Configuring new event attributes' : 'No active matrix files found on local device storage links'}
                    </p>
                  </div>
                )}

                {isDropdownOpen && sessionData.length > 0 && (
                  <div className={`absolute top-full left-0 mt-4 w-72 md:w-80 rounded-[2.5rem] border ${theme.dropdownMenu} p-3 z-50`}>
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

            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <div className="flex items-center gap-3">
                {activeEvent && !showEditorScreen && (
                  <button 
                    onClick={() => setIsScanning(true)}
                    className={`flex items-center gap-2 px-4 md:px-5 py-3 rounded-xl border font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105 shadow-md ${
                      isDark ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    <QrCode size={14} className="animate-pulse" />
                    <span>Scanner Desk</span>
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
                    className={`p-3 rounded-xl border transition-all ${showEditorScreen ? 'bg-red-500 text-white' : `${theme.inputBg} text-slate-400`}`}
                  >
                    {showEditorScreen ? <X size={18} /> : <Pencil size={18} />}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 ml-auto sm:ml-0">
                <div className="w-36 md:w-44 h-12 flex items-center justify-end shrink-0">
                  <SyncStatusBar />
                </div>

                <button 
                  type="button"
                  onClick={() => setIsDark(!isDark)} 
                  className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center relative overflow-hidden ${theme.inputBg}`}
                >
                  <div className={`transition-all duration-500 transform ${isDark ? 'translate-y-0' : 'translate-y-12 opacity-0'}`}>
                    <Sun size={20} className="text-blue-400 fill-blue-400/10" />
                  </div>
                  <div className={`absolute transition-all duration-500 transform ${!isDark ? 'translate-y-0' : '-translate-y-12 opacity-0'}`}>
                    <Moon size={20} className="text-amber-500 fill-amber-500/20" />
                  </div>
                </button>

                <div className="relative">
                  <button 
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                    className={`w-12 h-12 rounded-2xl border flex items-center justify-center relative transition-all ${theme.inputBg}`}
                  >
                    <Bell size={20} className={isNotificationsOpen ? theme.accent : 'text-slate-400'} />
                    {recentCheckIns.length > 0 && (
                      <div className="absolute top-3 right-3 w-2 h-2 bg-red-500 rounded-full border-2 border-inherit" />
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
        {showEditorScreen ? (
          <div className="flex-1 overflow-hidden min-h-0 w-full flex flex-col pt-0">
            <EventDetailEditor 
              event={isCreatingNew ? null : (activeEvent ?? null)}
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
        ) : activeTab === 'volunteers' ? (
          /* 🚀 RENDER VOLUNTEER INTERFACE FULLSCREEN VIA SIDEBAR OPTION CHOICE */
          <section className={`border p-6 md:p-8 rounded-[2.5rem] animate-in fade-in duration-300 ${theme.card} grid grid-cols-1 lg:grid-cols-3 gap-8`}>
            
            {/* VOLUNTEER ADMISSION ISSUANCE FORM */}
            <div className="lg:col-span-1 space-y-4">
              <div>
                <h3 className="text-lg font-black italic flex items-center gap-2">
                  <Shield size={20} className={theme.accent} /> Issue Credentials
                </h3>
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mt-1">Assign ground volunteers to operations</p>
              </div>

              <form onSubmit={handleIssueVolunteer} className="space-y-3">
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  className={`w-full p-3 text-xs font-bold rounded-xl border ${theme.inputBg} ${theme.inputText} focus:outline-none`}
                />
                <input
                  type="email"
                  placeholder="Email Identifier"
                  required
                  value={vEmail}
                  onChange={(e) => setVEmail(e.target.value)}
                  className={`w-full p-3 text-xs font-bold rounded-xl border ${theme.inputBg} ${theme.inputText} focus:outline-none`}
                />
                
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Assigned Context Matrix</label>
                  <select
                    value={vAssignedEventId}
                    onChange={(e) => setVAssignedEventId(e.target.value)}
                    className={`w-full p-3 text-xs font-bold rounded-xl border ${theme.inputBg} ${theme.inputText} focus:outline-none`}
                  >
                    {sessionData.map(ev => (
                      <option key={ev.id} value={ev.id} className={isDark ? 'bg-[#020617]' : 'bg-white'}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-black uppercase tracking-widest">Retention Protocol Profile</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setVPersistence('temporary')}
                      className={`p-3 text-[10px] font-black uppercase rounded-xl border transition-all ${vPersistence === 'temporary' ? `${theme.accentBg} text-white border-transparent` : `${theme.inputBg} text-slate-400`}`}
                    >
                      Auto-Purge Post Event
                    </button>
                    <button
                      type="button"
                      onClick={() => setVPersistence('permanent')}
                      className={`p-3 text-[10px] font-black uppercase rounded-xl border transition-all ${vPersistence === 'permanent' ? `${theme.accentBg} text-white border-transparent` : `${theme.inputBg} text-slate-400`}`}
                    >
                      Keep Until Manual Delete
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full p-3 rounded-xl font-black uppercase text-[10px] tracking-widest text-white transition-all hover:scale-[1.02] shadow-md ${theme.accentBg}`}
                >
                  Generate Pass Token
                  </button>
                </form>
              </div>

              {/* ACTIVE VOLUNTEER REGISTRY RECORD GRID */}
              <div className="lg:col-span-2 flex flex-col h-full space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-black italic">Active Field Operations</h3>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Verification states and credential layers</p>
                  </div>
                  {volunteersList.some(v => v.persistence === 'temporary') && (
                    <button
                      onClick={handlePurgeTemporaryVolunteers}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
                    >
                      <Trash2 size={12} /> Purge Post-Event Passes
                    </button>
                  )}
                </div>

                <div className="flex-1 min-h-[300px] overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl">
                  {volunteersList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-slate-500 font-bold italic p-8">No active operational credentials generated.</div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {volunteersList.map((vol) => {
                        const boundEvent = sessionData.find(e => e.id === vol.eventId);
                        return (
                          <div key={vol.id} className={`p-4 flex flex-wrap items-center justify-between gap-4 transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black tracking-tight">{vol.name}</span>
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${vol.persistence === 'temporary' ? 'bg-amber-500/10 text-amber-500' : 'bg-purple-500/10 text-purple-500'}`}>
                                  {vol.persistence}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium">{vol.email} • Token: <code className="text-blue-400 font-mono font-bold">{vol.qrToken}</code></p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                Matrix Assignment: <span className="text-slate-500 italic">{boundEvent?.name || `ID: ${vol.eventId}`}</span>
                              </p>
                            </div>
                            
                            <button
                              onClick={async () => await db.guests.delete(vol.id!)}
                              className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
          </section>
        ) : (
          /* DEFAULT OVERVIEW TAB PANEL */
          <>
            {/* STATS PANELS */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
              {[
                { label: 'Total Registrations', value: '412', icon: Users, color: theme.accent },
                { label: 'Live Check-ins', value: totalCheckInCount.toString(), icon: QrCode, color: 'text-emerald-500' },
              ].map((stat) => (
                <div key={stat.label} className={`border p-6 rounded-[2rem] ${theme.card}`}>
                  <div className={`p-3 w-fit rounded-2xl mb-4 ${isDark ? 'bg-white/5' : 'bg-slate-100'} ${stat.color}`}><stat.icon size={20} /></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-3xl font-black mt-1 uppercase">{stat.value}</h3>
                </div>
              ))}
            </section>

            {/* REAL-TIME COLLAPSED ACTIVITY REGISTRY */}
            <section className={`border p-6 md:p-8 rounded-[2.5rem] animate-in slide-in-from-bottom-6 duration-500 ${theme.card}`}>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black italic">Recent Entry Streams</h3>
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
            return { status: 'success', message: `${guest.type.toUpperCase()} badge verified.`, name: guest.name };
          }}
        />
      )}
    </div>
  );
}