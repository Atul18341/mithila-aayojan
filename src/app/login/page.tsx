'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hydrateDeviceFromCloud } from '@/lib/sync-recovery';
import { 
  ShieldCheck, KeyRound, User, Sparkles, 
  ArrowRight, Moon, Sun, Loader2, Lock, UserPlus 
} from 'lucide-react';
import { db } from '../../lib/db';

export default function UnifiedLoginPage() {
  const [isDark, setIsDark] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true); // Started as true to prevent flash during automatic session checking
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  
  const router = useRouter();

  // 🚀 HYBRID TOKEN SESSION RECOVERY: Check if an active, valid session is already cached locally
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        if (!db.isOpen()) await db.open();

        // Peek at the first active operator row cached in the system
        const cachedUser = await db.users.toCollection().first();

        if (cachedUser) {
          // Verify cache validity matrix constraints (7-day window expiration rule)
          const isCacheExpired = Date.now() - cachedUser.cachedAt > 7 * 24 * 60 * 60 * 1000;
          
          if (!isCacheExpired) {
            console.log(`Restoring verified cached offline session for ${cachedUser.identifier}`);
            if (cachedUser.role === 'manager') {
              router.push('/dashboard-eventManagers');
            } else {
              router.push('/dashboard-eventVolunteers');
            }
            return;
          } else {
            // Clean up stale session entries to force a fresh online validation handshake
            await db.users.clear();
          }
        }
      } catch (err) {
        console.error("Local session tracking index lookup error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    checkExistingSession();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!db.isOpen()) await db.open();
    } catch (openErr) {
      setError("Unable to initialize local security gateway terminal.");
      setIsLoading(false);
      return;
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    if (!cleanIdentifier || !password) {
      setError('Operational parameters require absolute configuration vectors.');
      setIsLoading(false);
      return;
    }

    try {
      // 🚀 ONLINE-FIRST GATEKEEPER PRINCIPLE: Initial logins MUST hit the authentication service route
      if (navigator.onLine) {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanIdentifier, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || 'Authentication rejected by secure directory nodes.');
          setIsLoading(false);
          return;
        }

        const remoteUser = data.user || data;
        console.log("data:",remoteUser)
        if (!remoteUser || !remoteUser.identifier || !remoteUser.role) {
          setError('Malformed identification payload returned by cloud network nodes.');
          setIsLoading(false);
          return;
        }

        // 🚀 HYBRID DATA SEEDING: Wipe old matrices and pin the new authoritative token configuration
        await db.users.clear();
        await db.users.add({
          identifier: remoteUser.identifier,
          name: remoteUser.name || 'Matrix Operator',
          passkey:'', // Retained purely for local credential checking fallback operations
          role: remoteUser.role,
          activeEventId: remoteUser.assignedEventId || 0,
          token: data.token || 'LOCAL_FALLBACK_TOKEN',
          cachedAt: Date.now(),
          syncStatus: 'synced' // User profile itself is clean post-handshake setup
        });
        setLoadingText('Synchronizing workspace records from cloud data anchors...');
      await hydrateDeviceFromCloud(remoteUser.identifier);

      // 3. Auto-select the first newly pulled event as active context so workspace fills seamlessly
      const firstEvent = await db.events.toCollection().first();
      if (firstEvent && firstEvent.id) {
        await db.users.where('identifier').equals(remoteUser.identifier).modify({
          activeEventId: firstEvent.id
        })
      }
        // Safe client redirection routing to the active control terminal
        if (remoteUser.role === 'manager') {
          router.push('/dashboard-eventManagers');
        } else {
          router.push('/dashboard-eventVolunteers');
        }

      } else {
        // --- HARDENED OFFLINE AUTONOMOUS VERIFICATION ---
        // If the device drops mid-shift and needs to re-auth, allow matching ONLY if seeded previously
        const localUser = await db.users.where('identifier').equals(cleanIdentifier).first();
        
        if (!localUser) {
          setError('This device terminal has not been provisioned. Initial login requires an active network link.');
          setIsLoading(false);
          return;
        }

        if (!localUser.passkey || localUser.passkey !== password) {
          setError('Invalid operational clearance credentials supplied.');
          setIsLoading(false);
          return;
        }

        const isCacheExpired = Date.now() - localUser.cachedAt > 7 * 24 * 60 * 60 * 1000;
        if (isCacheExpired) {
          setError('Offline security clearance has expired. Establish network access to refresh access token keys.');
          setIsLoading(false);
          return;
        }
        
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
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

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

        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => router.push('/register')}
            className="text-[10px] font-black uppercase text-slate-500 hover:text-blue-400 transition-colors tracking-widest inline-flex items-center gap-2"
          >
            <UserPlus size={12} /> Establish New Manager Workspace Matrix
          </button>
        </div>

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

      <footer className="mt-8 text-[8px] font-black text-slate-600 uppercase tracking-[0.25em] relative z-10">
        Inspiring Leadership through Technical Innovation
      </footer>
    </div>
  );
}