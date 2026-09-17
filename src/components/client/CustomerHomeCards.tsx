import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getHomeIcon } from '../../lib/homeIcons';
import type { HomeCard } from '../../types';

/** Grilla de tarjetas de acceso rápido del panel del cliente — reemplaza
 * las cápsulas hardcodeadas del header ("Solicitar un servicio", "Reclamos
 * y garantías"). 100% editable desde el editor de página del admin (ver
 * src/components/admin/HomePageEditor.tsx): el admin decide cuántas,
 * cuáles, con qué ícono y a dónde linkean, sin tocar código. Ver pedido de
 * Sandy del 16/9. Si se pasa `cards`, renderiza ese tramo (orden unificado
 * intercalado con banners); si no, todas las tarjetas activas.
 * Proporción y tamaño de ícono alineados al boceto de Codex del 13/9:
 * 4 por fila, tiles bajos (no cuadrados), ícono grande tipo outline. */
export const CustomerHomeCards: React.FC<{ cards?: HomeCard[] }> = ({ cards }) => {
  const { homeCards, navigate } = useApp();
  const activeCards = cards
    ? cards
    : homeCards.filter((c) => c.isActive).sort((a, b) => a.displayOrder - b.displayOrder);

  if (activeCards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
      {activeCards.map((card) => {
        const Icon = getHomeIcon(card.icon);
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => navigate(card.linkPath)}
            className="min-w-0 flex flex-col items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-4 sm:px-4 sm:py-5 text-left hover:border-teal-400 hover:shadow-xs transition-all"
          >
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-500 shrink-0">
              <Icon className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={1.6} />
            </div>
            <div className="min-w-0 w-full">
              <b className="block text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">{card.title}</b>
              {card.description && (
                <p className="flex items-start gap-1 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  <span className="min-w-0 line-clamp-2">{card.description}</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0 mt-0.5 text-slate-400" />
                </p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
