// components/GateScanner.tsx
'use client';
import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { db } from '@/lib/db';
import { useTranslation } from '@/contexts/LanguageContext';

export default function GateScanner() {
  const { t } = useTranslation();
  const [status, setStatus] = useState({ msg: '', type: 'idle' });

  useEffect(() => {
    // 1. Create the scanner instance
    const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);

    // 2. Define the ASYNC success handler separately
    const onScanSuccess = async (decodedText: string) => {
      try {
        // Find guest in IndexedDB
        const guest = await db.guests.where('qrCode').equals(decodedText).first();

        if (!guest) {
          setStatus({ msg: t.notFound, type: 'error' });
          return;
        }

        if (guest.isCheckedIn) {
          setStatus({ msg: `${t.alreadyIn}: ${guest.name}`, type: 'error' });
          return;
        }

        // Update local DB (Offline-first)
        await db.guests.update(guest.id!, { 
          isCheckedIn: 1, 
          checkInTime: Date.now(),
          syncStatus: 'pending' 
        });

        setStatus({ msg:`${t.success}: ${guest.name}`, type: 'success' });
      } catch (error) {
        console.error("Database error:", error);
        setStatus({ msg: "System Error", type: 'error' });
      }
    };

    // 3. Start the scanner (Synchronous call)
    scanner.render(onScanSuccess, (err) => { /* quiet errors */ });

    // 4. CLEANUP: This is what TypeScript was worried about!
    return () => {
      scanner.clear().catch(error => {
        console.error("Failed to clear scanner:", error);
      });
    };
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div className="flex flex-col items-center gap-4">
      <div id="reader" className="w-full max-w-sm rounded-xl overflow-hidden shadow-lg" />
      {status.type !== 'idle' && (
        <div className={`p-4 rounded-lg font-bold text-white ${
          status.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {status.msg}
        </div>
      )}
    </div>
  );
}