// src/components/Footer.tsx
'use client';

import React from 'react';
import { Mail, MapPin, Phone, ExternalLink, ShieldCheck } from 'lucide-react';
import { LinkedinIcon, WhatsappIcon, InstagramIcon } from '../lib/SocialIcons';
import Image from 'next/image';
import VisitorCounter from '../components/VisitorCount';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#020617] text-white pt-24 pb-12 px-6 border-t border-white/5 relative overflow-hidden">
      {/* Decorative Glow */}
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[120px] -z-0" />

      <div className="max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-20">
          
          {/* COLUMN 1: BRAND IDENTITY */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-blue-600/20 relative">
                <Image 
                  src="/icons/lyss.webp" 
                  alt="Lyss Technology Logo" 
                  fill
                  className="object-cover"
                />
              </div>
              <span className="text-xl font-black tracking-tighter uppercase">Lyss Technology</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Pioneering "Offline-First" software architectures and digital transformation for India's emerging markets. 
              A DPIIT Recognized Startup building from the heart of Mithila.
            </p>
            {/* 🌟 SOCIAL ICONS CONTAINER */}
            <div className="flex items-center gap-3">
              <a 
                href="https://linkedin.com/company/lysstechnology" 
                target="_blank" rel="noopener noreferrer"
                className="group relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-[#0077b5] hover:border-[#0077b5]/50 transition-all duration-300"
              >
                <LinkedinIcon/>
              </a>
               <a 
                href="https://instagram.com/lyss.technology" 
                target="_blank" rel="noopener noreferrer"
                className="group relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-[#e1306c] hover:border-[#e1306c]/50 transition-all duration-300"
              >
                <InstagramIcon/>
              </a>
               <a 
                href="https://wa.me/919122461780?text=*Hello,%20Lyss%20Technology%20Team*,%0A%20I%20would%20like%20to%20connect%20regarding%20your%20services%20and%20products." 
                target="_blank" 
                rel="noopener noreferrer"
                className="group relative flex items-center justify-center w-11 h-11 rounded-xl bg-white/5 border border-white/10 hover:bg-[#25D366] hover:border-[#25D366]/50 transition-all duration-300"
              >
                <WhatsappIcon />
              </a>
            </div>
          </div>

          {/* COLUMN 2: ECOSYSTEM PRODUCTS */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">The Ecosystem</h4>
            <ul className="space-y-4">
               <li>
                <div className="group flex flex-col cursor-pointer" onClick={() => window.open("https://atplc.in", "_blank")}>
                  <span className="text-sm font-bold group-hover:text-blue-400 transition-colors">ATPLC</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Our practical-oriented training platform</span>
                </div>
              </li>
              <li>
                <div className="group flex flex-col cursor-pointer">
                  <span className="text-sm font-bold group-hover:text-blue-400 transition-colors">Mithila Aayojan</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Event Management SaaS</span>
                </div>
              </li>
              <li>
                <div className="group flex flex-col cursor-pointer" onClick={() => window.open("https://certibanao.lyss.in", "_blank")}>
                  <span className="text-sm font-bold group-hover:text-blue-400 transition-colors">CertiBanao</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">Blockchain-secured Certificate Generation Platform</span>
                </div>
              </li>
              <li>
                <div className="group flex flex-col cursor-pointer" onClick={() => window.open("https://examvia.lyss.in", "_blank")}>
                  <span className="text-sm font-bold group-hover:text-blue-400 transition-colors">Examvia</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest">One Platform, Any Exam.</span>
                </div>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: REGIONAL IMPACT */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-red-500">Bihar Impact</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-red-500/10 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck size={14} className="text-red-500" />
                </div>
                <span className="text-sm text-slate-400">Technical Partner: Let's Inspire Bihar (Madhubani Chapter)</span>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={16} className="text-slate-500 mt-1" />
                <div>
                  <p className="text-sm font-bold">Madhubani Office</p>
                  <p className="text-xs text-slate-500">Mithila Region, Bihar, India</p>
                </div>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: CONTACT & SUPPORT */}
          <div className="space-y-6">
            <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Work With Us</h4>
            <div className="space-y-4">
              <a href="mailto:hello@lysstechnology.com" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
                <Mail size={18} className="group-hover:text-blue-500" />
                <span className="text-sm font-medium tracking-tight">support@lyss.in</span>
              </a>
              <a href="tel:+919122461780" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
                <Phone size={18} className="group-hover:text-blue-500" />
                <span className="text-sm font-medium tracking-tight">+91 91224 61780</span>
              </a>
              <div className="pt-4">
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-2">Technical Lead</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-bold text-white uppercase tracking-tighter">Support Systems Online</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* BOTTOM STRIP */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-center md:text-left space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
              © {currentYear} LYSS TECHNOLOGY PRIVATE LIMITED. All Rights Reserved.
            </p>
            <p className="text-[9px] text-slate-600 font-medium tracking-widest">
              CIN: U85499BR2024PTC067227 | DPIIT: DIPP184365
            </p>
          </div>
          
          {/* 🌟 MODULAR VISITOR COUNTER COMPONENT */}
          <VisitorCounter />

          <div className="flex gap-8">
            <a 
              href="https://www.lyss.in/privacy-page" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
              Privacy Policy
              <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
            <a 
              href="https://www.lyss.in/terms-page" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
              Terms
              <ExternalLink size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}