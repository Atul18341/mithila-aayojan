'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, Lock, ShieldCheck, Sparkles, ArrowRight, 
  Moon, Sun, Loader2, KeyRound, Briefcase
} from 'lucide-react';
import { db } from '../../lib/db';

export default function SecuritySignupPage() {
  const [isDark, setIsDark] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  
  const router = useRouter();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    // 1. SECURITY PRE-FLIGHT VALIDATIONS
    if (!identifier || !name || !password || !confirmPassword) {
      setStatusMessage({ type: 'error', text: 'All operational leadership parameters require configuration.' });
      return;
    }

    if (password !== confirmPassword) {
      setStatusMessage({ type: 'error', text: 'Authorized administrative credential confirmation mismatch.' });
      return;
    }

    if (password.length < 6) {
      setStatusMessage({ type: 'error', text: 'Security parameters require a minimum threshold of 6 characters.' });
      return;
    }

    setIsLoading(true);
    const cleanIdentifier = identifier.trim().toLowerCase();

    try {
      // 2. CHECK IF EXECUTIVE DISPATCH ID ALREADY EXISTS
      const identityExists = await db.users
        .where('identifier')
        .equals(cleanIdentifier)
        .first();

      if (identityExists) {
        setStatusMessage({ type: 'error', text: 'This executive identity string is already registered under leadership protocol.' });
        setIsLoading(false);
        return;
      }

      // 3. ENROLL SECURE MANAGEMENT EXECUTIVE ENVIRONMENT
      await db.users.add({
        identifier: cleanIdentifier,
        name: name.trim(),
        passkey: password,              
        role: 'manager',                 // Strictly locked down to Event Manager context execution
        assignedEventId: 0,             
        token: 'LOCAL_OFFLINE_SETUP',   
        cachedAt: Date.now(), 
        syncStatus:'pending'           
      });

      setStatusMessage({ type: 'success', text: 'Welcome to leadership. Establishing your digital event command matrix...' });
      
      setTimeout(() => {
        router.push('/login');
      }, 1500);

    } catch (err) {
      console.error("Critical core initialization transaction failure:", err);
      setStatusMessage({ type: 'error', text: 'Unable to provision secure manager workspace authorization at this time.' });
    } finally {
      setIsLoading(false);
    }
  };

  const theme = {
    bg: isDark ? 'bg-[#020617]' : 'bg-slate-50',
    card: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl',
    input: isDark ? 'bg-white/5 border-white/10 text-white focus:border-blue-500' : 'bg-slate-100 border-slate-200 text-slate-900 focus:border-blue-600',
    textMain: isDark ? 'text-white' : 'text-slate-900',
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 flex flex-col justify-center items-center p-4 relative overflow-hidden`}>
      
      {/* BACKGROUND GRAPHIC ORCHESTRATION */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* THEME SWITCHER */}
      <div className="absolute top-6 right-6">
        <button 
          type="button"
          onClick={() => setIsDark(!isDark)} 
          className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center relative overflow-hidden ${theme.input}`}
        >
          <div className={`transition-all duration-500 transform ${isDark ? 'translate-y-0' : 'translate-y-12 opacity-0'}`}>
            <Moon size={20} className="text-blue-400 fill-blue-400/10" />
          </div>
          <div className={`absolute transition-all duration-500 transform ${!isDark ? 'translate-y-0' : '-translate-y-12 opacity-0'}`}>
            <Sun size={20} className="text-amber-500 fill-amber-500/20" />
          </div>
        </button>
      </div>

      {/* CORE REGISTRATION INTERFACE BLOCK */}
      <div className={`w-full max-w-md border p-8 rounded-[2.5rem] relative z-10 backdrop-blur-xl transition-all duration-300 ${theme.card}`}>
        
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase tracking-widest">
            <Sparkles size={10} className="animate-pulse" /> Executive Command
          </div>
          <h2 className="text-2xl font-black italic tracking-tight uppercase mt-2">
            Empower Your <span className="text-blue-500">Vision</span>
          </h2>
          <p className="text-xs text-slate-500 font-bold">Initialize your exclusive manager terminal dashboard</p>
        </div>

        {statusMessage && (
          <div className={`mb-6 p-4 rounded-2xl border text-xs font-bold text-center animate-in fade-in zoom-in-95 ${
            statusMessage.type === 'success' 
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/10 border-red-500/20 text-red-400'
          }`}>
            {statusMessage.text}
          </div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
          
          {/* FIELD: FULL NAME */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Director/Manager Identity Name</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text"
                placeholder="EX: Atul Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isLoading}
                className={`w-full pl-11 pr-5 py-3.5 text-sm rounded-2xl border outline-none font-medium transition-all ${theme.input}`}
              />
            </div>
          </div>

          {/* FIELD: IDENTIFIER */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Workspace Login Identifier</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text"
                placeholder="manager@lyss.in"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isLoading}
                className={`w-full pl-11 pr-5 py-3.5 text-sm rounded-2xl border outline-none font-medium transition-all ${theme.input}`}
              />
            </div>
          </div>

          {/* LOCKED ASSIGNED ROLE IDENTITY FIELD */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Assigned Operational Authority</label>
            <div className="relative">
              <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <div className={`w-full pl-11 pr-5 py-3.5 text-sm rounded-2xl border font-bold cursor-not-allowed select-none opacity-80 flex items-center ${theme.input}`}>
                Event Experience Manager
              </div>
            </div>
          </div>

          {/* FIELD: PASSKEY */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Passkey</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className={`w-full pl-11 pr-5 py-3.5 text-sm rounded-2xl border outline-none font-medium transition-all ${theme.input}`}
              />
            </div>
          </div>

          {/* FIELD: CONFIRM PASSKEY */}
          <div className="space-y-1">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm Security Credentials</label>
            <div className="relative">
              <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className={`w-full pl-11 pr-5 py-3.5 text-sm rounded-2xl border outline-none font-medium transition-all ${theme.input}`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                Deploy Experience Dashboard <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="text-[10px] font-black uppercase text-slate-500 hover:text-blue-400 transition-colors tracking-widest"
          >
            Authorized Profile Registered? Return to Hub
          </button>
        </div>

      </div>

      <footer className="mt-8 text-[8px] font-black text-slate-600 uppercase tracking-[0.25em] relative z-10">
        Inspiring Leadership through Technical Innovation
      </footer>
    </div>
  );
}