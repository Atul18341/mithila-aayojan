// src/app/guests/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  LayoutDashboard, Users, QrCode, Loader2,
  Settings, UserCheck, User, Crown, ChevronRight, 
  Search, Edit3, Save, X, Menu, Sun, Moon, MessageSquareShare
} from 'lucide-react';
import { db } from '@/lib/db';
import SyncStatusBar from '@/components/SyncStatusBar';
import LogoutButton from '@/components/LogoutButton';

interface GuestRecord {
  id?: number | string;
  guestId?: string;
  qrToken?: string;
  qr_token?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  category: string;
  competitionTitle?: string | null;
  ageGroupLabel?: string | null;
  eventId: number | string;
  eventName?: string | null;
  isCheckedIn?: boolean;
  checkInTime?: number | null;
}

export default function GuestManagementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventIdParam = searchParams.get('eventId') || searchParams.get('id') || '';

  // Light theme set by default
  const [isDark, setIsDark] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>(eventIdParam);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedCompetition, setSelectedCompetition] = useState<string>('ALL');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('ALL');

  // Edit Modal/Inline State
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [editForm, setEditForm] = useState<Partial<GuestRecord>>({});

  // Manager Profile Session State
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
        console.error("❌ Failed to parse session identity indexes:", err);
      }
    }
    resolveActiveSession();
  }, []);

  // Fetch Guests from Dexie IndexedDB and map database field variations
  useEffect(() => {
    async function fetchGuests() {
      try {
        setLoading(true);
        if (!db.isOpen()) await db.open();

        const allGuests = await db.eventRegistrations.toArray();
        const normalizedGuests: GuestRecord[] = allGuests.map((g: any) => ({
          ...g,
          ageGroupLabel: g.ageGroupLabel || g.AgeGroupLabel || g.age_group_label || null,
          competitionTitle: g.competitionTitle || g.CompetitionTitle || g.competition_title || null,
          eventId: g.eventId || g.event_id,
        }));

        setGuests(normalizedGuests);
      } catch (err) {
        console.error('Failed to load guest list from local DB:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchGuests();
  }, []);

  // Extract unique filter options dynamically from records
  const filterOptions = useMemo(() => {
    const events = new Set<string>();
    const categories = new Set<string>();
    const competitions = new Set<string>();
    const ageGroups = new Set<string>();

    guests.forEach((g) => {
      if (g.eventId) events.add(String(g.eventId));
      if (g.category) categories.add(g.category);
      if (g.competitionTitle) competitions.add(g.competitionTitle);
      if (g.ageGroupLabel) ageGroups.add(g.ageGroupLabel);
    });

    return {
      events: Array.from(events),
      categories: Array.from(categories),
      competitions: Array.from(competitions),
      ageGroups: Array.from(ageGroups),
    };
  }, [guests]);

  // Filtered Guests Logic
  const filteredGuests = useMemo(() => {
    return guests.filter((g) => {
      if (selectedEventId && String(g.eventId) !== selectedEventId) return false;
      if (selectedCategory !== 'ALL' && g.category !== selectedCategory) return false;
      if (selectedCompetition !== 'ALL' && g.competitionTitle !== selectedCompetition) return false;
      if (selectedAgeGroup !== 'ALL' && g.ageGroupLabel !== selectedAgeGroup) return false;
      
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const nameMatch = g.name?.toLowerCase().includes(query);
        const phoneMatch = g.phone?.toLowerCase().includes(query);
        const tokenMatch = (g.qrToken || g.qr_token)?.toLowerCase().includes(query);
        if (!nameMatch && !phoneMatch && !tokenMatch) return false;
      }
      return true;
    });
  }, [guests, selectedEventId, selectedCategory, selectedCompetition, selectedAgeGroup, searchQuery]);

  // 🟢 WhatsApp Registration Metrics Dispatcher (Unfiltered Aggregations with Competition + Category + Age)
  const handleSendRegistrationMetricsToWhatsApp = () => {
    const totalCount = guests.length;
    const currentDateTime = new Date().toLocaleString();

    // Sum up by Category
    const categoryCounts: Record<string, number> = {};
    // Group by Competition -> Age Group -> Count
    const compAgeCounts: Record<string, Record<string, number>> = {};

    guests.forEach((g) => {
      const cat = g.category || 'Uncategorized';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      const comp = g.competitionTitle || 'Other Category';
      const age = g.ageGroupLabel || 'N/A';

      if (!compAgeCounts[comp]) {
        compAgeCounts[comp] = {};
      }
      compAgeCounts[comp][age] = (compAgeCounts[comp][age] || 0) + 1;
    });

    let message = `📋 *Event Registration Metrics Report*\n`;
    message += `📅 *Report Date/Time:* ${currentDateTime}\n\n`;
    message += `• *Total Registrations (till now):* ${totalCount}\n\n`;

    message += `📊 *Breakdown by Category:*\n`;
    Object.entries(categoryCounts).forEach(([cat, count]) => {
      message += `  - ${cat}: ${count}\n`;
    });

    message += `\n🎯 *Breakdown by Competition & Age Groups:*\n`;
    Object.entries(compAgeCounts).forEach(([comp, ageGroups]) => {
      message += `• *${comp}:*\n`;
      Object.entries(ageGroups).forEach(([age, count]) => {
        message += `  - ${age}: ${count}\n`;
      });
    });

    message += `\n_*Generated via Mithila Aayojan Platform (Powered by LYSS Technology, Madhubani)*_`;

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
  };

  const handleStartEdit = (guest: GuestRecord) => {
    const recordId = guest.id || guest.guestId;
    setEditingId(recordId || null);
    setEditForm({ ...guest });
  };

  const handleSaveEdit = async (id: number | string) => {
    try {
      if (!db.isOpen()) await db.open();
      const target = guests.find((g) => (g.id || g.guestId) === id);
      if (!target) return;

      const { id: _, guestId: __, ...fieldsToUpdate } = editForm;
      const updatedRecord = { ...target, ...fieldsToUpdate };

      if (target.id && typeof target.id === 'number') {
        await db.eventRegistrations.update(target.id, fieldsToUpdate);
      } else {
        await db.eventRegistrations.put(updatedRecord as any);
      }

      setGuests((prev) =>
        prev.map((g) => ((g.id || g.guestId) === id ? updatedRecord : g))
      );
      setEditingId(null);
      setEditForm({});
    } catch (err) {
      console.error('Failed to update guest record:', err);
    }
  };

  // Theme configuration tokens mapped dynamically
  const theme = {
    bg: isDark ? 'bg-[#020617] text-slate-100' : 'bg-slate-50 text-slate-900',
    sidebar: isDark ? 'bg-[#020617] border-white/5 text-slate-100' : 'bg-white border-slate-200 text-slate-900',
    card: isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-sm',
    inputBg: isDark ? 'bg-slate-950 border-slate-800 text-slate-200 placeholder-slate-500' : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400',
    tableBg: isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xl',
    tableHead: isDark ? 'bg-slate-950 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200',
    tableRowHover: isDark ? 'hover:bg-slate-800/40 divide-slate-800/60' : 'hover:bg-slate-50 divide-slate-100',
    accent: 'text-blue-600 dark:text-blue-500',
    accentBg: 'bg-blue-600'
  };

  if (loading) {
    return (
      <div className={`h-screen w-full flex flex-col items-center justify-center ${theme.bg}`}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Loading Guest Directory...
        </p>
      </div>
    );
  }

  return (
    <div className={`flex h-screen w-screen ${theme.bg} transition-colors duration-500 overflow-hidden relative`}>
      
      {/* MOBILE BACKDROP */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)} 
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity" 
        />
      )}

      {/* SIDEBAR */}
      <aside className={`
        fixed lg:static top-0 left-0 bottom-0 z-50 w-72 lg:w-64 border-r ${theme.sidebar} p-6 flex flex-col justify-between h-full shrink-0 transition-transform duration-300
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="space-y-6 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 ${theme.accentBg} rounded-lg flex items-center justify-center font-black text-white`}>
                A
              </div>
              <span className="font-black tracking-tighter text-lg uppercase">Mithila <span className="text-blue-600 dark:text-blue-500">Aayojan</span></span>
            </div>
            
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
              <X size={20} />
            </button>
          </div>

          <Link
            href="/dashboard-eventManagers/profile"
            className={`p-3 rounded-2xl border transition-all flex items-center justify-between group ${
              isDark ? 'bg-white/5 border-white/10 hover:border-blue-500/50' : 'bg-slate-50 border-slate-200 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                {managerSession.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 text-left">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-bold truncate text-slate-900 dark:text-white">{managerSession.name}</span>
                  <Crown size={12} className="text-amber-500 shrink-0" />
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{managerSession.email || 'Manager Workspace'}</p>
              </div>
            </div>
            <ChevronRight size={14} className="text-slate-400 shrink-0" />
          </Link>
          
          <nav className="space-y-1">
            {[
              { icon: LayoutDashboard, label: 'Overview', route: '/dashboard' },
              { icon: Users, label: 'Guest List', route: '/guests', active: true },
              { icon: UserCheck, label: 'Volunteers', route: '/dashboard' },
              { icon: QrCode, label: 'Check-in Desk', route: '/dashboard' },
              { icon: Settings, label: 'Event Settings', route: '/dashboard' },
              { icon: User, label: 'Manager Profile', route: '/dashboard-eventManagers/profile' }
            ].map((item) => (
              <button 
                key={item.label} 
                onClick={() => router.push(item.route)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${item.active ? `${theme.accentBg} text-white shadow-lg` : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'}`}
              >
                <item.icon size={18} /> {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-4 border-t border-inherit">
          <LogoutButton />
        </div>
      </aside>

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-1 flex flex-col space-y-6 p-4 sm:p-8 overflow-y-auto custom-scrollbar">
        
        {/* HEADER BAR */}
        <header className="flex items-center justify-between pb-4 border-b border-inherit gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={`lg:hidden p-2.5 rounded-xl border ${theme.inputBg}`}>
              <Menu size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
                <Users className="w-7 h-7 text-blue-600 dark:text-blue-500" />
                Guest List Management
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Filter, search, and manage registered attendee records locally.
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <SyncStatusBar />
            {/* Theme Toggle Button */}
            <button 
              onClick={() => setIsDark(!isDark)} 
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${theme.inputBg}`}
              title="Toggle Theme"
            >
              {isDark ? <Sun size={18} className="text-blue-400" /> : <Moon size={18} className="text-amber-500" />}
            </button>
          </div>
        </header>

        {/* TOTAL COUNT & WHATSAPP REGISTRATION METRICS BAR */}
        <div className="flex flex-col sm:flex-row items-center sm:items-center justify-between gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Total Registered Guests</span>
            <span className="text-xs font-mono font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-200 dark:border-blue-500/20 ml-2">
              {filteredGuests.length} <span className="text-[10px] text-slate-400 font-normal">/ {guests.length} total</span>
            </span>
          </div>

          <button
            onClick={handleSendRegistrationMetricsToWhatsApp}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-600/20"
          >
            <MessageSquareShare size={15} />
            Send Metrics to WhatsApp
          </button>
        </div>

        {/* SEARCH & FILTERS PANEL */}
        <div className={`${theme.card} p-4 rounded-2xl shadow-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3`}>
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, mobile, or token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full border rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-blue-500 ${theme.inputBg}`}
            />
          </div>

          <div>
            <select
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${theme.inputBg}`}
            >
              <option value="">All Events</option>
              {filterOptions.events.map((id) => (
                <option key={id} value={id}>Event ID: {id}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${theme.inputBg}`}
            >
              <option value="ALL">All Categories</option>
              {filterOptions.categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedCompetition}
              onChange={(e) => setSelectedCompetition(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 ${theme.inputBg}`}
            >
              <option value="ALL">All Competitions</option>
              {filterOptions.competitions.map((comp) => (
                <option key={comp} value={comp}>{comp}</option>
              ))}
            </select>
          </div>
        </div>

        {/* GUEST TABLE DISPLAY */}
        <div className={`${theme.tableBg} rounded-2xl overflow-hidden flex-1`}>
          <div className="overflow-x-auto max-h-[60vh] custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead className={`sticky top-0 uppercase tracking-wider border-b z-10 ${theme.tableHead}`}>
                <tr>
                  <th className="py-3 px-4 font-semibold w-12 text-center">#</th>
                  <th className="py-3 px-4 font-semibold">Attendee Name</th>
                  <th className="py-3 px-4 font-semibold">Contact / Mobile</th>
                  <th className="py-3 px-4 font-semibold">Token & Event</th>
                  <th className="py-3 px-4 font-semibold">Category / Comp</th>
                  <th className="py-3 px-4 font-semibold">Age Group</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${theme.tableRowHover}`}>
                {filteredGuests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-slate-500 font-semibold">
                      No matching guest records found.
                    </td>
                  </tr>
                ) : (
                  filteredGuests.map((guest, index) => {
                    const recordId = guest.id || guest.guestId;
                    const isEditing = editingId === recordId;

                    return (
                      <tr key={recordId} className="transition-colors">
                        <td className="py-3 px-4 text-center font-mono text-slate-400 font-bold">
                          {index + 1}
                        </td>

                        <td className="py-3 px-4 font-medium">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.name || ''}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className={`border rounded px-2 py-1 text-xs w-full ${theme.inputBg}`}
                            />
                          ) : (
                            guest.name
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.phone || ''}
                              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                              className={`border rounded px-2 py-1 text-xs w-full ${theme.inputBg}`}
                            />
                          ) : (
                            guest.phone || 'N/A'
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono">
                          <div className="text-blue-600 dark:text-blue-400 font-bold">{guest.qrToken || guest.qr_token || 'No Token'}</div>
                          <div className="text-[10px] text-slate-400">Event ID: {guest.eventId}</div>
                        </td>

                        <td className="py-3 px-4">
                          {isEditing ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={editForm.category || ''}
                                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                                placeholder="Category"
                                className={`border rounded px-2 py-1 text-[11px] w-full ${theme.inputBg}`}
                              />
                              <input
                                type="text"
                                value={editForm.competitionTitle || ''}
                                onChange={(e) => setEditForm({ ...editForm, competitionTitle: e.target.value })}
                                placeholder="Competition"
                                className={`border rounded px-2 py-1 text-[11px] w-full ${theme.inputBg}`}
                              />
                            </div>
                          ) : (
                            <div>
                              <span className="inline-block bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded text-[10px] font-semibold">
                                {guest.category || 'General'}
                              </span>
                              {guest.competitionTitle && (
                                <div className="text-slate-500 dark:text-slate-300 mt-0.5 text-[11px]">{guest.competitionTitle}</div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editForm.ageGroupLabel || ''}
                              onChange={(e) => setEditForm({ ...editForm, ageGroupLabel: e.target.value })}
                              className={`border rounded px-2 py-1 text-xs w-full ${theme.inputBg}`}
                            />
                          ) : (
                            guest.ageGroupLabel || 'N/A'
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-1 rounded-full text-[10px] font-bold ${guest.isCheckedIn || guest.checkInTime ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'}`}>
                            {guest.isCheckedIn || guest.checkInTime ? 'Checked-In' : 'Registered'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSaveEdit(recordId!)}
                                className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition"
                                title="Save"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg transition"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleStartEdit(guest)}
                              className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-300 rounded-lg transition"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>
    </div>
  );
}