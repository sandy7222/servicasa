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
import { combineHomeBlocks, isCurrentlyVigent } from '../../lib/homeBlocks';
import {
  BANNER_BACKGROUND_PRESETS,
  DEFAULT_BANNER_BACKGROUND,
  DEFAULT_BANNER_MEDIA_FADE,
  clampBannerMediaFade,
  normalizeBannerBackground,
} from '../../lib/homeBannerStyle';
import type { HomeBanner, HomeBannerInput, HomeCard, HomeCardInput } from '../../types';

/** Editor de página del admin para el panel del cliente (/customer):
 * banners y tarjetas en UNA sola secuencia (el admin decide el intercalado
 * con flechas). Los formularios de alta/edición siguen siendo específicos
 * de cada tipo. Ver pedido de Sandy del 16/9 y el orden unificado del 17/9. */

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
  backgroundColor: DEFAULT_BANNER_BACKGROUND,
  mediaFade: DEFAULT_BANNER_MEDIA_FADE,
};

const EMPTY_CARD_DRAFT: CardDraft = {
  icon: 'Wrench',
  title: '',
  description: '',
  linkPath: '',
};

function statusPillClasses(isActive: boolean, vigent: boolean): string {
  if (!isActive) return 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-950 dark:text-slate-400 dark:border-slate-800';
  if (!vigent) return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
}

