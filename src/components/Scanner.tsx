'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, X, CheckCircle2, AlertTriangle, Loader2, Keyboard, 
  LogIn, Utensils 
} from 'lucide-react';
import SyncStatusBar from '@/components/SyncStatusBar';
import { db } from '../lib/db';

export type ScanStatus = 'idle' | 'success' | 'warning' | 'error';
export type ScanMode = 'CHECK_IN' | 'FOOD_CLAIM';

interface ScanResultState {
  status: ScanStatus;
  message: string;
  title?: string;
}

interface ReusableScannerProps {
  currentEventId: number;
  variant?: 'blue' | 'emerald' | 'purple' | 'amber';
  isDark?: boolean;
  scanMode?: ScanMode;
  onClose: () => void;
  onScanExecute?: (token: string, mode: ScanMode) => Promise<{ status: ScanStatus; message: string; name?: string }>;
}

export default function EntryDeskCameraScanner({ 
  currentEventId, 
  variant = 'blue', 
  isDark = true,
  scanMode = 'CHECK_IN',
  onClose, 
  onScanExecute 
}: ReusableScannerProps) {
  const [scanResult, setScanResult] = useState<ScanResultState>({ status: 'idle', message: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  /**
   * Helper function to extract user parameters from TicketQR JSON payload or plain token
   */
  const parseQrContent = (rawText: string) => {
    try {
      const parsed = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object') {
        return {
          userId: parsed.uid ? String(parsed.uid) : null,
          eventId: parsed.eid ? Number(parsed.eid) : null,
          category: parsed.cat || null,
          hasFood: Boolean(parsed.food),
          rawToken: rawText
        };
      }
    } catch (e) {
      // Fallback for non-JSON string tokens
    }
    return {
      userId: rawText.trim(),
      eventId: null,
      category: null,
      hasFood: false,
      rawToken: rawText.trim()
    };
  };

  /**
   * Core execution pipeline for offline DB update + optional online DB flush
   */
  const executePipeline = async (scannedText: string) => {
    const rawInput = scannedText.trim();
    if (!rawInput || isProcessing) return;

    setIsProcessing(true);
    if (scannerRef.current) {
      try {
        scannerRef.current.pause(true); // Pause camera feed during validation
      } catch (err) {
        console.warn("Scanner pause exception:", err);
      }
    }

    try {
      // Step A: Parse TicketQR payload parameters
      const qrData = parseQrContent(rawInput);

      // Delegate to external handler if custom execution hook is passed
      if (onScanExecute) {
        const customResult = await onScanExecute(rawInput, scanMode);
        setScanResult({
          status: customResult.status,
          message: customResult.message,
          title: customResult.name
        });
        return;
      }

      // Step B: Locate guest record in Dexie IndexedDB (Offline First)
      if (!db.isOpen()) await db.open();

      let guest = await db.guests
        .where('qrToken')
        .equals(qrData.rawToken)
        .first();

      // Flexible secondary lookup by User ID / Email if token match missed
      if (!guest && qrData.userId) {
        guest = await db.guests
          .where('qrToken')
          .equals(qrData.userId)
          .or('email')
          .equals(qrData.userId)
          .or('guestId')
          .equals(qrData.userId)
          .first();
      }

      if (!guest) {
        setScanResult({
          status: 'error',
          message: 'Access Denied: Ticket credential not found in event roster.'
        });
        return;
      }

      // Verify event match
      if (Number(guest.eventId) !== Number(currentEventId) && qrData.eventId && Number(qrData.eventId) !== Number(currentEventId)) {
        setScanResult({
          status: 'error',
          message: 'Access Denied: Ticket is registered for a different event venue.'
        });
        return;
      }

      const now = Date.now();
      let mutationPayload: Record<string, any> = {};

      // Step C: Evaluate Check-In vs. Food Claim Logic based on active scanMode
      if (scanMode === 'CHECK_IN') {
        const alreadyCheckedIn = Boolean(guest.checkInTime) || guest.isCheckedIn === true;

        if (alreadyCheckedIn) {
          setScanResult({
            status: 'warning',
            title: guest.name,
            message: 'Duplicate Scan Warning: Attendee has already checked in.'
          });
          return;
        }

        mutationPayload = {
          checkInTime: now,
          isCheckedIn: true,
          isCheckIn: 1, // Dual support for integer / boolean DB columns
          syncStatus: 'pending'
        };

        setScanResult({
          status: 'success',
          title: guest.name,
          message: `✓ ${guest.category || 'General'} pass authenticated. Access granted.`
        });

      } else if (scanMode === 'FOOD_CLAIM') {
        const isEligible = Boolean(guest.hasFoodAccess) || qrData.hasFood === true;

        if (!isEligible) {
          setScanResult({
            status: 'error',
            title: guest.name,
            message: 'Meal Allocation Denied: Food entitlement not included with this pass tier.'
          });
          return;
        }

        if (guest.hasFoodClaimed === true) {
          setScanResult({
            status: 'warning',
            title: guest.name,
            message: 'Duplicate Food Voucher: Meal plate already claimed for this pass.'
          });
          return;
        }

        mutationPayload = {
          hasFoodClaimed: true,
          foodClaimedTime: now,
          syncStatus: 'pending'
        };

        setScanResult({
          status: 'success',
          title: guest.name,
          message: '🍱 Meal Allocation Approved. Voucher redeemed.'
        });
      }

      // Step D: Write Mutation to Local Offline DB (Dexie IndexedDB)
      await db.guests.update(guest.id!, mutationPayload);
      const updatedLocalGuest = { ...guest, ...mutationPayload };

      // Step E: Opportune Push Sync to Online DB (PostgreSQL) if device is online
      if (navigator.onLine) {
        try {
          const syncResponse = await fetch('/api/sync/push', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ guests: [updatedLocalGuest] }),
          });

          if (syncResponse.ok) {
            // Update local status to synced post-commit
            await db.guests.update(guest.id!, { syncStatus: 'synced' });
            console.log(`⚡ Instant online DB sync committed for guest: ${guest.name}`);
          }
        } catch (syncErr) {
          console.warn("🌐 Online push unreachable. Cached in offline DB for auto-sync.");
        }
      }

    } catch (err: any) {
      console.error("Fatal scan processing error:", err);
      setScanResult({ status: 'error', message: 'Terminal processing fault.' });
    } finally {
      setIsProcessing(false);
      setManualToken('');

      // Auto-resume camera feed after 2.5 seconds
      setTimeout(() => {
        setScanResult({ status: 'idle', message: '' });
        if (scannerRef.current) {
          try {
            scannerRef.current.resume();
          } catch (err) {
            console.warn("Scanner resume exception:", err);
          }
        }
      }, 2500);
    }
  };

  useEffect(() => {
    if (showManualInput) return;

    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader-container",
      { 
        fps: 15, 
        qrbox: { width: 230, height: 230 }, 
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE] 
      },
      /* verbose= */ false
    );

    scannerRef.current.render(
      (decodedText) => executePipeline(decodedText),
      (err) => {} // Fail-silent frame parsing
    );

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Scanner stream drop failed:", err));
      }
    };
  }, [currentEventId, showManualInput, scanMode]);

  // Dynamic color accents matching active scan mode
  const activeVariant = scanMode === 'CHECK_IN' ? (variant === 'amber' ? 'purple' : variant) : 'amber';

  const accentText = {
    blue: 'text-blue-500',
    emerald: 'text-emerald-500',
    purple: 'text-purple-500',
    amber: 'text-amber-500'
  }[activeVariant];

  const accentBtn = {
    blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500/20',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500/20',
    purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500/20',
    amber: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500/20'
  }[activeVariant];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-[2.5rem] p-6 relative overflow-hidden shadow-2xl border ${
        isDark ? 'bg-[#020617] border-white/10' : 'bg-white border-slate-200'
      }`}>
        
        {/* TERMINAL HEADER CONTROLS */}
        <div className="flex justify-between items-center mb-4 gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <Camera size={16} className={accentText} />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Terminal Desk
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="w-36 h-8 flex items-center shrink-0">
              <SyncStatusBar />
            </div>

            <button 
              onClick={() => setShowManualInput(!showManualInput)}
              className={`p-2 transition-colors shrink-0 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              title="Toggle Keyboard Input Fallback"
            >
              <Keyboard size={18} />
            </button>
            <button 
              onClick={onClose} 
              className={`p-2 transition-colors shrink-0 ${isDark ? 'text-slate-500 hover:text-white' : 'text-slate-400 hover:text-slate-900'}`}
              title="Close Scanner"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* LOCKED ACTIVE DESK MODE DISPLAY (READ-ONLY FOR VOLUNTEERS) */}
        <div className={`p-3 mb-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider ${
          scanMode === 'CHECK_IN'
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {scanMode === 'CHECK_IN' ? <LogIn size={15} /> : <Utensils size={15} />}
          <span>Active Mode: {scanMode === 'CHECK_IN' ? 'Gate Check-In' : 'Food Counter'}</span>
        </div>

        {/* CAMERA OR KEYBOARD WORKSPACE FRAME */}
        <div className="relative rounded-3xl overflow-hidden bg-black min-h-[260px] flex flex-col justify-center items-center border border-white/5">
          {showManualInput ? (
            /* FALLBACK MANUAL INTERFACE */
            <div className="w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Manual Ticket / User ID</label>
                <input 
                  type="text"
                  placeholder="Enter User ID or Ticket Code"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm font-mono uppercase tracking-widest outline-none text-white focus:border-purple-500 transition-all text-center"
                />
              </div>
              <button
                disabled={!manualToken || isProcessing}
                onClick={() => executePipeline(manualToken)}
                className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white flex items-center justify-center gap-2 transition-all shadow-lg ${accentBtn} disabled:opacity-40`}
              >
                {isProcessing ? <Loader2 size={12} className="animate-spin" /> : 'Confirm Pass Entry'}
              </button>
            </div>
          ) : (
            /* CAMERA FRAME MOUNT */
            <div id="qr-reader-container" className="w-full" />
          )}

          {/* REALTIME FEEDBACK OVERLAYS */}
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
          {showManualInput 
            ? "Enter system ticket code explicitly" 
            : `Align TicketQR code inside frame boundary (${scanMode})`}
        </p>

        {/* EXPLICIT CLOSE CAMERA BUTTON */}
        <button
          onClick={onClose}
          className={`w-full mt-4 py-3 rounded-2xl border text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
            isDark 
              ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white' 
              : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <X size={16} />
          Close Camera
        </button>
      </div>
    </div>
  );
}