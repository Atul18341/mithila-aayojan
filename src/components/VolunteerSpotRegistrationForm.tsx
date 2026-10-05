// src/components/EventRegistration/VolunteerSpotRegistrationForm.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Send, CheckCircle2, Loader2, User, Mail, Phone, Users, IndianRupee, 
  Trophy, AlertCircle, Camera, Upload, X, AlertTriangle, MapPin, Ticket 
} from 'lucide-react';
import { getApplicableCategoriesForType, db } from '@/lib/db';
import { translations, Locale } from '@/lib/translations';

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
  | 'event-participant'
  | 'ops-team';

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
  rules?: string;
  ageGroups?: AgeGroup[];
}

export interface FoodConfig {
  enabled: boolean;
  strategy?: 'complimentary' | 'coupon-based' | 'paid-buffet' | 'self-arranged';
  vendorDetails?: string;
  availableForAll: 'yes' | 'no';
  allowedCategories?: AttendeeCategory[] | string[];
}

const ATTENDEE_CATEGORY_KEYS: AttendeeCategory[] = [
  'patron', 'dignitary', 'vip', 'sponsor', 'speaker', 'artisan', 
  'delegate', 'trainee', 'exhibitor', 'general-public', 'event-participant', 'ops-team'
];

function checkFoodAccess(category: AttendeeCategory | string | undefined | null, foodConfig?: FoodConfig | null): boolean {
  if (!foodConfig || !foodConfig.enabled) return false;
  if (foodConfig.availableForAll === 'yes') return true;
  if (!category) return false;

  let allowed: string[] = [];
  if (Array.isArray(foodConfig.allowedCategories)) {
    allowed = foodConfig.allowedCategories;
  } else if (typeof foodConfig.allowedCategories === 'string') {
    try {
      const parsed = JSON.parse(foodConfig.allowedCategories);
      allowed = Array.isArray(parsed) ? parsed : [];
    } catch {
      allowed = [];
    }
  }
  return allowed.includes(category);
}

interface EventData {
  id?: string | number;
  slug?: string;
  name?: string;
  title?: string;
  type: 'event' | 'celebration' | 'summit' | 'workshop' | 'conference' | 'exam' | 'competition';
  eventDate?: string;          // Format: YYYY-MM-DD
  eventEndDate?: string;       // Format: YYYY-MM-DD
  eventEndTime?: string;       // Format: HH:mm (e.g., "18:00")
  isMultiCompetition?: boolean;
  collectPhoto?: boolean;
  referralAllowed?: boolean;
  competitions?: SubCompetition[];
  foodConfig?: FoodConfig;
  pricingConfig?: {
    isRequired: boolean;
    baseFee: number;
    gstApplicable: boolean;
    applicableForAll: 'yes' | 'no';
    categoryFees: Record<AttendeeCategory, number>;
  };
  [key: string]: any;
}

interface VolunteerSpotRegistrationFormProps {
  event: EventData;
  lang?: Locale;
  volunteerId?: string | number;
}

