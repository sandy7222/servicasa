import React, { useState } from 'react';
import { Megaphone, Trash2, Calendar } from 'lucide-react';
import { useApp } from '../../context/AppContext';

/** Promos del mes que el admin carga a mano (rubro + descuento/precio +
 * texto libre) y que se muestran en el dashboard del cliente
 * (CustomerPromoBanner.tsx) cuando no tiene un servicio en curso. Solo la
 * más reciente activa y vigente se muestra — acá el admin ve y administra
 * todas (activas, inactivas, vencidas). Ver pedido de Sandy del 13/9. */
export const ServicePromotions: React.FC = () => {
  const { servicePromotions, addServicePromotion, updateServicePromotionActive, deleteServicePromotion } = useApp();

  const [rubro, setRubro] = useState('');
  const [badgeLabel, setBadgeLabel] = useState('PROMO ESPECIAL · ESTE MES');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [highlights, setHighlights] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubro.trim() || !title.trim() || !description.trim()) return;
    addServicePromotion({
      rubro: rubro.trim(),
      badgeLabel: badgeLabel.trim() || 'Promo del mes',
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim() || undefined,
      highlights: highlights.trim() || undefined,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
    });
    setRubro('');
    setTitle('');
    setDescription('');
    setStartsAt('');
    setEndsAt('');
    setImageUrl('');
    setHighlights('');
  };

  const isCurrentlyVigent = (p: { startsAt?: string | null; endsAt?: string | null }) => {
    const today = new Date().toISOString().slice(0, 10);
    if (p.startsAt && p.startsAt > today) return false;
    if (p.endsAt && p.endsAt < today) return false;
    return true;
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start gap-2 mb-3">
        <Megaphone className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Promociones del mes</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Se muestra la más reciente que esté activa y vigente en el dashboard del cliente — solo cuando no tiene un
            servicio en curso, ahí prioriza mostrarle el estado de su servicio.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="space-y-2 mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Rubro *</label>
            <input
              type="text"
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              placeholder="Ej: Cámaras de seguridad"
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              required
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Etiqueta (opcional)</label>
            <input
              type="text"
              value={badgeLabel}
              onChange={(e) => setBadgeLabel(e.target.value)}
              placeholder="PROMO ESPECIAL · ESTE MES"
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Título *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Ej: "20% de descuento" o "Precio fijo $150.000"'
            className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Descripción *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: en instalaciones de aires acondicionados para el verano"
            rows={2}
            className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg resize-none"
            required
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Imagen (opcional) — ruta /images/promos/... o URL
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="/images/promos/camaras-cercos.jpg"
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div className="flex-1 min-w-[220px]">
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Bullets separados por "|" (opcional)
            </label>
            <input
              type="text"
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              placeholder="Más seguridad|Monitoreo 24/7|Técnicos certificados"
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Desde (opcional)</label>
            <input
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Hasta (opcional)</label>
            <input
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={!rubro.trim() || !title.trim() || !description.trim()}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 shrink-0"
          >
            Publicar promo
          </button>
        </div>
      </form>

      {servicePromotions.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Todavía no cargaste ninguna promo.</p>
      ) : (
        <div className="space-y-2">
          {servicePromotions.map((p) => {
            const vigent = isCurrentlyVigent(p);
            return (
              <div key={p.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2.5">
                    {p.imageUrl && (
                      <img
                        src={p.imageUrl}
                        alt=""
                        className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-1">
                        {p.badgeLabel} · {p.rubro}
                      </span>
                      <b className="block text-xs text-slate-900 dark:text-slate-100">{p.title}</b>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{p.description}</p>
                      {p.highlights && (
                        <p className="text-[10px] text-teal-700 dark:text-teal-400 mt-0.5">
                          {p.highlights.split('|').map((h) => h.trim()).filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {(p.startsAt || p.endsAt) && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {p.startsAt || '…'} → {p.endsAt || '…'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateServicePromotionActive(p.id, !p.isActive)}
                      className={`text-[10px] font-bold rounded-full px-2 py-1 border ${
                        p.isActive
                          ? vigent
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                          : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800'
                      }`}
                      title={p.isActive ? 'Click para desactivar' : 'Click para activar'}
                    >
                      {p.isActive ? (vigent ? 'Activa' : 'Activa (fuera de fecha)') : 'Inactiva'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteServicePromotion(p.id)}
                      title="Eliminar promo"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
