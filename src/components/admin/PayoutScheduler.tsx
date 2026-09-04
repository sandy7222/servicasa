import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Landmark } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { fetchReservedSettlementIds } from '../../lib/wallets';

type Settlement = {
  id: string;
  technician_id: string;
  order_id: string;
  net_amount: number;
  settlement_type: string;
  created_at: string;
  service_orders?: { title: string }[] | { title: string } | null;
};

const ars = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));

const orderTitle = (item: Settlement) =>
  (Array.isArray(item.service_orders) ? item.service_orders[0]?.title : item.service_orders?.title) ??
  `Orden ${item.order_id.slice(0, 8)}`;

export const PayoutScheduler: React.FC = () => {
  const { technicians, showToast, refreshRemoteData } = useApp();
  const [rows, setRows] = useState<Settlement[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('technician_settlements')
      .select('id, technician_id, order_id, net_amount, settlement_type, created_at, service_orders(title)')
      .eq('status', 'released')
      .order('created_at');
    if (error) {
      showToast('No se pudieron cargar las liquidaciones liberadas.', 'error');
      return;
    }
    let reserved = new Set<string>();
    try {
      reserved = await fetchReservedSettlementIds();
    } catch {
      reserved = new Set();
    }
    setRows(((data ?? []) as Settlement[]).filter((row) => !reserved.has(row.id)));
  };

  useEffect(() => {
    void load();
  }, []);

  const grouped = useMemo<Record<string, Settlement[]>>(
    () =>
      rows.reduce<Record<string, Settlement[]>>((result, row) => {
        (result[row.technician_id] ??= []).push(row);
        return result;
      }, {}),
    [rows],
  );

  const toggle = (id: string) =>
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  const scheduleTechnician = async (technicianId: string, items: Settlement[]) => {
    const total = items.reduce((sum, item) => sum + Number(item.net_amount), 0);
    const { data: batch, error: batchError } = await supabase
      .from('technician_payout_batches')
      .insert({
        technician_id: technicianId,
        scheduled_date: new Date(scheduledAt).toISOString(),
        status: 'scheduled',
        total_amount: total,
        settlement_count: items.length,
        transfer_method: method,
        admin_notes: notes.trim() || null,
      })
      .select('id')
      .single();
    if (batchError || !batch) throw batchError ?? new Error('No se creó el lote');
    const { error: updateError } = await supabase
      .from('technician_settlements')
      .update({
        status: 'scheduled',
        scheduled_date: new Date(scheduledAt).toISOString(),
        payout_batch_id: batch.id,
      })
      .in(
        'id',
        items.map((item) => item.id),
      );
    if (updateError) throw updateError;
  };

  const selectedByTechnician = (Object.entries(grouped) as Array<[string, Settlement[]]>)
    .map(([techId, items]) => ({ techId, items: items.filter((row) => selected.includes(row.id)) }))
    .filter((group) => group.items.length > 0);

  const schedule = async (technicianId: string) => {
    const items = selectedByTechnician.find((group) => group.techId === technicianId)?.items ?? [];
    if (!items.length) {
      showToast('Seleccioná al menos una liquidación de este técnico.', 'warning');
      return;
    }
    if (!scheduledAt) {
      showToast('Indicá una fecha real de transferencia.', 'warning');
      return;
    }
    setSaving(true);
    try {
      await scheduleTechnician(technicianId, items);
      showToast('Transferencia programada con fecha real.', 'success');
      setSelected((current) => current.filter((id) => !items.some((item) => item.id === id)));
      await load();
      await refreshRemoteData();
    } catch {
      showToast('No se pudo programar la transferencia.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const scheduleAllSelected = async () => {
    if (!selectedByTechnician.length) {
      showToast('Seleccioná al menos una liquidación.', 'warning');
      return;
    }
    if (!scheduledAt) {
      showToast('Indicá una fecha real de transferencia.', 'warning');
      return;
    }
    setSaving(true);
    try {
      for (const group of selectedByTechnician) {
        await scheduleTechnician(group.techId, group.items);
      }
      showToast(
        selectedByTechnician.length === 1
          ? 'Transferencia programada con fecha real.'
          : `Transferencias programadas para ${selectedByTechnician.length} técnicos.`,
        'success',
      );
      setSelected([]);
      await load();
      await refreshRemoteData();
    } catch {
      showToast('No se pudieron programar todas las transferencias.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Landmark className="w-4 text-teal-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold">Programar liquidaciones</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Sólo aparecen importes ya liberados. Podés marcar varios técnicos y programarlos en esta misma sesión: cada uno genera su propio lote.
          </p>
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No hay liquidaciones liberadas para programar.</p>
      ) : (
        <>
          <div className="grid sm:grid-cols-3 gap-2">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Fecha real
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-sm"
              />
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Método
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-sm"
              >
                <option value="bank_transfer">Transferencia bancaria</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Nota interna
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-sm"
                placeholder="Opcional"
              />
            </label>
          </div>
          <div className="space-y-3">
            {(Object.entries(grouped) as Array<[string, Settlement[]]>).map(([techId, items]) => {
              const technician = technicians.find((t) => t.id === techId);
              const amount = items
                .filter((item) => selected.includes(item.id))
                .reduce((sum, item) => sum + Number(item.net_amount), 0);
              return (
                <div key={techId} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="text-xs">{technician?.name ?? 'Técnico'}</strong>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{items.length} liquidación(es) liberadas</p>
                    </div>
                    <button
                      disabled={!items.some((item) => selected.includes(item.id)) || saving}
                      onClick={() => void schedule(techId)}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-teal-300 disabled:opacity-40"
                    >
                      <CalendarClock className="w-3.5" />
                      Programar {ars(amount)}
                    </button>
                  </div>
                  <div className="mt-2 space-y-1">
                    {items.map((item) => (
                      <label key={item.id} className="flex gap-2 items-center rounded bg-slate-50 dark:bg-slate-950 px-2 py-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggle(item.id)} />
                        <span className="flex-1">{orderTitle(item)}</span>
                        <strong className="text-teal-700">{ars(item.net_amount)}</strong>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {selectedByTechnician.length > 1 && (
            <div className="flex justify-end">
              <button
                disabled={saving}
                onClick={() => void scheduleAllSelected()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-2 text-[11px] font-bold text-white disabled:opacity-40"
              >
                <CalendarClock className="w-3.5" />
                Programar {selectedByTechnician.length} técnicos
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
};
