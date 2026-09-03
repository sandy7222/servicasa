import React from 'react';
import { Download, PlayCircle, Clock, ShieldCheck, MessageCircle } from 'lucide-react';
import tecnicoHeroWebp from '../../assets/landing/tecnico-hero.webp';
import tecnicoHeroPng from '../../assets/landing/tecnico-hero.png';

interface HeroSectionProps {
  onDownloadClick: () => void;
  onHowItWorksClick: () => void;
}

const BENEFITS = [
  { icon: <Clock className="w-4 h-4" />, label: 'Seguimiento en tiempo real' },
  { icon: <ShieldCheck className="w-4 h-4" />, label: 'Garantía de 30 días' },
  { icon: <MessageCircle className="w-4 h-4" />, label: 'Apertura de reclamo 48 hs' },
];

const TechnicianPicture: React.FC<{ className: string }> = ({ className }) => (
  <picture>
    <source srcSet={tecnicoHeroWebp} type="image/webp" />
    <img
      src={tecnicoHeroPng}
      alt="Técnico de TecniUrbano revisando el pedido desde su celular en el domicilio del cliente"
      width={1400}
      height={933}
      className={className}
      fetchPriority="high"
      draggable={false}
    />
  </picture>
);

export const HeroSection: React.FC<HeroSectionProps> = ({ onDownloadClick, onHowItWorksClick }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-blue-950 via-[#003875] to-[#00264d] text-white">
      {/* Foto del técnico a todo el alto de la sección — solo desktop, ver versión mobile más abajo. */}
      <div className="hidden lg:block absolute inset-y-0 right-0 w-[54%]">
        <div
          className="absolute inset-y-0 left-0 w-48 bg-gradient-to-r from-[#00264d] via-[#00264d]/70 to-transparent z-10"
          aria-hidden="true"
        />
        <TechnicianPicture className="w-full h-full object-cover object-[center_25%]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 relative z-20">
        <div className="text-center lg:text-left space-y-6 lg:max-w-[44%]">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Soluciones rápidas para <span className="text-teal-400">tu hogar</span>
          </h1>
          <p className="text-blue-100/90 text-sm sm:text-base max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Pedí un técnico, seguí el trabajo en tiempo real y disfrutá la tranquilidad de un
            servicio garantizado.
          </p>

          <ul className="flex flex-wrap justify-center lg:justify-start gap-x-5 gap-y-2 text-xs sm:text-sm text-blue-100">
            {BENEFITS.map((b) => (
              <li key={b.label} className="flex items-center gap-1.5">
                <span className="text-teal-400">{b.icon}</span>
                {b.label}
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start pt-2">
            <button
              onClick={onDownloadClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-sm shadow-lg shadow-teal-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Download className="w-4 h-4" />
              Descargá la app
            </button>
            <button
              onClick={onHowItWorksClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-sm transition-colors"
            >
              <PlayCircle className="w-4 h-4" />
              Cómo funciona
            </button>
          </div>

          <p className="text-xs text-blue-200/70">Disponible para Android e iOS</p>
        </div>

        {/* Mobile/tablet: foto contenida debajo del texto, sin bleed a todo el alto. */}
        <div className="mt-8 lg:hidden">
          <TechnicianPicture className="w-full h-auto max-h-[420px] rounded-2xl object-cover shadow-2xl" />
        </div>
      </div>
    </section>
  );
};
