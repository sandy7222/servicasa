import React, { useEffect, useMemo, useState } from 'react';
import { Download, Split } from 'lucide-react';
import { formatArs } from '../../lib/pricing';
import { supabase } from '../../lib/supabase';

/**
 * Cobro repartido, Fase 4 (plan-cobro-repartido.md): lo cobrado por reparto en un mes.
 * - mode 'admin': todos los técnicos, subtotal por técnico (para facturarle la comisión) y descarga CSV.
 * - mode 'technician': solo lo propio, informativo (la plata ya está en su Mercado Pago). Si no tiene ningún
 *   cobro repartido en el mes, no muestra nada.
 */

type Row = {
  id: string;
  orderId: string;
  orderTitle: string;
  technicianId: string;
  technicianName: string;
  capturedAt: string | null;
  status: 'approved' | 'refunded';
  amount: number;
  commission: number;
  mpFee: number;
  technicianNet: number;
};
type Totals = { count: number; amount: number; commission: number; mpFee: number; technicianNet: number };
type Report = { month: string; rows: Row[]; totals: Totals };

function currentMonth(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' }) : '—';

/** CSV con separador ";" y coma decimal: es lo que Excel en español abre bien. */
export function reportToCsv(report: Report): string {
  const num = (n: number) => n.toFixed(2).replace('.', ',');
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [
    ['Fecha de cobro', 'Técnico', 'Orden', 'Estado', 'Monto cobrado', 'Comisión TecniUrbano', 'Cargo Mercado Pago', 'Neto técnico'].join(';'),
    ...report.rows.map((r) =>
      [
        fmtDay(r.capturedAt),
        esc(r.technicianName),
        esc(r.orderTitle),
        r.status === 'refunded' ? 'Devuelto' : 'Cobrado',
        num(r.amount),
        num(r.commission),
        num(r.mpFee),
        num(r.technicianNet),
      ].join(';')
    ),
    ['Total (sin devueltos)', '', '', '', num(report.totals.amount), num(report.totals.commission), num(report.totals.mpFee), num(report.totals.technicianNet)].join(';'),
  ];
  return '﻿' + lines.join('\r\n');
}

export const SplitEarningsReport: React.FC<{ mode: 'admin' | 'technician' }> = ({ mode }) => {
  const [month, setMonth] = useState(currentMonth);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error('Tu sesión expiró.');
        const response = await fetch(`/api/payments/split-report?month=${month}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = (await response.json().catch(() => ({}))) as Partial<Report> & { error?: string };
        if (!response.ok) throw new Error(body.error || 'No se pudo cargar el informe.');
        if (!cancelled) setReport({ month: body.month ?? month, rows: body.rows ?? [], totals: body.totals ?? { count: 0, amount: 0, commission: 0, mpFee: 0, technicianNet: 0 } });
      } catch (err) {
        if (!cancelled) {
          setReport(null);
          setError(err instanceof Error ? err.message : 'No se pudo cargar el informe.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [month]);

  const byTechnician = useMemo(() => {
    const map = new Map<string, { name: string; count: number; amount: number; commission: number; technicianNet: number }>();
    for (const r of report?.rows ?? []) {
      if (r.status !== 'approved') continue;
      const t = map.get(r.technicianId) ?? { name: r.technicianName, count: 0, amount: 0, commission: 0, technicianNet: 0 };
      t.count += 1;
      t.amount += r.amount;
      t.commission += r.commission;
      t.technicianNet += r.technicianNet;
      map.set(r.technicianId, t);
    }
    return [...map.values()].sort((a, b) => b.commission - a.commission);
  }, [report]);

  // El técnico sin cobros repartidos no ve nada (la mayoría todavía cobra por liquidación).
  if (mode === 'technician' && !loading && (!report || report.rows.length === 0) && month === currentMonth()) return null;

  const download = () => {
    if (!report) return;
    const blob = new Blob([reportToCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cobros-repartidos-${report.month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const t = report?.totals;
  return (
    <section className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-900 p-4 space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-bold text-slate-900 dark:text-slate-100"><Split className="w-4 h-4 text-indigo-600" />
            {mode === 'admin' ? 'Cobros repartidos por Mercado Pago' : 'Cobrado directo en tu Mercado Pago'}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {mode === 'admin'
              ? 'Trabajos cobrados con reparto automático: la comisión ya está en tu cuenta y el neto en la del técnico. Usalo para facturarle la comisión a cada técnico.'
              : 'Trabajos que Mercado Pago te acreditó directo, ya descontada la comisión de TecniUrbano y el cargo de Mercado Pago. No pasan por tus liquidaciones.'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth((m) => shiftMonth(m, -1))} className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1" aria-label="Mes anterior">‹</button>
          <span className="min-w-28 text-center font-semibold">{monthLabel(month)}</span>
          <button type="button" disabled={month >= currentMonth()} onClick={() => setMonth((m) => shiftMonth(m, 1))} className="rounded-md border border-slate-200 dark:border-slate-700 px-2 py-1 disabled:opacity-40" aria-label="Mes siguiente">›</button>
        </div>
      </div>

      {loading && <p className="text-slate-500">Cargando…</p>}
      {error && <p role="alert" className="text-rose-700">{error}</p>}

      {!loading && report && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Figure label="Cobrado" value={formatArs(t!.amount)} hint={`${t!.count} trabajo${t!.count === 1 ? '' : 's'}`} />
            <Figure label={mode === 'admin' ? 'Tu comisión' : 'Comisión TecniUrbano'} value={formatArs(t!.commission)} strong={mode === 'admin'} />
            <Figure label="Cargo Mercado Pago" value={formatArs(t!.mpFee)} />
            <Figure label={mode === 'admin' ? 'Neto a técnicos' : 'Te quedó'} value={formatArs(t!.technicianNet)} strong={mode === 'technician'} />
          </div>

          {report.rows.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400">No hubo cobros repartidos en {monthLabel(month).toLowerCase()}.</p>
          ) : (
            <>
              {mode === 'admin' && byTechnician.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="text-slate-500"><tr><th className="py-1">Técnico</th><th>Trabajos</th><th>Cobrado</th><th>Comisión a facturar</th><th>Neto técnico</th></tr></thead>
                    <tbody>
                      {byTechnician.map((row) => (
                        <tr key={row.name} className="border-t border-slate-100 dark:border-slate-800">
                          <td className="py-1 font-semibold">{row.name}</td><td>{row.count}</td><td>{formatArs(row.amount)}</td>
                          <td className="font-bold text-indigo-700 dark:text-indigo-300">{formatArs(row.commission)}</td><td>{formatArs(row.technicianNet)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <details>
                <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">Detalle por trabajo ({report.rows.length})</summary>
                <ul className="mt-2 space-y-1">
                  {report.rows.map((r) => (
                    <li key={r.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-950 px-2 py-1.5">
                      <span>{fmtDay(r.capturedAt)} · {r.orderTitle}{mode === 'admin' ? ` · ${r.technicianName}` : ''}{r.status === 'refunded' && <strong className="text-rose-700"> · Devuelto</strong>}</span>
                      <span>{formatArs(r.amount)} · comisión {formatArs(r.commission)} · neto {formatArs(r.technicianNet)}</span>
                    </li>
                  ))}
                </ul>
              </details>
              {mode === 'admin' && (
                <button type="button" onClick={download} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 px-3 py-1.5 font-bold text-indigo-700">
                  <Download className="w-3.5 h-3.5" />Descargar planilla del mes
                </button>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
};

const Figure: React.FC<{ label: string; value: string; hint?: string; strong?: boolean }> = ({ label, value, hint, strong }) => (
  <div className={`rounded-lg p-2 ${strong ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'bg-slate-50 dark:bg-slate-950'}`}>
    <div className="text-[10px] text-slate-500 dark:text-slate-400">{label}</div>
    <div className={`text-sm ${strong ? 'font-black text-indigo-800 dark:text-indigo-200' : 'font-bold'}`}>{value}</div>
    {hint && <div className="text-[10px] text-slate-500">{hint}</div>}
  </div>
);
