import React from 'react';
import { ShieldCheck, Clock } from 'lucide-react';
import { LandingModal } from './LandingModal';
import { LANDING_STEPS } from './landingSteps';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDownloadClick: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, onDownloadClick }) => {
  return (
    <LandingModal
      isOpen={isOpen}
      onClose={onClose}
      titleId="how-it-works-modal-title"
      title="¿Cómo funciona TecniUrbano?"
      subtitle="Pedís el servicio desde la app y te acompañamos hasta que quede resuelto."
    >
      {/* Estructura preparada para insertar un video explicativo más adelante sin rehacer el modal. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {LANDING_STEPS.map((s) => (
          <div key={s.step} className="flex flex-col items-center text-center gap-2 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700">
            <div className="w-11 h-11 rounded-full bg-[#003875] text-white flex items-center justify-center">
              {s.icon}
            </div>
            <span className="text-xs font-mono font-bold text-slate-400">Paso {s.step}</span>
            <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">{s.title}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{s.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3 text-xs sm:text-sm">
        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 font-semibold">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          30 días de garantía
        </div>
        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 font-semibold">
          <Clock className="w-4 h-4 shrink-0" />
          Reclamo dentro de las 48 hs
        </div>
      </div>

      <button
        onClick={onDownloadClick}
        className="mt-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-teal-400 hover:bg-teal-300 text-[#00203d] font-bold text-sm shadow-lg shadow-teal-500/20 transition-colors duration-200"
      >
        Descargá TecniUrbano
      </button>
    </LandingModal>
  );
};
