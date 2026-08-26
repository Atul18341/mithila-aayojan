// src/components/EventRegistration/UniversalRegistrationForm.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Send, CheckCircle2, Loader2, User, Mail, Phone, Users, IndianRupee, 
  Lock, CalendarX, Ticket, Trophy, AlertCircle, Layers,
  Camera, Upload, X, AlertTriangle
} from 'lucide-react';
import { getApplicableCategoriesForType, db } from '@/lib/db';
import { loadRazorpayScript } from '@/hooks/useRazorpay';
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
  'patron',
  'dignitary',
  'vip',
  'sponsor',
  'speaker',
  'artisan',
  'delegate',
  'trainee',
  'exhibitor',
  'general-public',
  'event-participant',
  'ops-team'
];

const PUBLIC_EXCLUSIVE_CATEGORIES: AttendeeCategory[] = [
  'sponsor',
  'speaker',
  'artisan',
  'delegate',
  'trainee',
  'exhibitor',
  'general-public',
  'event-participant'
];

function checkFoodAccess(
  category: AttendeeCategory | string | undefined | null,
  foodConfig?: FoodConfig | null
): boolean {
  if (!foodConfig || !foodConfig.enabled) {
    return false;
  }

  if (foodConfig.availableForAll === 'yes') {
    return true;
  }

  if (!category) {
    return false;
  }

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
  id?: string;
  slug?: string;
  name?: string;
  type: 'event' | 'celebration' | 'summit' | 'workshop' | 'conference';
  registrationEndDate?: string;
  registration_end_date?: string;
  isMultiCompetition?: boolean;
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

interface CustomFieldConfig {
  id: string;
  label: string;
  type: 'text' | 'select' | 'textarea';
  required: boolean;
  options?: { value: string; label: string }[];
}

interface UniversalRegistrationFormProps {
  event: EventData;
  lang?: Locale;
}

export default function UniversalRegistrationForm({ event, lang = 'en' }: UniversalRegistrationFormProps) {
  const router = useRouter();
  const t = translations[lang] || translations.en;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [duplicateError, setDuplicateError] = useState<{ message: string; queryParam: string } | null>(null);
  const [globalWarning, setGlobalWarning] = useState<string | null>(null);

  // Field-specific inline error/warning states
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
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

  const [competitionsList, setCompetitionsList] = useState<SubCompetition[]>(
    event.competitions || []
  );
  const [isMultiCompActive, setIsMultiCompActive] = useState<boolean>(
    event.isMultiCompetition ?? false
  );
  const [isLoadingCompetitions, setIsLoadingCompetitions] = useState<boolean>(false);

  const [pricing, setPricing] = useState({
    basePrice: 0,
    gstAmount: 0,
    totalPrice: 0
  });

  const cutoffDateStr = event.registrationEndDate || event.registration_end_date;
  let isRegistrationClosed = false;

  if (cutoffDateStr) {
    const cutoffDate = new Date(`${cutoffDateStr}T23:59:59`);
    if (!isNaN(cutoffDate.getTime()) && Date.now() > cutoffDate.getTime()) {
      isRegistrationClosed = true;
    }
  }

  const validateField = (fieldName: string, value: any): string => {
    let warning = '';
    switch (fieldName) {
      case 'name':
        if (!value || !value.trim()) {
          warning = lang === 'hi' ? 'नाम दर्ज करना अनिवार्य है।' : lang === 'mai' ? 'नाम दर्ज करब अनिवार्य अछि।' : 'Full name is required.';
        } else if (value.trim().length < 2) {
          warning = lang === 'hi' ? 'कृपया कम से कम 2 अक्षरों का नाम दर्ज करें।' : lang === 'mai' ? 'कृपया कम सं कम 2 अक्षर क नाम लिखू।' : 'Name must be at least 2 characters.';
        }
        break;

      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!value || !value.trim()) {
          warning = lang === 'hi' ? 'ईमेल आईडी दर्ज करना अनिवार्य है।' : lang === 'mai' ? 'ईमेल पता दर्ज करब अनिवार्य अछि।' : 'Email address is required.';
        } else if (!emailRegex.test(value.trim())) {
          warning = lang === 'hi' ? 'कृपया एक वैध ईमेल पता दर्ज करें।' : lang === 'mai' ? 'कृपया एकटा वैध ईमेल पता दर्ज करू।' : 'Please enter a valid email address.';
        }
        break;

      case 'phone':
        const cleanDigits = String(value || '').replace(/\D/g, '');
        if (!cleanDigits) {
          warning = lang === 'hi' ? 'मोबाइल नंबर दर्ज करना अनिवार्य है।' : lang === 'mai' ? 'मोबाइल नंबर दर्ज करब अनिवार्य अछि।' : 'Mobile number is required.';
        } else if (cleanDigits.length !== 10) {
          warning = lang === 'hi' ? `मोबाइल नंबर में ठीक 10 अंक होने चाहिए (${cleanDigits.length}/10)` : lang === 'mai' ? `मोबाइल नंबर मे ठीक 10 अंक होबक चाही (${cleanDigits.length}/10)` : `Mobile number must be exactly 10 digits (${cleanDigits.length}/10).`;
        }
        break;

      case 'category':
        if (!value) {
          warning = lang === 'hi' ? 'कृपया एक श्रेणी का चयन करें।' : lang === 'mai' ? 'कृपया एकटा श्रेणीक चयन करू।' : 'Please select an attendee category.';
        }
        break;

      case 'competitionId':
        if (formData.category === 'event-participant' && isMultiCompActive && !value) {
          warning = lang === 'hi' ? 'कृपया एक प्रतियोगिता/ट्रैक चुनें।' : lang === 'mai' ? 'कृपया एकटा प्रतियोगिता चुनू।' : 'Please select a competition track.';
        }
        break;

      case 'ageGroupId':
        if (formData.category === 'event-participant' && availableAgeGroups.length > 0 && !value) {
          warning = lang === 'hi' ? 'कृपया इस प्रतियोगिता के लिए अपना आयु वर्ग चुनें।' : lang === 'mai' ? 'कृपया एहि प्रतियोगिताक लेल अपन आयु वर्ग चुनू।' : 'Please select an age group for this competition.';
        }
        break;

      case 'photo':
        if (!value) {
          warning = lang === 'hi' ? 'प्रतिभागी की फोटो अपलोड या कैप्चर करना अनिवार्य है।' : lang === 'mai' ? 'प्रतिभागीक फोटो अपलोड या कैप्चर करब अनिवार्य अछि।' : 'Participant photo is required.';
        }
        break;

      default:
        break;
    }
    return warning;
  };

  const markTouchedAndValidate = (fieldName: string, value: any) => {
    setTouchedFields(prev => ({ ...prev, [fieldName]: true }));
    const errorMsg = validateField(fieldName, value);
    setFieldWarnings(prev => {
      const updated = { ...prev };
      if (errorMsg) updated[fieldName] = errorMsg;
      else delete updated[fieldName];
      return updated;
    });
  };

  const compressImage = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = imageSrc;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setFieldWarnings(prev => ({ ...prev, photo: 'Unable to access device camera. Please upload a photo file instead.' }));
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
    
    const rawData = canvas.toDataURL('image/jpeg', 0.85);
    const optimized = await compressImage(rawData);
    setFormData(prev => ({ ...prev, photoBase64: optimized }));
    markTouchedAndValidate('photo', optimized);
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
      markTouchedAndValidate('photo', optimized);
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
          if (!isNaN(numericId)) {
            fetchedEvent = await db.events.get(numericId);
          }
        }

        if (!fetchedEvent && event.slug) {
          fetchedEvent = await db.events.where('slug').equals(event.slug).first();
        }

        if (fetchedEvent) {
          if (fetchedEvent.isMultiCompetition !== undefined) {
            setIsMultiCompActive(fetchedEvent.isMultiCompetition);
          }
          if (Array.isArray(fetchedEvent.competitions)) {
            setCompetitionsList(fetchedEvent.competitions);
          }
        }
      } catch (err) {
        console.error("Failed to load competitions from Dexie DB:", err);
      } finally {
        setIsLoadingCompetitions(false);
      }
    }

    loadCompetitionsFromDb();
  }, [event.id, event.slug]);

  const selectedCompetition = competitionsList.find(c => c.id === formData.competitionId);
  const availableAgeGroups = selectedCompetition?.ageGroups || [];

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
          { id: 'company', label: t.customFields.company, type: 'text', required: true },
          { id: 'designation', label: t.customFields.designation, type: 'text', required: true }
        ];
      case 'workshop':
        return [
          { 
            id: 'experience', 
            label: t.customFields.experience, 
            type: 'select', 
            required: true, 
            options: [
              { value: 'Beginner', label: t.customFields.optionBeginner },
              { value: 'Intermediate', label: t.customFields.optionIntermediate },
              { value: 'Advanced', label: t.customFields.optionAdvanced }
            ] 
          },
          { 
            id: 'laptop', 
            label: t.customFields.laptop, 
            type: 'select', 
            required: true, 
            options: [
              { value: 'Yes', label: t.customFields.optionYes },
              { value: 'No', label: t.customFields.optionNo }
            ] 
          }
        ];
      case 'celebration':
      default:
        return [
          { id: 'location', label: t.customFields.location, type: 'text', required: false }
        ];
    }
  };

  const fields = getCustomFieldsForEvent();

  const handleCustomChange = (fieldId: string, value: string, isRequired: boolean) => {
    setFormData(prev => ({
      ...prev,
      customAnswers: { ...prev.customAnswers, [fieldId]: value }
    }));
    setTouchedFields(prev => ({ ...prev, [fieldId]: true }));
    if (isRequired && !value.trim()) {
      setFieldWarnings(prev => ({ ...prev, [fieldId]: 'This field is required.' }));
    } else {
      setFieldWarnings(prev => {
        const copy = { ...prev };
        delete copy[fieldId];
        return copy;
      });
    }
  };

  const formatAgeBadgeText = (min?: number, max?: number) => {
    if (min !== undefined && max !== undefined) return `${min}–${max} yrs`;
    if (min !== undefined) return `≥ ${min} yrs`;
    if (max !== undefined) return `≤ ${max} yrs`;
    return t.formOpenBracket;
  };

  const generateQrToken = (eventData: EventData, phone: string): string => {
    const rawEventTitle = eventData?.name || eventData?.title || eventData?.slug || eventData?.id || 'EV';
    let prefix = rawEventTitle.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase();
    if (prefix.length < 2) prefix = (prefix + 'X').substring(0, 2);

    const cleanPhoneDigits = phone ? phone.replace(/\D/g, '') : '';
    let phoneTail = cleanPhoneDigits.slice(-4);

    if (phoneTail.length < 4) {
      phoneTail = Math.floor(1000 + Math.random() * 9000).toString();
    }

    return `${prefix}26-${phoneTail}`;
  };

  const sendRegistrationToServer = async (registrationPayload: any, guestPayload: any, paymentResponse?: any) => {
    if (typeof window !== 'undefined' && !navigator.onLine) {
      return;
    }

    const response = await fetch('/api/registrations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        registration: registrationPayload,
        guest: guestPayload,
        paymentDetails: paymentResponse ? {
          razorpay_order_id: paymentResponse.razorpay_order_id,
          razorpay_payment_id: paymentResponse.razorpay_payment_id,
          razorpay_signature: paymentResponse.razorpay_signature,
        } : null
      }),
    });

    const data = await response.json();

    if (response.status === 409 || data.isDuplicate) {
      const queryParam = registrationPayload.phone || registrationPayload.email;
      const errorObj = {
        message: data.error || (lang === 'hi' ? 'इस ईमेल या फोन नंबर से पहले ही पंजीकरण किया जा चुका है।' : lang === 'mai' ? 'एहि ईमेल या फोन नंबर सं पहिनेहि पंजीकरण भऽ चुकल अछि।' : 'An account with this email or phone is already registered for this event.'),
        queryParam: encodeURIComponent(queryParam)
      };
      setDuplicateError(errorObj);
      throw new Error(data.error || 'DUPLICATE_REGISTRATION');
    }

    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Server registration record failed.');
    }

    return data;
  };

  const saveRegistrationRecord = async (paymentDetails?: { paymentId?: string; orderId?: string; signature?: string }) => {
    const eventIdParam = event.id || event.slug || 'default';
    const registrationId = `REG-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const qrToken = generateQrToken(event, formData.phone);
    const isOnline = typeof window !== 'undefined' && navigator.onLine;

    const selectedComp = competitionsList.find(c => c.id === formData.competitionId);
    const selectedAgeGroup = selectedComp?.ageGroups?.find(g => g.id === formData.ageGroupId);

    const hasFoodAccess = checkFoodAccess(formData.category, event.foodConfig);

    const registrationPayload = {
      registrationId: registrationId,
      eventId: eventIdParam,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      category: formData.category as AttendeeCategory,
      competitionId: formData.competitionId || null,
      competitionTitle: selectedComp ? selectedComp.title : null,
      ageGroupId: formData.ageGroupId || null,
      ageGroupLabel: selectedAgeGroup ? selectedAgeGroup.label : null,
      customAnswers: {
        ...formData.customAnswers,
        participantPhoto: formData.photoBase64 || ''
      },
      photoUrl: formData.photoBase64 || null,
      
      basePrice: pricing.basePrice,
      gstAmount: pricing.gstAmount,
      totalPrice: pricing.totalPrice,
      
      paymentId: paymentDetails?.paymentId || 'FREE_ENTRY',
      orderId: paymentDetails?.orderId || null,
      
      status: 'CONFIRMED',
      syncStatus: isOnline ? 'synced' : 'pending',
      registrationTimestamp: Date.now()
    };

    const guestPayload = {
      guestId: `GUEST-${Date.now()}`,
      registrationId: registrationId,
      eventId: eventIdParam,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      category: formData.category,
      competitionTitle: selectedComp ? selectedComp.title : null,
      ageGroupLabel: selectedAgeGroup ? selectedAgeGroup.label : null,
      photoUrl: formData.photoBase64 || null,
      
      qrToken: qrToken,
      isCheckedIn: false,
      
      hasFoodAccess: hasFoodAccess,
      hasFoodClaimed: false,
      
      amountPaid: pricing.totalPrice,
      syncStatus: isOnline ? 'synced' : 'pending',
      registeredAt: Date.now()
    };

    if (isOnline) {
      await sendRegistrationToServer(registrationPayload, guestPayload, paymentDetails ? {
        razorpay_order_id: paymentDetails.orderId,
        razorpay_payment_id: paymentDetails.paymentId,
        razorpay_signature: paymentDetails.signature
      } : undefined);
    }

    if (typeof window !== 'undefined' && db) {
      try {
        await db.transaction('rw', [db.eventRegistrations, db.guests], async () => {
          await db.eventRegistrations.add(registrationPayload);
          await db.guests.add(guestPayload);
        });
      } catch (error) {
        console.error("❌ Dexie Write Failure:", error);
      }
    }

    return eventIdParam;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateError(null);
    setGlobalWarning(null);

    // Validate all fields across the board
    const newWarnings: Record<string, string> = {};
    const nameWarn = validateField('name', formData.name);
    if (nameWarn) newWarnings.name = nameWarn;

    const emailWarn = validateField('email', formData.email);
    if (emailWarn) newWarnings.email = emailWarn;

    const phoneWarn = validateField('phone', formData.phone);
    if (phoneWarn) newWarnings.phone = phoneWarn;

    const catWarn = validateField('category', formData.category);
    if (catWarn) newWarnings.category = catWarn;

    if (formData.category === 'event-participant') {
      const compWarn = validateField('competitionId', formData.competitionId);
      if (compWarn) newWarnings.competitionId = compWarn;

      const ageWarn = validateField('ageGroupId', formData.ageGroupId);
      if (ageWarn) newWarnings.ageGroupId = ageWarn;
    }

    fields.forEach(f => {
      if (f.required && !formData.customAnswers[f.id]?.trim()) {
        newWarnings[f.id] = `${f.label} is required.`;
      }
    });

    if (Object.keys(newWarnings).length > 0) {
      setFieldWarnings(newWarnings);
      setTouchedFields({
        name: true,
        email: true,
        phone: true,
        category: true,
        competitionId: true,
        ageGroupId: true,
        photo: true,
        ...fields.reduce((acc, f) => ({ ...acc, [f.id]: true }), {})
      });
      return;
    }

    if (isRegistrationClosed) {
      setGlobalWarning(t.formClosedHeading);
      return;
    }

    setIsSubmitting(true);

    const eventIdParam = event.id || event.slug || 'default';
    const isFeeApplicable = event.pricingConfig?.isRequired && pricing.totalPrice > 0;
    const isOffline = typeof window !== 'undefined' && !navigator.onLine;

    if (isFeeApplicable && isOffline) {
      setGlobalWarning('Payment processing requires an active internet connection. Please connect to the internet to complete your ticket purchase.');
      setIsSubmitting(false);
      return;
    }

    if (isFeeApplicable) {
      try {
        const isScriptLoaded = await loadRazorpayScript();
        if (!isScriptLoaded) {
          setGlobalWarning('Payment gateway library failed to mount. Verify your internet connection.');
          setIsSubmitting(false);
          return;
        }

        const orderResponse = await fetch('/api/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: pricing.totalPrice, 
            receipt: `reg_${event?.name || 'evt'}_${Date.now()}`,
          }),
        });

        const orderData = await orderResponse.json();
        if (!orderData.success) {
          throw new Error(orderData.error || 'Backend checkout orchestration failure.');
        }

        const options = {
          key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
          amount: orderData.order.amount,
          currency: orderData.order.currency,
          name: "Mithila Aayojan",
          description: "Event Access Registration Pass",
          image: "/icons/splash-icon.png",
          order_id: orderData.order.id,
          handler: async function (response: any) {
            try {
              const eventId = await saveRegistrationRecord({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature
              });

              setIsSubmitting(false);
              setFormSubmitted(true);
              router.push(`/ticket?eventId=${encodeURIComponent(eventId)}&phone=${encodeURIComponent(formData.phone)}`);
            } catch (dbErr: any) {
              console.error("Database write failed after payment:", dbErr);
              setIsSubmitting(false);
              if (dbErr.message !== 'DUPLICATE_REGISTRATION') {
              router.push(`/ticket?eventId=${encodeURIComponent(eventIdParam)}&phone=${encodeURIComponent(formData.phone)}`);
              }
            }
          },
          prefill: {
            name: formData.name,
            email: formData.email,
            contact: formData.phone,
          },
          theme: {
            color: "#0ea5e9",
          },
          modal: {
            ondismiss: function () {
              setIsSubmitting(false);
            }
          }
        };

        const paymentWindow = new (window as any).Razorpay(options);
        paymentWindow.open();

      } catch (err: any) {
        console.error("Payment setup failure:", err);
        if (err.message !== 'DUPLICATE_REGISTRATION') {
          setGlobalWarning(err.message || "Failed to initialize checkout gateway.");
        }
        setIsSubmitting(false);
      }
    } else {
      try {
        const eventId = await saveRegistrationRecord();
        setIsSubmitting(false);
        setFormSubmitted(true);
        router.push(`/ticket?eventId=${encodeURIComponent(eventIdParam)}&phone=${encodeURIComponent(formData.phone)}`);
      } catch (dbErr: any) {
        console.error("Database write failure on free tier:", dbErr);
        setIsSubmitting(false);
      }
    }
  };

  if (isRegistrationClosed) {
    return (
      <div className="w-full text-center p-6 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-2xl space-y-4 animate-in fade-in duration-300">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-500">
          <Lock size={22} />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-amber-500">
            <CalendarX size={14} />
            <span>{t.formClosedTitle}</span>
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            {t.formClosedHeading}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
            {t.formClosedDesc} <strong className="text-slate-700 dark:text-slate-200">{cutoffDateStr}</strong>.
          </p>
        </div>

        <div className="pt-2 border-t border-amber-500/10">
          <Link
            href="/find-ticket"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 active:scale-95"
          >
            <Ticket size={14} />
            <span>{t.formFindPassBtn}</span>
          </Link>
        </div>
      </div>
    );
  }

  if (formSubmitted) {
    return (
      <div className="text-center py-10 px-4 space-y-4 animate-in zoom-in-95 duration-300">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 size={28} />
        </div>
        <div className="space-y-1.5">
          <h4 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">{t.formSubmittedHeading}</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[260px] mx-auto leading-relaxed">
            {t.formSubmittedDesc}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 w-full">
      
      {/* CORE FIELDS */}
      <div className="space-y-3">
        {/* 1. FULL NAME FIELD */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            {t.formNameLabel} <span className="text-red-400 font-bold">*</span>
          </label>
          <div className="relative group">
            <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
            <input 
              type="text" 
              required 
              placeholder={t.formNamePlaceholder} 
              value={formData.name} 
              onChange={e => {
                const val = e.target.value;
                setFormData({...formData, name: val});
                markTouchedAndValidate('name', val);
                setDuplicateError(null);
                setGlobalWarning(null);
              }} 
              onBlur={() => markTouchedAndValidate('name', formData.name)}
              className={`w-full bg-slate-50 dark:bg-white/5 border ${touchedFields.name && fieldWarnings.name ? 'border-red-500/80 dark:border-red-500/80 bg-red-50/20' : 'border-slate-200 dark:border-white/10'} rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all font-semibold text-slate-800 dark:text-white placeholder-slate-400`}
            />
          </div>
          {touchedFields.name && fieldWarnings.name && (
            <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-red-500 dark:text-red-400 animate-in fade-in duration-200">
              <AlertCircle size={12} className="shrink-0" />
              <span>{fieldWarnings.name}</span>
            </div>
          )}
        </div>

        {/* 2. EMAIL ID FIELD */}
        <div className="space-y-1">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            {t.formEmailLabel} <span className="text-red-400 font-bold">*</span>
          </label>
          <div className="relative group">
            <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
            <input 
              type="email" 
              required 
              placeholder={t.formEmailPlaceholder} 
              value={formData.email} 
              onChange={e => {
                const val = e.target.value;
                setFormData({...formData, email: val});
                markTouchedAndValidate('email', val);
                setDuplicateError(null);
                setGlobalWarning(null);
              }} 
              onBlur={() => markTouchedAndValidate('email', formData.email)}
              className={`w-full bg-slate-50 dark:bg-white/5 border ${touchedFields.email && fieldWarnings.email ? 'border-red-500/80 dark:border-red-500/80 bg-red-50/20' : 'border-slate-200 dark:border-white/10'} rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all font-semibold text-slate-800 dark:text-white placeholder-slate-400`}
            />
          </div>
          {touchedFields.email && fieldWarnings.email && (
            <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-red-500 dark:text-red-400 animate-in fade-in duration-200">
              <AlertCircle size={12} className="shrink-0" />
              <span>{fieldWarnings.email}</span>
            </div>
          )}
        </div>

        {/* 3. PHONE NUMBER FIELD (Exact 10-Digits) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500">
              {t.formPhoneLabel} <span className="text-red-400 font-bold">*</span>
            </label>
            <span className={`text-[10px] font-mono font-bold ${formData.phone.length === 10 ? 'text-emerald-500' : 'text-slate-400'}`}>
              {formData.phone.length}/10 digits
            </span>
          </div>
          <div className="relative group">
            <Phone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
            <input 
              type="tel" 
              required 
              maxLength={10}
              placeholder={t.formPhonePlaceholder} 
              value={formData.phone} 
              onChange={e => {
                const numericVal = e.target.value.replace(/\D/g, '').slice(0, 10);
                setFormData({...formData, phone: numericVal});
                markTouchedAndValidate('phone', numericVal);
                setDuplicateError(null);
                setGlobalWarning(null);
              }} 
              onBlur={() => markTouchedAndValidate('phone', formData.phone)}
              className={`w-full bg-slate-50 dark:bg-white/5 border ${touchedFields.phone && fieldWarnings.phone ? 'border-red-500/80 dark:border-red-500/80 bg-red-50/20' : 'border-slate-200 dark:border-white/10'} rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all font-semibold text-slate-800 dark:text-white placeholder-slate-400`}
            />
          </div>
          {touchedFields.phone && fieldWarnings.phone && (
            <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-red-500 dark:text-red-400 animate-in fade-in duration-200">
              <AlertCircle size={12} className="shrink-0" />
              <span>{fieldWarnings.phone}</span>
            </div>
          )}
        </div>

        {/* 📷 PARTICIPANT PHOTO CAPTURE MODULE */}
        {/*<div className="space-y-2 pt-1 border-t border-slate-100 dark:border-white/5">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1 flex items-center justify-between">
            <span>Participant Photo <span className="text-red-400 font-bold">*</span></span>
            <span className="text-[9px] lowercase opacity-75 font-normal">Passport size / Clear face</span>
          </label>

          {formData.photoBase64 && !isCameraActive && (
            <div className="relative w-28 h-28 mx-auto rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md">
              <img src={formData.photoBase64} alt="Captured Participant" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, photoBase64: null }));
                  markTouchedAndValidate('photo', null);
                }}
                className="absolute top-1.5 right-1.5 p-1 bg-red-600/90 text-white rounded-full hover:bg-red-700 transition"
              >
                <X size={12} />
              </button>
              <div className="absolute bottom-0 inset-x-0 bg-emerald-600/90 text-white text-[9px] font-bold text-center py-0.5 flex items-center justify-center gap-1">
                <CheckCircle2 size={10} /> Photo Ready
              </div>
            </div>
          )}

          {isCameraActive && (
            <div className="relative rounded-2xl overflow-hidden border border-blue-500 bg-black aspect-square max-w-[220px] mx-auto">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute bottom-2 inset-x-0 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={captureSnapshot}
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-lg hover:bg-blue-500 transition"
                >
                  Snapshot
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!formData.photoBase64 && !isCameraActive && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={startCamera}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold transition"
              >
                <Camera size={14} />
                <span>Open Camera</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <Upload size={14} />
                <span>Upload File</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          )}
          {touchedFields.photo && fieldWarnings.photo && (
            <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-red-500 dark:text-red-400 animate-in fade-in duration-200">
              <AlertCircle size={12} className="shrink-0" />
              <span>{fieldWarnings.photo}</span>
            </div>
          )}
        </div>

        {/* 4. ATTENDEE CATEGORY SELECTION */}
        <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-white/5">
          <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            {t.formCategoryLabel} <span className="text-red-400 font-bold">*</span>
          </label>
          <div className="relative group">
            <Users size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
            <select
              required
              value={formData.category}
              onChange={e => {
                const selectedCat = e.target.value as AttendeeCategory;
                setFormData({
                  ...formData, 
                  category: selectedCat,
                  competitionId: selectedCat === 'event-participant' ? formData.competitionId : '',
                  ageGroupId: selectedCat === 'event-participant' ? formData.ageGroupId : ''
                });
                markTouchedAndValidate('category', selectedCat);
                setDuplicateError(null);
                setGlobalWarning(null);
              }}
              onBlur={() => markTouchedAndValidate('category', formData.category)}
              className={`w-full bg-slate-50 dark:bg-slate-950 border ${touchedFields.category && fieldWarnings.category ? 'border-red-500/80 dark:border-red-500/80 bg-red-50/20' : 'border-slate-200 dark:border-white/10'} rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-white cursor-pointer`}
            >
              <option value="" className="text-slate-400">{t.formCategoryPlaceholder}</option>
              {ATTENDEE_CATEGORY_KEYS.filter(cat => 
                getApplicableCategoriesForType(event.type).includes(cat) &&
                PUBLIC_EXCLUSIVE_CATEGORIES.includes(cat)
              ).map(cat => (
                <option key={cat} value={cat} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                  {t.formCategories[cat]}
                </option>
              ))}
            </select>
          </div>
          {touchedFields.category && fieldWarnings.category && (
            <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-red-500 dark:text-red-400 animate-in fade-in duration-200">
              <AlertCircle size={12} className="shrink-0" />
              <span>{fieldWarnings.category}</span>
            </div>
          )}
        </div>

        {/* 5. MULTI-COMPETITION SELECTION FIELD */}
        {isMultiCompActive && formData.category === 'event-participant' && (
          <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-white/5 animate-in fade-in duration-200">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
                {t.formCompLabel} <span className="text-red-400 font-bold">*</span>
              </label>
              <div className="relative group">
                <Trophy size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                <select
                  required
                  value={formData.competitionId}
                  onChange={e => {
                    const newCompId = e.target.value;
                    setFormData({
                      ...formData, 
                      competitionId: newCompId,
                      ageGroupId: ''
                    });
                    markTouchedAndValidate('competitionId', newCompId);
                    setGlobalWarning(null);
                  }}
                  onBlur={() => markTouchedAndValidate('competitionId', formData.competitionId)}
                  disabled={isLoadingCompetitions}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border ${touchedFields.competitionId && fieldWarnings.competitionId ? 'border-red-500/80 dark:border-red-500/80 bg-red-50/20' : 'border-slate-200 dark:border-white/10'} rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-white cursor-pointer disabled:opacity-50`}
                >
                  <option value="" className="text-slate-400">
                    {isLoadingCompetitions 
                      ? t.formCompLoading 
                      : competitionsList.length === 0 
                        ? t.formCompNone 
                        : t.formCompPlaceholder}
                  </option>
                  {competitionsList.map(comp => (
                    <option key={comp.id} value={comp.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                      [{comp.code}] {comp.title} {comp.category ? `(${comp.category})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {touchedFields.competitionId && fieldWarnings.competitionId && (
                <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-red-500 dark:text-red-400 animate-in fade-in duration-200">
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{fieldWarnings.competitionId}</span>
                </div>
              )}
            </div>

            {/* 6. DYNAMIC NESTED AGE CATEGORY SELECTION FIELD */}
            {availableAgeGroups.length > 0 && (
              <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1 flex items-center justify-between">
                  <span>{t.formAgeGroupLabel} <span className="text-red-400 font-bold">*</span></span>
                  <span className="text-[9px] lowercase opacity-75 font-normal">({availableAgeGroups.length} {t.formBracketsAvailable})</span>
                </label>
                <div className="relative group">
                  <Layers size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                  <select
                    required
                    value={formData.ageGroupId}
                    onChange={e => {
                      const ageId = e.target.value;
                      setFormData({...formData, ageGroupId: ageId});
                      markTouchedAndValidate('ageGroupId', ageId);
                      setGlobalWarning(null);
                    }}
                    onBlur={() => markTouchedAndValidate('ageGroupId', formData.ageGroupId)}
                    className={`w-full bg-slate-50 dark:bg-slate-950 border ${touchedFields.ageGroupId && fieldWarnings.ageGroupId ? 'border-red-500/80 dark:border-red-500/80 bg-red-50/20' : 'border-slate-200 dark:border-white/10'} rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-white cursor-pointer`}
                  >
                    <option value="" className="text-slate-400">{t.formAgeGroupPlaceholder}</option>
                    {availableAgeGroups.map(grp => (
                      <option key={grp.id} value={grp.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white">
                        {grp.label} ({formatAgeBadgeText(grp.minAge, grp.maxAge)}) [{grp.code}]
                      </option>
                    ))}
                  </select>
                </div>
                {touchedFields.ageGroupId && fieldWarnings.ageGroupId && (
                  <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-red-500 dark:text-red-400 animate-in fade-in duration-200">
                    <AlertCircle size={12} className="shrink-0" />
                    <span>{fieldWarnings.ageGroupId}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
                  onChange={e => handleCustomChange(field.id, e.target.value, field.required)}
                  onBlur={() => handleCustomChange(field.id, formData.customAnswers[field.id] || '', field.required)}
                  className={`w-full bg-slate-50 dark:bg-slate-950 border ${touchedFields[field.id] && fieldWarnings[field.id] ? 'border-red-500/80 dark:border-red-500/80 bg-red-50/20' : 'border-slate-200 dark:border-white/10'} rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all font-semibold text-slate-800 dark:text-white cursor-pointer`}
                >
                  <option value="" className="text-slate-400">{t.customFields.selectPlaceholder}</option>
                  {field.options?.map(opt => (
                    <option key={opt.value} value={opt.value} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">{opt.label}</option>
                  ))}
                </select>
              ) : (
                <input 
                  type="text" 
                  required={field.required}
                  placeholder={`${t.customFields.inputPlaceholder} ${field.label.toLowerCase()}...`}
                  value={formData.customAnswers[field.id] || ''}
                  onChange={e => handleCustomChange(field.id, e.target.value, field.required)}
                  onBlur={() => handleCustomChange(field.id, formData.customAnswers[field.id] || '', field.required)}
                  className={`w-full bg-slate-50 dark:bg-white/5 border ${touchedFields[field.id] && fieldWarnings[field.id] ? 'border-red-500/80 dark:border-red-500/80 bg-red-50/20' : 'border-slate-200 dark:border-white/10'} rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-transparent transition-all font-semibold text-slate-800 dark:text-white placeholder-slate-400`} 
                />
              )}
              {touchedFields[field.id] && fieldWarnings[field.id] && (
                <div className="flex items-center gap-1.5 px-1 pt-0.5 text-[11px] font-semibold text-red-500 dark:text-red-400 animate-in fade-in duration-200">
                  <AlertCircle size={12} className="shrink-0" />
                  <span>{fieldWarnings[field.id]}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DYNAMIC REGISTRATION FEE COMPUTATION SUMMARY */}
      {event.pricingConfig?.isRequired && (
        <div className="pt-3 border-t border-dashed border-slate-200 dark:border-white/10 space-y-2 animate-in fade-in duration-300">
          <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 dark:text-slate-500 ml-1">
            {t.formTicketSummary}
          </span>
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] text-xs space-y-1 text-slate-600 dark:text-slate-400 font-semibold">
            {event.pricingConfig.applicableForAll === 'no' && !formData.category ? (
              <p className="text-[11px] text-amber-500 italic font-medium">{t.formSelectCategoryToCalculate}</p>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <span>{t.formBasePrice}</span>
                  <span className="font-bold text-slate-800 dark:text-white">₹{pricing.basePrice}</span>
                </div>
                {event.pricingConfig.gstApplicable && (
                  <div className="flex justify-between items-center text-[11px] text-slate-400">
                    <span>{t.formGst}</span>
                    <span>₹{pricing.gstAmount}</span>
                  </div>
                )}
                <div className="flex justify-between items-center border-t border-slate-200 dark:border-white/10 pt-1.5 mt-1 text-slate-900 dark:text-white font-black">
                  <span className="flex items-center gap-0.5"><IndianRupee size={12} /> {t.formPayableAmount}</span>
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
            <span>{t.formProcessing}</span>
          </>
        ) : (
          <>
            <span>
              {pricing.totalPrice > 0 ? `₹${pricing.totalPrice} ${t.formPayAndRegBtn}` : t.formFreeRegBtn}
            </span>
            <Send size={12} className="text-white/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </>
        )}
      </button>

      {/* 🔴 GLOBAL/DUPLICATE WARNINGS BELOW BUTTON */}
      <div className="space-y-3 pt-1">
        {/* 1. DUPLICATE REGISTRATION WARNING BOX */}
        {duplicateError && (
          <div className="p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex items-start gap-3 text-red-600 dark:text-red-400">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider">{t.formDuplicateTitle}</h4>
                <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-300 font-medium">
                  {duplicateError.message}
                </p>
              </div>
            </div>
            <div className="pt-2 border-t border-red-500/20 flex justify-end">
              <Link
                href={`/find-ticket?query=${duplicateError.queryParam}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-red-600/20 active:scale-95"
              >
                <Ticket size={13} />
                <span>{t.formDuplicateBtn}</span>
              </Link>
            </div>
          </div>
        )}

        {/* 2. OPERATIONAL / SYSTEM WARNING MESSAGE BOX */}
        {globalWarning && (
          <div className="p-3.5 bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/30 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 leading-relaxed">
              {globalWarning}
            </div>
          </div>
        )}
      </div>
    </form>
  );
}