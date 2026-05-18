'use client';

import React from 'react';
import { Quote } from 'lucide-react';

export default function LyssIntegrity() {
  return (
    <section className="py-20 bg-gray-50/50 border-t border-gray-100">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center gap-12">
          
          {/* THE "LYSS INSIDE" SEAL */}
          <div className="relative flex-shrink-0 group">
            <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border-4 border-dashed border-blue-600/20 flex items-center justify-center p-4 group-hover:rotate-12 transition-transform duration-700">
               {/* Place your Lyss Logo here */}
               <div className="text-center">
                 <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Built with</span>
                 <p className="text-2xl font-black text-slate-900 leading-tight">INTEGRITY</p>
                 <span className="text-[10px] font-bold text-slate-400">by LYSS TECHNOLOGY</span>
               </div>
            </div>
            {/* Small Floating LIB Logo to show local ecosystem */}
            <div className="absolute -bottom-2 -right-2 bg-white p-2 rounded-xl shadow-lg border border-red-50" title="Let's Inspire Bihar Partner">
               <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center text-[8px] text-white font-bold">LIB</div>
            </div>
          </div>

          {/* THE PERSONAL PROMISE */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 text-blue-600">
              <Quote size={24} fill="currentColor" className="opacity-20" />
              <span className="text-xs font-black uppercase tracking-widest">A Promise to Mithila</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight">
              Mithila Aayojan is more than code; <span className="text-blue-600">it’s a commitment.</span>
            </h3>
            <p className="text-slate-600 leading-relaxed italic">
              "We aren't just selling software; we are professionalizing event management in Bihar. 
              Our 'LYSS Technology' team provides the strategy and local presence to ensure your event is flawless, 
              leveraging our expertise from Lyss Flow and our roots in the LIB ecosystem."
            </p>
            <div className="flex items-center gap-4 pt-2">
               <div className="h-[1px] w-12 bg-slate-200" />
               <p className="text-xs font-black uppercase tracking-widest text-slate-400">Founded in Madhubani, Trusted Globally</p>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}