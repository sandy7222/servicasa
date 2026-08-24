import React, { useEffect, useMemo, useState } from 'react';
import { ListFilter, Scale } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';

type Row = {
  settlement_id: string;
  order_id: string;
  technician_id: string;
  technician_name: string;
  settlement_type: string;
  status: string;
  net_amount: number;
  scheduled_date: string | null;
  paid_at: string | null;
  dispute_reason: string | null;
  batch_status: string | null;
  batch_transfer_reference: string | null;
  created_at: string;
};

const ars = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value?: string | null) => (value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value)) : '—');
const STATUS_LABELS: Record<string, string> = {
  pending_release: 'En garantía', released: 'Liberado', scheduled: 'Programado',
  in_transit: 'En tránsito', paid: 'Pagado', in_review: 'En revisión', cancelled: 'Cancelado',
};

/** Conciliación administrativa: todas las liquidaciones (RLS ya limita a
 * admin — ver policy de la vista), filtrables por estado/técnico/fecha/importe. */
export const SettlementReconciliation: React.FC = () => {
  const { technicians, showToast } = useApp();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [technicianId, setTechnicianId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minAmount, setMinAmount] = useState('');

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase
        .from('admin_settlement_reconciliation')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) { showToast('No se pudo cargar la conciliación de liquidaciones.', 'error'); setLoading(false); return; }
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => rows.filter((r) => {
    if (status && r.status !== status) return false;
    if (technicianId && r.technician_id !== technicianId) return false;
    if (dateFrom && new Date(r.created_at) < new Date(dateFrom)) return false;
    if (dateTo && new Date(r.created_at) > new Date(`${dateTo}T23:59:59`)) return false;
    if (minAmount && Number(r.net_amount) < Number(minAmount)) return false;
    return true;
  }), [rows, status, technicianId, dateFrom, dateTo, minAmount]);

  const total = filtered.reduce((sum, r) => sum + Number(r.net_amount), 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Scale className="w-4 text-teal-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold">Conciliación de liquidaciones</h3>
          <p className="text-[11px] text-slate-500">Por estado, técnico, fecha e importe. {filtered.length} de {rows.length} filas · {ars(total)}.</p>
        </div>
      </div>
      <div className="grid sm:grid-cols-5 gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 p-2 text-xs">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="rounded-lg border border-slate-200 p-2 text-xs">
          <option value="">Todos los técnicos</option>
          {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-lg border border-slate-200 p-2 text-xs" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-lg border border-slate-200 p-2 text-xs" />
        <input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="Importe mínimo" className="rounded-lg border border-slate-200 p-2 text-xs" />
      </div>
      {loading ? (
        <p className="text-xs text-slate-500 py-4 text-center">Cargando…</p>
      ) : filtered.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-slate-500 py-4 justify-center"><ListFilter className="w-3.5" />Sin resultados para estos filtros.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[11px] min-w-[640px]">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="py-1.5 px-1">Técnico</th>
                <th className="py-1.5 px-1">Estado</th>
                <th className="py-1.5 px-1">Neto</th>
                <th className="py-1.5 px-1">Creada</th>
                <th className="py-1.5 px-1">Pagada</th>
                <th className="py-1.5 px-1">Referencia lote</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.settlement_id} className="border-b border-slate-50">
                  <td className="py-1.5 px-1 font-semibold">{r.technician_name}</td>
                  <td className="py-1.5 px-1">{STATUS_LABELS[r.status] ?? r.status}{r.dispute_reason ? ` · ${r.dispute_reason}` : ''}</td>
                  <td className="py-1.5 px-1 font-mono">{ars(r.net_amount)}</td>
                  <td className="py-1.5 px-1">{date(r.created_at)}</td>
                  <td className="py-1.5 px-1">{date(r.paid_at)}</td>
                  <td className="py-1.5 px-1 text-slate-500">{r.batch_transfer_reference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
