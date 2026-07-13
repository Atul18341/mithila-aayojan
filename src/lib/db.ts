// lib/db.ts
import Dexie, { Table } from 'dexie';

// Unified Attendee Category Definitions matching form matrices
export type AttendeeCategory = 
 | 'patron' 
  | 'dignitary'
  | 'vip'
  | 'sponsor' // 🚀 Dedicated commercial partner pass tracking
  | 'speaker' 
  | 'artisan' 
  | 'delegate' 
  | 'trainee' 
  | 'exhibitor' 
  | 'general-public' 
  | 'ops-team';
// Shared taxonomy filter rule
export const getApplicableCategoriesForType = (eventType: string): AttendeeCategory[] => {
  switch (eventType) {
    case 'conference':
    case 'summit':
      // Corporate pipelines map distinct corporate sponsors alongside invite-only VIPs
      return ['patron', 'dignitary', 'vip', 'sponsor', 'speaker', 'delegate', 'exhibitor', 'ops-team','general-public'];
    case 'workshop':
    case 'training':
      // Knowledge tracks collapse commercial tiers to focus purely on trainers and scholars
      return ['speaker', 'trainee', 'ops-team'];
    case 'event': // Sanwaad / Cultural Festivals
      // Decentralized community festivals map patrons, official VIP guests, and corporate sponsors explicitly
      return ['patron', 'dignitary', 'vip', 'sponsor', 'artisan', 'general-public', 'ops-team'];
    case 'celebration':
    case 'private-party':
      // Social events strip all corporate business layers (exhibitors, sponsors, speakers)
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
  startTime?: string; // 🚀 ADDED: Event Temporal Window bounds
  endTime?: string;   // 🚀 ADDED: Event Temporal Window bounds
  location?: string;
  tagline?: string;
  description?: string;
  venueName?: string;
  coverBlob: Blob | null; 
  posterBlob: Blob | null;
  coverImageUrl?: string;
  posterImageUrl?: string;
  visibility?: {
    map: boolean;
    rsvp: boolean;
    schedule: boolean;
    gallery: boolean;
  };
  // 🚀 ADDED: Comprehensive Catering & Food Operational Parameters
  foodConfig?: {
    enabled: boolean;
    strategy: 'complimentary' | 'coupon-based' | 'paid-buffet' | 'self-arranged';
    vendorDetails: string;
    availableForAll: 'yes' | 'no';
    allowedCategories: AttendeeCategory[];
  };
  // 🚀 ADDED: Category Pricing Logic and Statutory Engines
  pricingConfig?: {
    isRequired: boolean;
    baseFee: number;
    gstApplicable: boolean;
    applicableForAll: 'yes' | 'no';
    categoryFees: Record<AttendeeCategory, number>;
  };
}

export interface Guest {
  id?: number;
  eventId: number;
  name: string;
  email?: string;       // 🚀 ADDED: Associated contact parameters for school/summit logs
  phone?: string;       // 🚀 ADDED: Associated contact parameters for school/summit logs
  qrToken: string;
  type: 'vip' | 'speaker' | 'delegate' | 'organizer' | 'volunteer' | AttendeeCategory; // 🚀 EXTENDED: Support new attendee profiles seamlessly
  isCheckedIn: number;  // 0 or 1 for easy syncing
  syncStatus: 'synced' | 'pending';
  checkInTime?: number;
  amountPaid?: number;  // 🚀 ADDED: Tracks resolved booking tokens at gate scan endpoints
  hasFoodAccess?: number; // 🚀 ADDED: Quick 0/1 binary flag for local network check checks
}

export interface SessionUser {
  id?: number;
  identifier: string;    // e.g., "gate1@lyss.in"
  name: string;
  passkey: string | '';
  role: 'manager' | 'volunteer';
  activeEventId: number;
  token: string;          // Encrypted JWT session string returned by the server
  cachedAt: number; 
  syncStatus: 'synced' | 'pending';
}

export interface ManagerEvents {
  id?: number;
  managerIdentifier: string;
  eventId: number;
  syncStatus: 'synced' | 'pending';
}

// 🚀 REGISTERED NEW SEPARATE INTERFACE FOR PUBLIC REGISTRATION FLOW DETAILS
export interface EventRegistration {
  id?: number;
  eventId: number;
  name: string;
  email: string;
  phone: string;
  category: AttendeeCategory; // 🚀 Category selector routing
  customAnswers: Record<string, any>; // 🚀 Holds dynamic schema-driven form logs (e.g. company, laptop)
  basePrice: number;
  gstAmount: number;
  totalPrice: number;
  registrationTimestamp: number;
  status: 'pending' | 'approved' | 'ticketed' | 'waitlisted';
  syncStatus: 'synced' | 'pending';
}

export class AayojanDB extends Dexie {
  events!: Table<Events>;
  guests!: Table<Guest>;
  users!: Table<SessionUser>;
  managerEvents!: Table<ManagerEvents>;
  eventRegistrations!: Table<EventRegistration>; // 🚀 REGISTERED NEW ENTRY TABLE EXPLICITLY

  constructor() {
    super('MithilaAayojanDB');
    // Bumped database version state layer to clean internal store layouts
    this.version(3).stores({
      events: '++id, slug, type, status, createdAt, syncStatus',
      guests: '++id, eventId, qrToken, type, isCheckedIn, syncStatus',
      users: '++id, identifier, role, syncStatus',
      managerEvents: '++id, [managerIdentifier+eventId], managerIdentifier, eventId, syncStatus',
      eventRegistrations: '++id, eventId, email, category, status, syncStatus' // 🚀 Added lookups
    });
  }
}

export const db = new AayojanDB();