'use client';

import React, { useState } from 'react';
import { Send, MessageSquare, LayoutDashboard, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

export default function CtaFlow() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', phone: '', business: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call to your CRM or Database
    setTimeout(() => {
      setLoading(false);
      setStep('success');
    }, 1500);
  };

  return (
    <section className="py-24 px-6 bg-white overflow-hidden">
      <div className="max-w-4xl mx-auto">
        <div className="relative bg-[#020617] rounded-[3rem] p-8 md:p-16 shadow-2xl shadow-blue-900/20">
          
          {/* Subtle Ambient Background */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-[100px] -z-0" />

          <div className="relative z-10">
            {step === 'form' ? (
              /* --- STEP 1: MINIMAL DATA CAPTURE --- */
              <div className="space-y-10">
                <div className="text-center space-y-4">
                  <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight">
                    Start your <span className="text-blue-500">Digital Journey.</span>
                  </h2>
                  <p className="text-slate-400 text-sm md:text-lg">
                    Tell us a bit about you, and we'll unlock the next steps.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    required
                    type="text"
                    placeholder="Your Name"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 transition-all outline-none"
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                  <input
                    required
                    type="tel"
                    placeholder="Phone Number"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 transition-all outline-none"
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                  <select 
                    className="md:col-span-2 w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-slate-400 focus:border-blue-500 transition-all outline-none appearance-none"
                    onChange={(e) => setFormData({...formData, business: e.target.value})}
                  >
                    <option value="">Select Business Type</option>
                    <option value="manufacturing">Manufacturing (Makhana/Others)</option>
                    <option value="retail">Retail / POS</option>
                    <option value="events">Event Management</option>
                    <option value="other">Other IT Solutions</option>
                  </select>

                  <button 
                    disabled={loading}
                    className="md:col-span-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-2xl uppercase tracking-widest text-xs flex items-center justify-center gap-3 transition-all active:scale-95"
                  >
                    {loading ? <Loader2 className="animate-spin" /> : <>Continue to Access <ArrowRight size={16} /></>}
                  </button>
                </form>
              </div>
            ) : (
              /* --- STEP 2: THE CHOICE (WHATSAPP OR DEMO) --- */
              <div className="text-center space-y-10 animate-in fade-in zoom-in duration-500">
                <div className="space-y-4">
                  <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle2 size={40} className="text-green-500" />
                  </div>
                  <h3 className="text-3xl font-black text-white">Awesome, {formData.name.split(' ')[0]}!</h3>
                  <p className="text-slate-400">Your details are verified. How would you like to proceed?</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* WhatsApp Path */}
                  <a 
                    href={`https://wa.me/919122461780?text=Hi%20Lyss%20Team,%20my%20name%20is%20${formData.name}%20from%20the%20${formData.business}%20sector.%20I%20just%20filled%20the%20form.`}
                    target="_blank"
                    className="group p-8 rounded-[2rem] bg-green-600/10 border border-green-500/20 hover:bg-green-600 transition-all duration-500"
                  >
                    <MessageSquare size={32} className="text-green-500 group-hover:text-white mx-auto mb-4" />
                    <span className="block text-white font-black text-lg">Instant Chat</span>
                    <span className="text-[10px] text-green-400 group-hover:text-green-100 uppercase tracking-widest font-bold">Connect on WhatsApp</span>
                  </a>

                  {/* Demo Path */}
                  <a 
                    href="/demo" 
                    className="group p-8 rounded-[2rem] bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600 transition-all duration-500"
                  >
                    <LayoutDashboard size={32} className="text-blue-500 group-hover:text-white mx-auto mb-4" />
                    <span className="block text-white font-black text-lg">Self Explore</span>
                    <span className="text-[10px] text-blue-400 group-hover:text-blue-100 uppercase tracking-widest font-bold">Try Live Demo</span>
                  </a>
                </div>

                <button 
                  onClick={() => setStep('form')}
                  className="text-slate-500 text-[10px] uppercase font-bold tracking-widest hover:text-white transition-colors"
                >
                  ← Go back to form
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}