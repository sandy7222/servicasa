import React, { useState } from 'react';
import { scrollToFramedSection } from '../lib/landingScrollFraming';
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
