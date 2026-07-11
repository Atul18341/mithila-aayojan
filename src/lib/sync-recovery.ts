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
            id: Number(ev.id), // Ensure structural strictness as integer key
            name: ev.name,
            type: ev.type,
            protocol: ev.protocol,
            slug: ev.slug,
            status: ev.status,
            date: ev.date,
            location: ev.location,
            description: ev.description,
            venueName: ev.venueName,
            createdAt: new Date(ev.created_at).getTime(),
            syncStatus: 'synced', // Explicitly mark as synced
            
            // 🚀 FIXED: Add the required properties from the Events interface
            hypeThreshold: ev.hype_threshold !== undefined ? Number(ev.hype_threshold) : 0,
            isCountPublic: ev.is_count_public !== undefined ? Boolean(ev.is_count_public) : true,
            visibility: ev.visibility || {
            map: true,
            rsvp: true,
            schedule: true,
            gallery: true
            }
  });
      }

      // 3. Hydrate Local Junction Link Indexes
      for (const link of managerEvents) {
        await db.managerEvents.add({
          managerIdentifier: link.manager_identifier,
          eventId: Number(link.event_id),
          syncStatus: 'synced'
        });
      }

      // 4. Hydrate Local Guests Store
      for (const gst of guests) {
        await db.guests.add({
          id: Number(gst.id),
          eventId: Number(gst.event_id),
          name: gst.name,
          type: gst.type,
          qrToken: gst.qr_token,
          isCheckedIn: gst.check_in_time ? 1 : 0,
          checkInTime: gst.check_in_time ? new Date(gst.check_in_time).getTime() : undefined,
          syncStatus: 'synced'
        });
      }
    });

    console.log('✅ Workspace state local hydration execution successfully complete.');
    return true;

  } catch (error) {
    console.error('❌ Local hydration crash:', error);
    throw error;
  }
}