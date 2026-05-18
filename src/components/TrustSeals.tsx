'use client';

import React from 'react';
import { ShieldCheck, Lock, Award, Building2, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

export default function TrustSeals() {
  const { t } = useTranslation();

  const seals = [
    {
      id: 'mca',
      icon: <Building2 className="text-blue-700" size={22} />,
      label: "Corporate Identity",
      org: "LYSS TECHNOLOGY PVT. LTD.",
      sub: "CIN: U85499BR2024PTC067227",
      bgColor: "bg-white",
    },
    {
      id: 'dpiit',
      icon: <Award className="text-orange-600" size={22} />,
      label: "Innovation Recognition",
      org: "DPIIT, Govt. of India",
      sub: "DPIIT: DIPP184365",
      bgColor: "bg-white",
      active: true
    },
    {
      id: 'lib',
      icon: <CheckCircle2 className="text-red-600" size={22} />,
      label: "Regional Impact",
      org: "Let's Inspire Bihar Madhubani Chapter",
      sub: "Official Technical Partner",
      bgColor: "bg-white",
    },
    {
      id: 'ssl',
      icon: <Lock className="text-green-600" size={22} />,
      label: "Data Security",
      org: "256-bit SSL Secured",
      sub: "End-to-End Encryption",
      bgColor: "bg-white",
    }
  ];

  return (
    <section className="py-20 bg-white">
      {/* 1. Added max-w-6xl for a smaller, focused width */}
      <div className="w-full mx-auto">
        
        {/* Symmetric Divider */}
        <div className="flex items-center gap-4 mb-12">
          <div className="h-[1px] flex-grow bg-gray-100" />
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-100 bg-gray-50/50">
            <ShieldCheck size={14} className="text-gray-400" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
              Verified Compliance
            </span>
          </div>
          <div className="h-[1px] flex-grow bg-gray-100" />
        </div>

        {/* --- SMALLER RADIUS GRID --- */}
        {/* 2. Added rounded-[2rem] and shadow to make the "small" section pop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-800 border border-slate-800  overflow-hidden shadow-2xl shadow-slate-200">
          {seals.map((seal) => (
            <div 
              key={seal.id} 
              className="group relative bg-[#020617] p-8 transition-all duration-300 hover:bg-slate-900"
            >
              <div className="flex items-center justify-center mb-6">
                <div className={`w-10 h-10 ${seal.bgColor} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-500`}>
                  {seal.icon}
                </div>
                {seal.active && (
                <div className="absolute top-6 right-6 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500"></span>
                  </span>
                  <span className="text-[8px] font-black text-green-400 uppercase tracking-widest">
                    Active
                  </span>
                </div>
              )}
              </div>

              <div className="space-y-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                  {seal.label}
                </p>
                <h4 className="text-sm font-bold text-white leading-tight">
                  {seal.org}
                </h4>
                <div className="pt-2">
                  <span className="text-[9px] font-mono text-slate-400 bg-white/5 px-1.5 py-0.5 rounded select-all">
                    {seal.sub}
                  </span>
                </div>
              </div>

              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-20 transition-opacity">
                <ArrowUpRight size={14} className="text-white" />
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer aligned to the small width */}
        <p className="mt-8 text-center text-[10px] text-slate-400 font-medium italic">
          * Verifiable via MCA and Startup India portals.
        </p>
      </div>
    </section>
  );
}