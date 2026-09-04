import React, { useState } from 'react';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Logo } from '../common/Logo';
import { useApp } from '../../context/AppContext';
import { goToLandingSection } from '../../lib/landingScrollFraming';
import { ThemeToggle } from '../common/ThemeToggle';

interface NavAnchor {
  label: string;
  targetId: string;
  // La banda de garantía sigue formando parte de la escena "Cómo funciona"
  // aunque sea otra sección en el DOM — por eso ese anchor encuadra hasta ahí.
  boundaryId?: string;
}

const NAV_ANCHORS: NavAnchor[] = [
  { label: 'Servicios', targetId: 'servicios-ofrecidos' },
  { label: 'Cómo funciona', targetId: 'como-funciona', boundaryId: 'garantia' },
  { label: 'La App', targetId: 'descarga-app' },
  { label: 'Opiniones', targetId: 'testimonios' },
  { label: 'Empresas', targetId: 'contacto' },
];

/**
 * Header de marketing exclusivo de la landing pública (visible solo sin sesión
 * iniciada — ver App.tsx). El <Header/> compartido de las vistas autenticadas
 * (admin/técnico/cliente) no se toca.
 */
export const LandingHeader: React.FC = () => {
  const { navigate, currentPath } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);

  const scrollToAnchor = (a: NavAnchor) => {
    setMobileOpen(false);
    const run = () => goToLandingSection(navigate, currentPath, a.targetId, a.boundaryId);
    // Esperar a que React aplique el cierre del menú antes de medir: si el
    // menú mobile estaba abierto, calcular el scroll en el mismo tick
    // mediría el header todavía "alto" por el menú desplegado.
    setTimeout(run, 0);
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
                key={a.targetId}
                onClick={() => scrollToAnchor(a)}
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

          <div className="hidden lg:flex items-center gap-2">
            <ThemeToggle variant="bar" />
            <button
              onClick={() => navigate('/auth')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-400 hover:bg-teal-300 text-[#0B1B33] font-bold text-sm transition-colors duration-200"
            >
              Ingresar al sistema
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex lg:hidden items-center gap-1">
            <ThemeToggle variant="bar" />
            <button
              onClick={() => setMobileOpen((v) => !v)}
              className="p-2.5 text-slate-300 hover:text-white rounded-md hover:bg-slate-800 min-w-11 min-h-11 flex items-center justify-center"
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-slate-800 bg-[#0F172A] px-4 py-4 space-y-1">
          {NAV_ANCHORS.map((a) => (
            <button
              key={a.targetId}
              onClick={() => scrollToAnchor(a)}
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
