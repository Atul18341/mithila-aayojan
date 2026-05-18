'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
  FileText, 
  UserCheck, 
  ChevronRight, 
  PartyPopper, 
  Utensils, 
  Gift, 
  MessageSquare,
  LayoutGrid
} from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

type Mode = 'government' | 'social';

export default function Solutions() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('government');
  const isGov = mode === 'government';

  return (
    <section id="solutions" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        
        {/* --- SECTION HEADER --- */}
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-4xl md:text-6xl font-black text-gray-900 tracking-tight">
            {t.solHeadline} <span className="text-orange-600">{t.solHeadlineSpan}</span>
          </h2>
          <p className="text-gray-500 text-lg font-medium max-w-2xl mx-auto leading-relaxed">
            {t.solSubheadline}
          </p>
        </div>

        {/* --- THE CHAMELEON SWITCHER --- */}
        <div className="flex p-1.5 bg-gray-100 rounded-[2rem] mb-12 max-w-md mx-auto shadow-inner border border-gray-200">
          <button 
            onClick={() => setMode('government')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.5rem] text-sm font-bold transition-all duration-300 ${
              isGov ? 'bg-white text-blue-700 shadow-lg scale-100' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <ShieldCheck size={18} />
            {t.modeGov}
          </button>
          <button 
            onClick={() => setMode('social')}
            className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-[1.5rem] text-sm font-bold transition-all duration-300 ${
              !isGov ? 'bg-orange-600 text-white shadow-lg scale-100' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <PartyPopper size={18} />
            {t.modeSocial}
          </button>
        </div>

        {/* --- DYNAMIC CHAMELEON CARD --- */}
        <div className={`relative overflow-hidden rounded-[3rem] border-2 transition-all duration-700 shadow-2xl ${
          isGov ? 'bg-slate-50 border-blue-100 shadow-blue-900/10' : 'bg-orange-50/30 border-orange-100 shadow-orange-900/10'
        }`}>
          
          <div className="grid lg:grid-cols-2 items-stretch">
            
            {/* Left Brand Panel */}
            <div className={`p-12 lg:p-20 flex flex-col justify-center transition-colors duration-700 relative overflow-hidden ${
              isGov ? 'bg-blue-700 text-white' : 'bg-orange-600 text-white'
            }`}>
              <div className="absolute inset-0 opacity-10 pointer-events-none">
                <LayoutGrid size={400} className="absolute -right-20 -bottom-20 rotate-12" />
              </div>

              <div className="relative z-10">
                <div className="mb-8 inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl backdrop-blur-md">
                  {isGov ? <UserCheck size={32} /> : <PartyPopper size={32} />}
                </div>
                <h3 className="text-3xl md:text-5xl font-black mb-6 leading-[1.1]">
                  {isGov ? t.solGovTitle : t.solSocialTitle}
                </h3>
                <p className="text-lg opacity-80 leading-relaxed mb-10 max-w-md">
                  {isGov ? t.solGovDesc : t.solSocialDesc}
                </p>
                <button className="flex items-center gap-3 font-black group text-sm uppercase tracking-widest bg-white/10 px-6 py-3 rounded-xl hover:bg-white/20 transition-all">
                  {t.solExplore} <ChevronRight size={20} className="group-hover:translate-x-2 transition-transform" />
                </button>
              </div>
            </div>

            {/* Right Feature Panel */}
            <div className="p-10 lg:p-20 flex flex-col justify-center bg-white">
              <div className="space-y-10">
                <div className="inline-block px-4 py-1 rounded-full bg-gray-100 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                  {isGov ? t.solGovBadge : t.solSocialBadge}
                </div>
                
                <div className="grid gap-10">
                  {isGov ? (
                    <>
                      <FeatureItem 
                        icon={<ShieldCheck className="text-blue-600" />} 
                        title={t.solFeatIdTitle} 
                        desc={t.solFeatIdDesc} 
                      />
                      <FeatureItem 
                        icon={<LayoutGrid className="text-blue-600" />} 
                        title={t.solFeatZoneTitle} 
                        desc={t.solFeatZoneDesc} 
                      />
                      <div className="space-y-4">
                        <FeatureItem 
                          icon={<FileText className="text-blue-600" />} 
                          title={t.solFeatAuditTitle} 
                          desc={t.solFeatAuditDesc} 
                        />
                        <div className="ml-20">
                          <button className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 text-xs font-bold rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all group">
                            <FileText size={14} />
                            {t.solBtnDownload}
                            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <FeatureItem 
                        icon={<MessageSquare className="text-orange-600" />} 
                        title={t.solFeatInviteTitle} 
                        desc={t.solFeatInviteDesc} 
                      />
                      <FeatureItem 
                        icon={<Gift className="text-orange-600" />} 
                        title={t.solFeatShagunTitle} 
                        desc={t.solFeatShagunDesc} 
                      />
                      <FeatureItem 
                        icon={<Utensils className="text-orange-600" />} 
                        title={t.solFeatBhojTitle} 
                        desc={t.solFeatBhojDesc} 
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
}

function FeatureItem({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex gap-6 group">
      <div className="flex-shrink-0 w-14 h-14 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center transition-all group-hover:bg-white group-hover:shadow-xl group-hover:scale-110">
        {icon}
      </div>
      <div className="space-y-1">
        <h5 className="font-bold text-gray-900 text-lg">{title}</h5>
        <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}