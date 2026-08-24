// src/components/Scanner.tsx
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, X, Keyboard, Loader2, LogIn, Utensils } from 'lucide-react';
import SyncStatusBar from '@/components/SyncStatusBar';

export type ScanStatus = 'idle' | 'success' | 'warning' | 'error';
export type ScanMode = 'CHECK_IN' | 'FOOD_CLAIM';

interface ReusableScannerProps {
  currentEventId: number;
  variant?: 'blue' | 'emerald' | 'purple' | 'amber';
  isDark?: boolean;
  scanMode?: ScanMode;
  onClose: () => void;
  onScanExecute?: (token: string, mode: ScanMode) => Promise<{ status: ScanStatus; message?: string; name?: string }>;
}

export default function EventScanner({ 
  currentEventId, 
  variant = 'blue', 
  isDark = true,
  scanMode = 'CHECK_IN',
  onClose, 
  onScanExecute 
}: ReusableScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);

  const executePipeline = async (scannedText: string) => {
    const rawInput = scannedText.trim();
    if (!rawInput || isProcessing) return;

    setIsProcessing(true);

    try {
      if (onScanExecute) {
        await onScanExecute(rawInput, scanMode);
      }
    } catch (err: any) {
      console.error("Fatal scan execution error:", err);
    } finally {
      setIsProcessing(false);
      setManualToken('');
    }
  };

  useEffect(() => {
    if (showManualInput) return;

    const qrCodeInstance = new Html5Qrcode("qr-reader-container");
    html5QrCodeRef.current = qrCodeInstance;

    const startBackCamera = async () => {
      try {
        isScanningRef.current = true;
        await qrCodeInstance.start(
          { facingMode: { exact: "environment" } }, 
          {
            fps: 15,
            qrbox: { width: 230, height: 230 }
          },
          (decodedText) => {
            executePipeline(decodedText);
          },
          () => {}
        );
      } catch (err) {
        try {
          if (isScanningRef.current) {
            await qrCodeInstance.start(
              { facingMode: "environment" },
              {
                fps: 15,
                qrbox: { width: 230, height: 230 }
              },
              (decodedText) => executePipeline(decodedText),
              () => {}
            );
          }
        } catch (fallbackErr) {
          console.error("Failed to start back camera stream:", fallbackErr);
        }
      }
    };

    startBackCamera();

    return () => {
      isScanningRef.current = false;
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(err => console.warn("Camera stop error:", err));
      }
    };
  }, [currentEventId, showManualInput, scanMode]);

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
            <div id="qr-reader-container" className="w-full [&_video]:object-cover" />
          )}
        </div>

        <p className="mt-4 text-[9px] text-slate-500 text-center font-bold uppercase tracking-widest leading-relaxed">
          {showManualInput 
            ? "Enter ticket qrToken explicitly" 
            : `Align Ticket QR code inside frame boundary (${scanMode})`}
        </p>

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