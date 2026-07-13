// src/app/dashboard/_components/event-details.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Save, Briefcase, Layers, BookOpen, 
  ShieldCheck, Globe, Award, Heart, GlassWater, 
  Calendar, Info, Shield, Layout, MapPin, Plus, 
  Eye, EyeOff, Settings2, Sparkles, CheckCircle2, 
  Loader2, TrendingUp, Image as ImageIcon, UploadCloud, Clock,
  Utensils, IndianRupee
} from 'lucide-react';
import { type AttendeeCategory, db } from '../../../lib/db';
// Unified Attendee Category Definitions


const ATTENDEE_CATEGORIES: { id: AttendeeCategory; label: string }[] = [
  { id: 'patron', label: 'Chief Patrons & Core Members' },
  { id: 'dignitary', label: 'Dignitaries & VIPs' },
  { id: 'speaker', label: 'Keynote Speakers & Panelists' },
  { id: 'artisan', label: 'Cultural Artists & Artisans' },
  { id: 'delegate', label: 'Registered Delegates' },
  { id: 'trainee', label: 'Trainees & Scholars' },
  { id: 'exhibitor', label: 'Exhibitors & Vendors' },
  { id: 'general-public', label: 'General Visitors & Public' },
  { id: 'ops-team', label: 'Operations & Logistics Team' }
];

// Explicit interfaces matching structural local IndexedDB store indexes
export interface EventData {
  id?: number;
  name: string;
  type: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  protocol: string;
  tagline?: string;
  description?: string;
  venueName?: string;
  location?: string;
  status?: 'draft' | 'published' | 'unpublished';
  slug?: string;
  hypeThreshold?: number;
  visibility?: {
    map: boolean;
    rsvp: boolean;
    schedule: boolean;
    gallery: boolean;
  };
  foodConfig?: {
    enabled: boolean;
    strategy: 'complimentary' | 'coupon-based' | 'paid-buffet' | 'self-arranged';
    vendorDetails: string;
    availableForAll: 'yes' | 'no';
    allowedCategories: AttendeeCategory[];
  };
  pricingConfig?: {
    isRequired: boolean;
    baseFee: number;
    gstApplicable: boolean;
    applicableForAll: 'yes' | 'no';
    categoryFees: Record<AttendeeCategory, number>;
  };
  coverBlob?: Blob | null;
  posterBlob?: Blob | null;
  createdAt: number;
}

interface EventDetailEditorProps {
  event: EventData | null;
  isDark: boolean;
  onClose: () => void;
  onCreationSuccess: (newEventId: number) => Promise<void>;
}

interface CategoryConfig {
  id: string;
  label: string;
  group: string;
  icon: any;
  defaultProtocol: 'ticketed' | 'open-registration' | 'invite-only';
}

const COMPREHENSIVE_CATEGORIES: CategoryConfig[] = [
  { id: 'conference', label: 'Conference / Summit', group: 'Corporate & Business', icon: Briefcase, defaultProtocol: 'ticketed' },
  { id: 'trade-show', label: 'Trade Show / Expo', group: 'Corporate & Business', icon: Layers, defaultProtocol: 'open-registration' },
  { id: 'workshop', label: 'Workshop / Seminar', group: 'Educational & Training', icon: BookOpen, defaultProtocol: 'open-registration' },
  { id: 'training', label: 'Training Program', group: 'Educational & Training', icon: ShieldCheck, defaultProtocol: 'invite-only' },
  { id: 'event', label: 'Sanwaad / Festival', group: 'Cultural & Community', icon: Globe, defaultProtocol: 'open-registration' },
  { id: 'fundraiser', label: 'Charity / Gala', group: 'Cultural & Community', icon: Award, defaultProtocol: 'invite-only' },
  { id: 'celebration', label: 'Celebration / Wedding', group: 'Social & Private', icon: Heart, defaultProtocol: 'invite-only' },
  { id: 'private-party', label: 'Private Social / Gathering', group: 'Social & Private', icon: GlassWater, defaultProtocol: 'invite-only' }
];

