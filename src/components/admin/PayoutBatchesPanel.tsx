import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileUp, Landmark, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

type Batch = {
  id: string;
  technician_id: string;
  status: string;
  total_amount: number;
  settlement_count: number;
  scheduled_date: string | null;
  transfer_method: string | null;
};

const ars = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

/** Cierre real de un lote programado: transición atómica e idempotente vía
 * la RPC close_payout_batch(). Reintentar sobre un lote ya cerrado no hace
 * nada (closed=false) — no hay riesgo de doble pago por doble click. */
export const PayoutBatchesPanel: React.FC = () => {
  const { technicians, showToast, refreshRemoteData } = useApp();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [reference, setReference] = useState<Record<string, string>>({});
  const [last4, setLast4] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [closing, setClosing] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from('technician_payout_batches')
      .select('id, technician_id, status, total_amount, settlement_count, scheduled_date, transfer_method')
      .eq('status', 'scheduled')
      .order('scheduled_date');
    if (error) { showToast('No se pudieron cargar los lotes programados.', 'error'); return; }
    setBatches((data ?? []) as Batch[]);
  };
  useEffect(() => { void load(); }, []);

  const close = async (batch: Batch) => {
    const ref = (reference[batch.id] ?? '').trim();
    if (!ref) { showToast('Ingresá la referencia real de la transferencia.', 'warning'); return; }
    setClosing(batch.id);
    try {
      let receiptPath: string | null = null;
      const file = files[batch.id];
      if (file) {
        const path = `${batch.technician_id}/${batch.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('payout-receipts').upload(path, file, { contentType: file.type });
        if (uploadError) throw uploadError;
        receiptPath = path;
      }

      const { data, error } = await supabase.rpc('close_payout_batch', {
        p_batch_id: batch.id,
        p_transfer_reference: ref,
        p_receipt_url: receiptPath,
        p_destination_last4: (last4[batch.id] ?? '').trim() || null,
      });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.closed) {
        showToast('Este lote ya estaba cerrado — no se hizo nada de nuevo.', 'warning');
      } else {
        showToast(`Lote cerrado: ${result.settlement_count} liquidación(es) por ${ars(result.total_amount)}.`, 'success');
      }
      await load();
      await refreshRemoteData();
    } catch {
      showToast('No se pudo cerrar el lote.', 'error');
    } finally {
      setClosing(null);
    }
  };

  if (batches.length === 0) return null;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="w-4 text-teal-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold">Cerrar lotes programados</h3>
          <p className="text-[11px] text-slate-500">
            Marcá como pagado solo después de confirmar la transferencia real. La operación es atómica: no se puede pagar dos veces el mismo lote.
          </p>
        </div>
      </div>
      <div className="space-y-3">
        {batches.map((batch) => {
          const technician = technicians.find((t) => t.id === batch.technician_id);
          return (
            <div key={batch.id} className="rounded-lg border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <strong className="text-xs">{technician?.name ?? 'Técnico'}</strong>
                  <p className="text-[11px] text-slate-500">
                    {batch.settlement_count} liquidación(es) · Programado: {dateTime(batch.scheduled_date)}
                  </p>
                </div>
                <strong className="text-sm text-teal-700">{ars(batch.total_amount)}</strong>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  value={reference[batch.id] ?? ''}
                  onChange={(e) => setReference((r) => ({ ...r, [batch.id]: e.target.value }))}
                  placeholder="Referencia real de la transferencia *"
                  className="rounded-lg border border-slate-200 p-2 text-xs"
                />
                <input
                  value={last4[batch.id] ?? ''}
                  onChange={(e) => setLast4((r) => ({ ...r, [batch.id]: e.target.value.slice(0, 4) }))}
                  placeholder="Últimos 4 dígitos (opcional)"
                  className="rounded-lg border border-slate-200 p-2 text-xs"
                />
                <label className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2 py-2 text-[11px] text-slate-600 cursor-pointer hover:border-teal-400">
                  <FileUp className="w-3.5 shrink-0" />
                  <span className="truncate">{files[batch.id]?.name ?? 'Comprobante (opcional)'}</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => setFiles((f) => ({ ...f, [batch.id]: e.target.files?.[0] ?? null }))}
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  disabled={closing === batch.id}
                  onClick={() => void close(batch)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-teal-300 disabled:opacity-40"
                >
                  <CheckCircle2 className="w-3.5" />
                  {closing === batch.id ? 'Cerrando…' : 'Marcar como pagado'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 text-[10px] text-slate-400">
        <Landmark className="w-3 shrink-0" /> El cierre libera al técnico ver fecha, referencia y comprobante en su portal, y le llega un aviso automático.
      </p>
    </section>
  );
};