export const HomePageEditor: React.FC = () => {
  const {
    homeBanners,
    addHomeBanner,
    updateHomeBanner,
    updateHomeBannerActive,
    deleteHomeBanner,
    homeCards,
    addHomeCard,
    updateHomeCard,
    updateHomeCardActive,
    deleteHomeCard,
    swapHomeBlockOrder,
  } = useApp();
  const [bannerDraft, setBannerDraft] = useState<BannerDraft | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const blocks = combineHomeBlocks(homeBanners, homeCards);

  const openNewBanner = () => {
    setCardDraft(null);
    setBannerDraft({ ...EMPTY_BANNER_DRAFT });
  };
  const openEditBanner = (b: HomeBanner) => {
    setCardDraft(null);
    setBannerDraft({
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
      backgroundColor: normalizeBannerBackground(b.backgroundColor),
      mediaFade: clampBannerMediaFade(b.mediaFade),
    });
  };
  const closeBannerForm = () => {
    setBannerDraft(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openNewCard = () => {
    setBannerDraft(null);
    setCardDraft({ ...EMPTY_CARD_DRAFT });
  };
  const openEditCard = (c: HomeCard) => {
    setBannerDraft(null);
    setCardDraft({ id: c.id, icon: c.icon, title: c.title, description: c.description || '', linkPath: c.linkPath });
  };
  const closeCardForm = () => setCardDraft(null);

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bannerDraft) return;
    setUploading(true);
    try {
      const { url, mediaType } = await uploadHomeBannerMedia(file);
      setBannerDraft((prev) => (prev ? { ...prev, mediaUrl: url, mediaType } : prev));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'No se pudo subir el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleBannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerDraft || !bannerDraft.rubro.trim() || !bannerDraft.title.trim() || !bannerDraft.description.trim()) return;
    const input: HomeBannerInput = {
      rubro: bannerDraft.rubro.trim(),
      badgeLabel: bannerDraft.badgeLabel.trim() || 'Promo del mes',
      title: bannerDraft.title.trim(),
      description: bannerDraft.description.trim(),
      mediaUrl: bannerDraft.mediaUrl?.trim() || undefined,
      mediaType: bannerDraft.mediaType,
      highlights: bannerDraft.highlights?.trim() || undefined,
      linkPath: bannerDraft.linkPath?.trim() || undefined,
      ctaLabel: bannerDraft.ctaLabel?.trim() || undefined,
      startsAt: bannerDraft.startsAt || undefined,
      endsAt: bannerDraft.endsAt || undefined,
      backgroundColor: normalizeBannerBackground(bannerDraft.backgroundColor),
      mediaFade: clampBannerMediaFade(bannerDraft.mediaFade),
    };
    if (bannerDraft.id) {
      updateHomeBanner(bannerDraft.id, input);
    } else {
      addHomeBanner(input);
    }
    closeBannerForm();
  };

  const handleCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardDraft || !cardDraft.title.trim() || !cardDraft.linkPath.trim()) return;
    const input: HomeCardInput = {
      icon: cardDraft.icon,
      title: cardDraft.title.trim(),
      description: cardDraft.description?.trim() || undefined,
      linkPath: cardDraft.linkPath.trim(),
    };
    if (cardDraft.id) {
      updateHomeCard(cardDraft.id, input);
    } else {
      addHomeCard(input);
    }
    closeCardForm();
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-2">
          <LayoutGrid className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Página del cliente</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Banners y tarjetas comparten un solo orden. Las flechas mueven cada ítem respecto del vecino, del tipo
              que sea. En el panel del cliente, las tarjetas consecutivas se ven como una grilla. Si el cliente tiene
              un servicio en curso, este bloque se reemplaza por el seguimiento.
            </p>
          </div>
        </div>
        {!bannerDraft && !cardDraft && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={openNewBanner}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar banner
            </button>
            <button
              type="button"
              onClick={openNewCard}
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar tarjeta
            </button>
          </div>
        )}
      </div>

      {bannerDraft && (
        <form
          onSubmit={handleBannerSubmit}
          className="space-y-2 mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {bannerDraft.id ? 'Editar banner' : 'Nuevo banner'}
            </span>
            <button type="button" onClick={closeBannerForm} className="p-1 rounded-md text-slate-400 hover:text-slate-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Rubro *</label>
              <input
                type="text"
                value={bannerDraft.rubro}
                onChange={(e) => setBannerDraft({ ...bannerDraft, rubro: e.target.value })}
                placeholder="Ej: Cámaras de seguridad"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                required
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Etiqueta (opcional)</label>
              <input
                type="text"
                value={bannerDraft.badgeLabel}
                onChange={(e) => setBannerDraft({ ...bannerDraft, badgeLabel: e.target.value })}
                placeholder="PROMO ESPECIAL · ESTE MES"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Título *</label>
            <input
              type="text"
              value={bannerDraft.title}
              onChange={(e) => setBannerDraft({ ...bannerDraft, title: e.target.value })}
              placeholder='Ej: "20% de descuento" o "Precio fijo $150.000"'
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Descripción *</label>
            <textarea
              value={bannerDraft.description}
              onChange={(e) => setBannerDraft({ ...bannerDraft, description: e.target.value })}
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
                onChange={handleBannerFileChange}
                disabled={uploading}
                className="flex-1 text-xs text-slate-600 dark:text-slate-400"
              />
              {uploading && <Loader2 className="w-4 h-4 text-teal-600 animate-spin shrink-0" />}
            </div>
            {bannerDraft.mediaUrl && !uploading && (
              <div className="mt-2 flex items-center gap-2">
                {bannerDraft.mediaType === 'video' ? (
                  <video src={bannerDraft.mediaUrl} className="w-20 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700" muted />
                ) : (
                  <img src={bannerDraft.mediaUrl} alt="" className="w-20 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700" />
                )}
                <button
                  type="button"
                  onClick={() => setBannerDraft({ ...bannerDraft, mediaUrl: '' })}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700"
                >
                  Quitar archivo
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Color de fondo
              </label>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                Lo elegís acá: no hace falta diseñarlo en la foto. El texto se adapta si el fondo es claro u oscuro.
              </p>
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                {BANNER_BACKGROUND_PRESETS.map((preset) => {
                  const selected = normalizeBannerBackground(bannerDraft.backgroundColor) === preset.value;
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => setBannerDraft({ ...bannerDraft, backgroundColor: preset.value })}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-bold ${
                        selected
                          ? 'border-teal-500 text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: preset.value }} />
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              <label className="inline-flex items-center gap-2 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                Personalizado
                <input
                  type="color"
                  value={normalizeBannerBackground(bannerDraft.backgroundColor)}
                  onChange={(e) => setBannerDraft({ ...bannerDraft, backgroundColor: e.target.value })}
                  className="h-8 w-12 cursor-pointer rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </label>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Fusión foto / fondo ({clampBannerMediaFade(bannerDraft.mediaFade)}%)
              </label>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                Suaviza el recorte de la foto para que se diluya en el color de fondo, como en el boceto.
              </p>
              <input
                type="range"
                min={0}
                max={100}
                value={clampBannerMediaFade(bannerDraft.mediaFade)}
                onChange={(e) => setBannerDraft({ ...bannerDraft, mediaFade: Number(e.target.value) })}
                className="w-full accent-teal-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>Recorte seco</span>
                <span>Fusión fuerte</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                Bullets separados por "|" (opcional)
              </label>
              <input
                type="text"
                value={bannerDraft.highlights}
                onChange={(e) => setBannerDraft({ ...bannerDraft, highlights: e.target.value })}
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
                value={bannerDraft.linkPath}
                onChange={(e) => setBannerDraft({ ...bannerDraft, linkPath: e.target.value })}
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
                value={bannerDraft.ctaLabel}
                onChange={(e) => setBannerDraft({ ...bannerDraft, ctaLabel: e.target.value })}
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
                value={bannerDraft.startsAt}
                onChange={(e) => setBannerDraft({ ...bannerDraft, startsAt: e.target.value })}
                className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Hasta (opcional)</label>
              <input
                type="date"
                value={bannerDraft.endsAt}
                onChange={(e) => setBannerDraft({ ...bannerDraft, endsAt: e.target.value })}
                className="text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={!bannerDraft.rubro.trim() || !bannerDraft.title.trim() || !bannerDraft.description.trim() || uploading}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 shrink-0"
            >
              {bannerDraft.id ? 'Guardar cambios' : 'Publicar banner'}
            </button>
          </div>
        </form>
      )}

      {cardDraft && (
        <form
          onSubmit={handleCardSubmit}
          className="space-y-2 mb-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
              {cardDraft.id ? 'Editar tarjeta' : 'Nueva tarjeta'}
            </span>
            <button type="button" onClick={closeCardForm} className="p-1 rounded-md text-slate-400 hover:text-slate-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5">Ícono</label>
            <div className="grid grid-cols-6 sm:grid-cols-8 gap-2">
              {HOME_ICON_OPTIONS.map(({ name, Icon }) => (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => setCardDraft({ ...cardDraft, icon: name })}
                  className={`h-12 sm:h-14 flex items-center justify-center rounded-xl border ${
                    cardDraft.icon === name
                      ? 'bg-teal-600 border-teal-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-teal-600 hover:border-teal-400'
                  }`}
                >
                  <Icon className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.6} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Título *</label>
            <input
              type="text"
              value={cardDraft.title}
              onChange={(e) => setCardDraft({ ...cardDraft, title: e.target.value })}
              placeholder='Ej: "Solicitar Servicio"'
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Descripción (opcional)</label>
            <input
              type="text"
              value={cardDraft.description}
              onChange={(e) => setCardDraft({ ...cardDraft, description: e.target.value })}
              placeholder="Ej: Pedí un técnico a domicilio"
              className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
            />
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Link *</label>
              <input
                type="text"
                value={cardDraft.linkPath}
                onChange={(e) => setCardDraft({ ...cardDraft, linkPath: e.target.value })}
                placeholder="/customer/solicitar"
                className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!cardDraft.title.trim() || !cardDraft.linkPath.trim()}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold disabled:opacity-50 shrink-0"
            >
              {cardDraft.id ? 'Guardar cambios' : 'Publicar tarjeta'}
            </button>
          </div>
        </form>
      )}

      {blocks.length === 0 ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">Todavía no cargaste banners ni tarjetas.</p>
      ) : (
        <div className="space-y-2">
          {blocks.map((block, idx) => {
            const neighborUp = idx > 0 ? blocks[idx - 1] : null;
            const neighborDown = idx < blocks.length - 1 ? blocks[idx + 1] : null;
            const currentRef = { id: block.item.id, type: block.type };
            if (block.type === 'banner') {
              const b = block.item;
              const vigent = isCurrentlyVigent(b);
              return (
                <div key={`banner-${b.id}`} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
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
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-100 dark:border-teal-900 rounded-full px-2 py-0.5 mb-1">
                          <Megaphone className="w-3 h-3" /> Banner
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
                        onClick={() => neighborUp && swapHomeBlockOrder(currentRef, { id: neighborUp.item.id, type: neighborUp.type })}
                        disabled={!neighborUp}
                        title="Subir"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => neighborDown && swapHomeBlockOrder(currentRef, { id: neighborDown.item.id, type: neighborDown.type })}
                        disabled={!neighborDown}
                        title="Bajar"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditBanner(b)}
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
            }

            const c = block.item;
            const Icon = getHomeIcon(c.icon);
            return (
              <div key={`card-${c.id}`} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-teal-500">
                      <Icon className="w-7 h-7" strokeWidth={1.6} />
                    </div>
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-2 py-0.5 mb-1">
                        <LayoutGrid className="w-3 h-3" /> Tarjeta
                      </span>
                      <b className="block text-xs text-slate-900 dark:text-slate-100">{c.title}</b>
                      {c.description && <p className="text-[11px] text-slate-500 dark:text-slate-400">{c.description}</p>}
                      <span className="text-[10px] font-mono text-slate-400">{c.linkPath}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => neighborUp && swapHomeBlockOrder(currentRef, { id: neighborUp.item.id, type: neighborUp.type })}
                      disabled={!neighborUp}
                      title="Subir"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => neighborDown && swapHomeBlockOrder(currentRef, { id: neighborDown.item.id, type: neighborDown.type })}
                      disabled={!neighborDown}
                      title="Bajar"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditCard(c)}
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
