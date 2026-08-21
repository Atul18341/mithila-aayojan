// src/components/WhatsAppRegistrationForm.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, User, Phone, Users, Trophy, 
  Layers, Send, AlertCircle, X, MapPin, FileText
} from 'lucide-react';
import { type AttendeeCategory, getApplicableCategoriesForType } from '@/lib/db';
import { Locale, translations } from '@/lib/translations';

export interface AgeGroup {
  id: string;
  label: string;
  code: string;
  minAge?: number;
  maxAge?: number;
}

export interface SubCompetition {
  id: string;
  title: string;
  code: string;
  category?: string;
  ageGroups?: AgeGroup[];
}

export interface WhatsAppEventProps {
  name: string;
  type?: string;
  date?: string;
  venue_name?: string;
  venueName?: string;
  location?: string;
  whatsapp_number?: string;
  whatsappNumber?: string;
  helpline_number?: string;
  helplineNumber?: string;
  isMultiCompetition?: boolean;
  competitions?: SubCompetition[];
}

interface WhatsAppRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  event: WhatsAppEventProps;
  lang?: Locale;
  onSuccess?: () => void;
}

const PUBLIC_CATEGORIES: AttendeeCategory[] = [
  'event-participant',
  'general-public',
  'delegate',
  'artisan',
  'exhibitor',
  'trainee',
  'speaker',
  'sponsor'
];

