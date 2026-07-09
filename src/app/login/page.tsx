'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, KeyRound, User, Sparkles, 
  ArrowRight, Moon, Sun, Loader2, Lock, UserPlus 
} from 'lucide-react';
import { db } from '../../lib/db';

export default function UnifiedLoginPage() {
  const [isDark, setIsDark] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Ensure database gateway node connectivity is established
    try {
      if (!db.isOpen()) {
        await db.open();
      }
    } catch (openErr) {
      console.error("Critical gateway failure during initialization:", openErr);
      setError("Unable to initialize local security gateway terminal.");
      setIsLoading(false);
      return;
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    // Defensive input check to intercept empty evaluation loops
    if (!cleanIdentifier || !password) {
      setError('Operational parameters require absolute configuration vectors.');
      setIsLoading(false);
      return;
    }

    // Toggle false if you are ready to hit your remote live API routes instead of the Dexie local disk
    const FORCE_OFFLINE_DEV = true;

    try {
      if (navigator.onLine && !FORCE_OFFLINE_DEV) {
        // --- ONLINE PATHWAY: Synchronize authorization with secure cloud architecture ---
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanIdentifier, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || 'Authentication rejected by security orchestration vectors.');
          setIsLoading(false);
          return;
        }

        // Verify payload structural fields are intact before commit
        const remoteUser = data.user || data;
        if (!remoteUser || !remoteUser.identifier || !remoteUser.role) {
          setError('Malformed identification payload returned by directory nodes.');
          setIsLoading(false);
          return;
        }

        // Reset runtime profile data blocks and cache the verified active session matrix
        await db.users.clear();
        await db.users.add({
          identifier: remoteUser.identifier,
          name: remoteUser.name || 'Matrix Operator',
          passkey: password, 
          role: remoteUser.role, // Dynamically maps 'manager' or 'volunteer'
          assignedEventId: remoteUser.assignedEventId || 0,
          token: data.token || 'LOCAL_FALLBACK_TOKEN',
          cachedAt: Date.now()
        });

        // UNIFIED ROUTING LOGIC: Inspect path segments based on verified credentials
        if (remoteUser.role === 'manager') {
          router.push('/dashboard-eventManager');
        } else {
          router.push('/dashboard-eventVolunteers');
        }

      } else {
        // --- OFFLINE FALLBACK: Safely match local matrix schemas natively offline ---
        const localUser = await db.users.where('identifier').equals(cleanIdentifier).first();
        
        if (!localUser) {
          setError('This workspace profile has not been provisioned for offline execution on this hardware.');
          setIsLoading(false);
          return;
        }

        // Defensive validation handling for legacy records that lack the passkey property
        if (!localUser.passkey || localUser.passkey !== password) {
          setError('Invalid operational clearance credentials supplied.');
          setIsLoading(false);
          return;
        }

        // Validate local cache timeline constraint matrices to prevent token spoofing
        const isCacheExpired = Date.now() - localUser.cachedAt > 7 * 24 * 60 * 60 * 1000;
        if (isCacheExpired) {
          setError('Offline leadership clearance window has expired. Establish network link to re-verify.');
          setIsLoading(false);
          return;
        }

        // UNIFIED ROUTING LOGIC: Direct local user to their role-bound terminal view
        if (localUser.role === 'manager') {
          router.push('/dashboard-eventManagers');
        } else {
          router.push('/dashboard-eventVolunteers');
        }
      }
    } catch (err) {
      console.error("Dexie processing exception runtime trace:", err);
      setError('Internal terminal gateway authentication node error.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickBypass = async (role: 'manager' | 'volunteer') => {
    // Populate identity configurations instantly for rapid staging environment validation
    setIdentifier(role === 'manager' ? 'manager@lyss.in' : 'volunteer_gate1@lyss.in');
    setPassword('password123');
  };

  const theme = {
    bg: isDark ? 'bg-[#020617]' : 'bg-slate-50',
    card: isDark ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-xl',
    input: isDark ? 'bg-white/5 border-white/10 text-white focus:border-blue-500' : 'bg-slate-100 border-slate-200 text-slate-900 focus:border-blue-600',
    textMain: isDark ? 'text-white' : 'text-slate-900',
  };

  return (
    <div className={`min-h-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 flex flex-col justify-center items-center p-4 relative overflow-hidden pt-10`}>
      
      {/* BRANDING BACKGROUND GRAPHICS */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* LIGHT/DARK OVERLAY MODIFIER */}
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

      {/* CORE LOGIN FORM MODULE */}
      <div className={`w-full max-w-md border p-8 rounded-[2.5rem] relative z-10 backdrop-blur-xl transition-all duration-300 ${theme.card}`}>
        
        <div className="text-center space-y-2 mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase tracking-widest">
            <Sparkles size={10} className="animate-pulse" /> Security Gateway Active
          </div>
          <h2 className="text-2xl font-black italic tracking-tight uppercase mt-2">
            Aayojan <span className="text-blue-500">Terminal</span>
          </h2>
          <p className="text-xs text-slate-500 font-bold">Provide workspace clearance vectors to enter terminal.</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center animate-in fade-in zoom-in-95">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Workspace Login Identifier</label>
            <div className="relative">
              <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="text"
                placeholder="manager@lyss.in or volunteer_id"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isLoading}
                className={`w-full pl-11 pr-5 py-4 text-sm rounded-2xl border outline-none font-medium transition-all ${theme.input}`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Secure Passkey</label>
            <div className="relative">
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className={`w-full pl-11 pr-5 py-4 text-sm rounded-2xl border outline-none font-medium transition-all ${theme.input}`}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                Initialize System Workspace <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        {/* SIGNUP LINK REDIRECTION */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => router.push('/register')}
            className="text-[10px] font-black uppercase text-slate-500 hover:text-blue-400 transition-colors tracking-widest inline-flex items-center gap-2"
          >
            <UserPlus size={12} /> Establish New Manager Workspace Matrix
          </button>
        </div>

        {/* SIMULATED TESTING PARAMS CONTAINER */}
        <div className="mt-6 pt-5 border-t border-dashed border-slate-700/30 text-center">
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">Dev Environment Quick Roles</p>
          <div className="grid grid-cols-2 gap-2">
            <button 
              type="button"
              onClick={() => handleQuickBypass('manager')}
              className="px-3 py-2 text-[10px] font-bold rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-all"
            >
              Simulate Manager
            </button>
            <button 
              type="button"
              onClick={() => handleQuickBypass('volunteer')}
              className="px-3 py-2 text-[10px] font-bold rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 hover:bg-purple-500/20 transition-all"
            >
              Simulate Volunteer
            </button>
          </div>
        </div>

      </div>

      {/* PERSISTENT RUNTIME BRAND FOOTER */}
      <footer className="mt-8 text-[8px] font-black text-slate-600 uppercase tracking-[0.25em] relative z-10">
        Inspiring Leadership through Technical Innovation
      </footer>
    </div>
  );
}