const compressToWebP = (file: File, maxDimension = 1200, quality = 0.75): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas context generation failed'));
        
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('WebP compression failed')),
          'image/webp',
          quality
        );
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export default function EventDetailEditor({
  event,
  isDark,
  onClose,
  onCreationSuccess
}: EventDetailEditorProps) {
  const [activeModule, setActiveModule] = useState<'basics' | 'media' | 'protocols'>('basics');

  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success'>('idle');
  const [currentStatus, setCurrentStatus] = useState<'draft' | 'published' | 'unpublished'>('draft');
  const [isCreateMode, setIsCreateMode] = useState(!event);

  const [coverBlob, setCoverBlob] = useState<Blob | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [posterPreview, setPosterPreview] = useState<string>('');

  const coverInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);

  // Default empty dictionary template for category mappings
  const initialCategoryFees = ATTENDEE_CATEGORIES.reduce((acc, cat) => {
    acc[cat.id] = 0;
    return acc;
  }, {} as Record<AttendeeCategory, number>);

  const [details, setDetails] = useState({
    title: '',
    tagline: '',
    description: '',
    venueName: '',
    address: '',
    primaryDate: '',
    startTime: '',
    endTime: '',
    hypeThreshold: 0,
    type: 'conference', 
    protocol: 'ticketed' as 'ticketed' | 'open-registration' | 'invite-only',
    visibility: { map: true, rsvp: true, schedule: true, gallery: false },
    foodConfig: {
      enabled: false,
      strategy: 'complimentary' as 'complimentary' | 'coupon-based' | 'paid-buffet' | 'self-arranged',
      vendorDetails: '',
      availableForAll: 'yes' as 'yes' | 'no',
      allowedCategories: [] as AttendeeCategory[]
    },
    pricingConfig: {
      isRequired: false,
      baseFee: 0,
      gstApplicable: false,
      applicableForAll: 'yes' as 'yes' | 'no',
      categoryFees: initialCategoryFees
    }
  });

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      if (posterPreview) URL.revokeObjectURL(posterPreview);
    };
  }, [coverPreview, posterPreview]);

  useEffect(() => {
    if (event) {
      setDetails({
        title: event.name || '',
        tagline: event.tagline || '',
        description: event.description || '',
        venueName: event.venueName || '',
        address: event.location || '',
        primaryDate: event.date || '',
        startTime: event.startTime || '',
        endTime: event.endTime || '',
        hypeThreshold: event.hypeThreshold || 0,
        type: event.type || 'conference',
        protocol: (event.protocol || 'ticketed') as 'ticketed' | 'open-registration' | 'invite-only', 
        visibility: event.visibility || { map: true, rsvp: true, schedule: true, gallery: false },
        foodConfig: {
          enabled: event.foodConfig?.enabled || false,
          strategy: event.foodConfig?.strategy || 'complimentary',
          vendorDetails: event.foodConfig?.vendorDetails || '',
          availableForAll: event.foodConfig?.availableForAll || 'yes',
          allowedCategories: event.foodConfig?.allowedCategories || []
        },
        pricingConfig: {
          isRequired: event.pricingConfig?.isRequired || false,
          baseFee: event.pricingConfig?.baseFee || 0,
          gstApplicable: event.pricingConfig?.gstApplicable || false,
          applicableForAll: event.pricingConfig?.applicableForAll || 'yes',
          categoryFees: { ...initialCategoryFees, ...(event.pricingConfig?.categoryFees || {}) }
        }
      });
      setCurrentStatus(event.status || 'draft');
      setIsCreateMode(false);
      setSaveStatus('idle');

      if (event.coverBlob) {
        setCoverBlob(event.coverBlob);
        setCoverPreview(URL.createObjectURL(event.coverBlob));
      } else {
        setCoverBlob(null);
        setCoverPreview('');
      }

      if (event.posterBlob) {
        setPosterBlob(event.posterBlob);
        setPosterPreview(URL.createObjectURL(event.posterBlob));
      } else {
        setPosterBlob(null);
        setPosterPreview('');
      }
    } else {
      handleResetToCreation();
    }
  }, [event]);

  const handleResetToCreation = () => {
    setDetails({
      title: '', tagline: '', description: '', venueName: '', address: '', primaryDate: '', startTime: '', endTime: '', hypeThreshold: 0, type: 'conference', protocol: 'ticketed',
      visibility: { map: true, rsvp: true, schedule: true, gallery: false },
      foodConfig: { enabled: false, strategy: 'complimentary', vendorDetails: '', availableForAll: 'yes', allowedCategories: [] },
      pricingConfig: { isRequired: false, baseFee: 0, gstApplicable: false, applicableForAll: 'yes', categoryFees: initialCategoryFees }
    });
    setCurrentStatus('draft');
    setIsCreateMode(true);
    setActiveModule('basics');
    setSaveStatus('idle');
    setCoverBlob(null);
    setPosterBlob(null);
    setCoverPreview('');
    setPosterPreview('');
  };

  const handleTypeChange = (selectedType: string) => {
    setDetails(prev => {
      const targetConfig = COMPREHENSIVE_CATEGORIES.find(c => c.id === selectedType);
      return {
        ...prev,
        type: selectedType,
        protocol: targetConfig ? targetConfig.defaultProtocol : prev.protocol
      };
    });
  };

  const handleFoodCategoryToggle = (categoryId: AttendeeCategory) => {
    setDetails(prev => {
      const currentSelected = prev.foodConfig.allowedCategories;
      const updatedCategories = currentSelected.includes(categoryId)
        ? currentSelected.filter(id => id !== categoryId)
        : [...currentSelected, categoryId];
      return { ...prev, foodConfig: { ...prev.foodConfig, allowedCategories: updatedCategories } };
    });
  };

  const handlePricingCategoryFeeChange = (categoryId: AttendeeCategory, val: number) => {
    setDetails(prev => ({
      ...prev,
      pricingConfig: {
        ...prev.pricingConfig,
        categoryFees: {
          ...prev.pricingConfig.categoryFees,
          [categoryId]: val
        }
      }
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: 'cover' | 'poster') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const webpBlob = await compressToWebP(file, target === 'cover' ? 1200 : 800, 0.75);
      const viewUrl = URL.createObjectURL(webpBlob);

      if (target === 'cover') {
        if (coverPreview) URL.revokeObjectURL(coverPreview);
        setCoverBlob(webpBlob);
        setCoverPreview(viewUrl);
      } else {
        if (posterPreview) URL.revokeObjectURL(posterPreview);
        setPosterBlob(webpBlob);
        setPosterPreview(viewUrl);
      }
      if (saveStatus === 'success') setSaveStatus('idle');
    } catch (err) {
      console.error('Asset optimization pipeline exception:', err);
    }
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

  const handleSubmit = async (forcedStatus?: 'draft' | 'published' | 'unpublished') => {
    if (!details.title.trim() || !details.primaryDate) return;
    forcedStatus === 'published' ? setIsPublishing(true) : setIsSaving(true);

    const generatedSlug = details.title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

    const compiledData = {
      name: details.title,
      tagline: details.tagline,
      description: details.description,
      venueName: details.venueName,
      location: details.address,
      date: details.primaryDate,
      startTime: details.startTime,
      endTime: details.endTime,
      type: details.type,
      protocol: details.protocol, 
      status: forcedStatus || currentStatus, 
      slug: generatedSlug || 'live-slug',
      hypeThreshold: details.hypeThreshold,
      visibility: details.visibility,
      foodConfig: details.foodConfig,
      pricingConfig: details.pricingConfig,
      coverBlob: coverBlob,    
      posterBlob: posterBlob,  
      createdAt: event?.createdAt || Date.now(),
      syncStatus: 'pending' as const 
    };

    try {
      const { db } = await import('../../../lib/db');
      if (isCreateMode) {
        const newId = await db.events.add(compiledData as any);
        setSaveStatus('success');
        setIsCreateMode(false);
        if (onCreationSuccess) await onCreationSuccess(newId as number);
      } else {
        if (!event?.id) return;
        await db.events.update(event.id, compiledData);
        setSaveStatus('success');
        if (forcedStatus) setCurrentStatus(forcedStatus);
      }
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Database transaction exception:", err);
    } finally {
      setIsSaving(false);
      setIsPublishing(false);
    }
  };

  const styles = {
    panel: isDark ? 'bg-[#0a0f1d] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-900 shadow-xl',
    input: isDark ? 'bg-white/5 border-white/10 text-white focus:border-blue-500' : 'bg-slate-100 border-slate-200 text-slate-900 focus:border-blue-600',
    label: 'text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5',
    sectionHeader: 'text-xs font-black uppercase tracking-widest text-slate-500 border-b border-inherit pb-2 mb-3',
    tabButton: (isActive: boolean) => `flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${
      isActive ? isDark ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-500'
    }`
  };

  const groupedCategories = COMPREHENSIVE_CATEGORIES.reduce((acc, current) => {
    if (!acc[current.group]) acc[current.group] = [];
    acc[current.group].push(current);
    return acc;
  }, {} as Record<string, typeof COMPREHENSIVE_CATEGORIES>);

  const accentColor = details.type === 'celebration' ? 'emerald' : 'blue';

  return (
    <div className={`w-full h-full flex flex-col overflow-hidden ${styles.panel}`}>
      {/* HEADER SECTION CONTROLS */}
      <div className="p-6 border-b border-inherit flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-inherit z-10 shrink-0">
        <div>
          <div className={`flex items-center gap-2 text-${accentColor}-500 mb-1`}>
            <Settings2 size={16} />
            <span className="text-[10px] font-black uppercase tracking-[0.3em]">{isCreateMode ? 'Instantiation Engine' : 'Configure Experience'}</span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black italic tracking-tight">{isCreateMode ? (details.title || "Initialize New Event") : details.title}</h2>
            {!isCreateMode && (
              <span className={`px-2.5 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border ${currentStatus === 'published' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'}`}>{currentStatus}</span>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <button type="button" onClick={() => handleSubmit()} disabled={isSaving || isPublishing || !details.title.trim() || !details.primaryDate} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2 shadow-lg transition-all bg-${accentColor}-600 hover:bg-${accentColor}-700 shadow-${accentColor}-50/20 disabled:opacity-30`}>
            {isSaving ? <Loader2 size={14} className="animate-spin" /> : saveStatus === 'success' ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {isCreateMode ? (saveStatus === 'success' ? 'Created Successfully' : 'Deploy Event') : (saveStatus === 'success' ? 'Changes Cached' : 'Save Changes')}
          </button>
          <button type="button" onClick={onClose} className="p-2.5 rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-500 border border-transparent hover:border-red-500/20"><X size={18} /></button>
        </div>
      </div>

      {/* NAVIGATOR LAYER */}
      <div className="px-6 py-2 border-b border-inherit flex items-center gap-2 shrink-0 bg-slate-50/50 dark:bg-white/[0.01]">
        <button type="button" onClick={() => setActiveModule('basics')} className={styles.tabButton(activeModule === 'basics')}><Layout size={14} /><span>Core Profile</span></button>
        <button type="button" onClick={() => setActiveModule('media')} className={styles.tabButton(activeModule === 'media')}><ImageIcon size={14} /><span>Assets & Media</span></button>
        <button type="button" onClick={() => setActiveModule('protocols')} className={styles.tabButton(activeModule === 'protocols')}><Shield size={14} /><span>Controls & Logistics</span></button>
      </div>

      {/* DATA ENTRY LAYER */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        
        {/* MODULE 1: CORE PROFILE */}
        {activeModule === 'basics' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className={`p-6 rounded-3xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              <div className="flex justify-between items-end mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-amber-500"><TrendingUp size={14} /><span className="text-[10px] font-black uppercase tracking-widest">Growth Logic</span></div>
                  <h4 className="text-sm font-bold">Sparkle Threshold</h4>
                </div>
                <span className={`text-2xl font-black text-${accentColor}-500`}>{details.hypeThreshold}+</span>
              </div>
              <input type="range" min="0" max="500" step="10" value={details.hypeThreshold} onChange={handleSliderChange} className={`w-full h-2 rounded-lg appearance-none cursor-pointer accent-${accentColor}-500 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
            </div>

            <div>
              <div className={styles.sectionHeader}>Identity Details</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input type="text" name="title" required value={details.title} onChange={handleChange} placeholder="Event Title" className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`} />
                <input type="text" name="tagline" value={details.tagline} onChange={handleChange} placeholder="Thematic Tagline" className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`} />
              </div>
            </div>

            <div>
              <div className={styles.sectionHeader}>Venue & Timeline</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="venueName" type="text" placeholder="Venue Designation" value={details.venueName} onChange={handleChange} className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`} />
                <div className="relative">
                  <Calendar className="absolute left-4 top-3.5 text-slate-500" size={18} />
                  <input name="primaryDate" required type="date" value={details.primaryDate} onChange={handleChange} className={`w-full pl-12 pr-4 py-3.5 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <input name="startTime" type="time" value={details.startTime} onChange={handleChange} className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`} />
                <input name="endTime" type="time" value={details.endTime} onChange={handleChange} className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`} />
              </div>
              <input name="address" type="text" placeholder="Geographic Address String" value={details.address} onChange={handleChange} className={`w-full p-3.5 text-xs font-bold rounded-xl border focus:outline-none mt-4 ${styles.input}`} />
            </div>

            <div>
              <div className={styles.sectionHeader}>Core Purpose Architecture</div>
              <select name="type" value={details.type} onChange={(e) => handleTypeChange(e.target.value)} className={`w-full p-4 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`}>
                {Object.entries(groupedCategories).map(([groupName, items]) => (
                  <optgroup key={groupName} label={groupName} className={isDark ? 'bg-[#020617] text-slate-400' : 'bg-slate-50 text-slate-500'}>
                    {items.map(cat => (<option key={cat.id} value={cat.id} className={isDark ? 'bg-[#0a0f1d] text-white font-bold' : 'bg-white text-slate-900 font-bold'}>{cat.label}</option>))}
                  </optgroup>
                ))}
              </select>
            </div>
            <textarea rows={4} name="description" value={details.description} onChange={handleChange} placeholder="Logistics Logs..." className={`w-full p-4 text-xs font-medium rounded-xl border focus:outline-none resize-none ${styles.input}`} />
          </div>
        )}

        {/* MODULE 2: MEDIA LAYOUT */}
        {activeModule === 'media' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-2">
              <label className={styles.label}>Hero Layout Banner (16:9)</label>
              <input type="file" ref={coverInputRef} accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'cover')} />
              <div onClick={() => coverInputRef.current?.click()} className={`w-full aspect-[16/6] rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                {coverPreview ? <img src={coverPreview} alt="Cover" className="w-full h-full object-cover" /> : <p className="text-xs font-bold text-slate-400">Select responsive cover layouts</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className={styles.label}>Distribution Poster (4:5 / Square)</label>
              <input type="file" ref={posterInputRef} accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, 'poster')} />
              <div onClick={() => posterInputRef.current?.click()} className={`w-44 aspect-[4/5] rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                {posterPreview ? <img src={posterPreview} alt="Poster" className="w-full h-full object-cover" /> : <p className="text-[10px] font-bold text-slate-400 text-center px-2">Select event media graphic asset</p>}
              </div>
            </div>
          </div>
        )}

        {/* MODULE 3: CONTROLS, LOGISTICS & PAYMENT PIPELINES */}
        {activeModule === 'protocols' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div>
              <div className={styles.sectionHeader}>Authorization Strategy</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: 'open-registration', label: 'Open Registration', desc: 'Public entry via token scans.' },
                  { id: 'ticketed', label: 'Ticketed System', desc: 'Requires checkout validation.' },
                  { id: 'invite-only', label: 'Invite-Only', desc: 'Restricted map bounds (VIPs).' }
                ].map((p) => {
                  const isSelected = details.protocol === p.id;
                  return (
                    <button key={p.id} type="button" onClick={() => setDetails(prev => ({ ...prev, protocol: p.id as any }))} className={`p-4 text-left border rounded-2xl transition-all ${isSelected ? `bg-${accentColor}-600/10 border-${accentColor}-500 text-${accentColor}-400 shadow-md` : `${styles.input} opacity-70`}`}>
                      <span className="text-xs font-black block">{p.label}</span>
                      <span className="text-[10px] text-slate-500 font-medium mt-1 block leading-tight">{p.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 🍽️ FOOD MODULE MATRIX CONFIGURATION */}
            <div>
              <div className={styles.sectionHeader}>Food Module Configuration</div>
              <div className={`p-5 rounded-3xl border space-y-4 ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Utensils size={18} className={details.foodConfig.enabled ? `text-${accentColor}-500` : 'text-slate-400'} />
                    <div>
                      <span className="text-xs font-bold block">Food provided during event</span>
                      <span className="text-[10px] text-slate-500">Enable food tracking codes on access tickets</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setDetails(prev => ({ ...prev, foodConfig: { ...prev.foodConfig, enabled: !prev.foodConfig.enabled } }))} className={`w-12 h-6 rounded-full transition-all relative ${details.foodConfig.enabled ? `bg-${accentColor}-600` : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${details.foodConfig.enabled ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {details.foodConfig.enabled && (
                  <div className="space-y-4 pt-2 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={styles.label}>Allocation Strategy</label>
                        <select name="foodStrategy" value={details.foodConfig.strategy} onChange={(e) => setDetails(prev => ({ ...prev, foodConfig: { ...prev.foodConfig, strategy: e.target.value as any } }))} className={`w-full p-3 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`}>
                          <option value="complimentary">Complimentary Setup</option>
                          <option value="coupon-based">Coupon Smart Token</option>
                          <option value="paid-buffet">Paid Buffet Ledger</option>
                          <option value="self-arranged">Self-Arranged Stall Desk</option>
                        </select>
                      </div>
                      
                      <div className="space-y-1.5">
                        <label className={styles.label}>Is food/snacks available for all?</label>
                        <select 
                          name="availableForAll" 
                          value={details.foodConfig.availableForAll} 
                          onChange={(e) => setDetails(prev => ({ ...prev, foodConfig: { ...prev.foodConfig, availableForAll: e.target.value as 'yes' | 'no' } }))} 
                          className={`w-full p-3 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`}
                        >
                          <option value="yes">Yes (All Attendees)</option>
                          <option value="no">No (Restricted Categories)</option>
                        </select>
                      </div>
                    </div>

                    {details.foodConfig.availableForAll === 'no' && (
                      <div className="space-y-2 border border-white/5 dark:border-slate-800 p-4 rounded-2xl bg-black/5 animate-in slide-in-from-top-2 duration-200">
                        <label className={styles.label}>Select Eligible Attendee Categories</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          {details.foodConfig.allowedCategories.length === 0 ? (
                            <span className="text-[11px] text-slate-500 italic">No category selected. Food will be restricted completely.</span>
                          ) : (
                            details.foodConfig.allowedCategories.map(catId => {
                              const match = ATTENDEE_CATEGORIES.find(c => c.id === catId);
                              return (
                                <span key={catId} className="inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                                  {match?.label || catId}
                                  <button type="button" onClick={() => handleFoodCategoryToggle(catId)} className="hover:text-red-400 transition-colors">
                                    <X size={10} className="stroke-[3]" />
                                  </button>
                                </span>
                              );
                            })
                          )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                          {ATTENDEE_CATEGORIES.map(cat => {
                            const isSelected = details.foodConfig.allowedCategories.includes(cat.id);
                            return (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => handleFoodCategoryToggle(cat.id)}
                                className={`text-left px-3 py-2 text-[11px] font-bold rounded-xl border transition-all flex items-center justify-between ${
                                  isSelected ? 'bg-blue-600/10 border-blue-500 text-blue-400' : `${styles.input} opacity-60 hover:opacity-100`
                                }`}
                              >
                                <span>{cat.label}</span>
                                {isSelected && <CheckCircle2 size={12} className="text-blue-400 shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className={styles.label}>Vendor Info & Notes</label>
                      <input type="text" placeholder="Specify catering partner records" value={details.foodConfig.vendorDetails} onChange={(e) => setDetails(prev => ({ ...prev, foodConfig: { ...prev.foodConfig, vendorDetails: e.target.value } }))} className={`w-full p-3 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`} />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 💰 REGISTRATION FEE MANAGEMENT */}
            <div>
              <div className={styles.sectionHeader}>Registration Fee Management</div>
              <div className={`p-5 rounded-3xl border space-y-4 ${isDark ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <IndianRupee size={18} className={details.pricingConfig.isRequired ? 'text-emerald-500' : 'text-slate-400'} />
                    <div>
                      <span className="text-xs font-bold block">Registration Fee collected for the event</span>
                      <span className="text-[10px] text-slate-500">Require transaction validations for ticket instantiation</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setDetails(prev => ({ ...prev, pricingConfig: { ...prev.pricingConfig, isRequired: !prev.pricingConfig.isRequired } }))} className={`w-12 h-6 rounded-full transition-all relative ${details.pricingConfig.isRequired ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${details.pricingConfig.isRequired ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>

                {details.pricingConfig.isRequired && (
                  <div className="space-y-4 pt-2 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* DYNAMIC DROP-DOWN: Is registration fee applicable for all */}
                      <div className="space-y-1.5">
                        <label className={styles.label}>Is registration fee applicable for all?</label>
                        <select 
                          name="applicableForAll" 
                          value={details.pricingConfig.applicableForAll} 
                          onChange={(e) => setDetails(prev => ({ ...prev, pricingConfig: { ...prev.pricingConfig, applicableForAll: e.target.value as 'yes' | 'no' } }))} 
                          className={`w-full p-3 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`}
                        >
                          <option value="yes">Yes (Flat Fee Structure)</option>
                          <option value="no">No (Category-Specific Fee Structure)</option>
                        </select>
                      </div>

                      {details.pricingConfig.applicableForAll === 'yes' && (
                        <div className="space-y-1.5">
                          <label className={styles.label}>Base Registration Fee (₹)</label>
                          <input type="number" min="0" placeholder="0.00" value={details.pricingConfig.baseFee || ''} onChange={(e) => setDetails(prev => ({ ...prev, pricingConfig: { ...prev.pricingConfig, baseFee: parseFloat(e.target.value) || 0 } }))} className={`w-full p-3 text-xs font-bold rounded-xl border focus:outline-none ${styles.input}`} />
                        </div>
                      )}
                    </div>

                    {/* DYNAMIC CATEGORY PRICING ENTRY MATRIX PANEL */}
                    {details.pricingConfig.applicableForAll === 'no' && (
                      <div className="space-y-3 border border-white/5 dark:border-slate-800 p-4 rounded-2xl bg-black/5 animate-in slide-in-from-top-2 duration-200">
                        <div>
                          <label className={styles.label}>Configure Custom Fee Per Attendee Category</label>
                          <span className="text-[10px] text-slate-500 block mb-3">Leave a category at 0 if registration should remain complimentary for them.</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                          {ATTENDEE_CATEGORIES.map(cat => (
                            <div key={cat.id} className={`p-3 rounded-xl border flex flex-col justify-between gap-2 ${isDark ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'}`}>
                              <span className="text-[11px] font-bold leading-tight">{cat.label}</span>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">₹</span>
                                <input 
                                  type="number" 
                                  min="0" 
                                  placeholder="0"
                                  value={details.pricingConfig.categoryFees[cat.id] || ''}
                                  onChange={(e) => handlePricingCategoryFeeChange(cat.id, parseFloat(e.target.value) || 0)}
                                  className={`w-full pl-7 pr-3 py-2 text-xs font-bold rounded-lg border focus:outline-none ${styles.input}`}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between border-t border-dashed border-white/10 dark:border-slate-800 pt-3">
                      <div>
                        <span className="text-xs font-bold block">Statutory GST Engine</span>
                        <span className="text-[10px] text-slate-500">Append transaction taxes to configuration fees</span>
                      </div>
                      <button type="button" onClick={() => setDetails(prev => ({ ...prev, pricingConfig: { ...prev.pricingConfig, gstApplicable: !prev.pricingConfig.gstApplicable } }))} className={`w-12 h-6 rounded-full transition-all relative ${details.pricingConfig.gstApplicable ? 'bg-emerald-600' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${details.pricingConfig.gstApplicable ? 'left-7' : 'left-1'}`} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className={styles.sectionHeader}>Module Management Matrix</div>
              <div className="space-y-3">
                {Object.entries(details.visibility).map(([key, value]) => (
                  <div key={key} className={`flex items-center justify-between p-4 rounded-2xl border ${isDark ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                      {value ? <Eye className={`text-${accentColor}-500`} size={18} /> : <EyeOff className="text-slate-500" size={18} />}
                      <span className="text-xs font-black uppercase tracking-widest">{key} Component rendering</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        setDetails(prev => ({
                          ...prev, 
                          visibility: {...prev.visibility, [key]: !value}
                        }));
                        if (saveStatus === 'success') setSaveStatus('idle');
                      }}
                      className={`w-12 h-6 rounded-full transition-all relative ${value ? `bg-${accentColor}-600` : 'bg-slate-700'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${value ? 'left-7' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* METADATA PERSISTENCE FOOTER */}
      <div className={`p-4 bg-white/5 border-t ${isDark ? 'border-t-white/5' : 'border-t-slate-100'} flex items-center justify-center gap-2 relative z-10 shrink-0`}>
        <Sparkles size={12} className="text-amber-500" />
        <p className="text-[9px] font-black text-slate-500 tracking-widest">
          {isCreateMode ? 'Storage Target: ' : 'Event Page Link: '}
          <span className={`text-${accentColor}-400 italic`}>
             {isCreateMode ? 'IndexedDB.AayojanDB.events' : `/events/${event?.slug || 'draft'}`}
          </span>
        </p>
      </div>
    </div>
  );
}