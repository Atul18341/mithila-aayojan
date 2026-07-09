// lib/db.ts
import Dexie, { Table } from 'dexie';

export interface Events {
  id?: number;
  name: string;
  type: 'conference' | 'summit' | 'event' | 'workshop' | 'celebration';
  protocol: 'invite-only' | 'open-registration' | 'ticketed';
  slug: string;
  status: 'draft' | 'published' |'unpublished';
  isCountPublic?: boolean;
  hypeThreshold: number;
  createdAt: number;
  syncStatus: 'synced' | 'pending';
  // --- ADD THESE NEW FIELDS ---
  date?: string;
  location?: string;
  tagline?: string;
  description?: string;
  venueName?: string;
  visibility?: {
    map: boolean;
    rsvp: boolean;
    schedule: boolean;
    gallery: boolean;
  };
}
export interface Guest {
  id?: number;
  eventId: number;
  name: string;
  qrToken: string;
  type: 'vip' | 'speaker' | 'delegate' | 'organizer';
  isCheckedIn: number; // 0 or 1 for easy syncing
  syncStatus: 'synced' | 'pending';
  checkInTime?: number;
  
}
export interface SessionUser {
  id?: number;
  identifier: string;    // e.g., "gate1@lyss.in"
  name: string;
  passkey:string;
  role: 'manager' | 'volunteer';
  assignedEventId: number;
  token: string;          // Encrypted JWT session string returned by the server
  cachedAt: number;  
  syncStatus: 'synced' | 'pending';     // Epoch timestamp to check for local session expiration
}
export class AayojanDB extends Dexie {
  events!: Table<Events>;
  guests!: Table<Guest>;
  users!: Table<SessionUser>;

  constructor() {
    super('MithilaAayojanDB');
    this.version(2).stores({
     events: '++id, slug, type, status, createdAt,syncStatus',
      guests: '++id, eventId, qrToken, type, checkInTime,syncStatus',
      users: '++id, identifier, role, assignedEventId,syncStatus',
    });
  }
}

export const db = new AayojanDB();