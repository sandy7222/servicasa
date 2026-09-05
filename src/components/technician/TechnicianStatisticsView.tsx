import React, { useEffect, useMemo, useState } from 'react';
import { Activity, ArrowLeft, BarChart3, CheckCircle2, Clock3, Star, TrendingDown, TrendingUp } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { formatElapsedTime, getOrderElapsedSeconds } from '../../lib/workTimer';
import {
  fetchTechnicianRatings,
  isNewTechnicianRating,
  parseInstant,
  ratingSparklineValues,
  recentRatingComments,
  summarizeRatingTrend,
  type OrderRating,
  type RatingTrendDirection,
} from '../../lib/orderRatings';

const number = new Intl.NumberFormat('es-AR');

const TREND_COPY: Record<RatingTrendDirection, string> = {
  up: 'Mejorando',
  down: 'En baja',
  stable: 'Estable',
  insufficient: 'Todavía no hay suficiente historial para una tendencia',
};

function formatRatingDate(iso: string): string {
  const ms = parseInstant(iso);
  if (ms == null) return '';
  return new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const TechnicianStatisticsView: React.FC = () => {
  const { currentUser, orders, technicians, navigate, showToast } = useApp();
  const technician = technicians.find((item) => item.id === currentUser?.technicianId);
  const [ratings, setRatings] = useState<OrderRating[]>([]);
  const [ratingsLoaded, setRatingsLoaded] = useState(!isSupabaseConfigured);

  useEffect(() => {
    const technicianId = currentUser?.technicianId;
    if (!technicianId || !isSupabaseConfigured) {
      setRatings([]);
      setRatingsLoaded(true);
      return;
    }
    let cancelled = false;
    setRatingsLoaded(false);
    void fetchTechnicianRatings(technicianId)
      .then((rows) => {
        if (cancelled) return;
        setRatings(rows);
        setRatingsLoaded(true);
      })
      .catch((error) => {
        if (cancelled) return;
        showToast(error instanceof Error ? error.message : 'No se pudieron cargar las calificaciones.', 'error');
        setRatings([]);
        setRatingsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.technicianId, showToast]);

  const stats = useMemo(() => {
    const mine = orders.filter((order) => order.assignedTechnicianId === currentUser?.technicianId);
    const completed = mine.filter((order) => order.status === 'completed');
    const cancelled = mine.filter((order) => order.status === 'cancelled');
    const active = mine.filter((order) => ['assigned', 'in_progress', 'paused'].includes(order.status));
    const resolved = completed.length + cancelled.length;
    const seconds = completed.reduce((total, order) => total + getOrderElapsedSeconds(order), 0);
    return {
      total: mine.length,
      completed: completed.length,
      active: active.length,
      completionRate: resolved ? completed.length / resolved : null,
      averageSeconds: completed.length ? Math.round(seconds / completed.length) : null,
    };
  }, [orders, currentUser?.technicianId]);

  const isNew = isNewTechnicianRating(ratings.length);
  const trend = useMemo(() => summarizeRatingTrend(ratings), [ratings]);
  const sparkline = useMemo(() => ratingSparklineValues(ratings), [ratings]);
  const comments = useMemo(() => recentRatingComments(ratings), [ratings]);
  const orderTitleById = useMemo(
    () => new Map(orders.map((order) => [order.id, order.title])),
    [orders]
  );

  return (
    <main className="min-h-screen bg-slate-100/70 dark:bg-slate-900/80 pb-12">
      <header className="border-b border-slate-800 bg-[#0F172A] text-white">
        <div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold">Mis estadísticas</h1>
              <p className="text-xs text-slate-400">Indicadores calculados solo con tu actividad registrada.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/technician')}
            aria-label="Volver a la Terminal de Campo"
            className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-teal-500 hover:text-teal-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 pt-5 space-y-4">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            icon={<CheckCircle2 />}
            label="Trabajos completados"
            value={number.format(stats.completed)}
            note={`de ${stats.total} asignados`}
            tone="teal"
          />
          <Metric
            icon={<Activity />}
            label="Trabajos activos"
            value={number.format(stats.active)}
            note="asignados, en curso o pausados"
            tone="blue"
          />
          <Metric
            icon={<TrendingUp />}
            label="Tasa de finalización"
            value={stats.completionRate === null ? 'Sin datos' : `${Math.round(stats.completionRate * 100)}%`}
            note={stats.completionRate === null ? 'Necesita trabajos cerrados' : 'sobre trabajos cerrados'}
            tone="violet"
          />
          <Metric
            icon={<Clock3 />}
            label="Tiempo promedio"
            value={stats.averageSeconds === null ? 'Sin datos' : formatElapsedTime(stats.averageSeconds)}
            note="en trabajos finalizados"
            tone="amber"
          />
        </section>
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Calificación actual</h2>
            </div>
            {!ratingsLoaded ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Cargando calificaciones…</p>
            ) : isNew ? (
              <>
                <p className="mt-4">
                  <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-800">
                    Nuevo
                  </span>
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  Tu perfil público muestra Nuevo hasta tener 3 calificaciones de clientes.
                  {ratings.length > 0 ? ` Llevás ${ratings.length}.` : ' Todavía no recibiste ninguna.'}
                </p>
              </>
            ) : (
              <>
                <p className="mt-4 text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {technician?.rating != null ? Number(technician.rating).toFixed(1) : '—'}
                  <span className="ml-1 text-base text-amber-500">★</span>
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {ratings.length} {ratings.length === 1 ? 'calificación' : 'calificaciones'} de clientes. Es el número
                  público de tu perfil (promedio ponderado de los últimos trabajos).
                </p>
              </>
            )}
            {ratingsLoaded && sparkline.length > 0 && (
              <div className="mt-4">
                <div
                  className="flex h-10 items-end gap-0.5"
                  role="img"
                  aria-label={`Últimas ${sparkline.length} calificaciones, de más antigua a más reciente`}
                >
                  {sparkline.map((stars, index) => (
                    <div
                      key={`${index}-${stars}`}
                      className="min-w-[3px] flex-1 rounded-sm bg-amber-400"
                      style={{ height: `${(stars / 5) * 100}%` }}
                      title={`${stars} estrellas`}
                    />
                  ))}
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {trend.direction === 'up' ? (
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  ) : trend.direction === 'down' ? (
                    <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                  ) : null}
                  {TREND_COPY[trend.direction]}
                </p>
                {trend.recentAverage != null && trend.previousAverage != null && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Promedio de tus últimas 5 calificaciones ({trend.recentAverage.toFixed(1)}) frente a las 5 anteriores
                    ({trend.previousAverage.toFixed(1)}). Estrellas tal cual las dejó el cliente, sin el colchón inicial.
                  </p>
                )}
              </div>
            )}
          </article>
          <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tasa de aceptación</h2>
            <p className="mt-4 text-2xl font-bold text-slate-400">Aún no registrada</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Para calcularla de forma honesta necesitamos registrar cada oferta que recibís y si la aceptás o
              rechazás. Hoy las órdenes empiezan cuando ya fueron asignadas.
            </p>
          </article>
        </section>
        <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Comentarios recientes</h2>
          {!ratingsLoaded ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Cargando comentarios…</p>
          ) : comments.length === 0 ? (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Todavía no hay comentarios. Las estrellas sin texto también cuentan para tu calificación.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {comments.map((row) => {
                const title = orderTitleById.get(row.orderId);
                return (
                  <li
                    key={row.id}
                    className="rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="font-mono font-bold text-amber-700">{row.stars}.0 ★</span>
                      <span>{formatRatingDate(row.createdAt)}</span>
                      {title ? <span className="truncate text-slate-600 dark:text-slate-300">{title}</span> : null}
                    </div>
                    <p className="mt-1.5 text-sm text-slate-800 dark:text-slate-200">{row.comment}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950">
          <strong>Datos transparentes, no estimados.</strong>
          <p className="mt-1">
            Estas métricas se actualizan desde las órdenes asignadas a tu cuenta. No se muestran porcentajes ni reseñas
            inventadas cuando todavía no existe la información de origen.
          </p>
        </section>
      </div>
    </main>
  );
};

const Metric: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: 'teal' | 'blue' | 'violet' | 'amber';
}> = ({ icon, label, value, note, tone }) => (
  <article className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
        tone === 'teal'
          ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700'
          : tone === 'blue'
            ? 'bg-blue-50 text-blue-700'
            : tone === 'violet'
              ? 'bg-violet-50 text-violet-700'
              : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700'
      }`}
    >
      {icon}
    </div>
    <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
    <strong className="mt-1 block text-xl text-slate-900 dark:text-slate-100">{value}</strong>
    <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">{note}</p>
  </article>
);
