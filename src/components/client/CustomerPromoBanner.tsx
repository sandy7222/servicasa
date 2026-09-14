import React from 'react';
import { Megaphone, Wrench, ChevronRight, Calendar, UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import type { ServiceOrder } from '../../types';

/** Ese espacio arriba del todo en /customer que antes quedaba vacío
 * (rediseño del 13/9): si el cliente tiene un servicio en curso, ahí se
 * prioriza informarle su estado; si no, se muestra la promo del mes vigente
 * que cargó el admin (ServicePromotions.tsx). Nunca las dos cosas juntas —
 * pedido explícito de Sandy. */

const ACTIVE_STATUSES: ServiceOrder['status'][] = ['assigned', 'in_progress', 'paused'];

type Props = {
  orders: ServiceOrder[];
};

export const CustomerPromoBanner: React.FC<Props> = ({ orders }) => {
  const { servicePromotions, navigate } = useApp();

  const activeOrder = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  if (activeOrder) {
    return (
      <div className="rounded-xl border border-teal-800/40 bg-[#0F172A] text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
          <UserCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">Tu servicio en curso</span>
            <StatusBadge status={activeOrder.status} size="sm" />
          </div>
          <h3 className="font-bold text-sm text-white truncate">{activeOrder.title}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {activeOrder.scheduledDate}
            </span>
            <span>Técnico: {activeOrder.assignedTechnicianName || 'Asignando...'}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/customer/orders/${encodeURIComponent(activeOrder.id)}`)}
          className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-500 px-3 py-2 text-xs font-bold text-white"
        >
          Ver seguimiento <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const promo = servicePromotions
    .filter((p) => p.isActive && (!p.startsAt || p.startsAt <= today) && (!p.endsAt || p.endsAt >= today))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

  if (!promo) return null;

  return (
    <div className="rounded-xl border border-teal-800/40 bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-teal-950 text-white p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
          <Megaphone className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-teal-300 mb-1">
            {promo.badgeLabel}
          </span>
          <h3 className="font-black text-lg sm:text-xl text-white leading-tight">{promo.title}</h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">{promo.description}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/customer/solicitar')}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 px-4 py-2.5 text-sm font-bold text-white"
        >
          <Wrench className="w-4 h-4" /> Ver servicios
        </button>
      </div>
    </div>
  );
};
