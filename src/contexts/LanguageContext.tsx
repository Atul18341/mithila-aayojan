'use client';
import React, { createContext, useContext, useState } from 'react';
import { translations, Locale } from '@/lib/translations';

const LanguageContext = createContext<any>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Locale>('en');
  const t = translations[lang];
  const selectLang = (newLang: Locale) => setLang(newLang);

  return (
    <LanguageContext.Provider value={{ t, lang, selectLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useTranslation = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useTranslation must be used within LanguageProvider");
  return context;
};