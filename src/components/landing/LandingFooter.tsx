import React from 'react';
import { Logo } from '../common/Logo';
import { useApp } from '../../context/AppContext';
import { goToLandingSection } from '../../lib/landingScrollFraming';
import { OPEN_DIAGNOSIS_ASSISTANT_EVENT } from '../common/DiagnosisAssistant';

type FooterLink = {
  label: string;
  href?: string;
  action?: 'assistant';
  boundaryId?: string;
};

export const LandingFooter: React.FC = () => {
  const { navigate, currentPath } = useApp();

  const handleLink = (link: FooterLink) => {
    if (link.action === 'assistant') {
      window.dispatchEvent(new CustomEvent(OPEN_DIAGNOSIS_ASSISTANT_EVENT, { detail: { reset: true } }));
      return;
    }
    if (!link.href) return;
    if (link.href.startsWith('#')) {
      goToLandingSection(navigate, currentPath, link.href.slice(1), link.boundaryId);
      return;
    }
    if (link.href.startsWith('mailto:')) {
      window.location.href = link.href;
      return;
    }
    navigate(link.href);
  };

  const columns: { title: string; links: FooterLink[] }[] = [
    {
      title: 'Enlaces',
      links: [
        { label: 'Quiénes somos', href: '/quienes-somos' },
        { label: 'Servicios', href: '#servicios-ofrecidos' },
        { label: 'Cómo funciona', href: '#como-funciona', boundaryId: 'garantia' },
        { label: 'Garantía', href: '#garantia' },
        { label: 'Términos y condiciones', href: '/terminos' },
        { label: 'Trabajá con nosotros', href: '/auth?mode=apply' },
      ],
    },
    {
      title: 'Ayuda',
      links: [{ label: 'Asistencia', action: 'assistant' }],
    },
    {
      title: 'Contacto',
      links: [
        { label: 'Empresas', href: '#contacto' },
        { label: 'Contacto', href: 'mailto:hola@tecniurbano.online' },
      ],
    },
  ];

  return (
    <footer className="bg-[#0B1B33] text-white pt-16 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-1">
          <Logo size="md" variant="white" showTagline />
          <p className="text-[13px] text-slate-400 mt-4 leading-relaxed max-w-[16rem]">
            Servicios técnicos a domicilio con seguimiento en tiempo real, de principio a fin.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">{col.title}</h4>
            <ul className="space-y-2.5">
              {col.links.map((link) => (
                <li key={link.label}>
                  <button
                    type="button"
                    onClick={() => handleLink(link)}
                    className="text-sm text-slate-300 hover:text-teal-300 transition-colors duration-200"
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-6 border-t border-white/[0.06] text-center">
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} TecniUrbano. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};
