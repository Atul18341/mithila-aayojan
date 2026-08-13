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
  | 'event-participant'
  | 'ops-team';

export interface SubCompetition {
  id: string;
  title: string;
  code: string;
  category?: string;
}

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
      return ['patron', 'dignitary', 'vip', 'sponsor', 'artisan', 'general-public', 'event-participant','ops-team'];
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
  registrationEndDate?: string; 
  location?: string;
  tagline?: string;
  description?: string;
  venueName?: string;

  // 🟢 ORGANIZER USER RELATION (Session Metadata)
  organizerId?: number | null;
  organizerName?: string;
  organizerEmail?: string;

  coverBlob: Blob | null; 
  posterBlob: Blob | null;
  coverImageUrl?: string;
  posterImageUrl?: string;
  isMultiCompetition?: boolean; // 🟢 Multi-Competition Flag
  competitions?: SubCompetition[]; // 🟢 Multi-Competition Array Storage
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
  // Primary Keys & Linking
  id?: number;                          // Dexie local auto-increment primary key
  guestId: string;                      // Public unique key (e.g. 'GUEST-1753456800000')
  registrationId: string;               // Foreign Key linking back to eventRegistration table[cite: 9]
  eventId: string | number;             // Associated Event ID[cite: 9]
  
  // Attendee Core Profile
  name: string;                         //[cite: 9]
  email?: string;                       // Optional contact details[cite: 9]
  phone?: string;                       // Optional contact details[cite: 9]
  category: AttendeeCategory | string;  // Category clearance (VIP, Speaker, Delegate, etc.)[cite: 9]
  
  // Gate Security & QR Verification
  qrToken: string;                      // Encrypted or unique QR payload string
  // Check-In Operations
  isCheckedIn: boolean;                 // Entrance status flag[cite: 9]
  checkInTime?: number;                 // Numeric timestamp (Date.now())
  // Catering & Lounge Logistics
  hasFoodAccess: boolean;               // Entitlement flag for meals
  hasFoodClaimed: boolean;              // Claimed status flag
  foodClaimedTime?: number;             // Timestamp when food was claimed
  // Sync & Financial Metadata
  amountPaid?: number;                  // Verified booking fee at gate scan endpoints[cite: 9]
  syncStatus: string;                   // Sync status for offline-first operation
  registeredAt: number;                 // Registration timestamp (Date.now())
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
  assignedAt: number;
  assignedDesk?: 'CHECK_IN' | 'FOOD_CLAIM' | 'ALL';
  syncStatus: 'synced' | 'pending';
}

// 🚀 REGISTERED NEW SEPARATE INTERFACE FOR PUBLIC REGISTRATION FLOW DETAILS
export interface EventRegistration {
  // Primary Keys & Identifiers
  id?: number;                         // Local Dexie auto-increment ID
  registrationId: string;              // Public unique pass ID (e.g., 'REG-982314')
  eventId: string | number;            // Associated Event ID
  // Attendee Core Profile
  name: string;
  email: string;
  phone: string;
  category: AttendeeCategory;
  competitionId?: string | null;       // 🟢 Stores selected sub-competition ID
  competitionTitle?: string | null;    // 🟢 Stores selected sub-competition title
  customAnswers: Record<string, any>;
  // Financial Audit Breakdown
  basePrice: number;
  gstAmount: number;
  totalPrice: number;
  // Gateway Payment Verification
  paymentId?: string;                  // Razorpay payment ID (or 'FREE_ENTRY')
  orderId?: string | null;             // Razorpay order ID
  // System Lifecycle & Sync Metadata
  status: string;
  syncStatus: string;
  registrationTimestamp: number;       // Date.now()
}

export class AayojanDB extends Dexie {
  events!: Table<Events>;
  guests!: Table<Guest>;
  users!: Table<SessionUser>;
  managerEvents!: Table<ManagerEvents>;
  eventRegistrations!: Table<EventRegistration>; // 🚀 REGISTERED NEW ENTRY TABLE EXPLICITLY[cite: 9]

  constructor() {
    super('MithilaAayojanDB');
    // Bumped database version state layer to clean internal store layouts[cite: 9]
    this.version(7).stores({
      events: '++id, slug, type, status, organizerId, isMultiCompetition, registrationEndDate, createdAt, syncStatus',
      guests: '++id, guestId, registrationId, eventId, qrToken, qr_token, phone, email, isCheckedIn, syncStatus',
      users: '++id, email, identifier, role, activeEventId, syncStatus',
      managerEvents: '++id, [managerIdentifier+eventId], managerIdentifier, eventId, assignedDesk, syncStatus',
      eventRegistrations: '++id, eventId, email, category, competitionId, status, syncStatus'
    });
  }
}

export const db = new AayojanDB();