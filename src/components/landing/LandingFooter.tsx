import React from 'react';
import { Logo } from '../common/Logo';
import { useApp } from '../../context/AppContext';

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

export const LandingFooter: React.FC = () => {
  const { navigate } = useApp();

  const scrollOrNavigate = (href: string) => {
    if (href.startsWith('#')) {
      document.querySelector(href)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate(href);
    }
  };

  const columns: FooterColumn[] = [
    {
      title: 'Enlaces',
      links: [
        { label: 'Servicios', href: '#servicios-ofrecidos' },
        { label: 'Cómo funciona', href: '#como-funciona' },
        { label: 'Garantía', href: '#garantia' },
        { label: 'Contacto', href: '#contacto' },
        { label: 'Empresas', href: '#contacto' },
      ],
    },
    {
      title: 'Ayuda',
      // Sin rutas reales todavía (no hay páginas de FAQ/legales en el sitio hoy)
      // — se dejan como texto simple en vez de links rotos.
      links: [],
    },
  ];

  return (
    <footer className="bg-slate-900 text-white pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <Logo size="md" variant="white" showTagline />
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            Servicios técnicos a domicilio con seguimiento en tiempo real, de principio a fin.
          </p>
        </div>

        {columns.map((col) =>
          col.links.length > 0 ? (
            <div key={col.title}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <button
                      onClick={() => scrollOrNavigate(link.href)}
                      className="text-sm text-slate-300 hover:text-teal-300 transition-colors"
                    >
                      {link.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div key={col.title}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">{col.title}</h4>
              <p className="text-sm text-slate-500 italic">Próximamente</p>
            </div>
          )
        )}

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Contacto</h4>
          <a href="mailto:hola@tecniurbano.online" className="text-sm text-slate-300 hover:text-teal-300 transition-colors">
            hola@tecniurbano.online
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10 pt-6 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-500">© {new Date().getFullYear()} TecniUrbano. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
};
