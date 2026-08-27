import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, CheckCircle2, ChevronDown, ChevronUp, CircleAlert, CreditCard, Landmark, Sprout, Target, Trash2, WalletCards } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { computeGoalProgress, deactivateGoal, fetchGoals, setGoal } from '../../lib/technicianGoals';
import type { GoalProgress, GoalType, TechnicianGoal } from '../../lib/technicianGoals';

type Settlement = { id: string; order_id: string; settlement_type: 'completed_work' | 'rejected_visit'; gross_amount: number; platform_commission_amount: number; payment_fee_amount: number; net_amount: number; status: string; release_date: string | null; release_at: string | null; released_at: string | null; scheduled_date: string | null; paid_at: string | null; transfer_reference: string | null; receipt_url: string | null; created_at: string; service_orders?: { title: string; service_type: string; client_name: string } | Array<{ title: string; service_type: string; client_name: string }> | null };
type Batch = { id: string; scheduled_date: string | null; status: string; total_amount: number; settlement_count: number; transfer_method: string | null; destination_last4: string | null; transfer_reference: string | null; receipt_url: string | null; completed_at: string | null; created_at: string };
type Tab = 'summary' | 'pending' | 'history' | 'goals';
const ars = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : undefined;
const isPending = (status: string) => ['pending_release', 'in_review'].includes(status);
const orderInfo = (settlement: Settlement) => Array.isArray(settlement.service_orders) ? settlement.service_orders[0] : settlement.service_orders;

/** El bucket es privado — receipt_url guarda la ruta interna, no una URL
 * pública. Se pide una URL firmada recién al clickear "Ver comprobante". */
async function openReceipt(path: string, onError: () => void) {
  const { data, error } = await supabase.storage.from('payout-receipts').createSignedUrl(path, 60);
  if (error || !data?.signedUrl) { onError(); return; }
  window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
}

export const EarningsView: React.FC = () => {
  const { currentUser, technicians, showToast, navigate } = useApp();
  const techId = currentUser?.technicianId; const [tab, setTab] = useState<Tab>('summary'); const [settlements, setSettlements] = useState<Settlement[]>([]); const [batches, setBatches] = useState<Batch[]>([]); const [loading, setLoading] = useState(true); const [open, setOpen] = useState<string>();
  const technician = technicians.find((item) => item.id === techId);
  const load = async () => { if (!techId) return; setLoading(true); const [settlementRes, batchRes] = await Promise.all([supabase.from('technician_settlements').select('*, service_orders(title, service_type, client_name)').eq('technician_id', techId).order('created_at', { ascending: false }), supabase.from('technician_payout_batches').select('*').eq('technician_id', techId).order('created_at', { ascending: false })]); if (settlementRes.error || batchRes.error) showToast('No pudimos cargar tus ganancias.', 'error'); else { setSettlements((settlementRes.data ?? []) as Settlement[]); setBatches((batchRes.data ?? []) as Batch[]); } setLoading(false); };
  useEffect(() => { void load(); }, [techId]);
  const figures = useMemo(() => { const now = new Date(); const month = settlements.filter((s) => new Date(s.created_at).getMonth() === now.getMonth() && new Date(s.created_at).getFullYear() === now.getFullYear()); return { available: settlements.filter((s) => ['released', 'scheduled'].includes(s.status)).reduce((sum, s) => sum + Number(s.net_amount), 0), protected: settlements.filter((s) => isPending(s.status)).reduce((sum, s) => sum + Number(s.net_amount), 0), month: month.filter((s) => s.status !== 'cancelled').reduce((sum, s) => sum + Number(s.net_amount), 0) }; }, [settlements]);
  const scheduled = settlements.filter((s) => s.status === 'scheduled' && s.scheduled_date).sort((a, b) => +new Date(a.scheduled_date!) - +new Date(b.scheduled_date!))[0];
  const tabs: Array<[Tab, string]> = [['summary', 'Resumen'], ['pending', 'Pendientes'], ['history', 'Historial'], ['goals', 'Metas']];
  if (!techId) return null;
  return <main className="min-h-screen bg-slate-100/70 pb-12"><div className="bg-[#0F172A] text-white border-b border-slate-800"><div className="max-w-5xl mx-auto px-4 py-5"><div className="flex gap-3 items-center justify-between"><div className="flex gap-3 items-center"><div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-300 flex items-center justify-center"><WalletCards className="w-5" /></div><div><h1 className="font-bold">Mis ganancias</h1><p className="text-xs text-slate-400">Liquidaciones reales y transferencias de {technician?.name ?? 'tu cuenta'}.</p></div></div><button onClick={() => navigate('/technician')} aria-label="Volver a la Terminal de Campo" className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-teal-500 hover:text-teal-300"><ArrowLeft className="w-4 h-4" /></button></div></div></div><div className="max-w-5xl mx-auto px-4 pt-4"><div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1">{tabs.map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`whitespace-nowrap rounded-md px-3 py-2 text-xs font-bold ${tab === value ? 'bg-slate-900 text-teal-300' : 'text-slate-600 hover:bg-slate-50'}`}>{label}</button>)}</div>{loading ? <div className="p-8 text-center text-sm text-slate-500">Cargando liquidaciones…</div> : tab === 'goals' ? <Goals techId={techId} showToast={showToast} /> : settlements.length === 0 ? <Empty /> : <>{tab === 'summary' && <Summary figures={figures} scheduled={scheduled} settlements={settlements} onTab={setTab} />}{tab === 'pending' && <Pending settlements={settlements.filter((s) => !['paid', 'cancelled'].includes(s.status))} open={open} setOpen={setOpen} />}{tab === 'history' && <History batches={batches.filter((b) => b.status === 'completed')} showToast={showToast} />}</>}</div></main>;
};

