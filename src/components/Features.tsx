'use client';

import React from 'react';
import { 
  Smartphone, 
  WifiOff, 
  Map, 
  Zap, 
  Languages,
  ArrowRight,
  UserPlus,
  PieChart,
  BellRing,
  History
} from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

export default function CoordinationFeatures() {
  const { t } = useTranslation();

  // Mapping the translation keys to the icons and accent colors
  const featureData = [
    { id: 'f1', icon: <Smartphone />, color: 'blue', key: 'featVIP' },
    { id: 'f2', icon: <WifiOff />, color: 'orange', key: 'featOffline' },
    { id: 'f3', icon: <Map />, color: 'green', key: 'featHeatmap' },
    { id: 'f4', icon: <Languages />, color: 'purple', key: 'featMaithili' },
    { id: 'f5', icon: <UserPlus />, color: 'pink', key: 'featSpot' },
    { id: 'f6', icon: <PieChart />, color: 'indigo', key: 'featAnalytics' },
    { id: 'f7', icon: <BellRing />, color: 'red', key: 'featSMS' },
    { id: 'f8', icon: <History />, color: 'cyan', key: 'featArchive' },
  ];

  return (
    <section id="features" className="py-24 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        
        {/* --- HEADER --- */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-[10px] font-black uppercase tracking-widest mb-4">
            <Zap size={12} fill="currentColor" /> {t.featureTag}
          </div>
          <h2 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">
            {t.featureHeadingMain} <span className="text-orange-600">{t.featureHeadingSpan}</span>
          </h2>
        </div>

        {/* --- THE FEATURE GRID --- */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {featureData.map((item) => (
           <FeatureCard 
              key={item.id}
              icon={React.cloneElement(item.icon as React.ReactElement<any>, { 
                className: `text-${item.color}-600 w-full h-full` 
              })}
              // Accessing translations dynamically using the keys
              title={t[`${item.key}Title`]}
              description={t[`${item.key}Desc`]}
              footer={t[`${item.key}Footer`]}
              accentColor={item.color as any}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* --- REUSABLE CARD COMPONENT --- */
function FeatureCard({ 
  icon, 
  title, 
  description, 
  accentColor, 
  footer 
}: { 
  icon: React.ReactNode, 
  title: string, 
  description: string, 
  accentColor: 'blue' | 'orange' | 'green' | 'purple' | 'pink' | 'indigo' | 'red' | 'cyan',
  footer: string
}) {
  const accentClasses = {
    blue: 'border-blue-100 bg-blue-50/20',
    orange: 'border-orange-100 bg-orange-50/20',
    green: 'border-green-100 bg-green-50/20',
    purple: 'border-purple-100 bg-purple-50/20',
    pink: 'border-pink-100 bg-pink-50/20',
    indigo: 'border-indigo-100 bg-indigo-50/20',
    red: 'border-red-100 bg-red-50/20',
    cyan: 'border-cyan-100 bg-cyan-50/20'
  };

  return (
    <div className={`group p-8 rounded-[2.5rem] border-2 transition-all duration-500 hover:shadow-xl hover:-translate-y-2 flex flex-col h-full ${accentClasses[accentColor]}`}>
      <div className="mb-6 w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center transition-transform group-hover:scale-110 group-hover:rotate-6">
        {icon}
      </div>
      <h3 className="text-lg font-black text-gray-900 mb-3 tracking-tight">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed mb-8 flex-grow">{description}</p>
      <div className="pt-6 border-t border-gray-100/50 flex items-center justify-between mt-auto">
        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">{footer}</span>
        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-300 group-hover:bg-gray-900 group-hover:text-white transition-all">
          <ArrowRight size={14} />
        </div>
      </div>
    </div>
  );
}