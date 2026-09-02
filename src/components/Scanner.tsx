// src/components/Scanner.tsx
'use client';

import React, { useState } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import { 
  Camera, X, CheckCircle2, AlertTriangle, Loader2, Keyboard, 
  LogIn, Utensils 
} from 'lucide-react';
import SyncStatusBar from '@/components/SyncStatusBar';
import { db } from '../lib/db';

export type ScanStatus = 'idle' | 'success' | 'warning' | 'error';
export type ScanMode = 'CHECK_IN' | 'FOOD_CLAIM' | 'REGISTRATION';

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

  /**
   * Helper function to extract qrToken & attendee parameters from JSON payload or raw text
   */
  const parseQrContent = (rawText: string) => {
    const trimmedText = rawText.trim();
    try {
      const parsed = JSON.parse(trimmedText);
      if (parsed && typeof parsed === 'object') {
        return {
          qrToken: parsed.qrToken || parsed.token || parsed.uid || trimmedText,
          userId: parsed.uid ? String(parsed.uid) : null,
          eventId: parsed.eid ? Number(parsed.eid) : null,
          category: parsed.cat || null,
          hasFood: Boolean(parsed.food),
          rawToken: trimmedText
        };
      }
    } catch (e) {
      // Fallback for plain text qrToken (e.g. MI26-9122)
    }
    return {
      qrToken: trimmedText,
      userId: trimmedText,
      eventId: null,
      category: null,
      hasFood: false,
      rawToken: trimmedText
    };
  };

  /**
   * Core execution pipeline: Instant UI Feedback + Background DB Mutation & Sync
   */
  const executePipeline = async (scannedText: string) => {
    const rawInput = scannedText.trim();
    if (!rawInput || isProcessing) return;

    setIsProcessing(true);

    try {
      // Step A: Parse scanned payload to extract exact qrToken
      const qrData = parseQrContent(rawInput);
      const targetQrToken = qrData.qrToken;

      console.log(`🔍 Scanning pass for qrToken: "${targetQrToken}" under Mode: ${scanMode}`);

      // Delegate to custom execution handler if provided
      if (onScanExecute) {
        const customResult = await onScanExecute(targetQrToken, scanMode);
        setScanResult({
          status: customResult.status,
          message: customResult.message,
          title: customResult.name
        });
        return;
      }

      // Step B: Locate guest record in Dexie IndexedDB using targetQrToken
      if (!db.isOpen()) await db.open();

      let guest = await db.guests
        .where('qrToken')
        .equals(targetQrToken)
        .first();

      if (!guest) {
        guest = await db.guests
          .where('qr_token')
          .equals(targetQrToken)
          .first();
      }

      if (!guest && qrData.rawToken !== targetQrToken) {
        guest = await db.guests
          .where('qrToken')
          .equals(qrData.rawToken)
          .first();
      }

      if (!guest) {
        setScanResult({
          status: 'error',
          message: `Access Denied: Ticket pass (${targetQrToken}) not found in roster.`
        });
        return;
      }

      // Verify event ID venue match
      if (
        guest.eventId && 
        Number(guest.eventId) !== Number(currentEventId) && 
        qrData.eventId && 
        Number(qrData.eventId) !== Number(currentEventId)
      ) {
        setScanResult({
          status: 'error',
          message: 'Access Denied: Invalid pass for this venue/event. / प्रवेश अस्वीकृत: इस स्थान/कार्यक्रम के लिए अमान्य पास।'
        });
        return;
      }

      const now = Date.now();
      let mutationPayload: Record<string, any> = {};
      let immediateStatus: ScanStatus = 'success';
      let immediateMessage = '';

      // Step C: Validate conditions & prepare responses
      if (scanMode === 'CHECK_IN') {
        const isAlreadyCheckedIn = 
          Boolean(guest.checkInTime) || 
          guest.isCheckedIn === true

        if (isAlreadyCheckedIn) {
          setScanResult({
            status: 'warning',
            title: guest.name,
            message: `${guest.name} has already checked in. / ${guest.name} पहले ही चेक-इन कर चुके हैं।`
          });
          return;
        }

        mutationPayload = {
          checkInTime: now,
          check_in_time: now,
          isCheckedIn: true,
          is_check_in: true,
          isCheckIn: 1,
          syncStatus: 'pending'
        };

        immediateMessage = `✓ Pass Verified (${guest.category || 'General'}). Gate check-in complete./ पास सत्यापित। गेट चेक-इन पूरा हो गया - ${guest.name}`;

      } else if (scanMode === 'FOOD_CLAIM') {
        const isFoodEligible = 
          Boolean(guest.hasFoodAccess) || 
          qrData.hasFood === true;

        if (!isFoodEligible) {
          setScanResult({
            status: 'error',
            title: guest.name,
            message: 'Denied: Food not included with this pass type. / अस्वीकृत: इस पास के साथ भोजन शामिल नहीं है।'
          });
          return;
        }

        const isFoodAlreadyClaimed = 
          Boolean(guest.foodClaimedTime) || 
          guest.hasFoodClaimed === true 

        if (isFoodAlreadyClaimed) {
          setScanResult({
            status: 'warning',
            title: guest.name,
            message: `Pass already claimed/redeemed for ${guest.name}. / ${guest.name} के लिए भोजन पहले ही प्राप्त किया जा चुका है।`
          });
          return;
        }

        const isAlreadyCheckedIn = 
          Boolean(guest.checkInTime) || 
          guest.isCheckedIn === true

        mutationPayload = {
          hasFoodClaimed: true,
          has_food_claimed: true,
          foodClaimedTime: now,
          food_claimed_time: now,
          syncStatus: 'pending',
          ...(!isAlreadyCheckedIn && {
            checkInTime: now,
            check_in_time: now,
            isCheckedIn: true,
            is_check_in: true,
            isCheckIn: 1
          })
        };

        immediateMessage = `🍱 Meal Allocation Approved. Voucher successfully redeemed${!isAlreadyCheckedIn ? ' & Check-in recorded' : ''}./भोजन थाली स्वीकृत। वाउचर सफलतापूर्वक भुना लिया गया${!isAlreadyCheckedIn ? ' और चेक-इन दर्ज किया गया' : ''} - ${guest.name}`;
      }

      // ⚡ INSTANT OPTIMISTIC UI UPDATE (Fires immediately with zero perceived latency)
      setScanResult({
        status: 'success',
        title: guest.name,
        message: immediateMessage
      });

      // Step D & E: Run heavy DB writes and network syncs asynchronously behind the scenes
      const guestId = guest.id!;
      const updatedGuestRecord = { 
        ...guest, 
        ...mutationPayload, 
        hasFoodClaimed: mutationPayload.hasFoodClaimed ?? guest.hasFoodClaimed ?? false,
        has_food_claimed: mutationPayload.has_food_claimed  ?? guest.hasFoodClaimed ?? false,
        foodClaimedTime: mutationPayload.foodClaimedTime ?? guest.foodClaimedTime ?? null,
        food_claimed_time: mutationPayload.food_claimed_time ?? guest.foodClaimedTime ?? null,
      };

      (async () => {
        try {
          await db.guests.update(guestId, mutationPayload);
          console.log(`💾 Local IndexedDB updated for pass (${targetQrToken}):`, mutationPayload);

          if (navigator.onLine) {
            const syncResponse = await fetch('/api/sync/push', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ guests: [updatedGuestRecord] }),
            });

            if (syncResponse.ok) {
              await db.guests.update(guestId, { syncStatus: 'synced' });
              console.log(`⚡ Online DB sync committed for pass (${targetQrToken})`);
            }
          }
        } catch (bgErr) {
          console.warn("Background sync/mutation error:", bgErr);
        }
      })();

    } catch (err: any) {
      console.error("Fatal scan execution error:", err);
      setScanResult({ status: 'error', message: 'Terminal camera processing error.' });
    } finally {
      setManualToken('');

      // Auto-resume camera decoding feed after 2.5 seconds
      setTimeout(() => {
        setScanResult({ status: 'idle', message: '' });
        setIsProcessing(false);
      }, 1000);
    }
  };

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
              Event Scanner
            </span>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="w-36 h-8 flex items-center shrink-0">
              <SyncStatusBar />
            </div>

            <button 
              onClick={() => setShowManualInput(!showManualInput)}
              className={`p-2 transition-colors shrink-0 ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
              title="Toggle Manual Input"
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

        {/* ACTIVE SCANNER MODE BADGE */}
        <div className={`p-3 mb-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider ${
          scanMode === 'CHECK_IN'
            ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {scanMode === 'CHECK_IN' ? <LogIn size={15} /> : <Utensils size={15} />}
          <span>Active Mode: {scanMode === 'CHECK_IN' ? 'Gate Check-In' : 'Food Counter'}</span>
        </div>

        {/* CAMERA / MANUAL ENTRY FRAME */}
        <div className="relative rounded-3xl overflow-hidden bg-black min-h-[260px] flex flex-col justify-center items-center border border-white/5">
          {showManualInput ? (
            /* MANUAL INPUT FALLBACK */
            <div className="w-full p-6 space-y-4 animate-in zoom-in-95 duration-200">
              <div className="space-y-2">
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Manual QR Token</label>
                <input 
                  type="text"
                  placeholder="e.g. MI26-9122"
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
            /* CLEAN REACT-QR-SCANNER VIEWPORT */
            <div className="w-full h-full min-h-[260px] relative">
              <Scanner
                onScan={(detectedCodes) => {
                  if (!isProcessing && detectedCodes && detectedCodes.length > 0) {
                    executePipeline(detectedCodes[0].rawValue);
                  }
                }}
                onError={(error) => {
                  console.warn("QR Scanner error:", error);
                }}
                constraints={{ facingMode: 'environment' }}
                styles={{
                  container: { width: '100%', height: '100%', minHeight: '260px' },
                  video: { width: '100%', height: '100%', objectFit: 'cover' }
                }}
              />
            </div>
          )}

          {/* OVERLAY FEEDBACK STATUS */}
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
            ? "Enter ticket qrToken explicitly" 
            : `Align Ticket QR code inside frame boundary (${scanMode})`}
        </p>

        {/* CLOSE BUTTON */}
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