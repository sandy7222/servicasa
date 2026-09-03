import React from 'react';
import { Download, PlayCircle, Clock, ShieldCheck, MessageCircle } from 'lucide-react';
import tecnicoHeroWebp from '../../assets/landing/tecnico-hero.webp';
import tecnicoHeroPng from '../../assets/landing/tecnico-hero.png';

interface HeroSectionProps {
  onDownloadClick: () => void;
  onHowItWorksClick: () => void;
}

const BENEFITS = [
  { icon: <Clock className="w-4 h-4" strokeWidth={1.75} />, label: 'Seguimiento en tiempo real' },
  { icon: <ShieldCheck className="w-4 h-4" strokeWidth={1.75} />, label: 'Garantía de 30 días' },
  { icon: <MessageCircle className="w-4 h-4" strokeWidth={1.75} />, label: 'Apertura de reclamo 48 hs' },
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
    <section className="relative overflow-hidden bg-gradient-to-b from-[#071A32] via-[#003875] to-[#00284f] text-white">
      {/* Foto del técnico a todo el alto de la sección — solo desktop. La fusión con el
          fondo es un degradado progresivo de 5 paradas (~22% del ancho de la foto),
          no un corte entre dos columnas. */}
      <div className="hidden lg:block absolute inset-y-0 right-0 w-[56%]">
        <div
          className="absolute inset-y-0 left-0 w-[24%] z-10"
          style={{
            background:
              'linear-gradient(to right, #00203d 0%, #00203d 12%, rgba(0,32,61,0.85) 45%, rgba(0,32,61,0.35) 78%, rgba(0,32,61,0) 100%)',
          }}
          aria-hidden="true"
        />
        <TechnicianPicture className="w-full h-full object-cover object-[center_25%]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 lg:py-28 relative z-20">
        <div className="text-center lg:text-left lg:max-w-[45%]">
          <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.05]">
            <span className="block text-white">Soluciones rápidas para</span>
            <span className="block text-teal-400">tu hogar</span>
          </h1>
          <p className="mt-6 text-blue-100/85 text-base leading-relaxed max-w-xl mx-auto lg:mx-0">
            Pedí un técnico, seguí el trabajo en tiempo real y disfrutá la tranquilidad de un
            servicio garantizado.
          </p>

          <ul className="mt-8 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-3 text-sm text-blue-50">
            {BENEFITS.map((b) => (
              <li key={b.label} className="flex items-center gap-2">
                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-teal-400/10 text-teal-300">
                  {b.icon}
                </span>
                {b.label}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col sm:flex-row items-center gap-3 justify-center lg:justify-start">
            <button
              onClick={onDownloadClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-teal-400 hover:bg-teal-300 text-[#00203d] font-bold text-sm shadow-lg shadow-teal-500/20 transition-colors duration-200"
            >
              <Download className="w-4 h-4" strokeWidth={2} />
              Descargá la app
            </button>
            <button
              onClick={onHowItWorksClick}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-white font-semibold text-sm transition-colors duration-200"
            >
              <PlayCircle className="w-4 h-4" strokeWidth={1.75} />
              Cómo funciona
            </button>
          </div>

          <p className="mt-6 text-xs text-blue-200/60 tracking-wide">Disponible para Android e iOS</p>
        </div>

        {/* Mobile/tablet: foto contenida debajo del texto, sin bleed a todo el alto. */}
        <div className="mt-10 lg:hidden">
          <TechnicianPicture className="w-full h-auto max-h-[420px] rounded-2xl object-cover shadow-xl shadow-black/20" />
        </div>
      </div>
    </section>
  );
};
