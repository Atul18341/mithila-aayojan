'use client';

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  QrCode, Clock, Loader, Bell, Sun, Moon, 
  LogOut, Calendar, Sparkles, ShieldAlert 
} from 'lucide-react';
import { db } from '../../lib/db';
import EntryDeskCameraScanner from '../../components/CheckIn-Scanner';

export default function VolunteerCheckInPanel() {
  const [isDark, setIsDark] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  
  // Explicitly bound to assigned event context on the ground
  const volunteerEventId = 1; 

  // 1. DEXIE LIVE QUERIES (Lightweight footprints for mobile devices)
  const activeEvent = useLiveQuery(
    () => db.events.get(volunteerEventId),
    [volunteerEventId]
  );

  const recentCheckIns = useLiveQuery(
    async () => {
      return await db.guests
        .where('eventId')
        .equals(volunteerEventId)
        .reverse()
        .limit(5)
        .toArray();
    },
    [volunteerEventId]
  ) || [];

  const totalCheckedIn = useLiveQuery(
    () => db.guests.where('eventId').equals(volunteerEventId).count()
  ) || 0;

  if (!activeEvent) {
    return (
      <div className={`h-screen w-full flex items-center justify-center ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
        <Loader className="animate-spin text-purple-500" size={32} />
        <p>No event active.</p>
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

  const handleLogout = () => {
    console.log("Volunteer terminal disconnecting...");
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 flex flex-col justify-between overflow-x-hidden custom-scrollbar`}>
      
      {/* BRAND NEW FIXED HEADER - MATCHES MANAGER SPECIFICATION */}
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
              <span className="flex items-center gap-1"><Sparkles size={11} className="text-purple-500" /> {activeEvent.protocol}</span>
            </div>
          </div>
        </div>

        {/* RIGHT HEADER ACTION UTILITIES */}
        <div className="flex items-center gap-2.5">
          {/* THEME SWITCHER */}
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

          {/* NOTIFICATIONS TERMINAL HUB */}
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
                        {new Date(g.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

          {/* QUICK TERMINAL EXIT LOGOUT ACCESSIBILITY */}
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
      <div className="px-6 pt-6 flex justify-center">
        <div className={`inline-flex items-center gap-4 px-6 py-3 rounded-2xl border ${theme.card}`}>
          <div className="space-y-0.5">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Desk Stream Count</p>
            <p className="text-2xl font-black text-purple-500 tracking-tight">{totalCheckedIn}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-left">
            <span className="text-[8px] font-black uppercase bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded border border-purple-500/20 tracking-wider">
              Gate Operator Node
            </span>
          </div>
        </div>
      </div>

      {/* TARGETED SCAN TOUCH ZONE */}
      <div className="flex-1 flex flex-col justify-center items-center p-6">
        <button 
          onClick={() => setIsScanning(true)}
          className="w-36 h-36 rounded-full bg-purple-600 hover:bg-purple-700 flex flex-col items-center justify-center gap-2 shadow-2xl shadow-purple-500/20 active:scale-95 transition-all border-4 border-white/10 group"
        >
          <QrCode size={36} className="animate-pulse group-hover:scale-110 transition-transform text-white" />
          <span className="text-[9px] font-black uppercase tracking-widest text-white/90">Launch Camera</span>
        </button>
      </div>

      {/* FOOTER BAR */}
      <footer className={`p-4 text-center border-t ${isDark ? 'border-white/5 text-slate-600' : 'border-slate-200 text-slate-400'} text-[8px] font-black uppercase tracking-[0.2em]`}>
        Mithila Aayojan Encryption Lock Edge Terminal Secure Active
      </footer>

      {/* DETACHED CAMERA SCANNER ENGINE PORTAL */}
      {isScanning && (
        <EntryDeskCameraScanner 
          currentEventId={volunteerEventId}
          variant="purple"
          isDark={isDark}
          onClose={() => setIsScanning(false)}
          onScanExecute={async (token) => {
            const guest = await db.guests.where('qrToken').equals(token).first();
            if (!guest || guest.eventId !== volunteerEventId) {
              return { status: 'error', message: 'Access Denied: Invalid credential for this venue.' };
            }
            if (guest.checkInTime) {
              return { status: 'warning', message: 'Pass duplicate scan exception.', name: guest.name };
            }
            
            await db.guests.update(guest.id!, { checkInTime: Date.now() });
            return { status: 'success', message: `${guest.type.toUpperCase()} pass authenticated.`, name: guest.name };
          }}
        />
      )}
    </div>
  );
}