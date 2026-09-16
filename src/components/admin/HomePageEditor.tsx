import React, { useRef, useState } from 'react';
import {
  Megaphone,
  LayoutGrid,
  Trash2,
  Calendar,
  Pencil,
  X,
  ArrowUp,
  ArrowDown,
  Loader2,
  Film,
  Plus,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { uploadHomeBannerMedia } from '../../lib/supabaseMutations';
import { HOME_ICON_OPTIONS, getHomeIcon } from '../../lib/homeIcons';
import type { HomeBanner, HomeBannerInput, HomeBannerMediaType, HomeCard, HomeCardInput } from '../../types';

/** Editor de página del admin para el panel del cliente (/customer):
 * banners de publicidad (imagen/gif/video, arriba y abajo) + tarjetas
 * linkeables (reemplazan las cápsulas "Solicitar un servicio"/"Reclamos y
 * garantías" del header). Todo editable sin tocar código — subida de
 * archivos, reordenar con flechas, activar/desactivar, borrar. Ver pedido
 * de Sandy del 16/9 ("editor de pagina" con banners + tarjetas + grilla de
 * íconos). Reemplaza a ServicePromotions.tsx. */

type BannerDraft = HomeBannerInput & { id?: string };
type CardDraft = HomeCardInput & { id?: string };

const EMPTY_BANNER_DRAFT: BannerDraft = {
  rubro: '',
  badgeLabel: 'PROMO ESPECIAL · ESTE MES',
  title: '',
  description: '',
  startsAt: '',
  endsAt: '',
  highlights: '',
  linkPath: '',
  ctaLabel: '',
  mediaUrl: '',
  mediaType: 'image',
};

const EMPTY_CARD_DRAFT: CardDraft = {
  icon: 'Wrench',
  title: '',
  description: '',
  linkPath: '',
};

function isCurrentlyVigent(p: { startsAt?: string | null; endsAt?: string | null }): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (p.startsAt && p.startsAt > today) return false;
  if (p.endsAt && p.endsAt < today) return false;
  return true;
}

function statusPillClasses(isActive: boolean, vigent: boolean): string {
  if (!isActive) return 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800';
  if (!vigent) return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
}

