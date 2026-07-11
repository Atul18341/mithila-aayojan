// src/app/dashboard/_components/event-details.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  Save, Calendar, MapPin, Plus, Eye, EyeOff, 
  Type, Settings2, Sparkles, CheckCircle2, Loader2,
  TrendingUp, X, Globe
} from 'lucide-react'; 
import { db } from '../../../lib/db'; 

interface EventDetailEditorProps {
  isDark?: boolean;
  event: any | null; 
  onCreationSuccess?: (newEventId: number) => void; 
  onClose: () => void; 
}

export default function EventDetailEditor({ isDark = true, event, onCreationSuccess, onClose }: EventDetailEditorProps) {
  const [activeTab, setActiveTab] = useState('basics');
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  const [currentStatus, setCurrentStatus] = useState<'draft' | 'published' | 'unpublished'>('draft');
  const [isCreateMode, setIsCreateMode] = useState(!event);

  const [details, setDetails] = useState({
    title: '',
    tagline: '',
    description: '',
    venueName: '',
    address: '',
    primaryDate: '',
    hypeThreshold: 0,
    type: 'event' as 'event' | 'celebration' | 'conference' | 'summit' | 'workshop', 
    protocol: 'open-registration' as 'open-registration' | 'ticketed' | 'invite-only',
    visibility: {
      map: true,
      rsvp: true,
      schedule: true,
      gallery: false
    }
  });

  useEffect(() => {
    if (event) {
      setDetails({
        title: event.name || '',
        tagline: event.tagline || '',
        description: event.description || '',
        venueName: event.venueName || '',
        address: event.location || '',
        primaryDate: event.date || '',
        hypeThreshold: event.hypeThreshold || 0,
        type: event.type || 'event',
        protocol: event.protocol || 'open-registration', 
        visibility: event.visibility || {
          map: true, rsvp: true, schedule: true, gallery: false
        }
      });
      setCurrentStatus((event.status as 'draft' | 'published') || 'draft');
      setIsCreateMode(false);
      setSaveStatus('idle');
    } else {
      handleResetToCreation();
    }
  }, [event]);

  const handleResetToCreation = () => {
    setDetails({
      title: '',
      tagline: '',
      description: '',
      venueName: '',
      address: '',
      primaryDate: '',
      hypeThreshold: 0,
      type: 'event',
      protocol: 'open-registration',
      visibility: { map: true, rsvp: true, schedule: true, gallery: false }
    });
    setCurrentStatus('draft');
    setIsCreateMode(true);
    setActiveTab('basics');
    setSaveStatus('idle');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDetails(prev => ({ ...prev, [name]: value }));
    if (saveStatus === 'success') setSaveStatus('idle');
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDetails(prev => ({ ...prev, hypeThreshold: parseInt(e.target.value) }));
    if (saveStatus === 'success') setSaveStatus('idle');
  };

  const handleSaveOrCreate = async (forcedStatus?: 'draft' | 'published' | 'unpublished') => {
    if (!details.title.trim()) return;
    forcedStatus === 'published' ? setIsPublishing(true) : setIsSaving(true);

    const generatedSlug = details.title.toLowerCase().trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const compiledData = {
      name: details.title,
      tagline: details.tagline,
      description: details.description,
      venueName: details.venueName,
      location: details.address,
      date: details.primaryDate,
      type: details.type,
      protocol: details.protocol, 
      status: forcedStatus || currentStatus, 
      slug: generatedSlug || 'live-slug',
      hypeThreshold: details.hypeThreshold,
      visibility: details.visibility,
      createdAt: event?.createdAt || Date.now(),
      syncStatus: 'pending' as const 
    };

    try {
      if (isCreateMode) {
        const newId = await db.events.add(compiledData);
        setSaveStatus('success');
        setIsCreateMode(false);
        if (onCreationSuccess) onCreationSuccess(newId as number);
      } else {
        if (!event?.id) return;
        await db.events.update(event.id, compiledData);
        setSaveStatus('success');
        if (forcedStatus) setCurrentStatus(forcedStatus);
      }

      if (navigator.onLine) {
        try {
          const currentEventId = event?.id || 1;
          const freshLocalRecord = await db.events.get(currentEventId);
          
          if (freshLocalRecord) {
            const response = await fetch('/api/sync/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ events: [freshLocalRecord] })
            });

            if (response.ok) {
              await db.events.update(currentEventId, { syncStatus: 'synced' });
            }
          }
        } catch (netErr) {
          console.warn("Immediate sync link dropped. Local changes safely cached in Dexie.");
        }
      }

      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Database update transaction exception:", err);
    } finally {
      setIsSaving(false);
      setIsPublishing(false);
    }
  };

  const accentColor = details.type === 'celebration' ? 'emerald' : 'blue';

  return (
    /* 🚀 FIXED: Added h-full and min-h-0 to let this main component scale correctly inside page constraints */
    <div className={`w-full max-w-5xl mx-auto rounded-[1.5rem] border overflow-hidden animate-in fade-in zoom-in-95 duration-500 relative flex flex-col h-full min-h-0 ${
      isDark ? 'bg-[#020617] border-white/10' : 'bg-white border-slate-200 shadow-xl'
    }`}>
      
      {/* STICKY CONFIGURATION HEADER */}
      <div className="p-6 md:p-8 border-b border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-inherit z-10 shrink-0">
        <div>
          <div className={`flex items-center gap-2 text-${accentColor}-500 mb-1`}>
            <Settings2 size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">
              {isCreateMode ? 'Instantiation Engine' : 'Configure Experience'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className={`text-2xl font-black italic tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {isCreateMode ? (details.title || "Initialize New Event") : details.title}
            </h2>
            
            {!isCreateMode && (
              <span className={`px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${
                currentStatus === 'published' 
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}>
                {currentStatus}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          {!isCreateMode && (
            <button
              type="button"
              onClick={handleResetToCreation}
              className={`p-3 rounded-xl border border-dashed transition-all hover:scale-105 flex items-center justify-center ${
                isDark ? 'border-white/10 hover:border-white/30 text-slate-400 hover:text-white' : 'border-slate-300 text-slate-500 hover:text-slate-900'
              }`}
              title="Instantiate Blank Ledger"
            >
              <Plus size={16} />
            </button>
          )}

          {!isCreateMode && currentStatus !== 'published' ? (
            <button
              type="button"
              onClick={() => handleSaveOrCreate('published')}
              disabled={isPublishing || isSaving}
              className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 shadow-lg shadow-emerald-600/10 transition-all flex items-center gap-2 disabled:opacity-40"
            >
              {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
              Publish Event
            </button>
          ) : (
            !isCreateMode && (
              <button
                type="button"
                onClick={() => handleSaveOrCreate('unpublished')}
                disabled={isPublishing || isSaving}
                className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40"
              >
                {isPublishing ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Unpublish Event
              </button>
            )
          )}

          <button 
            onClick={() => handleSaveOrCreate()}
            disabled={isSaving || isPublishing || !details.title.trim()}
            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 shadow-lg transition-all bg-${accentColor}-600 hover:bg-${accentColor}-700 shadow-${accentColor}-500/20 disabled:opacity-30`}
          >
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : saveStatus === 'success' ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {isCreateMode 
              ? (saveStatus === 'success' ? 'Created Successfully' : 'Deploy Event') 
              : (saveStatus === 'success' ? 'Changes Cached' : 'Save Changes')
            }
          </button>

          <button
            type="button"
            onClick={onClose}
            className={`p-3 rounded-xl border transition-all hover:scale-105 flex items-center justify-center ${
              isDark 
                ? 'bg-white/5 border-white/10 text-slate-400 hover:text-red-400 hover:bg-red-50/10 hover:border-red-500/20' 
                : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-red-600 hover:bg-red-50 hover:border-red-200'
            }`}
            title="Discard Configuration and Return"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* CORE WORKSPACE CONTENT PANEL */}
      {/* 🚀 FIXED: Set md:h-[calc(100vh-14rem)] and flex-1 so it matches dashboard bounds dynamically */}
      <div className="flex flex-col md:flex-row md:h-[calc(100vh-14rem)] overflow-hidden bg-inherit relative flex-1 min-h-0 w-full">
        
        {/* NAV SELECTION TAB SIDEBAR */}
        <div className={`w-full md:w-64 border-b md:border-b-0 md:border-r ${isDark ? 'border-white/5' : 'border-slate-100'} p-5 space-y-2 bg-black/10 shrink-0 flex flex-col justify-between h-full overflow-y-auto`}>
          <div className="space-y-2">
            {[
              { id: 'basics', label: 'Basic Info', icon: Type },
              { id: 'location', label: 'Venue & Time', icon: MapPin },
              { id: 'controls', label: 'Module Visibility', icon: Eye },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  activeTab === tab.id 
                    ? `bg-${accentColor}-500/10 text-${accentColor}-500` 
                    : 'text-slate-500 hover:bg-white/5'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </button>
            ))}
          </div>

          {isCreateMode && (
            <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-center space-y-1 hidden md:block animate-pulse shrink-0">
              <Sparkles size={14} className="mx-auto text-amber-500" />
              <p className="text-[8px] font-black text-amber-500 uppercase tracking-wider">Unsaved Buffer Active</p>
            </div>
          )}
        </div>

        {/* COMPONENT CONTENT FRAME RENDERS */}
        {/* 🚀 FIXED: Lowered bottom padding configuration from pb-36 to pb-10 so scrolling indicators behave nicely inside borders */}
        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-10 md:py-8 custom-scrollbar scroll-smooth relative h-full pb-10">
          
          {/* TAB DATA: BASICS CONSOLE */}
          {activeTab === 'basics' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              
              <div className={`p-6 rounded-3xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div className="flex justify-between items-end mb-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-500">
                      <TrendingUp size={14} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Growth Logic</span>
                    </div>
                    <h4 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>Sparkle Threshold</h4>
                  </div>
                  <span className={`text-2xl font-black text-${accentColor}-500`}>{details.hypeThreshold}+</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="500" 
                  step="10"
                  value={details.hypeThreshold}
                  onChange={handleSliderChange}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-${accentColor}-500 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}
                />
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5 md:col-span-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Public Event Title</label>
                    <input 
                      type="text" 
                      name="title"
                      required
                      placeholder="EX: Mithila Sanwaad Karyakram"
                      value={details.title}
                      onChange={handleChange}
                      className={`w-full bg-white/5 border ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-${accentColor}-500 transition-all`}
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Experience Type</label>
                    <select
                      name="type"
                      value={details.type}
                      onChange={handleChange}
                      className={`w-full bg-white/5 border ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-${accentColor}-500 transition-all cursor-pointer ${isDark ? '[&_option]:bg-[#020617] text-white' : '[&_option]:bg-white text-slate-900'}`}
                    >
                      <option value="event">Sanwaad / Event</option>
                      <option value="celebration">Celebration</option>
                      <option value="summit">Summit</option>
                      <option value="conference">Conference</option>
                      <option value="workshop">Workshop</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Entry Strategy Protocol</label>
                    <select
                      name="protocol"
                      value={details.protocol}
                      onChange={handleChange}
                      className={`w-full bg-white/5 border ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-2xl px-5 py-3.5 text-sm font-bold outline-none focus:border-${accentColor}-500 transition-all cursor-pointer ${isDark ? '[&_option]:bg-[#020617] text-white' : '[&_option]:bg-white text-slate-900'}`}
                    >
                      <option value="open-registration">Open Registration</option>
                      <option value="ticketed">Ticketed / Verification Needed</option>
                      <option value="invite-only">Invite Only / Restricted Access</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tagline</label>
                  <input 
                    type="text" 
                    name="tagline"
                    placeholder="Enter short identifying experience thematic message"
                    value={details.tagline}
                    onChange={handleChange}
                    className={`w-full bg-white/5 border ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-2xl px-6 py-3.5 text-sm outline-none focus:border-${accentColor}-500 transition-all`}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    rows={4} 
                    name="description"
                    placeholder="Elaborate details structural parameters regarding operational objectives..."
                    value={details.description}
                    onChange={handleChange}
                    className={`w-full bg-white/5 border ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-2xl px-6 py-4 text-sm outline-none focus:border-${accentColor}-500 transition-all resize-none`}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB DATA: GEOGRAPHIC VENUE BOUNDARY DEFINITIONS */}
          {activeTab === 'location' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Venue Name</label>
                    <input name="venueName" type="text" placeholder="EX: Town Hall Complex" value={details.venueName} onChange={handleChange} className={`w-full bg-white/5 border ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-2xl px-6 py-3.5 text-sm outline-none focus:border-${accentColor}-500 transition-all`} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Event Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-3.5 text-slate-500" size={18} />
                      <input name="primaryDate" type="date" value={details.primaryDate} onChange={handleChange} className={`w-full bg-white/5 border ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-2xl pl-12 pr-6 py-3.5 text-sm outline-none focus:border-${accentColor}-500 transition-all`} />
                    </div>
                  </div>
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Address / Maps Location Resource</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-3.5 text-slate-500" size={18} />
                    <input name="address" type="text" placeholder="Specify geographic coordinate details strings" value={details.address} onChange={handleChange} className={`w-full bg-white/5 border ${isDark ? 'border-white/10' : 'border-slate-200'} rounded-2xl pl-12 pr-6 py-3.5 text-sm outline-none focus:border-${accentColor}-500 transition-all`} />
                  </div>
               </div>
            </div>
          )}

          {/* TAB DATA: MODULE VISIBILITY MATRIX */}
          {activeTab === 'controls' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-1">Module Management Matrix</p>
               {Object.entries(details.visibility).map(([key, value]) => (
                 <div key={key} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} hover:border-${accentColor}-50/30 transition-colors`}>
                    <div className="flex items-center gap-3">
                       {value ? <Eye className={`text-${accentColor}-500`} size={18} /> : <EyeOff className="text-slate-500" size={18} />}
                       <span className="text-xs font-black uppercase tracking-widest">{key} Component rendering</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setDetails({
                          ...details, 
                          visibility: {...details.visibility, [key]: !value}
                        });
                        if (saveStatus === 'success') setSaveStatus('idle');
                      }}
                      className={`w-12 h-6 rounded-full transition-all relative ${value ? `bg-${accentColor}-600` : 'bg-slate-700'}`}
                    >
                       <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${value ? 'left-7' : 'left-1'}`} />
                    </button>
                 </div>
               ))}
            </div>
          )}
        </div>
      </div>
      
      {/* METADATA PERSISTENCE FOOTER */}
      <div className={`p-4 bg-white/5 border-t ${isDark ? 'border-t-white/5' : 'border-t-slate-100'} flex items-center justify-center gap-2 relative z-10 shrink-0`}>
          <Sparkles size={12} className="text-amber-500" />
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
            {isCreateMode ? 'Engine Storage Target Allocation: ' : 'Persistence Link: '} 
            <span className={`text-${accentColor}-400 italic`}>
              {isCreateMode ? 'IndexedDB.AayojanDB.events' : ("/"+event?.slug || 'draft')}
            </span>
          </p>
      </div>
    </div>
  );
}