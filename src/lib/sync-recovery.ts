import { db } from '@/lib/db';

export async function hydrateDeviceFromCloud(managerEmail: string) {
  try {
    console.log(`🔄 Initiating workspace recovery sequence for: ${managerEmail}...`);
    
    const response = await fetch(`/api/sync/pull?managerEmail=${encodeURIComponent(managerEmail)}`);
    if (!response.ok) throw new Error('Cloud database rejected the recovery sync request.');

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Unknown sync error');

    const { events, guests, managerEvents } = result.data;

    // 🚀 ATOMIC CLIENT HYDRATION TRANSACTION
    await db.transaction('rw', [db.events, db.guests, db.managerEvents], async () => {
      
      // 1. Clear out any residual staging data to avoid key collisions
      await db.events.clear();
      await db.guests.clear();
      await db.managerEvents.clear();

      // 2. Hydrate Local Events Store
      for (const ev of events) {
        await db.events.add({
          id: Number(ev.id),
          name: ev.name,
          type: ev.type || 'conference',
          protocol: ev.protocol || 'ticketed',
          slug: ev.slug,
          status: ev.status || 'draft',
          date: ev.date || '',
          startTime: ev.startTime || '',
          endTime: ev.endTime || '',
          location: ev.location || '',
          tagline: ev.tagline || '',
          description: ev.description || '',
          venueName: ev.venueName || '',
          hypeThreshold: Number(ev.hypeThreshold || 0),
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
          createdAt: ev.createdAt || Date.now(),
          syncStatus: 'synced', // Explicitly mark as synced
        } as any);
      }

      // 3. Hydrate Local Manager Events Junction Links
      for (const link of managerEvents) {
        await db.managerEvents.add({
          managerIdentifier: link.managerIdentifier || link.manager_identifier,
          eventId: Number(link.eventId || link.event_id),
          assignedAt:Date.now(),
          syncStatus: 'synced'
        });
      }

      // 4. Hydrate Local Guests Store
      for (const gst of guests) {
        await db.guests.add({
          id: Number(gst.id),
          guestId: gst.guestId || `GUEST-${gst.id}`,
          registrationId: gst.registrationId || `REG-${gst.id}`,
          eventId: Number(gst.eventId), // 🟢 Fixed: Correctly maps eventId instead of gst.id
          name: gst.name,
          email: gst.email || '',
          phone: gst.phone || '',
          category: gst.category || 'general-public',
          type: gst.category || gst.type || 'general-public',
          qrToken: gst.qrToken || '', // 🟢 Standardized QR token mapping
          isCheckedIn: Boolean(gst.isCheckedIn),
          checkInTime: gst.checkInTime ? Number(gst.checkInTime) : undefined,
          hasFoodAccess: Boolean(gst.hasFoodAccess),
          hasFoodClaimed: Boolean(gst.hasFoodClaimed),
          amountPaid: Number(gst.amountPaid || 0),
          registeredAt: gst.registeredAt || Date.now(),
          syncStatus: 'synced', // Explicitly mark as synced
        } as any);
      }
    });

    console.log('✅ Workspace state local hydration execution successfully complete.');
    return true;

  } catch (error) {
    console.error('❌ Local hydration crash:', error);
    throw error;
  }
}