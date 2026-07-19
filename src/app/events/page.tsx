// src/app/events/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, Calendar, MapPinHouse, SlidersHorizontal, 
  Building2, ArrowRight, Sparkles, Loader2, AlertCircle, Clock
} from 'lucide-react';
import Link from 'next/link';

interface EventSummary {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  type: 'event' | 'celebration' | 'summit' | 'workshop' | 'conference';
  date: string; 
  start_time?: string;
  end_time?: string;
  location: string;
  venue_name:string;
  coverImageUrl: string | null;
  organizedBy: string;
}

export default function AggregatedEventsLandingPage() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter & Active Tab States
  const [activeTab, setActiveTab] = useState<'active' | 'past'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedOrg, setSelectedOrg] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function fetchGlobalEventsMatrix() {
      try {
        setLoading(true);
        const res = await fetch('/api/events/public');
        if (!res.ok) throw new Error('Failed to synchronize global event registries.');
        
        const data = await res.json();
        if (data.success) {
          setEvents(data.events || []);
        } else {
          throw new Error(data.error || 'Empty target validation schema returned.');
        }
      } catch (err: any) {
        console.error('Data layer connection failure:', err);
        setError(err.message || 'An anomaly occurred while building the experience matrix.');
      } finally {
        setLoading(false);
      }
    }
    fetchGlobalEventsMatrix();
  }, []);
  
  const uniqueOrganizations = ['all', ...Array.from(new Set(events.map(e => e.organizedBy || 'General Tenant')))];

  const matchesFilters = (event: EventSummary) => {
    const matchesSearch = event.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          event.tagline?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          event.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || event.type === selectedType;
    const matchesOrg = selectedOrg === 'all' || event.organizedBy === selectedOrg;
    
    return matchesSearch && matchesType && matchesOrg;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Segment all events matching search filters into respective timeline arrays
  const activeEvents = events.filter(event => {
    if (!matchesFilters(event)) return false;
    const eventDate = new Date(event.date);
    return isNaN(eventDate.getTime()) || eventDate >= today;
  });

  const pastEvents = events.filter(event => {
    if (!matchesFilters(event)) return false;
    const eventDate = new Date(event.date);
    return !isNaN(eventDate.getTime()) && eventDate < today;
  });

  const currentVisibleEvents = activeTab === 'active' ? activeEvents : pastEvents;
  
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 text-slate-500">
        <Loader2 className="animate-spin text-blue-600" size={36} />
        <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Synchronizing Regional Ledger Matrix...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center text-red-500 mx-auto">
          <AlertCircle size={28} />
        </div>
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Registry Resolution Failure</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-blue-600 selection:text-white antialiased">
      
      {/* HERO PRESENTATION BLOCK */}
      <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-b from-blue-50/50 via-indigo-50/20 to-slate-50 py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-400/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-emerald-400/10 rounded-full filter blur-3xl pointer-events-none" />
        
        <div className="max-w-6xl mx-auto text-center space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-200 bg-blue-50 text-[10px] font-black uppercase tracking-widest text-blue-700 shadow-sm">
            <Sparkles size={12} />
            <span>Unified Platform Discovery Hub</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-tight text-slate-900 italic">
            Connecting Communities, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 bg-clip-text text-transparent not-italic">Empowering Initiatives.</span>
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed">
            Explore and register for upcoming summits, specialized technical bootcamps, and historic cultural programs orchestrated across our global chapter matrices.
          </p>
        </div>
      </div>

      {/* SEARCH & FILTERS CONTROLS */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-30">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white/90 shadow-xl backdrop-blur-xl space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search event signatures, descriptions, or geographic hubs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-xl text-sm placeholder:text-slate-400 text-slate-800 focus:outline-none transition-all"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center justify-center gap-2 px-5 py-3 rounded-xl border font-bold text-xs uppercase tracking-wider cursor-pointer transition-all select-none
                ${showFilters 
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md' 
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <SlidersHorizontal size={14} />
              <span>Filter Events</span>
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Class Layout Type</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none"
                >
                  <option value="all">All Event Formats</option>
                  <option value="summit">Summits & Keynotes</option>
                  <option value="workshop">Technical Workshops</option>
                  <option value="celebration">Cultural Celebrations</option>
                  <option value="conference">Conferences</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 block">Host Signature Authority</label>
                <select
                  value={selectedOrg}
                  onChange={(e) => setSelectedOrg(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-500 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none capitalize"
                >
                  {uniqueOrganizations.map(org => (
                    <option key={org} value={org}>
                      {org === 'all' ? 'All Organizations / Chapters' : org}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DYNAMIC TAB NAVIGATION BAR */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
          {/* Tab Button Toggles */}
          <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('active')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all select-none cursor-pointer
                ${activeTab === 'active' 
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40' 
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <span>Active/Upcoming Events</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-slate-300/60 text-slate-600'}`}>
                {activeEvents.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-all select-none cursor-pointer
                ${activeTab === 'past' 
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200/40' 
                  : 'text-slate-500 hover:text-slate-800'
                }`}
            >
              <span>Past Events</span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'past' ? 'bg-slate-800 text-white' : 'bg-slate-300/60 text-slate-600'}`}>
                {pastEvents.length}
              </span>
            </button>
          </div>

          <p className="text-xs text-slate-400 font-medium italic">
            {activeTab === 'active' 
              ? 'Showing running setups scheduled for active registration entry.' 
              : 'Showing completed operations compiled inside historical memory.'}
          </p>
        </div>

        {/* TAB GRID CONTENTS PANEL */}
        {currentVisibleEvents.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-slate-200 rounded-3xl bg-white text-slate-400 text-xs font-medium">
            No {activeTab === 'active' ? 'active' : 'archived'} event records match your parameters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {currentVisibleEvents.map((event) => {
              // 🚀 Helper function to convert "HH:MM:SS" or "HH:MM" to "HH:MM AM/PM"
              const formatTimeString = (timeStr?: string) => {
                if (!timeStr) return '';
                
                // Split the hours and minutes out, ignoring the seconds column
                const [hoursStr, minutesStr] = timeStr.split(':');
                let hours = parseInt(hoursStr, 10);
                const minutes = minutesStr || '00';
                
                if (isNaN(hours)) return timeStr; // Fallback safety check

                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12;
                hours = hours ? hours : 12; // The hour '0' should be converted to '12'
                
                // Pads single digits with a leading zero (e.g., "5" becomes "05")
                const paddedHours = hours < 10 ? `0${hours}` : hours; 

                return `${paddedHours}:${minutes} ${ampm}`;
              };

              // 🚀 Update your loop logic inside the component to use the helper:
              const formattedStart = formatTimeString(event.start_time);
              const formattedEnd = formatTimeString(event.end_time);

              const timeDisplay = formattedEnd 
                ? `${formattedStart} - ${formattedEnd}` 
                : `${formattedStart || '09:30 AM'} onwards`;

              return (
                <article 
                  key={event.id}
                  className={`group rounded-2xl border bg-white shadow-sm transition-all duration-300 overflow-hidden flex flex-col justify-between
                    ${activeTab === 'past' 
                      ? 'border-slate-200/60 opacity-90 hover:opacity-100 hover:shadow-md' 
                      : 'border-slate-200 hover:border-slate-300 hover:shadow-xl'
                    }`}
                >
                  <div className="w-full">
                    {/* 🚀 FIXED: Dynamic verification ensuring coverImageUrl maps safely on the cards */}
                    <div className="h-44 overflow-hidden relative border-b border-slate-100 bg-slate-100">
                      <img 
                        src={event?.coverImageUrl || '/assets/default-cover-placeholder.webp'} 
                        alt={event.name} 
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 
                          ${activeTab === 'past' ? 'filter grayscale brightness-90 saturate-[0.8]' : 'filter brightness-[0.95] saturate-[1.05]'}`}
                        loading="lazy"
                      />
                      <div className="absolute top-4 left-4 flex flex-wrap gap-1.5">
                        <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-white/90 border shadow-sm backdrop-blur-md
                          ${activeTab === 'past' ? 'border-slate-300 text-slate-600' : 'border-slate-200 text-blue-700'}`}>
                          {event.type}
                        </span>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-wider text-slate-400">
                        <Building2 size={12} className={activeTab === 'past' ? 'text-slate-400' : 'text-indigo-500'} />
                        <span className="truncate max-w-[220px]">{event.organizedBy || 'Regional Tenant'}</span>
                      </div>

                      <div className="space-y-1">
                        <h3 className={`text-lg font-black tracking-tight leading-snug group-hover:text-blue-600 transition-colors line-clamp-1 italic
                          ${activeTab === 'past' ? 'text-slate-700' : 'text-slate-900'}`}>
                          {event.name}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">
                          {event.tagline || 'Click to view configuration matrix bounds and check gate validation keys.'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                        <div className="flex items-center gap-2.5">
                          <Calendar size={14} className="text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800">{event.date}</span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <Clock size={14} className="text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800">{timeDisplay}</span>
                        </div>
                        
                        {/* 🚀 FIXED: Swapped venue fallback mapping for explicit general location attribute */}
                        <div className="flex items-center gap-2.5">
                          <MapPinHouse size={14} className="text-slate-400 shrink-0" />
                          <span className="font-medium truncate text-slate-500" title={event.location}>
                            {event.venue_name || 'Location Specified Upon Verification'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <Link 
                      href={`/events/${event.slug}`}
                      className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border font-bold text-xs uppercase tracking-wider select-none cursor-pointer transition-all duration-300 shadow-sm group-hover:shadow-md
                        ${activeTab === 'past'
                          ? 'bg-white border-slate-250 text-slate-600 hover:bg-slate-800 hover:text-white hover:border-slate-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700 group-hover:bg-blue-600 group-hover:border-blue-600 group-hover:text-white'
                        }`}
                    >
                      <span>{activeTab === 'past' ? 'Review Archive Details' : 'Access Secure Registry'}</span>
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}