export default function WhatsAppRegistrationModal({ 
  isOpen,
  onClose,
  event, 
  lang = 'en',
  onSuccess 
}: WhatsAppRegistrationModalProps) {
  const t = translations[lang] || translations.en;

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    category: 'event-participant' as AttendeeCategory,
    competitionId: '',
    ageGroupId: '',
    notes: ''
  });

  const [error, setError] = useState<string | null>(null);

  // Close on Escape key & manage scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const eventType = event.type || 'event';
  const allowedCategories = getApplicableCategoriesForType(eventType).filter(cat => 
    PUBLIC_CATEGORIES.includes(cat)
  );

  const competitions = event.competitions || [];
  const selectedComp = competitions.find(c => c.id === formData.competitionId);
  const availableAgeGroups = selectedComp?.ageGroups || [];

  const handleLaunchWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!formData.name.trim()) {
      setError(lang === 'hi' ? 'कृपया अपना पूरा नाम दर्ज करें।' : lang === 'mai' ? 'कृपया अपन पूरा नाम दर्ज करू।' : 'Please enter your full name.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setError(lang === 'hi' ? 'कृपया 10 अंकों का वैध मोबाइल नंबर दर्ज करें।' : lang === 'mai' ? 'कृपया 10 अंक क वैध मोबाइल नंबर दर्ज करू।' : 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (event.isMultiCompetition && competitions.length > 0 && !formData.competitionId) {
      setError(lang === 'hi' ? 'कृपया प्रतियोगिता ट्रैक चुनें।' : lang === 'mai' ? 'कृपया प्रतियोगिता ट्रैक चुनू।' : 'Please select a competition track.');
      return;
    }

    const selectedCategoryLabel = t.formCategories[formData.category] || formData.category;
    const selectedTrackTitle = selectedComp ? `${selectedComp.title} [${selectedComp.code}]` : 'N/A';
    const selectedAgeLabel = availableAgeGroups.find(g => g.id === formData.ageGroupId)?.label || 'Open / General';
    const finalVenue = event.venue_name || event.venueName || event.location || 'Main Venue';

    const messageLines = [
      `📝 *EVENT REGISTRATION SUBMISSION*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🎯 *Event:* ${event.name}`,
      `📅 *Date:* ${event.date || 'TBA'}`,
      `📍 *Venue:* ${finalVenue}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *Participant Name:* ${formData.name.trim()}`,
      `📱 *Mobile Number:* ${cleanPhone}`,
      formData.email.trim() ? `✉️ *Email ID:* ${formData.email.trim()}` : null,
      formData.city.trim() ? `🏡 *Village / City:* ${formData.city.trim()}` : null,
      `🏷️ *Category:* ${selectedCategoryLabel}`,
      event.isMultiCompetition ? `🏆 *Competition Track:* ${selectedTrackTitle}` : null,
      event.isMultiCompetition && formData.competitionId ? `👥 *Age Bracket:* ${selectedAgeLabel}` : null,
      formData.notes.trim() ? `💬 *Additional Note:* ${formData.notes.trim()}` : null,
      `━━━━━━━━━━━━━━━━━━━━`,
      `_Please verify details and issue official entry pass._`
    ].filter(Boolean).join('\n');

    // 🟢 Utilizes the specific WhatsApp / Helpline number configured during event creation
    const configuredNumber = event.whatsapp_number || event.whatsappNumber || event.helpline_number || event.helplineNumber || '';
    const cleanConfiguredNumber = configuredNumber.replace(/\D/g, '');
    const encodedPayload = encodeURIComponent(messageLines);
    console.log("clean no:",cleanConfiguredNumber)
    const waUrl = configuredNumber
      ? `https://wa.me/${cleanConfiguredNumber.length === 10 ? `91${cleanConfiguredNumber}` : cleanConfiguredNumber}?text=${encodedPayload}`
      : `https://wa.me/?text=${encodedPayload}`;

    if (onSuccess) onSuccess();
    onClose();

    if (typeof window !== 'undefined') {
      window.open(waUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
      />

      {/* Modal Container */}
      <div className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <MessageCircle size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white">
                Register via WhatsApp
              </h3>
              <p className="text-[10.5px] text-slate-400">
                व्हाट्सएप द्वारा त्वरित पंजीकरण (Assisted Helpdesk)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body Form (Scrollable) */}
        <form onSubmit={handleLaunchWhatsApp} className="p-5 space-y-3.5 text-slate-800 dark:text-slate-100 overflow-y-auto custom-scrollbar">
          
          {/* 1. Full Name */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block ml-0.5">
              {t.formNameLabel} <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="relative group">
              <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
              <input
                type="text"
                required
                placeholder={t.formNamePlaceholder}
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 2. 10-Digit Mobile Number */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-0.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t.formPhoneLabel} <span className="text-red-500 font-bold">*</span>
              </label>
              <span className={`text-[10px] font-mono font-bold ${formData.phone.length === 10 ? 'text-emerald-500' : 'text-slate-400'}`}>
                {formData.phone.length}/10
              </span>
            </div>
            <div className="relative group">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
              <input
                type="tel"
                required
                maxLength={10}
                placeholder={t.formPhonePlaceholder}
                value={formData.phone}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setFormData(prev => ({ ...prev, phone: val }));
                }}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 3. Email ID (Optional) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block ml-0.5">
              Email ID / ईमेल आईडी
            </label>
            <div className="relative group">
              <FileText size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
              <input
                type="email"
                placeholder="name@example.com"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 4. Village & City */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block ml-0.5">
              Village & City / गाम, शहर *
            </label>
            <div className="relative group">
              <MapPin size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. Madhubani"
                value={formData.city}
                onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 5. Attendge Category Dropdown (Always Visible) */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block ml-0.5">
              {t.formCategoryLabel} <span className="text-red-500 font-bold">*</span>
            </label>
            <div className="relative group">
              <Users size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as AttendeeCategory }))}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 transition-all cursor-pointer"
              >
                {allowedCategories.map(cat => (
                  <option key={cat} value={cat}>
                    {t.formCategories[cat]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 6. Competition & Age Group Dropdowns (Always Visible if Multi-Competition) */}
          {event.isMultiCompetition && competitions.length > 0 && (
            <div className="space-y-2.5 pt-1 border-t border-dashed border-slate-200 dark:border-white/10">
              <div className="space-y-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block ml-0.5">
                  {t.formCompLabel} <span className="text-red-500 font-bold">*</span>
                </label>
                <div className="relative group">
                  <Trophy size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
                  <select
                    required
                    value={formData.competitionId}
                    onChange={(e) => setFormData(prev => ({ ...prev, competitionId: e.target.value, ageGroupId: '' }))}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 transition-all cursor-pointer"
                  >
                    <option value="">{t.formCompPlaceholder}</option>
                    {competitions.map(comp => (
                      <option key={comp.id} value={comp.id}>
                        [{comp.code}] {comp.title} {comp.category ? `(${comp.category})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {availableAgeGroups.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block ml-0.5">
                    {t.formAgeGroupLabel}
                  </label>
                  <div className="relative group">
                    <Layers size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors pointer-events-none" />
                    <select
                      value={formData.ageGroupId}
                      onChange={(e) => setFormData(prev => ({ ...prev, ageGroupId: e.target.value }))}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      <option value="">Select Age Group / Bracket</option>
                      {availableAgeGroups.map(grp => (
                        <option key={grp.id} value={grp.id}>
                          {grp.label} [{grp.code}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Additional Notes */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block ml-0.5">
              Additional Notes / कोई विशेष टिप्पणी
            </label>
            <input
              type="text"
              placeholder="Any specific requirement or message..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Error Notice */}
          {error && (
            <div className="flex items-center gap-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium animate-in fade-in">
              <AlertCircle size={13} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Launch WhatsApp Action Button */}
          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 cursor-pointer mt-2"
          >
            <MessageCircle size={15} />
            <span>Send to WhatsApp</span>
            <Send size={12} className="opacity-80" />
          </button>

          <p className="text-[10px] text-center text-slate-400 leading-tight pt-1">
            Opens WhatsApp with your complete pre-filled information to send to the event helpdesk.
          </p>
        </form>
      </div>
    </div>
  );
}