export default function VolunteerSpotRegistrationForm({ event, lang = 'en', volunteerId }: VolunteerSpotRegistrationFormProps) {
  const router = useRouter();
  const t = translations[lang] || translations.en;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEventExpired, setIsEventExpired] = useState(false);
  const [expiryMessage, setExpiryMessage] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{ registrationId: string; qrToken: string; name: string; phone: string; isCheckedIn: boolean } | null>(null);
  const [globalWarning, setGlobalWarning] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    referralCode: '',
    category: '' as AttendeeCategory | '',
    competitionId: '',
    ageGroupId: '',
    photoBase64: '' as string | null,
    customAnswers: {} as Record<string, string>
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [competitionsList, setCompetitionsList] = useState<SubCompetition[]>(event.competitions || []);
  const [isMultiCompActive, setIsMultiCompActive] = useState<boolean>(event.isMultiCompetition ?? true);
  const [isLoadingCompetitions, setIsLoadingCompetitions] = useState<boolean>(false);

  const [pricing, setPricing] = useState({ basePrice: 0, gstAmount: 0, totalPrice: 0 });

  // 🕒 Check if current time has passed the event end date/time
  useEffect(() => {
    const checkEventExpiry = () => {
      const targetDateStr = event.eventEndDate || event.eventDate;
      if (!targetDateStr) return;

      const now = new Date();
      const endTimeStr = event.eventEndTime || '23:59';
      const eventEndDateTime = new Date(`${targetDateStr}T${endTimeStr}:00`);

      if (now.getTime() > eventEndDateTime.getTime()) {
        setIsEventExpired(true);
        setExpiryMessage(`Spot registrations are closed. This event concluded on ${targetDateStr} at ${endTimeStr}.`);
      }
    };

    checkEventExpiry();
    const interval = setInterval(checkEventExpiry, 60000);
    return () => clearInterval(interval);
  }, [event.eventEndDate, event.eventDate, event.eventEndTime]);

  const compressImage = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 500;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
    });
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error('Camera access error:', err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureSnapshot = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const rawData = canvas.toDataURL('image/jpeg', 0.8);
    const optimized = await compressImage(rawData);
    setFormData(prev => ({ ...prev, photoBase64: optimized }));
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawData = event.target?.result as string;
      const optimized = await compressImage(rawData);
      setFormData(prev => ({ ...prev, photoBase64: optimized }));
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    async function loadCompetitionsFromDb() {
      if (!db || !db.events) return;
      setIsLoadingCompetitions(true);
      try {
        let fetchedEvent = null;
        if (event.id) {
          const numericId = typeof event.id === 'string' ? parseInt(event.id, 10) : event.id;
          if (!isNaN(numericId)) fetchedEvent = await db.events.get(numericId);
        }
        if (!fetchedEvent && event.slug) {
          fetchedEvent = await db.events.where('slug').equals(event.slug).first();
        }
        if (fetchedEvent) {
          if (fetchedEvent.isMultiCompetition !== undefined) setIsMultiCompActive(fetchedEvent.isMultiCompetition);
          if (Array.isArray(fetchedEvent.competitions)) setCompetitionsList(fetchedEvent.competitions);
        }
      } catch (err) {
        console.error("Failed to load competitions from Dexie:", err);
      } finally {
        setIsLoadingCompetitions(false);
      }
    }
    loadCompetitionsFromDb();
  }, [event.id, event.slug]);

  const selectedCompetition = competitionsList.find(c => c.id === formData.competitionId);

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
    setPricing({ basePrice: calculatedBase, gstAmount: calculatedGst, totalPrice: calculatedBase + calculatedGst });
  }, [formData.category, event.pricingConfig]);

  const generateQrToken = (eventData: EventData, phone: string): string => {
    const rawTitle = eventData?.name || eventData?.title || eventData?.slug || 'EV';
    let prefix = rawTitle.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase();
    if (prefix.length < 2) prefix = (prefix + 'X').substring(0, 2);
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    let phoneTail = cleanPhone.slice(-4);
    if (phoneTail.length < 4) phoneTail = Math.floor(1000 + Math.random() * 9000).toString();
    return `${prefix}26-SPOT-${phoneTail}`;
  };

  const handleSpotRegistrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalWarning(null);

    if (isEventExpired) {
      setGlobalWarning(expiryMessage || 'Registration is closed as the event has ended.');
      return;
    }

    if (!formData.name.trim() || !formData.phone.match(/^\d{10}$/)) {
      setGlobalWarning('Please provide a valid full name and a 10-digit mobile number.');
      return;
    }

    if (event.type !== 'exam' && !formData.category) {
      setGlobalWarning('Please select an attendee category.');
      return;
    }

    setIsSubmitting(true);

    try {
      const eventIdParam = event.id || event.slug || 'default';
      const registrationId = `REG-SPOT-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
      const qrToken = generateQrToken(event, formData.phone);
      const isOnline = typeof window !== 'undefined' && navigator.onLine;

      // 🕒 Conditional Auto-Check-In Logic (Only on actual event date)
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const eventDayStr = event.eventDate || event.eventStartDate;
      const isHappeningToday = eventDayStr ? todayStr === eventDayStr : true;

      const selectedComp = competitionsList.find(c => c.id === formData.competitionId);
      const selectedAgeGroup = selectedComp?.ageGroups?.find(g => g.id === formData.ageGroupId);
      const resolvedCategory = event.type === 'exam' ? 'event-participant' : (formData.category || 'event-participant');
      const hasFoodAccess = checkFoodAccess(resolvedCategory, event.foodConfig);

      const registrationPayload = {
        registrationId,
        eventId: eventIdParam,
        name: formData.name,
        email: formData.email || `${formData.phone}@spot.mithila`,
        phone: formData.phone,
        address: formData.address || null,
        referralCode: formData.referralCode || `SPOT-DESK-${volunteerId || 'GEN'}`,
        category: resolvedCategory as AttendeeCategory,
        competitionId: formData.competitionId || null,
        competitionTitle: selectedComp ? selectedComp.title : (event.type === 'exam' ? event.name : null),
        ageGroupId: formData.ageGroupId || null,
        ageGroupLabel: selectedAgeGroup ? selectedAgeGroup.label : null,
        customAnswers: {
          ...formData.customAnswers,
          registrationMode: 'DESK_SPOT_REGISTRATION',
          assistedByVolunteer: volunteerId || 'desk-volunteer'
        },
        photoUrl: formData.photoBase64 || null,
        basePrice: pricing.basePrice,
        gstAmount: pricing.gstAmount,
        totalPrice: pricing.totalPrice,
        paymentId: pricing.totalPrice > 0 ? 'CASH_COLLECTED_AT_DESK' : 'FREE_ENTRY',
        status: 'CONFIRMED',
        syncStatus: 'pending',
        registrationTimestamp: Date.now()
      };

      const guestPayload = {
        guestId: `GUEST-SPOT-${Date.now()}`,
        registrationId,
        eventId: eventIdParam,
        name: formData.name,
        email: formData.email || `${formData.phone}@spot.mithila`,
        phone: formData.phone,
        address: formData.address || null,
        category: resolvedCategory,
        competitionTitle: selectedComp ? selectedComp.title : (event.type === 'exam' ? event.name : null),
        ageGroupLabel: selectedAgeGroup ? selectedAgeGroup.label : null,
        photoUrl: formData.photoBase64 || null,
        qrToken,
        isCheckedIn: isHappeningToday,
        checkInTime: isHappeningToday ? Date.now() : null,
        dayCheckIns: isHappeningToday ? { "1": Date.now() } : {},
        hasFoodAccess,
        hasFoodClaimed: false,
        amountPaid: pricing.totalPrice,
        syncStatus: 'pending',
        registeredAt: Date.now()
      };

      if (typeof window !== 'undefined' && db) {
        await db.transaction('rw', [db.eventRegistrations, db.guests], async () => {
          await db.eventRegistrations.add(registrationPayload);
          await db.guests.add(guestPayload);
        });
      }

      if (isOnline) {
        fetch('/api/sync/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            events: [],
            guests: [guestPayload],
            eventRegistrations: [registrationPayload],
            users: []
          })
        }).then(async res => {
          if (res.ok && db) {
            await db.eventRegistrations.update(registrationId, { syncStatus: 'synced' });
            await db.guests.where('qrToken').equals(qrToken).modify({ syncStatus: 'synced' });
          }
        }).catch(err => {
          console.warn('Background sync push queued for later retry:', err);
        });
      }

      setIsSubmitting(false);
      setSuccessData({ registrationId, qrToken, name: formData.name, phone: formData.phone, isCheckedIn: isHappeningToday });

    } catch (err: any) {
      console.error('Spot registration failure:', err);
      setGlobalWarning(err.message || 'Failed to save spot registration locally.');
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccessData(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      referralCode: '',
      category: '',
      competitionId: '',
      ageGroupId: '',
      photoBase64: null,
      customAnswers: {}
    });
  };

  if (isEventExpired) {
    return (
      <div className="bg-slate-900 border border-amber-500/30 p-6 rounded-2xl text-center space-y-3 shadow-xl">
        <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
          <AlertTriangle size={28} />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-black text-white uppercase tracking-wider">Spot Registration Closed</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
            {expiryMessage}
          </p>
        </div>
      </div>
    );
  }

  if (successData) {
    const eventIdParam = event.id || event.slug || 'default';
    return (
      <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl text-center space-y-4 shadow-xl animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
          <CheckCircle2 size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-black text-slate-900 dark:text-white">Spot Registration Successful!</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {successData.isCheckedIn ? 'Pass generated and checked in instantly.' : 'Advance registration saved successfully.'}
          </p>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-left space-y-1 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-slate-400">Attendee:</span>
            <span className="font-bold text-slate-800 dark:text-white">{successData.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">QR Token:</span>
            <span className="font-bold text-blue-600 dark:text-blue-400">{successData.qrToken}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.push(`/ticket?eventId=${encodeURIComponent(eventIdParam)}&phone=${encodeURIComponent(successData.phone)}`)}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition shadow-md flex items-center justify-center gap-1.5"
          >
            <Ticket size={14} /> View Digital Pass
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2.5 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-800 dark:text-white rounded-xl text-xs font-black uppercase tracking-wider transition"
          >
            Next Pass
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSpotRegistrationSubmit} className="space-y-4 w-full bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-lg">
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400">
            <Users size={18} />
          </div>
          <div>
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Volunteer Desk Spot Registration</h4>
            <p className="text-[10px] text-slate-400 font-medium">Active until event end time</p>
          </div>
        </div>
        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded-full animate-pulse">
          Desk Live
        </span>
      </div>

      <div className="space-y-3">
        {/* Full Name */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">
            Full Name <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              required 
              placeholder="Enter participant full name..." 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 font-semibold text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Mobile Number */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">
            Mobile Number (10 Digits) <span className="text-red-400">*</span>
          </label>
          <div className="relative">
            <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="tel" 
              required 
              maxLength={10}
              placeholder="9876543210" 
              value={formData.phone} 
              onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} 
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 font-semibold text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Email Address */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">
            Email Address <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="email" 
              placeholder="participant@email.com" 
              value={formData.email} 
              onChange={e => setFormData({ ...formData, email: e.target.value })} 
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 font-semibold text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Address Field */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">
            Location / Address <span className="text-slate-400 font-normal">(Optional)</span>
          </label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3.5 top-3 text-slate-400" />
            <input 
              type="text" 
              placeholder="Village, City, or Institution..." 
              value={formData.address} 
              onChange={e => setFormData({ ...formData, address: e.target.value })} 
              className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 font-semibold text-slate-800 dark:text-white"
            />
          </div>
        </div>

        {/* Attendee Category Selection */}
        {event.type !== 'exam' && (
          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">
              Attendee Category <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Users size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                required
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as AttendeeCategory })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 font-semibold text-slate-800 dark:text-white cursor-pointer"
              >
                <option value="">Select Category...</option>
                {ATTENDEE_CATEGORY_KEYS.map(cat => (
                  <option key={cat} value={cat}>
                    {t.formCategories?.[cat] || cat}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Photo Capture Module */}
        {event.collectPhoto !== false && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-white/5">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">
              Participant Photo / ID Snapshot
            </label>

            {formData.photoBase64 && !isCameraActive && (
              <div className="relative w-24 h-24 mx-auto rounded-xl overflow-hidden border-2 border-emerald-500">
                <img src={formData.photoBase64} alt="Snapshot" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, photoBase64: null }))}
                  className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full"
                >
                  <X size={10} />
                </button>
              </div>
            )}

            {isCameraActive && (
              <div className="relative rounded-xl overflow-hidden border border-blue-500 bg-black aspect-square max-w-[200px] mx-auto">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <div className="absolute bottom-2 inset-x-0 flex justify-center gap-2">
                  <button type="button" onClick={captureSnapshot} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold">Capture</button>
                  <button type="button" onClick={stopCamera} className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold">Cancel</button>
                </div>
              </div>
            )}

            {!formData.photoBase64 && !isCameraActive && (
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={startCamera} className="py-2 px-3 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/5 text-blue-600 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Camera size={14} /> Open Camera
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1.5">
                  <Upload size={14} /> Upload File
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </div>
            )}
          </div>
        )}

        {/* Competition Track */}
        {isMultiCompActive && (event.type === 'exam' || event.type === 'competition') && competitionsList.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 ml-1">
              Select Exam / Competition Track <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Trophy size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                required
                value={formData.competitionId}
                onChange={e => setFormData({ ...formData, competitionId: e.target.value, ageGroupId: '' })}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 font-semibold text-slate-800 dark:text-white"
              >
                <option value="">Select Track...</option>
                {competitionsList.map(comp => (
                  <option key={comp.id} value={comp.id}>[{comp.code}] {comp.title}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Pricing Summary */}
        {event.pricingConfig?.isRequired && pricing.totalPrice > 0 && (
          <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl flex justify-between items-center text-xs font-semibold">
            <span>Spot Collection Fee:</span>
            <span className="text-emerald-500 font-black flex items-center gap-0.5"><IndianRupee size={12} /> {pricing.totalPrice} (Cash)</span>
          </div>
        )}
      </div>

      {globalWarning && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{globalWarning}</span>
        </div>
      )}

      <button 
        type="submit" 
        disabled={isSubmitting}
        className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition shadow-md flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="animate-spin" size={14} />
            <span>Saving to Offline Database...</span>
          </>
        ) : (
          <>
            <span>Complete Spot Registration & Issue QR Pass</span>
            <Send size={12} />
          </>
        )}
      </button>
    </form>
  );
}