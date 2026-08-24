// src/app/dashboard/_components/sidebar.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  LayoutDashboard, Users, QrCode, Settings, 
  X, Sun, Moon, Crown, ChevronRight, User
} from 'lucide-react';
import LogoutButton from '@/components/LogoutButton';

interface SidebarProps {
  isDark: boolean;
  setIsDark: (val: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (val: boolean) => void;
  activeEvent: any;
  managerSession: {
    id?: number;
    name: string;
    email: string;
    role: string;
  };
  showActiveScreen: boolean;
  isManagingVolunteers: boolean;
  isEditing: boolean;
  setIsManagingVolunteers: (val: boolean) => void;
  setIsEditing: (val: boolean) => void;
  setIsCreatingNew: (val: boolean) => void;
  setIsScanning: (val: boolean) => void;
  theme: {
    sidebar: string;
    accent: string;
    accentBg: string;
    inputBg: string;
  };
}

export default function Sidebar({
  isDark,
  setIsDark,
  isSidebarOpen,
  setIsSidebarOpen,
  activeEvent,
  managerSession,
  showActiveScreen,
  isManagingVolunteers,
  isEditing,
  setIsManagingVolunteers,
  setIsEditing,
  setIsCreatingNew,
  setIsScanning,
  theme
}: SidebarProps) {
  const router = useRouter();

  return (
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

        <Link
          href="/dashboard-eventManagers/profile"
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
            { icon: LayoutDashboard, label: 'Overview', active: !showActiveScreen },
            { icon: Users, label: 'Guest List', active: false },
            { icon: Users, label: 'Volunteers', active: isManagingVolunteers },
            { icon: QrCode, label: 'Check-in Desk' },
            { icon: Settings, label: 'Event Edit/Settings', active: isEditing },
            { icon: User, label: 'Manager Profile' }
          ].map((item) => (
            <button 
              key={item.label} 
              onClick={() => { 
                if (item.label === 'Manager Profile') {
                  router.push('/dashboard/eventManagers/profile');
                } else if (item.label === 'Guest List') {
                  const targetQuery = activeEvent?.id ? `?eventId=${activeEvent.id}` : '';
                  router.push(`/dashboard/eventManagers/guests${targetQuery}`);
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
        </div>
      </div>

      <div className="pt-4 border-t border-inherit">
        <LogoutButton />
      </div>
    </aside>
  );
}