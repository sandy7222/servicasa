import React from 'react';
import mascotImage from '../../assets/landing/asistente-cuerpo.png';

/**
 * El muñequito de TecniUrbano (dibujado por Sandy) en pantallas vacías y momentos de éxito.
 * Reglas (26/11/2026): como mucho una vez por pantalla y nunca en formularios, pagos en curso ni
 * en la herramienta de presupuesto. Hoy hay una sola pose; cuando Sandy dibuje las otras
 * (saludando, festejando, pensando) se agregan acá y cada lugar elige la suya.
 */
export const Mascot: React.FC<{ className?: string }> = ({ className = 'h-28' }) => (
  <img src={mascotImage} alt="" aria-hidden="true" className={`w-auto select-none ${className}`} draggable={false} />
);

type Props = {
  title: string;
  description?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  /** Tamaño reducido para paneles chicos (por ejemplo la campanita). */
  compact?: boolean;
  children?: React.ReactNode;
};

export const MascotEmptyState: React.FC<Props> = ({ title, description, action, compact, children }) => (
  <div className={`text-center ${compact ? 'py-4' : 'py-2'}`}>
    <Mascot className={`mx-auto ${compact ? 'h-16' : 'h-28'}`} />
    <h3 className={`mt-2 font-bold text-slate-900 dark:text-slate-100 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</h3>
    {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
    {action && (
      <button
        type="button"
        onClick={action.onClick}
        className="mt-3 inline-flex items-center rounded-lg bg-teal-500 hover:bg-teal-400 px-4 py-2 text-xs font-bold text-slate-950 transition-colors"
      >
        {action.label}
      </button>
    )}
    {children}
  </div>
);
