import React from 'react';
import { Megaphone, Wrench, ChevronRight, Calendar, UserCheck, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/Badge';
import type { ServiceOrder, HomeBanner } from '../../types';

/** Ese espacio arriba del todo en /customer que antes quedaba vacío
 * (rediseño del 13/9): si el cliente tiene un servicio en curso, ahí se
 * prioriza informarle su estado; si no, se muestran TODOS los banners
 * activos y vigentes que cargó el admin en su editor de página (ver
 * src/components/admin/HomePageEditor.tsx), apilados — no solo el más
 * reciente. Nunca banners + servicio en curso juntos — pedido explícito de
 * Sandy.
 *
 * 16/9: lo que antes era "promos de texto" ahora es el editor de página
 * completo del admin — los banners soportan foto, gif o video (mp4)
 * subidos desde el panel, con link y texto de botón configurables
 * (linkPath/ctaLabel; caen a /customer/solicitar / "Ver servicios" si no
 * se cargaron). El orden lo decide el admin con las flechas subir/bajar
 * (displayOrder), ya no por fecha de creación. */

const ACTIVE_STATUSES: ServiceOrder['status'][] = ['assigned', 'in_progress', 'paused'];

const BannerCard: React.FC<{ banner: HomeBanner }> = ({ banner }) => {
  const { navigate } = useApp();
  const highlights = (banner.highlights || '')
    .split('|')
    .map((h) => h.trim())
    .filter(Boolean);
  const linkPath = banner.linkPath || '/customer/solicitar';
  const ctaLabel = banner.ctaLabel || 'Ver servicios';

  const media = banner.mediaUrl ? (
    banner.mediaType === 'video' ? (
      <video
        src={banner.mediaUrl}
        className="w-full h-full object-cover"
        autoPlay
        loop
        muted
        playsInline
      />
    ) : (
      <img src={banner.mediaUrl} alt="" className="w-full h-full object-cover" />
    )
  ) : null;

  // Con foto/gif/video: layout tipo hero de marketing (texto + bullets a la
  // izquierda, media a la derecha) — calcado del boceto que pidió Sandy.
  // Sin media: cae a la versión compacta solo-texto (banner cargado sin
  // archivo todavía).
  if (media) {
    return (
      <div className="rounded-xl overflow-hidden border border-teal-800/40 bg-[#0F172A] text-white">
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-5 sm:p-6 flex flex-col justify-center gap-3 min-w-0">
            <span className="inline-block w-fit text-[10px] font-bold uppercase tracking-wider text-teal-300 bg-teal-500/10 border border-teal-500/30 rounded-full px-2.5 py-1">
              {banner.badgeLabel}
            </span>
            <div>
              <h2 className="font-black text-2xl sm:text-3xl text-white leading-tight">{banner.title}</h2>
              <p className="text-sm text-slate-300 mt-1.5 max-w-md">{banner.description}</p>
            </div>
            {highlights.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {highlights.map((h) => (
                  <span key={h} className="inline-flex items-center gap-1.5 text-xs text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" /> {h}
                  </span>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => navigate(linkPath)}
              className="mt-1 w-fit inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 px-4 py-2.5 text-sm font-bold text-white"
            >
              <Wrench className="w-4 h-4" /> {ctaLabel}
            </button>
          </div>
          <div className="md:w-[42%] shrink-0 h-40 md:h-auto">{media}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-teal-800/40 bg-gradient-to-br from-[#0F172A] via-[#0F172A] to-teal-950 text-white p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
          <Megaphone className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-teal-300 mb-1">
            {banner.badgeLabel}
          </span>
          <h3 className="font-black text-lg sm:text-xl text-white leading-tight">{banner.title}</h3>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">{banner.description}</p>
          {highlights.length > 0 && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
              {highlights.map((h) => (
                <span key={h} className="inline-flex items-center gap-1 text-[11px] text-slate-200">
                  <CheckCircle2 className="w-3 h-3 text-teal-400 shrink-0" /> {h}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate(linkPath)}
          className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 px-4 py-2.5 text-sm font-bold text-white"
        >
          <Wrench className="w-4 h-4" /> {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export function findActiveCustomerOrder(orders: ServiceOrder[]): ServiceOrder | undefined {
  return orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
}

export const CustomerActiveServiceCard: React.FC<{ order: ServiceOrder }> = ({ order }) => {
  const { navigate } = useApp();
  return (
    <div className="rounded-xl border border-teal-800/40 bg-[#0F172A] text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500/15 text-teal-300">
        <UserCheck className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-300">Tu servicio en curso</span>
          <StatusBadge status={order.status} size="sm" />
        </div>
        <h3 className="font-bold text-sm text-white truncate">{order.title}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {order.scheduledDate}
          </span>
          <span>Técnico: {order.assignedTechnicianName || 'Asignando...'}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate(`/customer/orders/${encodeURIComponent(order.id)}`)}
        className="shrink-0 inline-flex items-center justify-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-500 px-3 py-2 text-xs font-bold text-white"
      >
        Ver seguimiento <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const CustomerBannerCard: React.FC<{ banner: HomeBanner }> = ({ banner }) => (
  <BannerCard banner={banner} />
);
