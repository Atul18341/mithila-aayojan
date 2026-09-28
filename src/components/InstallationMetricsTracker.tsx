// src/components/InstallMetricsTracker.tsx
'use client';

import { useEffect } from 'react';
import { db } from '../lib/db';

export default function InstallMetricsTracker({ eventId }: { eventId?: number | null }) {
  useEffect(() => {
    async function recordInstallationMetric() {
      try {
        if (!db.isOpen()) await db.open();

        // Check if running as installed PWA (Standalone mode)
        const isStandalone = 
          window.matchMedia('(display-mode: standalone)').matches || 
          (window.navigator as any).standalone === true;

        const userAgent = navigator.userAgent;
        const timestamp = Date.now();

        // Prevent duplicate logging in the same session
        const sessionLogged = sessionStorage.getItem('lyss_install_metric_logged');
        if (sessionLogged) return;

        // Save metric record locally in Dexie
        await db.table('installations').add({
          eventId: eventId || null,
          isStandalone,
          installedAt: timestamp,
          userAgent,
          syncStatus: 'pending'
        });

        sessionStorage.setItem('lyss_install_metric_logged', 'true');
        console.log(`📊 Installation Metric Recorded: Standalone Mode = ${isStandalone}`);
      } catch (err) {
        console.error('Failed to record installation metric:', err);
      }
    }

    recordInstallationMetric();
  }, [eventId]);

  return null;
}