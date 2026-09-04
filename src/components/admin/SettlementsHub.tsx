import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock, Scale, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { formatArs } from '../../lib/pricing';
import { fetchSettings, getSettingValue, updateSetting } from '../../lib/settings';
import {
  cancelTechnicianPayoutRequest,
  fetchAdminPlatformWalletAvailable,
  fetchPendingPayoutRequestCount,
  formatDailyProcessLabel,
  fulfillTechnicianPayoutRequest,
  parseDailyProcessTime,
  withdrawAdminEarnings,
  type AdminWithdrawal,
  type PaymentAccount,
  type PayoutRequest,
  type PayoutRequestItem,
} from '../../lib/wallets';
import { PayoutScheduler } from './PayoutScheduler';
import { PayoutBatchesPanel } from './PayoutBatchesPanel';
import { SettlementReconciliation } from './SettlementReconciliation';

type SettlementRow = {
  id: string;
  technician_id: string;
  status: string;
  net_amount: number;
  platform_commission_amount: number;
};

type ScheduledBatch = {
  id: string;
  technician_id: string;
  total_amount: number;
  settlement_count: number;
  created_at: string;
  scheduled_date: string | null;
};

const REQUEST_LABEL: Record<PayoutRequest['status'], string> = {
  pending: 'Pendiente',
  processing: 'En proceso',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

export function usePendingPayoutRequestCount(active: boolean) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => {
    try {
      setCount(await fetchPendingPayoutRequestCount());
    } catch {
      setCount(0);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh, active]);
  return { count, refresh };
}

