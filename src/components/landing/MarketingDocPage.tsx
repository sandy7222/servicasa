import React, { useEffect } from 'react';
import { LandingHeader } from './LandingHeader';
import { LandingFooter } from './LandingFooter';

export const MarketingDocPage: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      <LandingHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{title}</h1>
        <div className="mt-8 space-y-4 text-[15px] leading-relaxed text-slate-600 dark:text-slate-400">{children}</div>
      </main>
      <LandingFooter />
    </div>
  );
};
