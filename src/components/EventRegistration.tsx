// src/components/EventRegistration.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Loader2, User, Mail, Phone, Users, IndianRupee } from 'lucide-react';
import { getApplicableCategoriesForType } from '@/lib/db';

// Unified Attendee Category Definitions
export type AttendeeCategory = 
  | 'patron' 
  | 'dignitary'
  | 'vip'
  | 'sponsor' 
  | 'speaker' 
  | 'artisan' 
  | 'delegate' 
  | 'trainee' 
  | 'exhibitor' 
  | 'general-public' 
  | 'ops-team';

const ATTENDEE_CATEGORIES: { id: AttendeeCategory; label: string }[] = [
  { id: 'patron', label: 'Chief Patrons & Core Members' },
  { id: 'dignitary', label: 'Dignitaries / State Officials' }, 
  { id: 'vip', label: 'VIP Guests' },
  { id: 'sponsor', label: 'Event Sponsors' },              
  { id: 'speaker', label: 'Keynote Speakers & Panelists' },
  { id: 'artisan', label: 'Cultural Artists & Artisans' },
  { id: 'delegate', label: 'Registered Delegates' },
  { id: 'trainee', label: 'Trainees & Scholars' },
  { id: 'exhibitor', label: 'Exhibitors & Vendors' },
  { id: 'general-public', label: 'General Visitors & Public' },
  { id: 'ops-team', label: 'Operations & Logistics Team' }
];

// 🚀 Whitelist filter defining which specific profiles are permitted on public self-registration paths
const PUBLIC_EXCLUSIVE_CATEGORIES: AttendeeCategory[] = [
  'sponsor',
  'speaker',
  'artisan',
  'delegate',
  'trainee',
  'exhibitor',
  'general-public'
];

interface EventData {
  type: 'event' | 'celebration' | 'summit' | 'workshop' | 'conference';
  pricingConfig?: {
    isRequired: boolean;
    baseFee: number;
    gstApplicable: boolean;
    applicableForAll: 'yes' | 'no';
    categoryFees: Record<AttendeeCategory, number>;
  };
  [key: string]: any;
}

interface CustomFieldConfig {
  id: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  required: boolean;
  options?: string[];
}

interface UniversalRegistrationFormProps {
  event: EventData;
}

