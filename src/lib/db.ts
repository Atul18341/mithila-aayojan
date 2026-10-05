// lib/db.ts
import Dexie, { Table } from 'dexie';

// Unified Attendee Category Definitions matching form matrices
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

// 🟢 Multi-Day Event Itinerary Schedule Definition
export interface EventDaySchedule {
  id: string;
  dayNumber: number;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  description?: string;
}

export const getApplicableCategoriesForType = (eventType: string): AttendeeCategory[] => {
  switch (eventType) {
    case 'conference':
    case 'summit':
      return ['patron', 'dignitary', 'vip', 'sponsor', 'speaker', 'delegate', 'exhibitor', 'ops-team', 'general-public'];
    case 'workshop':
    case 'training':
      return ['speaker', 'trainee', 'ops-team'];
    case 'event': 
      return ['patron', 'dignitary', 'vip', 'sponsor', 'artisan', 'general-public', 'event-participant', 'ops-team'];
    case 'celebration':
    case 'private-party':
      return ['dignitary', 'vip', 'general-public', 'ops-team'];
    default:
      return ['general-public'];
  }
};

export interface Events {
  id?: number;
  name: string;
  type: 'conference' | 'trade-show' | 'workshop' | 'training' | 'event' | 'fundraiser' | 'celebration' | 'private-party' | string;
  protocol: 'invite-only' | 'open-registration' | 'ticketed';
  slug: string;
  status: 'draft' | 'published' | 'unpublished';
  isCountPublic?: boolean;
  hypeThreshold: number;
  createdAt: number;
  syncStatus: 'synced' | 'pending';
  date?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  
  // 🟢 Multi-Day Event Configuration Parameters
  isMultiDay?: boolean; 
  daySchedules?: EventDaySchedule[];

  registrationEndDate?: string;
  registration_end_date?: string; 
  location?: string;
  tagline?: string;
  description?: string;
  venueName?: string;
  venue_name?: string;

  whatsappNumber?: string;
  whatsapp_number?: string;
  helplineNumber?: string;
  helpline_number?: string;

  organizerId?: number | null;
  organizerName?: string;
  organizerEmail?: string;

  coverBlob: Blob | null; 
  posterBlob: Blob | null;
  coverImageUrl?: string;
  posterImageUrl?: string;
  isMultiCompetition?: boolean; 
  competitions?: SubCompetition[]; 
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
}

export interface EventRegistration {
  id?: number;                         
  registrationId: string;              
  eventId: string | number;            
  name: string;                        
  email: string;                       
  phone: string;                       
  category: AttendeeCategory;          
  
  competitionId?: string | null;       
  competitionTitle?: string | null;    
  ageGroupId?: string | null;          
  ageGroupLabel?: string | null;       

  isAgeVerified?: boolean;             
  verifiedAge?: number | null;         

  customAnswers: Record<string, any>;  
  basePrice: number;                   
  gstAmount: number;                   
  totalPrice: number;                  
  paymentId?: string;                  
  orderId?: string | null;             
  status: string;                      
  syncStatus: string;                  
  registrationTimestamp: number;       
}

export interface Guest {
  id?: number;                          
  guestId: string;                      
  registrationId: string;               
  eventId: string | number;             
  
  name: string;                         
  email?: string | null;                
  phone?: string | null;                
  category: AttendeeCategory | string;  
  
  competitionId?: string | null;       
  competitionTitle?: string | null;    
  ageGroupId?: string | null;          
  ageGroupLabel?: string | null;       
  isAgeVerified?: boolean;             
  verifiedAge?: number | null;         
  customAnswers?: Record<string, any>; 

  qrToken: string;                      
  qr_token?: string | null;             
  
  // Single-Day Check-in Operations
  isCheckedIn: boolean;                 
  checkInTime?: number | null;          
  
  // Single-Day Catering Logistics
  hasFoodAccess?: boolean;              
  hasFoodClaimed?: boolean;             
  foodClaimedTime?: number | null;      
  
  // 🟢 Multi-Day Event Operational Tracking Maps (Day Number -> Timestamp)
  dayCheckIns?: Record<number, number>; 
  day_check_ins?: Record<number, number>;
  dayFoodClaims?: Record<number, number>;
  day_food_claims?: Record<number, number>;
  
  amountPaid?: number | null;           
  syncStatus: string;                   
  registeredAt: number;                 
}

export interface SessionUser {
  id?: number;
  identifier: string;    
  name: string;
  passkey: string | '';
  role: 'manager' | 'volunteer';
  activeEventId: number;
  token: string;          
  cachedAt: number; 
  syncStatus: 'synced' | 'pending';
}

export interface ManagerEvents {
  id?: number;
  managerIdentifier: string;
  eventId: number;
  assignedAt: number;
  assignedDesk?: 'REGISTRATION' | 'CHECK_IN' | 'FOOD_CLAIM' | 'ALL';
  syncStatus: 'synced' | 'pending';
}

export interface InstallationLog {
  id?: number;
  eventId?: number | null;
  isStandalone: boolean;      
  installedAt: number;        
  userAgent: string;          
  syncStatus: 'pending' | 'synced'; 
}

export class AayojanDB extends Dexie {
  events!: Table<Events>;
  guests!: Table<Guest>;
  users!: Table<SessionUser>;
  managerEvents!: Table<ManagerEvents>;
  eventRegistrations!: Table<EventRegistration>; 
  installations!: Table<InstallationLog>;
  
  constructor() {
    super('MithilaAayojanDB'); 
    this.version(10).stores({
      events: '++id, slug, type, status, organizerId, isMultiCompetition, registrationEndDate, whatsapp_number, helpline_number, createdAt, syncStatus', 
      guests: '++id, guestId, registrationId, eventId, qrToken, qr_token, phone, email, isCheckedIn, syncStatus', 
      users: '++id, email, identifier, role, activeEventId, syncStatus', 
      managerEvents: '++id, [managerIdentifier+eventId], managerIdentifier, eventId, assignedDesk, syncStatus', 
      eventRegistrations: '++id, registrationId, eventId, email, phone, category, competitionId, ageGroupId, status, syncStatus', 
      installations: '++id, eventId, isStandalone, syncStatus'
    });
  }
}

export const db = new AayojanDB();