import React from 'react';
import { useApp } from '../../context/AppContext';
import { getHomeIcon } from '../../lib/homeIcons';
import type { HomeCard } from '../../types';

/** Grilla de tarjetas de acceso rápido del panel del cliente — reemplaza
 * las cápsulas hardcodeadas del header ("Solicitar un servicio", "Reclamos
 * y garantías"). 100% editable desde el editor de página del admin (ver
 * src/components/admin/HomePageEditor.tsx): el admin decide cuántas,
 * cuáles, con qué ícono y a dónde linkean, sin tocar código. Ver pedido de
 * Sandy del 16/9. Si se pasa `cards`, renderiza ese tramo (orden unificado
 * intercalado con banners); si no, todas las tarjetas activas. */
export const CustomerHomeCards: React.FC<{ cards?: HomeCard[] }> = ({ cards }) => {
  const { homeCards, navigate } = useApp();
  const activeCards = cards
    ? cards
    : homeCards.filter((c) => c.isActive).sort((a, b) => a.displayOrder - b.displayOrder);

  if (activeCards.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {activeCards.map((card) => {
        const Icon = getHomeIcon(card.icon);
        return (
          <button
            key={card.id}
            type="button"
            onClick={() => navigate(card.linkPath)}
            className="flex flex-col items-start gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 text-left hover:border-teal-400 hover:shadow-xs transition-all"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 border border-teal-100 dark:border-teal-900 shrink-0">
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <b className="block text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">{card.title}</b>
              {card.description && (
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{card.description}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};
