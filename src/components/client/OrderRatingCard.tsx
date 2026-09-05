import React, { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  canCreateRating,
  canEditRating,
  fetchOrderRating,
  insertOrderRating,
  updateOrderRating,
  type OrderRating,
} from '../../lib/orderRatings';

type Props = {
  orderId: string;
  technicianId: string | null;
  customerId: string;
  completedAt?: string;
  onSaved?: () => void;
};

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export const OrderRatingCard: React.FC<Props> = ({
  orderId,
  technicianId,
  customerId,
  completedAt,
  onSaved,
}) => {
  const { showToast } = useApp();
  const [rating, setRating] = useState<OrderRating | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!technicianId || !customerId || !isSupabaseConfigured) {
      setLoaded(true);
      return;
    }
    let cancelled = false;
    setLoaded(false);
    void fetchOrderRating(orderId)
      .then((row) => {
        if (cancelled) return;
        setRating(row);
        setStars(row?.stars ?? 0);
        setComment(row?.comment ?? '');
        setLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        showToast(error instanceof Error ? error.message : 'No se pudo cargar la calificación.', 'error');
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, technicianId, customerId, showToast]);

  if (!technicianId || !customerId || !isSupabaseConfigured) return null;
  if (!loaded) {
    return (
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs text-xs text-slate-500 dark:text-slate-400">
        Cargando calificación…
      </section>
    );
  }

  const canCreate = !rating && canCreateRating(completedAt);
  const canEdit = Boolean(rating && canEditRating(rating.createdAt));
  const readOnly = Boolean(rating && !canEdit);

  if (!rating && !canCreate) return null;

  const submit = async () => {
    if (stars < 1 || stars > 5 || busy) return;
    setBusy(true);
    try {
      const saved = rating
        ? await updateOrderRating(rating.id, { stars, comment })
        : await insertOrderRating({ orderId, technicianId, customerId, stars, comment });
      setRating(saved);
      setStars(saved.stars);
      setComment(saved.comment ?? '');
      showToast(rating ? 'Calificación actualizada.' : 'Gracias por calificar el servicio.', 'success');
      onSaved?.();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo guardar la calificación.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs space-y-3" aria-label="Calificación del servicio">
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {readOnly ? 'Tu calificación' : rating ? 'Podés editar tu calificación' : 'Calificá este servicio'}
        </h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {readOnly
            ? 'Calificación enviada'
            : rating
              ? 'Tenés 48 horas desde el envío para corregir estrellas o comentario.'
              : 'Las estrellas son obligatorias. El comentario es opcional.'}
        </p>
      </div>

      <div className="flex items-center gap-1" role="radiogroup" aria-label="Estrellas">
        {STAR_VALUES.map((value) => {
          const selected = value <= stars;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={stars === value}
              aria-label={`${value} ${value === 1 ? 'estrella' : 'estrellas'}`}
              disabled={readOnly || busy}
              onClick={() => setStars(value)}
              className="p-0.5 disabled:cursor-default"
            >
              <Star
                className={`w-6 h-6 ${selected ? 'text-amber-500 fill-amber-500' : 'text-slate-300'}`}
              />
            </button>
          );
        })}
      </div>

      {readOnly ? (
        rating?.comment ? (
          <p className="text-xs text-slate-700 dark:text-slate-300 italic">“{rating.comment}”</p>
        ) : (
          <p className="text-[11px] text-slate-400">Sin comentario.</p>
        )
      ) : (
        <>
          <label className="block">
            <span className="sr-only">Comentario opcional</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              disabled={busy}
              rows={3}
              maxLength={500}
              placeholder="Comentario opcional"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
            />
          </label>
          <button
            type="button"
            disabled={busy || stars < 1}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? 'Guardando…' : rating ? 'Actualizar calificación' : 'Enviar calificación'}
          </button>
        </>
      )}
    </section>
  );
};