export const SettlementsHub: React.FC<{ onQueueChange?: () => void }> = ({ onQueueChange }) => {
  const { technicians, showToast } = useApp();
  const [settlements, setSettlements] = useState<SettlementRow[]>([]);
  const [batches, setBatches] = useState<ScheduledBatch[]>([]);
  const [accounts, setAccounts] = useState<PaymentAccount[]>([]);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [items, setItems] = useState<PayoutRequestItem[]>([]);
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [adminAvailable, setAdminAvailable] = useState(0);
  const [dailyTime, setDailyTime] = useState('20:00');
  const [staleDays, setStaleDays] = useState(1);
  const [draftTime, setDraftTime] = useState('20:00');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settlementRes, batchRes, accountRes, requestRes, itemRes, withdrawalRes, wallet, settings] = await Promise.all([
        supabase.from('technician_settlements').select('id, technician_id, status, net_amount, platform_commission_amount'),
        supabase.from('technician_payout_batches').select('id, technician_id, total_amount, settlement_count, created_at, scheduled_date').eq('status', 'scheduled'),
        supabase.from('technician_payment_accounts').select('technician_id, account_holder, cbu_cvu, alias, provider'),
        supabase.from('technician_payout_requests').select('*').order('requested_at', { ascending: false }),
        supabase.from('technician_payout_request_items').select('request_id, settlement_id, net_amount'),
        supabase.from('admin_earnings_withdrawals').select('*').order('withdrawn_at', { ascending: false }).limit(20),
        fetchAdminPlatformWalletAvailable(),
        fetchSettings(),
      ]);
      if (settlementRes.error) throw settlementRes.error;
      if (batchRes.error) throw batchRes.error;
      if (accountRes.error) throw accountRes.error;
      if (requestRes.error) throw requestRes.error;
      if (itemRes.error) throw itemRes.error;
      if (withdrawalRes.error) throw withdrawalRes.error;
      setSettlements((settlementRes.data ?? []) as SettlementRow[]);
      setBatches((batchRes.data ?? []) as ScheduledBatch[]);
      setAccounts((accountRes.data ?? []) as PaymentAccount[]);
      setRequests((requestRes.data ?? []) as PayoutRequest[]);
      setItems((itemRes.data ?? []) as PayoutRequestItem[]);
      setWithdrawals((withdrawalRes.data ?? []) as AdminWithdrawal[]);
      setAdminAvailable(wallet);
      const time = parseDailyProcessTime(getSettingValue<string>(settings, 'payout_daily_process_time'));
      setDailyTime(time);
      setDraftTime(time);
      setStaleDays(Number(getSettingValue<number>(settings, 'payout_stale_scheduled_days')) || 1);
    } catch {
      showToast('No se pudo cargar Liquidaciones.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const techName = (id: string) => technicians.find((t) => t.id === id)?.name ?? 'Técnico';
  const accountFor = (id: string) => accounts.find((a) => a.technician_id === id);

  const releasedByTech = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of settlements.filter((s) => s.status === 'released')) {
      map.set(row.technician_id, (map.get(row.technician_id) ?? 0) + Number(row.net_amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [settlements]);

  const releasedTotal = releasedByTech.reduce((sum, [, amount]) => sum + amount, 0);
  const scheduledTotal = settlements
    .filter((s) => s.status === 'scheduled' || s.status === 'in_transit')
    .reduce((sum, s) => sum + Number(s.net_amount), 0);
  const pendingRequests = requests.filter((r) => r.status === 'pending' || r.status === 'processing');
  const staleCutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const staleBatches = batches.filter((b) => new Date(b.created_at).getTime() < staleCutoff);

  const saveTime = async () => {
    const next = parseDailyProcessTime(draftTime);
    try {
      await updateSetting('payout_daily_process_time', next);
      setDailyTime(next);
      showToast('Horario diario de liquidaciones actualizado.', 'success');
    } catch {
      showToast('No se pudo guardar el horario.', 'error');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Liquidaciones</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Monedero de técnicos, cola diaria de retiros y cierre de lotes. Ningún pago se descuenta sin referencia real.
          </p>
        </div>
        <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-2">
          Lote diario (hora Argentina)
          <input
            type="time"
            value={draftTime}
            onChange={(e) => setDraftTime(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1 text-xs font-mono"
          />
          <button
            type="button"
            onClick={() => void saveTime()}
            disabled={draftTime === dailyTime}
            className="rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-bold text-teal-300 disabled:opacity-40"
          >
            Guardar
          </button>
        </label>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">Cargando liquidaciones…</p>
      ) : (
        <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <SummaryCard
          label="Liberado sin pagar"
          value={formatArs(releasedTotal)}
          note={
            releasedByTech.length === 0
              ? 'Nada liberado pendiente de retiro'
              : releasedByTech.map(([id, amount]) => `${techName(id)} ${formatArs(amount)}`).join(' · ')
          }
          tone="slate"
        />
        <SummaryCard
          label="Programado / tránsito"
          value={formatArs(scheduledTotal)}
          note={`${batches.length} lote(s) scheduled`}
          tone="teal"
        />
        <SummaryCard
          label="Pedidos de retiro"
          value={String(pendingRequests.length)}
          note={pendingRequests.length ? `Próximo lote: ${formatDailyProcessLabel(dailyTime)}` : 'Cola vacía'}
          tone={pendingRequests.length ? 'amber' : 'slate'}
        />
        <SummaryCard
          label="Lotes sin cerrar"
          value={String(staleBatches.length)}
          note={
            staleBatches.length
              ? staleBatches.map((b) => `${techName(b.technician_id)} ${formatArs(Number(b.total_amount))}`).join(' · ')
              : `Ninguno lleva más de ${staleDays} día(s)`
          }
          tone={staleBatches.length ? 'rose' : 'slate'}
          icon={staleBatches.length > 0}
        />
      </div>

      {staleBatches.length > 0 && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-900 dark:text-rose-200 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            Hay {staleBatches.length} lote(s) programado(s) hace más de {staleDays} día(s) sin marcar como pagado.
            Cerralos abajo con la referencia real de la transferencia.
          </p>
        </div>
      )}

          <WithdrawalQueue
            requests={pendingRequests}
            items={items}
            techName={techName}
            accountFor={accountFor}
            dailyTime={dailyTime}
            onChanged={async () => {
              await load();
              onQueueChange?.();
            }}
          />
          <AdminWalletPanel
            available={adminAvailable}
            withdrawals={withdrawals}
            onChanged={load}
          />
          <PayoutScheduler />
          <PayoutBatchesPanel accounts={accounts} />
          <SettlementReconciliation />
        </>
      )}
    </div>
  );
};

const SummaryCard: React.FC<{
  label: string;
  value: string;
  note: string;
  tone: 'slate' | 'teal' | 'amber' | 'rose';
  icon?: boolean;
}> = ({ label, value, note, tone, icon }) => {
  const tones = {
    slate: 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700',
    teal: 'bg-white dark:bg-slate-900 border-teal-300',
    amber: 'bg-amber-50 dark:bg-amber-950/40 border-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-950/40 border-rose-300',
  };
  return (
    <div className={`rounded-lg border p-3 shadow-2xs ${tones[tone]}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider font-mono text-slate-500 dark:text-slate-400 mb-1">
        <span>{label}</span>
        {icon && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
      </div>
      <div className="text-2xl font-black font-mono text-slate-900 dark:text-slate-100">{value}</div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={note}>{note}</p>
    </div>
  );
};

const WithdrawalQueue: React.FC<{
  requests: PayoutRequest[];
  items: PayoutRequestItem[];
  techName: (id: string) => string;
  accountFor: (id: string) => PaymentAccount | undefined;
  dailyTime: string;
  onChanged: () => Promise<void>;
}> = ({ requests, items, techName, accountFor, dailyTime, onChanged }) => {
  const { showToast } = useApp();
  const [reference, setReference] = useState<Record<string, string>>({});
  const [last4, setLast4] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const coverFor = (id: string) =>
    items.filter((i) => i.request_id === id).reduce((sum, i) => sum + Number(i.net_amount), 0);

  const fulfill = async (row: PayoutRequest) => {
    const ref = (reference[row.id] ?? '').trim();
    if (!ref) {
      showToast('Ingresá la referencia real de la transferencia.', 'warning');
      return;
    }
    setSaving(row.id);
    try {
      const account = accountFor(row.technician_id);
      await fulfillTechnicianPayoutRequest({
        requestId: row.id,
        transferReference: ref,
        destinationLast4: (last4[row.id] ?? '').trim() || (account?.cbu_cvu.slice(-4) ?? null),
        transferMethod: account?.provider === 'mercadopago' ? 'mercadopago' : 'bank_transfer',
      });
      showToast('Retiro marcado como pagado.', 'success');
      await onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo cumplir el retiro.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const cancel = async (row: PayoutRequest) => {
    setSaving(row.id);
    try {
      await cancelTechnicianPayoutRequest(row.id, 'Cancelado por administración');
      showToast('Pedido cancelado. El saldo volvió al monedero.', 'success');
      await onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo cancelar.', 'error');
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Wallet className="w-4 text-teal-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold">Solicitudes de retiro</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Cola diaria. Se cubre con liquidaciones de más vieja a más nueva (puede transferirse un poco más que lo pedido, nunca menos ni una fracción de orden). Próximo lote: {formatDailyProcessLabel(dailyTime)}.
          </p>
        </div>
      </div>
      {requests.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No hay pedidos pendientes.</p>
      ) : (
        requests.map((row) => {
          const account = accountFor(row.technician_id);
          const cover = coverFor(row.id);
          return (
            <div key={row.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <strong className="text-xs">{techName(row.technician_id)}</strong>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {REQUEST_LABEL[row.status]} · pidió {formatArs(Number(row.requested_amount))} · transferir {formatArs(cover)} ({items.filter((i) => i.request_id === row.id).length} orden(es))
                  </p>
                  <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-1">
                    {account
                      ? `${account.account_holder} · ${account.provider === 'mercadopago' ? 'CVU' : 'CBU'} ${account.cbu_cvu}${account.alias ? ` · alias ${account.alias}` : ''}`
                      : 'Sin CBU/alias cargado'}
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase text-amber-800">{REQUEST_LABEL[row.status]}</span>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  value={reference[row.id] ?? ''}
                  onChange={(e) => setReference((r) => ({ ...r, [row.id]: e.target.value }))}
                  placeholder="Referencia real de la transferencia *"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs"
                />
                <input
                  value={last4[row.id] ?? ''}
                  onChange={(e) => setLast4((r) => ({ ...r, [row.id]: e.target.value.slice(0, 4) }))}
                  placeholder="Últimos 4 (opcional)"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    disabled={saving === row.id}
                    onClick={() => void fulfill(row)}
                    className="flex-1 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-teal-300 disabled:opacity-40"
                  >
                    {saving === row.id ? 'Pagando…' : 'Marcar como pagado'}
                  </button>
                  {row.status === 'pending' && (
                    <button
                      disabled={saving === row.id}
                      onClick={() => void cancel(row)}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-[11px] font-bold text-slate-500"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </section>
  );
};

const AdminWalletPanel: React.FC<{
  available: number;
  withdrawals: AdminWithdrawal[];
  onChanged: () => Promise<void>;
}> = ({ available, withdrawals, onChanged }) => {
  const { showToast } = useApp();
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const withdraw = async () => {
    const value = Number(amount);
    const ref = reference.trim();
    if (!Number.isFinite(value) || value <= 0) {
      showToast('Ingresá un monto mayor a 0.', 'warning');
      return;
    }
    if (!ref) {
      showToast('Ingresá la referencia real de la transferencia.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await withdrawAdminEarnings(value, ref, notes);
      showToast('Retiro de comisiones registrado.', 'success');
      setAmount('');
      setReference('');
      setNotes('');
      await onChanged();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo registrar el retiro.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Scale className="w-4 text-teal-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold">Monedero de la plataforma</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Comisión TecniUrbano ya liberada (o posterior), menos retiros ya cargados. Retiro libre, siempre con referencia real.
          </p>
        </div>
      </div>
      <p className="text-2xl font-black font-mono text-teal-800">{formatArs(available)}</p>
      <div className="grid sm:grid-cols-4 gap-2">
        <input
          type="number"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Monto"
          className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs"
        />
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Referencia real *"
          className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs"
        />
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Nota (opcional)"
          className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-xs"
        />
        <button
          disabled={saving}
          onClick={() => void withdraw()}
          className="rounded-lg bg-teal-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"
        >
          {saving ? 'Registrando…' : 'Retirar'}
        </button>
      </div>
      {withdrawals.length > 0 && (
        <div className="space-y-1">
          {withdrawals.slice(0, 5).map((w) => (
            <p key={w.id} className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3" />
              {new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(w.withdrawn_at))}
              · {formatArs(Number(w.amount))} · ref {w.transfer_reference}
            </p>
          ))}
        </div>
      )}
    </section>
  );
};
