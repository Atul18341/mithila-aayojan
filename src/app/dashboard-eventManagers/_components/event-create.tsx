'use client';

import React, { useState } from 'react';
import { Heart, Briefcase, Sparkles, Globe, ShieldCheck, Fingerprint, Loader2, CheckCircle2 } from 'lucide-react';
import { db } from '../../../lib/db';

const EVENT_TYPES = [
  { 
    id: 'summit', 
    label: 'Summit', 
    icon: Briefcase, 
    protocol: 'invite-only', 
    isPublic: false,
    threshold: 0,
    color: 'blue' 
  },
  { 
    id: 'conference', 
    label: 'Conference', 
    icon: Briefcase, 
    protocol: 'ticketed', 
    isPublic: false,
    threshold: 100, // Show count only after 100
    color: 'blue' 
  },
  { 
    id: 'event', 
    label: 'Sanwaad / Event', 
    icon: Globe, 
    protocol: 'open-registration', 
    isPublic: true,
    threshold: 50,
    color: 'amber' 
  },
  { 
    id: 'celebration', 
    label: 'Celebration', 
    icon: Heart, 
    protocol: 'invite-only', 
    isPublic: true,
    threshold: 0,
    color: 'emerald' 
  },
  { 
    id: 'workshop', 
    label: 'Workshop', 
    icon: ShieldCheck, 
    protocol: 'open-registration', 
    isPublic: false,
    threshold: 20,
    color: 'purple' 
  }
];

export default function EventCreate() {
  const [eventName, setEventName] = useState('');
  const [selectedType, setSelectedType] = useState('celebration');
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const slug = eventName
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');

  const activeConfig = EVENT_TYPES.find(t => t.id === selectedType) || EVENT_TYPES[0];
  const activeColor = activeConfig.color;

  const handleSaveIdentity = async () => {
    if (!eventName) return;
    
    setIsSaving(true);
    try {
      // 1. Save to local IndexedDB via Dexie using the verified Interface
      await db.events.add({
        name: eventName,
        date: 'Pending Set',
        location: 'TBD',
        type: selectedType as any,
        protocol: activeConfig.protocol as any,
        slug: slug || 'untitled-event',
        status: 'draft',
        isCountPublic: activeConfig.isPublic,
        hypeThreshold: activeConfig.threshold,
        createdAt: Date.now()
      });

      setIsSaved(true);
      setTimeout(() => {
        // Navigation logic for Lyss Flow could go here
        console.log("Event Identity and Protocol Secured Offline.");
      }, 1500);

    } catch (error) {
      console.error("Dexie Transaction Failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto bg-[#020617] rounded-[3rem] border border-white/10 overflow-hidden shadow-2xl relative">
      
      {/* SUCCESS OVERLAY */}
      {isSaved && (
        <div className="absolute inset-0 bg-[#020617]/90 backdrop-blur-xl z-50 flex flex-col items-center justify-center animate-in fade-in duration-500">
           <CheckCircle2 size={64} className={`text-${activeColor}-500 mb-4 animate-bounce`} />
           <h2 className="text-2xl font-black text-white italic">Identity Secured.</h2>
           <p className="text-slate-500 text-xs uppercase tracking-widest mt-2">Protocol: {activeConfig.protocol}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2">
        
        {/* LEFT SIDE: INPUT & INTENT */}
        <div className="p-8 md:p-12 space-y-10 border-r border-white/5">
          <div className="space-y-2">
            <div className={`flex items-center gap-2 text-${activeColor}-500 mb-2 transition-colors`}>
              <Sparkles size={16} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">New Project</span>
            </div>
            <h2 className="text-3xl font-black text-white leading-tight">Define Your <br/>Event Identity.</h2>
          </div>

          <div className="space-y-8">
            <div className="group space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Event Name</label>
              <input
                type="text"
                placeholder="e.g. Mithila IT Summit"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                className={`w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-${activeColor}-500 outline-none transition-all placeholder:text-slate-700`}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Event Type</label>
              <div className="grid grid-cols-2 gap-3">
                {EVENT_TYPES.map((item) => {
                  const Icon = item.icon;
                  const isActive = selectedType === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedType(item.id)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        isActive 
                        ? `border-${item.color}-500 bg-${item.color}-500/10` 
                        : 'border-white/5 bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <Icon size={18} className={isActive ? `text-${item.color}-500` : 'text-slate-500'} />
                      <h4 className={`mt-2 font-black uppercase tracking-widest text-[10px] ${isActive ? 'text-white' : 'text-slate-500'}`}>
                        {item.label}
                      </h4>
                    </button>
                  );
                })}
              </div>
            </div>

            <button 
              onClick={handleSaveIdentity}
              disabled={!eventName || isSaving}
              className={`w-full bg-${activeColor}-600 hover:scale-[1.02] text-white font-black py-5 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 uppercase text-xs tracking-widest disabled:opacity-50`}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : "Next Step: Design Template"}
            </button>
          </div>
        </div>

        {/* RIGHT SIDE: LIVE PREVIEW */}
        <div className="p-8 md:p-12 flex flex-col justify-center bg-white/5 relative">
          <div className={`absolute top-0 right-0 w-32 h-32 bg-${activeColor}-500/10 blur-[80px]`} />
          
          <div className="relative space-y-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Identity Sync</h3>
            
            <div className="bg-[#020617] rounded-3xl p-6 border border-white/10 shadow-2xl space-y-4">
              <div className="flex items-center gap-2 bg-white/5 rounded-full py-2 px-4 overflow-hidden border border-white/5">
                <Globe size={12} className="text-slate-500 shrink-0" />
                <span className="text-[10px] text-slate-400 truncate">
                  mithila.in/e/<span className={`text-${activeColor}-400 font-bold`}>{slug || 'your-slug'}</span>
                </span>
              </div>
              
              <div className={`aspect-video rounded-2xl bg-gradient-to-br from-slate-900 to-black border border-white/5 flex flex-col items-center justify-center p-6 text-center`}>
                {eventName ? (
                  <h3 className={`text-xl font-black ${selectedType === 'celebration' ? 'text-emerald-400 italic font-serif' : 'text-blue-400 font-sans uppercase'}`}>
                    {eventName}
                  </h3>
                ) : (
                  <div className="w-20 h-2 bg-white/5 rounded-full animate-pulse" />
                )}
                <p className="text-[8px] text-slate-600 mt-2 font-bold uppercase tracking-[0.2em]">
                  Protocol: {activeConfig.protocol.replace('-', ' ')}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between px-4">
               <div className="flex items-center gap-1.5 opacity-40">
                  <ShieldCheck size={12} className="text-slate-400" />
                  <span className="text-[8px] font-black uppercase text-slate-400">Offline DB</span>
               </div>
               <div className="flex items-center gap-1.5 opacity-40">
                  <Fingerprint size={12} className="text-slate-400" />
                  <span className="text-[8px] font-black uppercase text-slate-400">PWA Ready</span>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}