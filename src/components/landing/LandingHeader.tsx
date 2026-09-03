import React, { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from '../common/Logo';
import { useApp } from '../../context/AppContext';

interface NavAnchor {
  label: string;
  href: string;
}

const NAV_ANCHORS: NavAnchor[] = [
  { label: 'Servicios', href: '#servicios-ofrecidos' },
  { label: 'Cómo funciona', href: '#como-funciona' },
  { label: 'Garantía', href: '#garantia' },
  { label: 'Contacto', href: '#contacto' },
];

/**
 * Header de marketing exclusivo de la landing pública (visible solo sin sesión
 * iniciada — ver App.tsx). El <Header/> compartido de las vistas autenticadas
 * (admin/técnico/cliente) no se toca.
 */
export const LandingHeader: React.FC = () => {
  const { navigate } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollToAnchor = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <header
      className="sticky top-0 z-40 bg-[#0B1B33]/95 backdrop-blur-sm border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04),0_8px_24px_-16px_rgba(0,0,0,0.6)]"
      id="tecniurbano-landing-header"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-[4.5rem]">
          <button onClick={() => navigate('/')} className="shrink-0 transition-opacity hover:opacity-90">
            <Logo size="md" showText showTagline={false} variant="white" />
          </button>

          <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
            {NAV_ANCHORS.map((a) => (
              <button
                key={a.href}
                onClick={() => scrollToAnchor(a.href)}
                className="text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200"
              >
                {a.label}
              </button>
            ))}
            <button
              onClick={() => navigate('/auth?mode=apply')}
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors duration-200"
            >
              Trabajá con nosotros
            </button>
          </nav>

          <div className="hidden lg:block">
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-[#0B1B33] font-bold text-sm transition-colors duration-200"
            >
              Ingresar al sistema
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden p-2.5 text-slate-300 hover:text-white rounded-md hover:bg-slate-800 min-w-11 min-h-11 flex items-center justify-center"
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-[#0F172A] px-4 py-4 space-y-1">
          {NAV_ANCHORS.map((a) => (
            <button
              key={a.href}
              onClick={() => scrollToAnchor(a.href)}
              className="block w-full text-left px-3 py-3 rounded-lg text-sm font-semibold text-slate-200 hover:bg-slate-800 min-h-11"
            >
              {a.label}
            </button>
          ))}
          <button
            onClick={() => {
              setMobileOpen(false);
              navigate('/auth?mode=apply');
            }}
            className="block w-full text-left px-3 py-3 rounded-lg text-sm font-semibold text-slate-200 hover:bg-slate-800 min-h-11"
          >
            Trabajá con nosotros
          </button>
          <button
            onClick={() => navigate('/auth')}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm transition-colors"
          >
            Ingresar al sistema
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
};
