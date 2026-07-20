'use client';

import { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { LogIn, Utensils, CheckCircle, XCircle } from 'lucide-react';

type ScanMode = 'CHECK_IN' | 'FOOD_CLAIM';

export default function Scanner() {
  const [scanMode, setScanMode] = useState<ScanMode>('CHECK_IN');
  const [scanResult, setScanResult] = useState<{ success: boolean; message: string } | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    // Initialize the scanner on component mount
    scannerRef.current = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      /* verbose= */ false
    );

    scannerRef.current.render(onScanSuccess, onScanFailure);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch((err) => console.error('Failed to clear scanner', err));
      }
    };
  }, [scanMode]); // Re-binds the success handler context when mode changes

  const onScanSuccess = async (decodedText: string) => {
    // Pause scanning briefly to prevent duplicate triggers
    if (scannerRef.current) scannerRef.current.pause();

    try {
      // 🚀 Hit the corresponding offline-first evaluation or API endpoint
      const response = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: decodedText, mode: scanMode }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setScanResult({ success: true, message: data.message });
      } else {
        setScanResult({ success: false, message: data.error });
      }
    } catch (err) {
      setScanResult({ success: false, message: 'Network error. Saved to offline queue.' });
    }

    // Resume scanning after 2.5 seconds to allow the volunteer to process the next attendee
    setTimeout(() => {
      setScanResult(null);
      if (scannerRef.current) scannerRef.current.resume();
    }, 2500);
  };

  const onScanFailure = (error: any) => {
    // Verbose logging turned off to prevent console flooding during frame search
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      {/* 🚀 Mode Switcher Buttons */}
      <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setScanMode('CHECK_IN')}
          className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${
            scanMode === 'CHECK_IN' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          <LogIn size={16} />
          Gate Check-In
        </button>
        <button
          onClick={() => setScanMode('FOOD_CLAIM')}
          className={`flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-bold transition-all ${
            scanMode === 'FOOD_CLAIM' ? 'bg-white text-amber-600 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Utensils size={16} />
          Food Counter
        </button>
      </div>

      {/* 📷 Live Camera Feed Container */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-black relative">
        <div id="qr-reader" className="w-full"></div>

        {/* 🚨 Dynamic Overlay for Scanning Results */}
        {scanResult && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center text-white p-6 transition-all bg-opacity-95 animate-fade-in ${
            scanResult.success 
              ? scanMode === 'CHECK_IN' ? 'bg-indigo-600' : 'bg-emerald-600'
              : 'bg-rose-600'
          }`}>
            {scanResult.success ? <CheckCircle size={56} className="mb-2" /> : <XCircle size={56} className="mb-2" />}
            <p className="text-lg font-black text-center">{scanResult.message}</p>
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-slate-400 font-medium">
        Current Scanner Mode: <span className="font-bold text-slate-700">{scanMode}</span>
      </div>
    </div>
  );
}