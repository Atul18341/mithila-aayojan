'use client';

import { Smartphone, WifiOff, ShieldCheck, Play, Users, Ticket, ArrowRight } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

export default function Hero() {
  const { t } = useTranslation();

  return (
    <section className="relative pt-32 pb-20 px-6 overflow-hidden bg-white">
      {/* Background Blobs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-50 rounded-full blur-[120px] opacity-60" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-50 rounded-full blur-[120px] opacity-40" />
      </div>

      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
        
        {/* LEFT COLUMN */}
        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 px-4 py-1.5 rounded-full shadow-sm">
            <WifiOff size={14} className="text-orange-600" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">
              {t.heroBadge}
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight">
            {t.heroTitle} <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-red-600">
              {t.heroSpan}
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-gray-500 max-w-xl leading-relaxed">
            {t.heroSub}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5">
            <button className="group relative bg-gray-900 text-white px-8 py-4 rounded-2xl font-bold transition-all hover:bg-orange-600 hover:shadow-[0_20px_40px_rgba(234,88,12,0.3)] active:scale-95 flex items-center justify-center gap-2">
              {t.btnDemo}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button className="group flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-gray-700 border border-gray-200 bg-white hover:bg-gray-50 transition-all active:scale-95">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 text-orange-600 group-hover:scale-110 transition-transform">
                <Play size={14} fill="currentColor" />
              </span>
              {t.btnWatch}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: SIDE-BY-SIDE PHONES */}
        <div className="relative flex items-center justify-center min-h-[500px] md:min-h-[600px] w-full mt-12 lg:mt-0">
          <div className="flex flex-row items-center justify-center gap-4 md:gap-8 scale-75 sm:scale-90 md:scale-100 transition-transform duration-500">
            
            {/* Phone 1: Scanner (Left) */}
            <div className="relative w-[180px] md:w-[240px] aspect-[9/18.5] bg-gray-900 rounded-[2.5rem] border-[6px] md:border-[8px] border-gray-900 shadow-2xl transform -rotate-3 hover:rotate-0 transition-transform duration-500 overflow-hidden group">
              <div className="absolute inset-0 bg-green-600 flex flex-col items-center justify-center p-6 text-white text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
                  <div className="relative w-16 h-16 md:w-20 md:h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md">
                    <ShieldCheck size={40} className="md:w-12 md:h-12" />
                  </div>
                </div>
                <h3 className="text-lg md:text-xl font-black mb-1 uppercase tracking-tight">{t.dashVerified}</h3>
                <p className="text-white/70 text-[10px] md:text-xs font-medium italic">Mr. Ramesh Jha</p>
                <div className="mt-6 px-4 py-1.5 rounded-full border border-white/30 text-[8px] md:text-[9px] font-black tracking-widest bg-white/10 uppercase">
                  {t.dashMithilaVip}
                </div>
              </div>
            </div>

            {/* Phone 2: Dashboard (Right) */}
            <div className="relative w-[180px] md:w-[240px] aspect-[9/18.5] bg-white rounded-[2.5rem] border-[6px] md:border-[8px] border-gray-900 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500 overflow-hidden">
               <div className="p-4 md:p-6 pt-10">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center text-[8px] text-white font-bold italic">L</div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{t.dashLive}</span>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 text-blue-600 mb-1">
                        <Users size={14} />
                        <span className="text-[10px] font-bold uppercase">{t.dashOccupancy}</span>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter">842 / 1200</div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="flex items-center gap-2 text-orange-600 mb-1">
                        <Ticket size={14} />
                        <span className="text-[10px] font-bold uppercase">{t.dashBhoj}</span>
                      </div>
                      <div className="text-xl md:text-2xl font-black text-gray-900 tracking-tighter">315 {t.dashIssued}</div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-dashed border-gray-200">
                     <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="w-[70%] h-full bg-orange-500 animate-pulse" />
                     </div>
                     <p className="text-[9px] text-gray-400 mt-2 font-medium tracking-tight">{t.dashSync}</p>
                  </div>
               </div>
            </div>

          </div>
          {/* Decorative Background Blob behind phones */}
          <div className="absolute w-[400px] h-[400px] bg-orange-100 rounded-full blur-[100px] opacity-30 -z-10" />
        </div>
      </div>
    </section>
  );
}