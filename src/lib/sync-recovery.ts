import { db } from '@/lib/db';

export async function hydrateDeviceFromCloud(managerEmail: string) {
  try {
    console.log(`🔄 Initiating workspace recovery sequence for: ${managerEmail}...`);
    
    const response = await fetch(`/api/sync/pull?managerEmail=${encodeURIComponent(managerEmail)}`);
    if (!response.ok) throw new Error('Cloud database rejected the recovery sync request.');

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Unknown sync error');

    // 🟢 Extract eventRegistrations alongside events, guests, managerEvents, and users
    const { 
      events = [], 
      guests = [], 
      eventRegistrations = [], 
      managerEvents = [], 
      users = [] 
    } = result.data || result;

    const normalizedManagerEmail = managerEmail.toLowerCase();

    // 🚀 ATOMIC CLIENT HYDRATION TRANSACTION (Added db.eventRegistrations)
    await db.transaction('rw', [db.events, db.guests, db.eventRegistrations, db.managerEvents, db.users], async () => {
      
      // 1. Clear out staging tables that don't hold persistent session state
      await db.events.clear();
      await db.guests.clear();
      await db.eventRegistrations.clear(); // 🟢 Clear stale event registrations
      await db.managerEvents.clear();

      // 🟢 2. PRESERVE ACTIVE MANAGER SESSION & PRUNE STALE VOLUNTEERS
      await db.users
        .filter(u => {
          const uEmail = (u.identifier || '').toLowerCase();
          return uEmail !== normalizedManagerEmail;
        })
        .delete();

      // 3. Hydrate Local Events Store
      for (const ev of events) {
        await db.events.put({
          id: Number(ev.id),
          name: ev.name,
          type: ev.type || 'conference',
          protocol: ev.protocol || 'ticketed',
          slug: ev.slug,
          status: ev.status || 'draft',
          date: ev.date || '',
          startTime: ev.startTime || '',
          endTime: ev.endTime || '',
          registrationEndDate: ev.registrationEndDate || ev.registration_end_date || '',
          location: ev.location || '',
          tagline: ev.tagline || '',
          description: ev.description || '',
          venueName: ev.venueName || '',
          hypeThreshold: Number(ev.hypeThreshold || 0),
          isMultiCompetition: Boolean(ev.isMultiCompetition),
          competitions: Array.isArray(ev.competitions) ? ev.competitions : [],
          visibility: ev.visibility || {
            map: true,
            rsvp: true,
            schedule: true,
            gallery: false,
          },
          foodConfig: ev.foodConfig || {
            enabled: false,
            strategy: 'complimentary',
            vendorDetails: '',
            availableForAll: 'yes',
            allowedCategories: []
          },
          pricingConfig: ev.pricingConfig || {
            isRequired: false,
            baseFee: 0,
            gstApplicable: false,
            applicableForAll: 'yes',
            categoryFees: {}
          },
          coverBlob: null,
          posterBlob: null,
          coverImageUrl: ev.cover_image || ev.coverImageUrl || null,
          posterImageUrl: ev.poster_image || ev.posterImageUrl || null,
          createdAt: ev.createdAt || Date.now(),
          syncStatus: 'synced',
        } as any);
      }

      // 4. Hydrate Local Manager Events Junction Links
      for (const link of managerEvents) {
        await db.managerEvents.add({
          managerIdentifier: (link.managerIdentifier || link.manager_identifier || '').toLowerCase(),
          eventId: Number(link.eventId || link.event_id),
          assignedDesk: link.assignedDesk || link.assigned_desk || 'CHECK_IN',
          assignedAt: link.assignedAt || link.assigned_at || Date.now(),
          syncStatus: 'synced'
        });
      }

      // 5. HYDRATE VOLUNTEERS & USERS STORE ALONGSIDE MANAGER ROW
      for (const usr of users) {
        const userEmail = (usr.email || usr.identifier || '').toLowerCase();
        if (!userEmail) continue;

        const existingUser = await db.users
          .filter(u => (u.identifier === userEmail))
          .first();

        if (existingUser && existingUser.id) {
          await db.users.update(existingUser.id, {
            name: usr.name || existingUser.name,
            role: usr.role || existingUser.role,
            activeEventId: usr.activeEventId ? Number(usr.activeEventId) : existingUser.activeEventId,
            syncStatus: 'synced'
          } as any);
        } else {
          await db.users.add({
            name: usr.name || userEmail.split('@')[0],
            identifier: userEmail,
            role: usr.role || 'volunteer',
            activeEventId: usr.activeEventId ? Number(usr.activeEventId) : undefined,
            syncStatus: 'synced'
          } as any);
        }
      }

      // 6. Hydrate Local Guests Store
      for (const gst of guests) {
        await db.guests.put({
          id: Number(gst.id),
          guestId: gst.guestId || `GUEST-${gst.id}`,
          registrationId: gst.registrationId || `REG-${gst.id}`,
          eventId: Number(gst.eventId),
          name: gst.name,
          email: gst.email || '',
          phone: gst.phone || '',
          category: gst.category || 'general-public',
          type: gst.category || gst.type || 'general-public',
          competitionTitle: gst.competitionTitle || null,
          ageGroupLabel: gst.ageGroupLabel || null,
          qrToken: gst.qrToken || '',
          isCheckedIn: Boolean(gst.isCheckedIn),
          checkInTime: gst.checkInTime ? Number(gst.checkInTime) : undefined,
          hasFoodAccess: Boolean(gst.hasFoodAccess),
          hasFoodClaimed: Boolean(gst.hasFoodClaimed),
          foodClaimedTime: gst.foodClaimedTime ? Number(gst.foodClaimedTime) : undefined,
          amountPaid: Number(gst.amountPaid || 0),
          registeredAt: gst.registeredAt || Date.now(),
          syncStatus: 'synced',
        } as any);
      }

      // 🟢 7. Hydrate Local Event Registrations Store
      for (const reg of eventRegistrations) {
        await db.eventRegistrations.put({
          id: Number(reg.id),
          registrationId: reg.registrationId || `REG-${reg.id}`,
          eventId: Number(reg.eventId),
          name: reg.name || reg.attendeeName || '',
          email: reg.email || '',
          phone: reg.phone || '',
          category: reg.category || reg.ticketType || 'general-public',
          
          // Competition & Age Group Identification
          competitionId: reg.competitionId || null,
          competitionTitle: reg.competitionTitle || null,
          ageGroupId: reg.ageGroupId || null,
          ageGroupLabel: reg.ageGroupLabel || null,
          
          // Verified Age Metadata
          isAgeVerified: Boolean(reg.isAgeVerified),
          verifiedAge: reg.verifiedAge !== null && reg.verifiedAge !== undefined ? Number(reg.verifiedAge) : null,

          customAnswers: typeof reg.customAnswers === 'string' ? JSON.parse(reg.customAnswers) : (reg.customAnswers || {}),
          basePrice: parseFloat(reg.basePrice || 0),
          gstAmount: parseFloat(reg.gstAmount || 0),
          totalPrice: parseFloat(reg.totalPrice || reg.amountPaid || 0),
          paymentId: reg.paymentId || 'FREE_ENTRY',
          orderId: reg.orderId || null,
          status: reg.status || 'CONFIRMED',
          syncStatus: 'synced',
          registrationTimestamp: reg.registrationTimestamp || reg.registeredAt || Date.now()
        } as any);
      }
    });

    console.log('✅ Workspace state local hydration execution successfully complete (events, guests, registrations, manager sessions & volunteers populated).');
    return true;

  } catch (error) {
    console.error('❌ Local hydration crash:', error);
    throw error;
  }
}