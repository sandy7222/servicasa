import React, { useCallback, useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { formatArs } from '../../lib/pricing';
import { supabase } from '../../lib/supabase';

/**
 * Cobro repartido (plan-cobro-repartido.md, Fase 3): estado de la reserva del pago del trabajo en la ficha de
 * la orden, y los botones de administración "Cobrar ahora" / "Cancelar reserva" (con motivo obligatorio).
 * No muestra nada si la orden no tiene pagos repartidos (hoy, ninguna: el interruptor está apagado).
 */

type SplitPayment = {
  id: string;
  status: 'pending' | 'authorized' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
  amount: number;
  application_fee: number | null;
  mp_fee_amount: number | null;
  authorized_at: string | null;
  captured_at: string | null;
  cancelled_at: string | null;
  expires_at: string | null;
  split_action_reason: string | null;
};

const STATUS_LABEL: Record<SplitPayment['status'], string> = {
  pending: 'Iniciado, sin confirmar',
  authorized: 'Reservado (todavía no cobrado)',
  approved: 'Cobrado y repartido',
  rejected: 'Tarjeta rechazada',
  cancelled: 'Reserva cancelada',
  refunded: 'Devuelto',
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró.');
  return { Authorization: `Bearer ${token}` };
}

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Argentina/Buenos_Aires' }) : '—';

export const SplitReservationCard: React.FC<{ orderId: string }> = ({ orderId }) => {
  const [payments, setPayments] = useState<SplitPayment[]>([]);
  const [action, setAction] = useState<'capture' | 'cancel' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/split-admin?orderId=${encodeURIComponent(orderId)}`, { headers: await authHeader() });
      const body = (await response.json().catch(() => ({}))) as { payments?: SplitPayment[] };
      if (response.ok) setPayments(body.payments ?? []);
    } catch {
      /* Sin datos: la tarjeta no se muestra. */
    }
  }, [orderId]);

  useEffect(() => {
    setPayments([]);
    setAction(null);
    setReason('');
    setMessage(null);
    void load();
  }, [load]);

  if (payments.length === 0) return null;
  const current = payments.find((p) => p.status === 'authorized') ?? payments[0];

  const submit = async () => {
    if (!action) return;
    if (reason.trim().length < 5) {
      setMessage({ kind: 'error', text: 'Escribí el motivo (al menos 5 letras).' });
      return;
    }
    const question = action === 'capture'
      ? `¿Cobrar ahora ${formatArs(current.amount)}? Se reparte solo: el técnico recibe su parte y vos tu comisión.`
      : '¿Cancelar la reserva? El cliente NO paga el trabajo y el técnico no cobra por él. No se puede deshacer.';
    if (!window.confirm(question)) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/payments/split-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ orderId, action, reason: reason.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error || 'No se pudo completar.');
      setMessage({ kind: 'ok', text: action === 'capture' ? 'Listo: la reserva se cobró.' : 'Listo: la reserva se canceló.' });
      setAction(null);
      setReason('');
      await load();
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : 'No se pudo completar.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 p-3 text-xs text-indigo-950 dark:text-indigo-100 space-y-2">
      <div className="font-bold flex items-center gap-1.5"><CreditCard className="w-4 h-4" /> Pago del trabajo con cobro repartido</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        <span className="text-indigo-700 dark:text-indigo-300">Estado</span><strong>{STATUS_LABEL[current.status]}</strong>
        <span className="text-indigo-700 dark:text-indigo-300">Monto</span><span>{formatArs(current.amount)}</span>
        <span className="text-indigo-700 dark:text-indigo-300">Tu comisión</span><span>{current.application_fee != null ? formatArs(current.application_fee) : '—'}</span>
        {current.status === 'authorized' && <><span className="text-indigo-700 dark:text-indigo-300">Vence</span><span>{fmtDate(current.expires_at)}</span></>}
        {current.captured_at && <><span className="text-indigo-700 dark:text-indigo-300">Cobrado</span><span>{fmtDate(current.captured_at)}</span></>}
        {current.cancelled_at && <><span className="text-indigo-700 dark:text-indigo-300">Cancelado</span><span>{fmtDate(current.cancelled_at)}</span></>}
      </div>
      {current.split_action_reason && <p className="text-[11px] text-indigo-800 dark:text-indigo-200">Último motivo: {current.split_action_reason}</p>}

      {current.status === 'authorized' && !action && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={() => setAction('capture')} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white">Cobrar ahora</button>
          <button type="button" onClick={() => setAction('cancel')} className="rounded-lg border border-rose-300 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-rose-700">Cancelar reserva</button>
        </div>
      )}

      {action && (
        <div className="space-y-2 pt-1">
          <label className="block font-semibold" htmlFor={`split-reason-${orderId}`}>
            Motivo para {action === 'capture' ? 'cobrar' : 'cancelar'} (queda registrado)
          </label>
          <textarea
            id={`split-reason-${orderId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={400}
            className="w-full rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 p-2"
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void submit()} className="rounded-lg bg-indigo-600 px-3 py-1.5 font-bold text-white disabled:opacity-50">
              {busy ? 'Procesando…' : 'Confirmar'}
            </button>
            <button type="button" disabled={busy} onClick={() => { setAction(null); setReason(''); }} className="rounded-lg border border-slate-300 px-3 py-1.5">Volver</button>
          </div>
        </div>
      )}

      {message && <p role="status" className={message.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'}>{message.text}</p>}
    </div>
  );
};
