'use client';

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  LayoutDashboard, Users, Box, QrCode, Loader,
  Settings, Bell, Search, TrendingUp, 
  MapPin, Calendar, Clock, ChevronRight,
  Sun, Moon, ChevronDown, CheckCircle2, Sparkles, Plus,
  Heart, Briefcase, Globe, X, ArrowRight, ShieldCheck,
  Pencil, Save, Type, Image as ImageIcon, Eye, Link as LinkIcon, 
  Settings2, Loader2, LogOut
} from 'lucide-react';

import { db } from '../../lib/db';
import EventDetailEditor from './_components/event-details';
import EntryDeskCameraScanner from '../../components/CheckIn-Scanner';
import SyncStatusBar from '@/components/SyncStatusBar';

// --- CONFIG & CONSTANTS ---
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  // 1. DEXIE LIVE QUERIES
  const events = useLiveQuery(() => db.events.orderBy('createdAt').reverse().toArray()) || [];

  const activeEvent = useLiveQuery(
    async () => {
      if (selectedEventId) {
        const selected = await db.events.get(selectedEventId);
        if (selected) return selected;
      }
      const fallbackList = await db.events.orderBy('createdAt').reverse().toArray();
      return fallbackList.length > 0 ? fallbackList[0] : null;
    },
    [selectedEventId]
  );

  const recentCheckIns = useLiveQuery(
    async () => {
      if (!activeEvent?.id) return [];
      return await db.guests
        .where('eventId')
        .equals(activeEvent.id)
        .reverse()
        .limit(10)
        .toArray();
    },
    [activeEvent?.id]
  ) || [];

  const totalCheckInCount = useLiveQuery(
    async () => {
      if (!activeEvent?.id) return 0;
      return await db.guests.where('eventId').equals(activeEvent.id).count();
    },
    [activeEvent?.id]
  ) || 0;

  useEffect(() => {
    if (events.length > 0 && !selectedEventId) {
      setSelectedEventId(events[0].id || null);
    }
  }, [events, selectedEventId]);

  // --- EMPTY STORAGE DATA SCREEN PROTOCOL ---
  if (events.length === 0 && !isEditing) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center ${isDark ? 'bg-[#020617] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Sparkles className="text-blue-500 mb-4 animate-pulse" size={48} />
        <h2 className="text-2xl font-black italic">Welcome to Mithila Aayojan</h2>
        <button 
          onClick={() => setIsEditing(true)} 
          className="mt-6 px-8 py-4 bg-blue-600 rounded-2xl font-black uppercase text-xs tracking-widest hover:scale-105 transition-all shadow-xl shadow-blue-600/10"
        >
          Create Your First Event
        </button>
      </div>
    );
  }

  if (!activeEvent && !isEditing) {
    return (
      <div className={`h-screen w-full flex items-center justify-center ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
        <Loader className="animate-spin text-blue-500" size={32} />
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

  const handleLogout = () => {
    console.log("System terminal disconnecting...");
  };

  return (
    <div className={`flex h-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 overflow-hidden`}>
      
      {/* SIDEBAR CONTAINER */}
      <aside className={`w-64 border-r ${theme.sidebar} p-6 hidden lg:flex flex-col justify-between`}>
        <div className="space-y-8">
          <div className="flex items-center gap-3 px-2">
            <div className={`w-8 h-8 ${theme.accentBg} rounded-lg flex items-center justify-center font-black text-white`}>
              {activeEvent?.name ? activeEvent.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <span className="font-black tracking-tighter text-lg uppercase">Mithila <span className={theme.accent}>Aayojan</span></span>
          </div>
          <nav className="space-y-1">
            {[
              { icon: LayoutDashboard, label: 'Overview', active: !isEditing },
              { icon: Users, label: 'Guest List' },
              { icon: Box, label: 'Stockman Sync' },
              { icon: QrCode, label: 'Check-in Desk' },
              { icon: Settings, label: 'Settings', active: isEditing }
            ].map((item) => (
              <button 
                key={item.label} 
                onClick={() => { 
                  if (item.label === 'Settings' && activeEvent) setIsEditing(true); 
                  if (item.label === 'Overview') setIsEditing(false); 
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${item.active ? `${theme.accentBg} text-white shadow-lg` : 'text-slate-500 hover:bg-white/5'}`}
              >
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </nav>
        </div>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
        >
          <LogOut size={18} />
          <span>Exit System</span>
        </button>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 overflow-y-auto flex flex-col relative custom-scrollbar p-8 space-y-8">
        
        {/* UNIFIED HEADER BAR */}
        <header className={`sticky top-0 z-40 w-full py-4 border-b ${theme.bg} backdrop-blur-xl flex items-center justify-between`}>
          <div className="flex items-center gap-6">
            <div className="relative">
              {activeEvent ? (
                <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="group text-left space-y-1 focus:outline-none">
                  <h1 className={`text-2xl font-black italic flex items-center gap-2 ${activeEvent.type === 'celebration' ? 'font-serif' : 'font-sans'}`}>
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
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">No active matrix files found on local device storage links</p>
                </div>
              )}

              {isDropdownOpen && events.length > 0 && (
                <div className={`absolute top-full left-0 mt-4 w-80 rounded-[2.5rem] border ${theme.dropdownMenu} p-3 z-50`}>
                  {events.map((ev) => (
                    <button 
                      key={ev.id} 
                      onClick={() => { setSelectedEventId(ev.id || null); setIsDropdownOpen(false); setIsEditing(false); }} 
                      className={`w-full flex items-center justify-between p-4 rounded-2xl ${activeEvent?.id === ev.id ? 'bg-white/5' : 'hover:bg-white/5'}`}
                    >
                      <span className="text-xs font-black">{ev.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* HEADER INTERACTION ACTION ROW */}
            <div className="flex items-center gap-3">
              {activeEvent && !isEditing && (
                <button 
                  onClick={() => setIsScanning(true)}
                  className={`flex items-center gap-2 px-5 py-3 rounded-xl border font-black uppercase text-[10px] tracking-widest transition-all hover:scale-105 shadow-md ${
                    isDark 
                      ? 'bg-emerald-600/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/20' 
                      : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                  }`}
                >
                  <QrCode size={14} className="animate-pulse" />
                  Open Camera Desk
                </button>
              )}
              {(activeEvent || events.length > 0) && (
                <button 
                  onClick={() => setIsEditing(!isEditing)} 
                  className={`p-3 rounded-xl border transition-all ${isEditing ? 'bg-red-500 text-white' : `${theme.inputBg} text-slate-400`}`}
                >
                  {isEditing ? <X size={18} /> : <Pencil size={18} />}
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* 🚀 FIXED-WIDTH CONTAINER WRAPPER FOR PREVENTING LAYOUT SHIFTS */}
            <div className="w-44 h-12 flex items-center justify-end shrink-0">
              <SyncStatusBar />
            </div>

            {/* THEME TOGGLE SWITCHER */}
            <button 
              type="button"
              onClick={() => setIsDark(!isDark)} 
              className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center relative overflow-hidden ${theme.inputBg}`}
              aria-label="Toggle Layout Theme Color Mapping Modifiers"
            >
              <div className={`transition-all duration-500 transform ${isDark ? 'translate-y-0' : 'translate-y-12 opacity-0'}`}>
                <Sun size={20} className="text-blue-400 fill-blue-400/10" />
              </div>
              <div className={`absolute transition-all duration-500 transform ${!isDark ? 'translate-y-0' : '-translate-y-12 opacity-0'}`}>
                <Moon size={20} className="text-amber-500 fill-amber-500/20" />
              </div>
            </button>

            {/* LIVE NOTIFICATION OVERLAY */}
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
                    <span className="text-[9px] font-mono font-bold bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-md">Realtime</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {recentCheckIns.slice(0, 3).map((g: any) => (
                      <div key={g.id} className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] flex flex-col gap-1">
                        <p className="font-bold">
                          🎉 <span className={theme.accent}>{g.name}</span> verified entry as a <span className="underline">{g.type}</span>.
                        </p>
                        <span className="text-[9px] text-slate-500 font-mono">
                          {new Date(g.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                    {recentCheckIns.length === 0 && (
                      <p className="text-xs text-center py-4 text-slate-500 font-medium">No recent network activity streams.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT LAYOUT TOGGLE INTERFACE ROUTER */}
        {isEditing ? (
          <div className="w-full h-full flex flex-col justify-start pb-12 animate-in fade-in duration-300">
            <EventDetailEditor 
              event={activeEvent ?? null}
              isDark={isDark} 
              onClose={() => setIsEditing(false)}
              onCreationSuccess={(newEventId) => {
                setSelectedEventId(newEventId);
                setIsEditing(false);
              }}
            />
          </div>
        ) : (
          <>
            {/* STATS PANELS */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
              {[
                { label: 'Total RSVPs', value: '412', icon: Users, color: theme.accent },
                { label: 'Live Check-ins', value: totalCheckInCount.toString(), icon: QrCode, color: 'text-emerald-500' },
                { label: 'Stock Health', value: '94%', icon: Box, color: 'text-amber-500' },
                { label: 'Event Status', value: activeEvent?.status || 'draft', icon: Sparkles, color: 'text-purple-500' }
              ].map((stat) => (
                <div key={stat.label} className={`border p-6 rounded-[2rem] ${theme.card}`}>
                  <div className={`p-3 w-fit rounded-2xl mb-4 ${isDark ? 'bg-white/5' : 'bg-slate-100'} ${stat.color}`}><stat.icon size={20} /></div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{stat.label}</p>
                  <h3 className="text-3xl font-black mt-1 uppercase">{stat.value}</h3>
                </div>
              ))}
            </section>

            {/* REAL-TIME COLLAPSED ACTIVITY REGISTRY */}
            <section className={`border p-8 rounded-[2.5rem] animate-in slide-in-from-bottom-6 duration-500 ${theme.card}`}>
              <div className="flex justify-between items-center mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-500">
                    <Clock size={14} className="animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Live System Feed</span>
                  </div>
                  <h3 className="text-lg font-black italic">Recent Entry Streams</h3>
                </div>
                <div className="px-4 py-1.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Streaming Cap: 10 max
                </div>
              </div>

              {recentCheckIns.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 font-bold italic">
                  Awaiting system entries... Check-in terminal idle.
                </div>
              ) : (
                <div className="divide-y divide-white/5 border border-white/5 rounded-3xl overflow-hidden">
                  {recentCheckIns.map((guest: any) => {
                    const colors = GUEST_COLOR_MAP[guest.type as keyof typeof GUEST_COLOR_MAP] || GUEST_COLOR_MAP.delegate;
                    return (
                      <div key={guest.id} className={`p-4 flex items-center justify-between transition-colors ${isDark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-2.5 h-2.5 rounded-full ${colors.dot} shadow-lg shrink-0`} />
                          <div>
                            <p className="text-sm font-black tracking-tight">{guest.name}</p>
                            <span className={`inline-block mt-1 px-2.5 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider ${colors.bg} ${colors.text} ${colors.border}`}>
                              {guest.type}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-[11px] font-mono text-slate-500 font-bold">
                          {new Date(guest.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
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

      {/* PORTAL OVERLAY CAMERA SCANNER MODAL */}
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