const Summary: React.FC<{ figures: { available: number; protected: number; month: number }; scheduled?: Settlement; settlements: Settlement[]; onTab: (tab: Tab) => void }> = ({ figures, scheduled, settlements, onTab }) => <div className="space-y-4 mt-4"><section className="rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-wider text-teal-100">Disponible para liquidación</p><strong className="text-3xl block mt-1">{ars(figures.available)}</strong>{scheduled?.scheduled_date ? <p className="mt-3 text-xs text-teal-50"><CalendarClock className="inline w-4 mr-1" />Transferencia programada: {dateTime(scheduled.scheduled_date)}</p> : <p className="mt-3 text-xs text-teal-50">Disponible para liquidación. Administración aún no programó una transferencia.</p>}<button onClick={() => onTab('pending')} className="mt-4 rounded-lg bg-white/15 border border-white/20 px-3 py-2 text-xs font-bold hover:bg-white/25">Ver detalle</button></section><div className="grid grid-cols-2 gap-3"><Card title="En garantía / revisión" amount={figures.protected} note="Sujeto al período de garantía o revisión." tone="amber" /><Card title="Ganado este mes" amount={figures.month} note="Neto de tus liquidaciones generadas." tone="slate" /></div><section className="rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-bold">Últimos movimientos</h2><div className="mt-3 space-y-2">{settlements.slice(0, 4).map((s) => <Movement key={s.id} settlement={s} compact />)}</div></section><section className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900"><strong>¿Cómo funcionan los pagos?</strong><p className="mt-1">Cada liquidación muestra su monto bruto, comisión real aplicada, costo real del cobro y tu neto. Los trabajos finalizados pasan por garantía; una fecha de transferencia sólo se muestra cuando administración la programa.</p></section></div>;
const Card: React.FC<{ title: string; amount: number; note: string; tone: 'amber' | 'slate' }> = ({ title, amount, note, tone }) => <section className={`rounded-xl border p-4 ${tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-200'}`}><p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{title}</p><strong className="block mt-2 text-lg text-slate-900">{ars(amount)}</strong><p className="mt-1 text-[10px] text-slate-500">{note}</p></section>;
const Pending: React.FC<{ settlements: Settlement[]; open?: string; setOpen: (id?: string) => void }> = ({ settlements, open, setOpen }) => <div className="mt-4 space-y-3">{settlements.length === 0 ? <p className="rounded-xl bg-white p-5 text-center text-xs text-slate-500">No tenés liquidaciones pendientes.</p> : settlements.map((s) => { const order = orderInfo(s); return <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4"><button onClick={() => setOpen(open === s.id ? undefined : s.id)} className="w-full text-left"><div className="flex justify-between gap-3"><div><strong className="text-sm">{order?.title ?? `Orden ${s.order_id.slice(0, 8)}`}</strong><p className="mt-1 text-[11px] text-slate-500">{s.settlement_type === 'rejected_visit' ? 'Visita de diagnóstico rechazada' : order?.service_type ?? 'Servicio'} · {order?.client_name ?? 'Cliente'}</p></div><div className="text-right"><strong className="text-sm text-teal-700">{ars(s.net_amount)}</strong><Status status={s.status} /></div></div></button>{open === s.id && <div className="mt-3 pt-3 border-t border-slate-100 text-xs space-y-1.5"><Row label="Monto bruto" value={ars(s.gross_amount)} /><Row label="Comisión TecniUrbano" value={`-${ars(s.platform_commission_amount)}`} /><Row label="Costo de cobro" value={`-${ars(s.payment_fee_amount)}`} /><Row label="Neto a cobrar" value={ars(s.net_amount)} strong />{s.status === 'pending_release' && <p className="mt-2 text-amber-700">Se libera: {dateTime(s.release_date ?? s.release_at) ?? 'cuando termine el período de garantía'}.</p>}{s.status === 'scheduled' && <p className="mt-2 text-teal-700">Transferencia programada: {dateTime(s.scheduled_date)}.</p>}{s.status === 'in_review' && <p className="mt-2 text-amber-700">En revisión: la liberación está pausada.</p>}</div>}</div>; })}</div>;
const History: React.FC<{ batches: Batch[]; showToast: (message: string, kind: 'success' | 'error' | 'warning') => void }> = ({ batches, showToast }) => <div className="mt-4 space-y-3">{batches.length === 0 ? <p className="rounded-xl bg-white p-5 text-center text-xs text-slate-500">Todavía no hay transferencias efectivamente realizadas.</p> : batches.map((b) => <section key={b.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex justify-between"><div><strong className="text-sm">Transferencia {b.transfer_reference ?? `#${b.id.slice(0, 8)}`}</strong><p className="mt-1 text-[11px] text-slate-500">{dateTime(b.completed_at)} · {b.transfer_method ?? 'Transferencia'}</p></div><strong className="text-teal-700">{ars(b.total_amount)}</strong></div><p className="mt-2 text-xs text-slate-600">Incluye {b.settlement_count} liquidación(es){b.destination_last4 ? ` · Destino ••••${b.destination_last4}` : ''}.</p>{b.receipt_url && <button onClick={() => void openReceipt(b.receipt_url as string, () => showToast('No se pudo abrir el comprobante.', 'error'))} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-teal-700"><CreditCard className="w-3.5" />Ver comprobante</button>}</section>)}</div>;
const GOAL_TYPES: Array<{ type: GoalType; label: string; unit: 'amount' | 'count'; note: string }> = [
  { type: 'weekly_jobs', label: 'Trabajos por semana', unit: 'count', note: 'Órdenes completadas de lunes a domingo (semana en curso).' },
  { type: 'monthly_jobs', label: 'Trabajos por mes', unit: 'count', note: 'Órdenes completadas en el mes en curso.' },
  { type: 'monthly_earnings', label: 'Ganancias por mes', unit: 'amount', note: 'Neto de liquidaciones (no canceladas) generadas en el mes en curso.' },
];

/** Metas reales sobre technician_goals: una activa por tipo, avance
 * calculado desde liquidaciones/órdenes reales (nunca un valor guardado a
 * mano — la tabla no tiene columna de progreso). */
const Goals: React.FC<{ techId: string; showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void }> = ({ techId, showToast }) => {
  const [goals, setGoals] = useState<TechnicianGoal[]>([]);
  const [progress, setProgress] = useState<Record<string, GoalProgress>>({});
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<GoalType | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchGoals(techId);
      setGoals(rows);
      const active = rows.filter((g) => g.isActive);
      const entries = await Promise.all(active.map(async (g) => [g.id, await computeGoalProgress(g)] as const));
      setProgress(Object.fromEntries(entries));
    } catch {
      showToast('No pudimos cargar tus metas.', 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [techId]);

  const activeByType = (type: GoalType) => goals.find((g) => g.goalType === type && g.isActive);

  const save = async (type: GoalType, unit: 'amount' | 'count') => {
    const raw = drafts[type];
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Ingresá un objetivo mayor a 0.', 'warning');
      return;
    }
    setSaving(type);
    try {
      await setGoal(type, unit === 'amount' ? value : null, unit === 'count' ? value : null);
      setDrafts((d) => { const next = { ...d }; delete next[type]; return next; });
      showToast('Meta guardada.', 'success');
      await load();
    } catch {
      showToast('No se pudo guardar la meta.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const remove = async (goalId: string) => {
    setSaving(goals.find((g) => g.id === goalId)?.goalType ?? null);
    try {
      await deactivateGoal(goalId);
      showToast('Meta desactivada.', 'success');
      await load();
    } catch {
      showToast('No se pudo desactivar la meta.', 'error');
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="mt-4 p-8 text-center text-sm text-slate-500">Cargando metas…</div>;

  return (
    <div className="mt-4 space-y-3">
      {GOAL_TYPES.map(({ type, label, unit, note }) => {
        const active = activeByType(type);
        const p = active ? progress[active.id] : undefined;
        return (
          <section key={type} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-teal-600" />
              <h3 className="text-sm font-bold">{label}</h3>
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">{note}</p>

            {active && p ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-end justify-between">
                  <div>
                    <strong className="text-lg text-slate-900">{unit === 'amount' ? ars(p.current) : p.current}</strong>
                    <span className="text-xs text-slate-500"> / {unit === 'amount' ? ars(p.target) : p.target} {p.periodLabel}</span>
                  </div>
                  <button onClick={() => void remove(active.id)} disabled={saving === type} className="text-slate-400 hover:text-rose-600 disabled:opacity-40" aria-label="Desactivar meta">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className={`h-full rounded-full ${p.met ? 'bg-emerald-500' : 'bg-teal-500'}`} style={{ width: `${p.percent}%` }} />
                </div>
                <p className={`text-xs font-semibold ${p.met ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {p.met ? <><CheckCircle2 className="inline w-3.5 mr-1" />Meta cumplida</> : `${p.percent}% · falta ${unit === 'amount' ? ars(p.remaining) : p.remaining}`}
                </p>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="number" min="0" step={unit === 'amount' ? '1000' : '1'}
                  value={drafts[type] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [type]: e.target.value }))}
                  placeholder={unit === 'amount' ? 'Objetivo ($ ARS)' : 'Objetivo (cantidad)'}
                  className="w-40 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-mono"
                />
                <button
                  onClick={() => void save(type, unit)}
                  disabled={saving === type || !drafts[type]}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-teal-300 disabled:opacity-40"
                >
                  {saving === type ? 'Guardando…' : 'Definir meta'}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
};
const Movement: React.FC<{ settlement: Settlement; compact?: boolean }> = ({ settlement }) => <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"><div><p className="text-xs font-semibold">{settlement.settlement_type === 'rejected_visit' ? 'Visita rechazada' : orderInfo(settlement)?.title ?? 'Trabajo técnico'}</p><p className="text-[10px] text-slate-500">{dateTime(settlement.created_at)}</p></div><div className="text-right"><strong className="text-xs text-teal-700">+{ars(settlement.net_amount)}</strong><Status status={settlement.status} /></div></div>;
const Status: React.FC<{ status: string }> = ({ status }) => { const labels: Record<string, string> = { pending_release: 'EN GARANTÍA', released: 'LIBERADO', scheduled: 'PROGRAMADO', in_transit: 'EN TRÁNSITO', paid: 'PAGADO', in_review: 'EN REVISIÓN', cancelled: 'CANCELADO' }; const color = status === 'released' || status === 'paid' ? 'text-emerald-700' : status === 'in_review' || status === 'pending_release' ? 'text-amber-700' : 'text-slate-500'; return <span className={`block mt-1 text-[10px] font-bold ${color}`}>{labels[status] ?? status}</span>; };
const Row: React.FC<{ label: string; value: string; strong?: boolean }> = ({ label, value, strong }) => <div className={`flex justify-between ${strong ? 'pt-2 border-t border-slate-200 font-bold text-slate-900' : 'text-slate-600'}`}><span>{label}</span><span>{value}</span></div>;
const Empty: React.FC = () => <section className="mt-4 rounded-xl bg-white border border-slate-200 p-10 text-center"><Sprout className="w-8 h-8 text-teal-600 mx-auto" /><h2 className="mt-3 text-sm font-bold">Todavía no tenés ganancias</h2><p className="mt-1 text-xs text-slate-500">Completá tu primer trabajo para empezar a generar ingresos y liquidaciones.</p></section>;
