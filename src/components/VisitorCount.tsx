// src/components/VisitorCounter.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Users, Calendar } from 'lucide-react';

export default function VisitorCounter() {
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [dailyCount, setDailyCount] = useState<number | null>(null);

  useEffect(() => {
    async function trackAndFetchVisitor() {
      try {
        const hasCounted = sessionStorage.getItem('site_visitor_counted');

        if (!hasCounted) {
          const res = await fetch('/api/visitors', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.success && typeof data.count === 'number') {
              setVisitorCount(data.count);
              setDailyCount(data.dailyCount ?? 0);
              sessionStorage.setItem('site_visitor_counted', 'true');
              return;
            }
          }
        }

        const res = await fetch('/api/visitors');
        if (res.ok) {
          const data = await res.json();
          if (data.success && typeof data.count === 'number') {
            setVisitorCount(data.count);
            setDailyCount(data.dailyCount ?? 0);
          }
        }
      } catch (err) {
        console.warn('Visitor counter network error:', err);
      }
    }

    trackAndFetchVisitor();
  }, []);

  if (visitorCount === null) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-md shadow-inner">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
          <Calendar size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Today's Visitors</span>
          <span className="text-md text-center font-black tracking-tight text-slate-200">
            {(dailyCount ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="h-6 w-[1px] bg-slate-700" />

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
          <Users size={20} />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Total Visitors</span>
          <span className="text-md text-center font-black tracking-tight text-slate-200">
            {visitorCount.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
