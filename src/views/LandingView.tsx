import React, { useEffect, useState } from 'react';
import { scrollToFramedSection, peekQueuedLandingScroll, clearQueuedLandingScroll } from '../lib/landingScrollFraming';
import { LandingHeader } from '../components/landing/LandingHeader';
import { HeroSection } from '../components/landing/HeroSection';
import { HowItWorksModal } from '../components/landing/HowItWorksModal';
import { ServicesSection } from '../components/landing/ServicesSection';
import { HowItWorksSection } from '../components/landing/HowItWorksSection';
import { TrustBand } from '../components/landing/TrustBand';
import { DownloadAppSection } from '../components/landing/DownloadAppSection';
import { TestimonialsSection } from '../components/landing/TestimonialsSection';
import { BusinessSection } from '../components/landing/BusinessSection';
import { LandingFooter } from '../components/landing/LandingFooter';

export const LandingView: React.FC = () => {
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  useEffect(() => {
    const pending = peekQueuedLandingScroll();
    if (!pending) return;
    let attempts = 0;
    let timer = 0;
    const tryScroll = () => {
      if (document.getElementById(pending.targetId)) {
        scrollToFramedSection(pending.targetId, pending.boundaryId);
        clearQueuedLandingScroll();
        return;
      }
      if (attempts < 20) {
        attempts += 1;
        timer = window.setTimeout(tryScroll, 50);
      }
    };
    timer = window.setTimeout(tryScroll, 50);
    return () => window.clearTimeout(timer);
  }, []);

  const scrollToDownload = () => {
    scrollToFramedSection('descarga-app');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200" id="tecniurbano-landing-view">
      <LandingHeader />

      <HeroSection
        onDownloadClick={scrollToDownload}
        onHowItWorksClick={() => setHowItWorksOpen(true)}
      />

      <ServicesSection />
      <HowItWorksSection />
      <TrustBand />

      <div id="descarga-app">
        <DownloadAppSection />
      </div>

      <TestimonialsSection />
      <BusinessSection />
      <LandingFooter />

      <HowItWorksModal
        isOpen={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        onDownloadClick={() => {
          setHowItWorksOpen(false);
          scrollToDownload();
        }}
      />
    </div>
  );
};
