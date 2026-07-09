'use client';

import React, { useEffect, useState } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, X, CheckCircle2, AlertTriangle, Loader2, Keyboard } from 'lucide-react';
import SyncStatusBar from '@/components/SyncStatusBar';
import { db } from '../lib/db'; // Adjust this path to match your Dexie instance location

// Unified status type for terminal execution feedback
export type ScanStatus = 'idle' | 'success' | 'warning' | 'error';

interface ScanResultState {
  status: ScanStatus;
  message: string;
  title?: string;
}

interface ReusableScannerProps {
  currentEventId: number;
  variant?: 'blue' | 'emerald' | 'purple' | 'amber';
  isDark?: boolean;
  onClose: () => void;
  // Deep execution abstraction hook: handles UI transformations gracefully
  onScanExecute: (token: string) => Promise<{ status: ScanStatus; message: string; name?: string }>;
}

export default function EntryDeskCameraScanner({ 
  currentEventId, 
  variant = 'blue', 
  isDark = true,
  onClose, 
  onScanExecute 
}: ReusableScannerProps) {
  const [scanResult, setScanResult] = useState<ScanResultState>({ status: 'idle', message: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  // Consolidated handler for processing both camera frames and keyboard inputs
  const executePipeline = async (token: string, scannerInstance?: any) => {
    const cleanedToken = token.trim().toUpperCase();
    if (!cleanedToken || isProcessing) return;
    
    setIsProcessing(true);
    if (scannerInstance) scannerInstance.pause(true); // Freeze camera feed frame tracking

    try {
      // 1. Run the layout UI checker abstraction sequence passed down by the dashboard core
      const result = await onScanExecute(cleanedToken);
      
      setScanResult({
        status: result.status,
        message: result.message,
        title: result.name
      });

      // 2. Opportune Background Sync Operation: Runs only on valid new check-ins
      if (result.status === 'success') {
        // Fetch the freshly updated local object from Dexie storage links
        const updatedLocalGuest = await db.guests.where('qrToken').equals(cleanedToken).first();
        
        if (updatedLocalGuest && navigator.onLine) {
          // Attempt an immediate background flush directly to your Next.js PostgreSQL route
          try {
            const syncResponse = await fetch('/api/sync/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ mutations: [updatedLocalGuest] }),
            });

            if (syncResponse.ok) {
              // Successfully written to PostgreSQL. Flips local status to prevent redundant uploads.
              await db.guests.update(updatedLocalGuest.id!, { syncStatus: 'synced' });
              console.log(`Background sync stream committed for ticket: ${cleanedToken}`);
            }
          } catch (syncErr) {
            // Fail silently on purpose. The row is marked as 'pending', so SyncStatusBar handles it later.
            console.warn("Background channel link offline. Mutation cached on local hardware storage slots.");
          }
        }
      }

    } catch (err) {
      console.error("Fatal entry track exception:", err);
      setScanResult({ status: 'error', message: 'System verification crash.' });
    } finally {
      setIsProcessing(false);
      setManualToken('');
      
      // Keep feedback view visible for 2.5 seconds, then resume camera tracks smoothly
      setTimeout(() => {
        setScanResult({ status: 'idle', message: '' });
        if (scannerInstance) scannerInstance.resume();
      }, 2500);
    }
  };

  useEffect(() => {
    if (showManualInput) return; // Terminate engine instantiation if fallback typing is active

    const scanner = new Html5QrcodeScanner(
      "qr-reader-container",
      { 
        fps: 15, 
        qrbox: { width: 220, height: 220 }, 
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] 
      },
      /* verbose= */ false
    );

    scanner.render(
      (text) => executePipeline(text, scanner),
      (err) => {} // Fail-silent frame parsing noise dropped intentionally
    );

    return () => {
      scanner.clear().catch(err => console.error("Scanner stream drop failed:", err));
    };
  }, [currentEventId, showManualInput]);

  // Color theme mapper tokens based on the active event state definition
  const accentText = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    purple: 'text-purple-500',
    amber: 'text-amber-500'
  }[variant];

  const accentBtn = {
    blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20',
    purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500/20',
    amber: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20'
  }[variant];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-[2.5rem] p-6 relative overflow-hidden shadow-2xl border ${
        isDark ? 'bg-[#020617] border-white/10' : 'bg-white border-slate-200'
      }`}>
        
        {/* TERMINAL HEADER CONTROLS */}
        <div className="flex justify-between items-center mb-6 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <Camera size={16} className={accentText} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Terminal Desk
            </span>
          </div>

          {/* HUD TELEMETRY WRAPPERS SECTION */}
          <div className="flex items-center gap-2 flex-1 justify-end">
            {/* 🚀 NETWORK TELEMETRY SYNC MONITOR (STABILIZED LAYOUT POSITION) */}
            <div className="w-40 h-9 flex items-center shrink-0">
              <SyncStatusBar />
            </div>

            <button 
              onClick={() => setShowManualInput(!showManualInput)}
              className={`p-2 transition-colors shrink-0 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              title="Toggle Keyboard Input Fallback"
            >
              <Keyboard size={18} />
            </button>
            <button onClick={onClose} className={`p-2 transition-colors shrink-0 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* WORKSPACE FRAME (CAMERA OR KEYBOARD) */}
        <div className="relative rounded-3xl overflow-hidden bg-black min-h-[260px] flex flex-col justify-center items-center border border-white/5">
          {showManualInput ? (
            /* FALLBACK MANUAL INTERFACE */
            <div className="w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Manual Ticket ID</label>
                <input 
                  type="text"
                  placeholder="EX: CLBR-7X9P2"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-mono uppercase tracking-widest outline-none text-white focus:border-blue-500 transition-all text-center"
                />
              </div>
              <button
                disabled={!manualToken || isProcessing}
                onClick={() => executePipeline(manualToken)}
                className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all shadow-lg ${accentBtn} disabled:opacity-40`}
              >
                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'Confirm Ticket Entry'}
              </button>
            </div>
          ) : (
            /* SYSTEM CAMERA FRAME MOUNT */
            <div id="qr-reader-container" className="w-full" />
          )}

          {/* REALTIME RESULTS SCREEN OVERLAYS */}
          {scanResult.status !== 'idle' && (
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 ${
              scanResult.status === 'success' ? 'bg-emerald-950/95 text-emerald-400' :
              scanResult.status === 'warning' ? 'bg-amber-950/95 text-amber-400' : 'bg-red-950/95 text-red-400'
            }`}>
              {scanResult.status === 'success' && <CheckCircle2 size={48} className="mb-3 animate-bounce" />}
              {scanResult.status === 'warning' && <AlertTriangle size={48} className="mb-3" />}
              {scanResult.status === 'error' && <X size={48} className="mb-3" />}

              {scanResult.title && (
                <h4 className="text-base font-black text-white tracking-tight mb-1">{scanResult.title}</h4>
              )}
              <p className="text-xs font-bold text-slate-200 max-w-xs">{scanResult.message}</p>
            </div>
          )}
        </div>

        <p className="mt-4 text-[9px] text-slate-500 text-center font-bold uppercase tracking-widest leading-relaxed">
          {showManualInput ? "Enter system ticket code explicitly" : "Align ticket token inside frame boundary targets"}
        </p>
      </div>
    </div>
  );
}