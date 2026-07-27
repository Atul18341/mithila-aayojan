'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hydrateDeviceFromCloud } from '@/lib/sync-recovery';
import { 
  ShieldCheck, KeyRound, User, Sparkles, 
  ArrowRight, Moon, Sun, Loader2, Lock, UserPlus,
  Home 
} from 'lucide-react';
import { db } from '../../lib/db';

export default function UnifiedLoginPage() {
  const [isDark, setIsDark] = useState(true);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState('');
  const [error, setError] = useState('');
  
  const router = useRouter();

  // Helper function to navigate based on verified role
  const navigateByRole = (role: string) => {
    const normalizedRole = role.toLowerCase().trim();
    if (normalizedRole === 'manager') {
      router.push('/dashboard-eventManagers');
      return true;
    } else if (normalizedRole === 'volunteer') {
      router.push('/dashboard-eventVolunteers');
      return true;
    }
    return false;
  };

  // HYBRID TOKEN SESSION RECOVERY: Restore existing local active session if valid
  useEffect(() => {
    const checkExistingSession = async () => {
      try {
        if (!db.isOpen()) await db.open();

        const cachedUser = await db.users.toCollection().first();

        if (cachedUser) {
          const isCacheExpired = Date.now() - (cachedUser.cachedAt || 0) > 7 * 24 * 60 * 60 * 1000;
          
          if (!isCacheExpired && cachedUser.role) {
            console.log(`Restoring verified cached offline session for ${cachedUser.identifier}`);
            const redirected = navigateByRole(cachedUser.role);
            if (redirected) return;
          }
          
          // Clear invalid or stale sessions
          await db.users.clear();
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
    setLoadingText('');

    try {
      if (!db.isOpen()) await db.open();
    } catch (openErr) {
      setError("Unable to initialize local security gateway terminal.");
      setIsLoading(false);
      return;
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanIdentifier || !cleanPassword) {
      setError('Operational parameters require absolute configuration vectors.');
      setIsLoading(false);
      return;
    }

    try {
      // 1. FIRST ATTEMPT: Check local IndexedDB cache (works offline or for fast local verification)
      let localUser = await db.users.where('identifier').equals(cleanIdentifier).first();

      // Verify local password matching if present locally
      const isLocalMatch = localUser && localUser.passkey && localUser.passkey === cleanPassword;

      if (isLocalMatch) {
        const isCacheExpired = Date.now() - (localUser.cachedAt || 0) > 7 * 24 * 60 * 60 * 1000;
        if (isCacheExpired) {
          setError('Offline security clearance has expired. Establish network access to refresh access token keys.');
          setIsLoading(false);
          return;
        }

        const userRole = String(localUser.role).toLowerCase().trim();
        if (userRole !== 'manager' && userRole !== 'volunteer') {
          setError('Unauthorized user role level detected.');
          setIsLoading(false);
          return;
        }

        navigateByRole(userRole);
        return;
      }

      // 2. SECOND ATTEMPT: Fallback to Server Handshake (If missing locally OR password mismatch on initial setup)
      if (navigator.onLine) {
        setLoadingText('Verifying credentials against central directory server...');

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: cleanIdentifier, password: cleanPassword }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.message || 'Invalid username or password.');
          setIsLoading(false);
          return;
        }

        const remoteUser = data.user || data;

        if (!remoteUser || !remoteUser.identifier || !remoteUser.role) {
          setError('Malformed identification payload returned by cloud network nodes.');
          setIsLoading(false);
          return;
        }

        const userRole = String(remoteUser.role).toLowerCase().trim();

        // Check if role is authorized (Manager or Volunteer)
        if (userRole !== 'manager' && userRole !== 'volunteer') {
          setError('Access denied. Account is not provisioned with Manager or Volunteer privileges.');
          setIsLoading(false);
          return;
        }

        // Cache authenticated user session locally in IndexedDB for subsequent offline access
        await db.users.clear();
        await db.users.add({
          identifier: remoteUser.identifier,
          name: remoteUser.name || 'Matrix Operator',
          passkey: cleanPassword, // Stored locally for offline authentication fallback
          role: userRole,
          activeEventId: remoteUser.assignedEventId || 0,
          token: data.token || 'LOCAL_FALLBACK_TOKEN',
          cachedAt: Date.now(),
          syncStatus: 'synced'
        });

        setLoadingText('Synchronizing workspace records from cloud data anchors...');
        await hydrateDeviceFromCloud(remoteUser.identifier);

        // Auto-select the first available event as active workspace context
        const firstEvent = await db.events.toCollection().first();
        if (firstEvent && firstEvent.id) {
          await db.users.where('identifier').equals(remoteUser.identifier).modify({
            activeEventId: firstEvent.id
          });
        }

        // Redirect based on verified role
        navigateByRole(userRole);

      } else {
        // Device is offline AND local lookup failed
        if (!localUser) {
          setError('Volunteer/User account not found on this device. Establish an internet connection to perform initial credential verification.');
        } else {
          setError('Invalid password supplied.');
        }
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Dexie processing exception runtime trace:", err);
      setError('Internal terminal gateway authentication node error.');
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
    <div className={`min-h-screen ${theme.bg} ${theme.textMain} transition-colors duration-500 flex flex-col justify-center items-center p-4 relative overflow-hidden pt-10`}>
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Escape hatch button for public visitors */}
      <div className="absolute top-6 left-6">
        <button 
          type="button"
          onClick={() => router.push('/')} 
          className={`w-40 h-12 rounded-2xl border transition-all flex items-center justify-center group ${theme.input}`}
        >
          <Home size={18} className="text-slate-400 group-hover:text-blue-500 transition-colors mr-2" />
          <p className={`${!isDark ? 'text-black' : 'text-white'} font-semibold text-xs`}>Go to Home</p>
        </button>
      </div>

      <div className="absolute top-6 right-6">
        <button 
          type="button"
          onClick={() => setIsDark(!isDark)} 
          className={`w-12 h-12 rounded-2xl border transition-all flex items-center justify-center relative overflow-hidden ${theme.input}`}
        >
          <div className={`transition-all duration-500 transform ${isDark ? 'translate-y-0' : 'translate-y-12 opacity-0'}`}>
            <Sun size={20} className="text-amber-500 fill-amber-500/20" />
          </div>
          <div className={`absolute transition-all duration-500 transform ${!isDark ? 'translate-y-0' : '-translate-y-12 opacity-0'}`}>
            <Moon size={20} className="text-blue-400 fill-blue-400/10" />
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
              <span className="flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                {loadingText || 'Authenticating...'}
              </span>
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
      </div>

      <footer className="mt-8 text-[8px] font-black text-slate-600 uppercase tracking-[0.25em] relative z-10">
        Inspiring Leadership through Technical Innovation
      </footer>
    </div>
  );
}