const BannersSection: React.FC = () => {
  const { homeBanners, addHomeBanner, updateHomeBanner, updateHomeBannerActive, deleteHomeBanner, swapHomeBannerOrder } =
    useApp();
  const [draft, setDraft] = useState<BannerDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sorted = [...homeBanners].sort((a, b) => a.displayOrder - b.displayOrder);

  const openNew = () => setDraft({ ...EMPTY_BANNER_DRAFT });
  const openEdit = (b: HomeBanner) =>
    setDraft({
      id: b.id,
      rubro: b.rubro,
      badgeLabel: b.badgeLabel,
      title: b.title,
      description: b.description,
      startsAt: b.startsAt || '',
      endsAt: b.endsAt || '',
      highlights: b.highlights || '',
      linkPath: b.linkPath || '',
      ctaLabel: b.ctaLabel || '',
      mediaUrl: b.mediaUrl || '',
      mediaType: b.mediaType,
    });
  const closeForm = () => {
    setDraft(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    setUploading(true);
    try {
      const { url, mediaType } = await uploadHomeBannerMedia(file);
      setDraft((prev) => (prev ? { ...prev, mediaUrl: url, mediaType } : prev));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.rubro.trim() || !draft.title.trim() || !draft.description.trim()) return;
    const input: HomeBannerInput = {
      rubro: draft.rubro.trim(),
      badgeLabel: draft.badgeLabel.trim() || 'Promo del mes',
      title: draft.title.trim(),
      description: draft.description.trim(),
      mediaUrl: draft.mediaUrl?.trim() || undefined,
      mediaType: draft.mediaType,
      highlights: draft.highlights?.trim() || undefined,
      linkPath: draft.linkPath?.trim() || undefined,
      ctaLabel: draft.ctaLabel?.trim() || undefined,
      startsAt: draft.startsAt || undefined,
      endsAt: draft.endsAt || undefined,
    };
    if (draft.id) {
      updateHomeBanner(draft.id, input);
    } else {
      addHomeBanner(input);
    }
    closeForm();
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2">
          <Megaphone className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Banners de publicidad</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Se muestran apilados en el dashboard del cliente cuando no tiene un servicio en curso — ahí prioriza
              mostrarle el estado de su servicio. Soportan foto, gif o video (mp4).
            </p>
          </div>
        </div>
        {!draft && (
          <button
            type="button"
            onClick={openNew}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar banner
          </button>
        )}
      </div>

      {draft && (
        <form
          onSubmit={handleSubmit}
          className="space-y-2 mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {draft.id ? 'Editar banner' : 'Nuevo banner'}
            </span>
            <button type="button" onClick={closeForm} className="p-1 rounded-md text-slate-400 hover:text-slate-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Rubro *</label>
              <input
                type="text"
                value={draft.rubro}
                onChange={(e) => setDraft({ ...draft, rubro: e.target.value })}
                placeholder="Ej: Cámaras de seguridad"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                required
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Etiqueta (opcional)</label>
              <input
                type="text"
                value={draft.badgeLabel}
                onChange={(e) => setDraft({ ...draft, badgeLabel: e.target.value })}
                placeholder="PROMO ESPECIAL · ESTE MES"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Título *</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder='Ej: "20% de descuento" o "Precio fijo $150.000"'
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Descripción *</label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Ej: en instalaciones de aires acondicionados para el verano"
              rows={2}
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              Foto, gif o video (opcional) — jpg, png, gif o mp4
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,video/mp4"
                onChange={handleFileChange}
                disabled={uploading}
                className="flex-1 text-xs text-slate-600 dark:text-slate-400"
              />
              {uploading && <Loader2 className="w-4 h-4 text-teal-600 animate-spin shrink-0" />}
            </div>
            {draft.mediaUrl && !uploading && (
              <div className="mt-2 flex items-center gap-2">
                {draft.mediaType === 'video' ? (
                  <video src={draft.mediaUrl} className="w-20 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700" muted />
                ) : (
                  <img src={draft.mediaUrl} alt="" className="w-20 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                )}
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, mediaUrl: '' })}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700"
                >
                  Quitar archivo
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Bullets separados por "|" (opcional)
              </label>
              <input
                type="text"
                value={draft.highlights}
                onChange={(e) => setDraft({ ...draft, highlights: e.target.value })}
                placeholder="Más seguridad|Monitoreo 24/7|Técnicos certificados"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Link del botón (opcional — default /customer/solicitar)
              </label>
              <input
                type="text"
                value={draft.linkPath}
                onChange={(e) => setDraft({ ...draft, linkPath: e.target.value })}
                placeholder="/customer/solicitar"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Texto del botón (opcional — default "Ver servicios")
              </label>
              <input
                type="text"
                value={draft.ctaLabel}
                onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
                placeholder="Ver servicios"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Desde (opcional)</label>
              <input
                type="date"
                value={draft.startsAt}
                onChange={(e) => setDraft({ ...draft, startsAt: e.target.value })}
                className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Hasta (opcional)</label>
              <input
                type="date"
                value={draft.endsAt}
                onChange={(e) => setDraft({ ...draft, endsAt: e.target.value })}
                className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={!draft.rubro.trim() || !draft.title.trim() || !draft.description.trim() || uploading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 shrink-0"
            >
              {draft.id ? 'Guardar cambios' : 'Publicar banner'}
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Todavía no cargaste ningún banner.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((b, idx) => {
            const vigent = isCurrentlyVigent(b);
            return (
              <div key={b.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex items-start gap-2.5">
                    {b.mediaUrl &&
                      (b.mediaType === 'video' ? (
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-900 flex items-center justify-center">
                          <video src={b.mediaUrl} className="w-full h-full object-cover" muted />
                          <Film className="w-4 h-4 text-white absolute" />
                        </div>
                      ) : (
                        <img
                          src={b.mediaUrl}
                          alt=""
                          className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ))}
                    <div className="min-w-0">
                      <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 mb-1">
                        {b.badgeLabel} · {b.rubro}
                      </span>
                      <b className="block text-xs text-slate-900 dark:text-slate-100">{b.title}</b>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{b.description}</p>
                      {b.highlights && (
                        <p className="text-[10px] text-teal-700 dark:text-teal-400 mt-0.5">
                          {b.highlights.split('|').map((h) => h.trim()).filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {(b.startsAt || b.endsAt) && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                          <Calendar className="w-3 h-3" />
                          {b.startsAt || '…'} → {b.endsAt || '…'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => idx > 0 && swapHomeBannerOrder(b.id, sorted[idx - 1].id)}
                      disabled={idx === 0}
                      title="Subir"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => idx < sorted.length - 1 && swapHomeBannerOrder(b.id, sorted[idx + 1].id)}
                      disabled={idx === sorted.length - 1}
                      title="Bajar"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateHomeBannerActive(b.id, !b.isActive)}
                      className={`text-[10px] font-bold rounded-full px-2 py-1 border ${statusPillClasses(b.isActive, vigent)}`}
                      title={b.isActive ? 'Click para desactivar' : 'Click para activar'}
                    >
                      {b.isActive ? (vigent ? 'Activo' : 'Activo (fuera de fecha)') : 'Inactivo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteHomeBanner(b.id)}
                      title="Eliminar banner"
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

const CardsSection: React.FC = () => {
  const { homeCards, addHomeCard, updateHomeCard, updateHomeCardActive, deleteHomeCard, swapHomeCardOrder } = useApp();
  const [draft, setDraft] = useState<CardDraft | null>(null);

  const sorted = [...homeCards].sort((a, b) => a.displayOrder - b.displayOrder);

  const openNew = () => setDraft({ ...EMPTY_CARD_DRAFT });
  const openEdit = (c: HomeCard) =>
    setDraft({ id: c.id, icon: c.icon, title: c.title, description: c.description || '', linkPath: c.linkPath });
  const closeForm = () => setDraft(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.title.trim() || !draft.linkPath.trim()) return;
    const input: HomeCardInput = {
      icon: draft.icon,
      title: draft.title.trim(),
      description: draft.description?.trim() || undefined,
      linkPath: draft.linkPath.trim(),
    };
    if (draft.id) {
      updateHomeCard(draft.id, input);
    } else {
      addHomeCard(input);
    }
    closeForm();
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2">
          <LayoutGrid className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tarjetas de acceso rápido</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Reemplazan las cápsulas fijas del header del cliente. Agregá, quitá o reordená las que quieras y
              linkealas a donde quieras.
            </p>
          </div>
        </div>
        {!draft && (
          <button
            type="button"
            onClick={openNew}
            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-xs font-bold"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar tarjeta
          </button>
        )}
      </div>

      {draft && (
        <form
          onSubmit={handleSubmit}
          className="space-y-2 mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {draft.id ? 'Editar tarjeta' : 'Nueva tarjeta'}
            </span>
            <button type="button" onClick={closeForm} className="p-1 rounded-md text-slate-400 hover:text-slate-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Ícono</label>
            <div className="grid grid-cols-8 sm:grid-cols-11 gap-1.5">
              {HOME_ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => setDraft({ ...draft, icon: name })}
                  className={`aspect-square flex items-center justify-center rounded-lg border ${
                    draft.icon === name
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 hover:border-teal-400 hover:text-teal-600'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Título *</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder='Ej: "Solicitar Servicio"'
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Descripción (opcional)</label>
            <input
              type="text"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Ej: Pedí un técnico a domicilio"
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Link *</label>
              <input
                type="text"
                value={draft.linkPath}
                onChange={(e) => setDraft({ ...draft, linkPath: e.target.value })}
                placeholder="/customer/solicitar"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!draft.title.trim() || !draft.linkPath.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 shrink-0"
            >
              {draft.id ? 'Guardar cambios' : 'Publicar tarjeta'}
            </button>
          </div>
        </form>
      )}

      {sorted.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Todavía no cargaste ninguna tarjeta.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map((c, idx) => {
            const Icon = getHomeIcon(c.icon);
            return (
              <div key={c.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-600 border border-teal-100 dark:border-teal-900">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <b className="block text-xs text-slate-900 dark:text-slate-100">{c.title}</b>
                      {c.description && <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.description}</p>}
                      <span className="text-[10px] font-mono text-slate-400">{c.linkPath}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => idx > 0 && swapHomeCardOrder(c.id, sorted[idx - 1].id)}
                      disabled={idx === 0}
                      title="Subir"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => idx < sorted.length - 1 && swapHomeCardOrder(c.id, sorted[idx + 1].id)}
                      disabled={idx === sorted.length - 1}
                      title="Bajar"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateHomeCardActive(c.id, !c.isActive)}
                      className={`text-[10px] font-bold rounded-full px-2 py-1 border ${
                        c.isActive
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800'
                      }`}
                      title={c.isActive ? 'Click para desactivar' : 'Click para activar'}
                    >
                      {c.isActive ? 'Activa' : 'Inactiva'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteHomeCard(c.id)}
                      title="Eliminar tarjeta"
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

export const HomePageEditor: React.FC = () => {
  return (
    <div className="space-y-4">
      <BannersSection />
      <CardsSection />
    </div>
  );
};