export default function UniversalRegistrationForm({ event }: UniversalRegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    category: '' as AttendeeCategory | '',
    customAnswers: {} as Record<string, string>
  });

  const [pricing, setPricing] = useState({
    basePrice: 0,
    gstAmount: 0,
    totalPrice: 0
  });

  // Calculate fees dynamically whenever category selection changes
  useEffect(() => {
    if (!event.pricingConfig?.isRequired) {
      setPricing({ basePrice: 0, gstAmount: 0, totalPrice: 0 });
      return;
    }

    let calculatedBase = 0;
    if (event.pricingConfig.applicableForAll === 'yes') {
      calculatedBase = event.pricingConfig.baseFee || 0;
    } else if (formData.category) {
      calculatedBase = event.pricingConfig.categoryFees?.[formData.category] || 0;
    }

    const calculatedGst = event.pricingConfig.gstApplicable ? parseFloat((calculatedBase * 0.18).toFixed(2)) : 0;
    const calculatedTotal = calculatedBase + calculatedGst;

    setPricing({
      basePrice: calculatedBase,
      gstAmount: calculatedGst,
      totalPrice: calculatedTotal
    });
  }, [formData.category, event.pricingConfig]);

  const getCustomFieldsForEvent = (): CustomFieldConfig[] => {
    switch (event.type) {
      case 'summit':
      case 'conference':
        return [
          { id: 'company', label: 'Organization / Institution', type: 'text', required: true },
          { id: 'designation', label: 'Designation / Job Title', type: 'text', required: true }
        ];
      case 'workshop':
        return [
          { id: 'experience', label: 'Prior Coding/Domain Experience', type: 'select', required: true, options: ['Beginner', 'Intermediate', 'Advanced'] },
          { id: 'laptop', label: 'Will you bring your own laptop?', type: 'select', required: true, options: ['Yes', 'No'] }
        ];
      case 'celebration':
      default:
        return [
          { id: 'location', label: 'Home Town / City', type: 'text', required: false }
        ];
    }
  };

  const fields = getCustomFieldsForEvent();

  const handleCustomChange = (fieldId: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      customAnswers: { ...prev.customAnswers, [fieldId]: value }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate pipeline latency database processing lag
    await new Promise(resolve => setTimeout(resolve, 1200));
    
    setIsSubmitting(false);
    setFormSubmitted(true);
  };

  if (formSubmitted) {
    return (
      <div className="text-center py-10 px-4 space-y-4 animate-in zoom-in-95 duration-300">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={28} />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">Registration Processed</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[260px] mx-auto leading-relaxed">
            Your telemetry data and commercial clearance parameters were successfully written to the secure ledger cache.
          </p>
        </div>
        {pricing.totalPrice > 0 && (
          <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Total Charge Recorded: <span className="text-emerald-500">₹{pricing.totalPrice}</span>
          </div>
        )}
        <div className="inline-block p-2.5 rounded-xl border font-mono text-[10px] bg-slate-50 border-slate-200 text-slate-600 dark:bg-black/30 dark:border-white/5 dark:text-slate-400">
          Status: <span className="text-emerald-600 dark:text-emerald-400 font-extrabold uppercase tracking-wide">Ready for Gate Sync</span>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      
      {/* CORE FIELDS */}
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            Identity Profile Name
          </label>
          <div className="relative group">
            <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
            <input 
              type="text" 
              required 
              placeholder="Ex: Atul Kumar" 
              value={formData.name} 
              onChange={e => setFormData({...formData, name: e.target.value})} 
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all font-semibold text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            Secure Communications Routing
          </label>
          <div className="relative group">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
            <input 
              type="email" 
              required 
              placeholder="name@company.com" 
              value={formData.email} 
              onChange={e => setFormData({...formData, email: e.target.value})} 
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all font-semibold text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            Mobile Access Node (WhatsApp)
          </label>
          <div className="relative group">
            <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
            <input 
              type="tel" 
              required 
              placeholder="+91 XXXXX XXXXX" 
              value={formData.phone} 
              onChange={e => setFormData({...formData, phone: e.target.value})} 
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all font-semibold text-slate-800 dark:text-white placeholder-slate-400"
            />
          </div>
        </div>

        {/* ATTENDEE CATEGORY SELECTION DROPDOWN */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            Attendee Clearance Category
          </label>
          <div className="relative group">
            <Users size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
            <select
              required
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value as AttendeeCategory})}
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-white cursor-pointer"
            >
              <option value="" className="text-slate-400">Select attendee profile type...</option>
              {ATTENDEE_CATEGORIES.filter(cat => 
                // Intersect the database schema configuration logic with the public-facing whitelist
                getApplicableCategoriesForType(event.type).includes(cat.id) &&
                PUBLIC_EXCLUSIVE_CATEGORIES.includes(cat.id)
              ).map(cat => (
                <option key={cat.id} value={cat.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* DYNAMIC METRIC FIELDS */}
      {fields.length > 0 && (
        <div className="pt-2 space-y-3 border-t border-slate-100 dark:border-white/5">
          {fields.map(field => (
            <div key={field.id} className="space-y-1 animate-in fade-in slide-in-from-right-2 duration-300">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
                {field.label} {field.required && <span className="text-red-400 font-bold">*</span>}
              </label>
              
              {field.type === 'select' ? (
                <select 
                  required={field.required}
                  value={formData.customAnswers[field.id] || ''}
                  onChange={e => handleCustomChange(field.id, e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-white cursor-pointer"
                >
                  <option value="" className="text-slate-400">Select option...</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{opt}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  required={field.required}
                  placeholder={`Provide target ${field.label.toLowerCase()}...`}
                  value={formData.customAnswers[field.id] || ''}
                  onChange={e => handleCustomChange(field.id, e.target.value)}
                  className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all font-semibold text-slate-800 dark:text-white placeholder-slate-400" 
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* DYNAMIC REGISTRATION FEE COMPUTATION SUMMARY */}
      {event.pricingConfig?.isRequired && (
        <div className="pt-3 border-t border-dashed border-slate-200 dark:border-white/10 space-y-2 animate-in fade-in duration-300">
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            Commercial Summary
          </span>
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] text-xs space-y-1 text-slate-600 dark:text-slate-400 font-semibold">
            {event.pricingConfig.applicableForAll === 'no' && !formData.category ? (
              <p className="text-[11px] text-amber-500 italic font-medium">Please select an entry category to calculate registration fees.</p>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span>Base Booking Token:</span>
                  <span className="font-bold text-slate-800 dark:text-white">₹{pricing.basePrice}</span>
                </div>
                {event.pricingConfig.gstApplicable && (
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>Statutory GST (18%):</span>
                    <span>₹{pricing.gstAmount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/10 pt-1.5 mt-1 text-slate-900 dark:text-white font-black">
                  <span className="flex items-center gap-0.5"><IndianRupee size={12} /> Payable Amount:</span>
                  <span className="text-sm text-emerald-500">₹{pricing.totalPrice}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* CONTROLLER ACTION INTERFACE */}
      <button 
        type="submit" 
        disabled={isSubmitting || (event.pricingConfig?.isRequired && event.pricingConfig.applicableForAll === 'no' && !formData.category)}
        className="w-full bg-orange-600 hover:bg-gray-900 text-white py-3 mt-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center gap-2 group"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin text-white" size={14} />
            <span>Writing Storage Ledgers...</span>
          </>
        ) : (
          <>
            <span>
              {pricing.totalPrice > 0 ? `Pay ₹${pricing.totalPrice} & Register` : 'Transmit Registration Ledger'}
            </span>
            <Send size={12} className="text-white/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </>
        )}
      </button>
    </form>
  );
}