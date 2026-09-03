import React from 'react';
import { Clock3, FileWarning, Printer } from 'lucide-react';
import { formatArs } from '../../lib/pricing';
import type { OrderQuote, ServiceOrder } from '../../types';

type Props = { order: ServiceOrder; quote: OrderQuote };

/** Customer-facing rejection record; internal settlement and payment costs never appear here. */
export const RejectedVisitReceipt: React.FC<Props> = ({ order, quote }) => {
  const visitDeposit = quote.visitDepositCredit || order.visitDepositAmount || 0;
  return <section className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 p-4 shadow-xs space-y-3 print:bg-white" aria-labelledby="rejected-receipt-title">
    <div className="flex items-start justify-between gap-3"><div className="flex gap-2"><FileWarning className="mt-0.5 h-4 w-4 text-amber-700" /><div><h3 id="rejected-receipt-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Constancia de presupuesto rechazado</h3><p className="text-[11px] text-slate-600 dark:text-slate-400">Orden {order.id.slice(0, 8).toUpperCase()} · TecniUrbano</p></div></div><button type="button" onClick={() => window.print()} className="no-print inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white dark:bg-slate-900 px-2 py-1.5 text-[11px] font-bold text-amber-900 dark:text-amber-200"><Printer className="h-3.5 w-3.5" />Imprimir</button></div>
    <div className="grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-3"><strong className="block text-slate-900 dark:text-slate-100">Servicio de diagnóstico</strong><span className="mt-1 block text-slate-600 dark:text-slate-400">{order.serviceType} · {order.clientAddress}</span><span className="mt-1 block text-slate-600 dark:text-slate-400">Técnico asignado: {order.assignedTechnicianName ?? 'A confirmar'}</span></div><div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-3"><strong className="block text-slate-900 dark:text-slate-100">Estado del presupuesto</strong><span className="mt-1 block text-rose-700">Rechazado por el cliente</span><span className="mt-1 block text-slate-600 dark:text-slate-400">Monto propuesto: {formatArs(quote.totalAmount)}</span></div></div>
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 p-3 text-xs"><div className="flex justify-between gap-3"><span>Visita de presupuesto registrada</span><strong>{formatArs(visitDeposit)}</strong></div><p className="mt-2 text-slate-600 dark:text-slate-400">La visita de presupuesto queda en revisión según las condiciones aceptadas. No incluye la distribución interna de la operación.</p></div>
    <div className="flex gap-2 text-[11px] text-amber-900 dark:text-amber-200"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><p>El comprobante definitivo y la descarga PDF se habilitarán cuando el servidor confirme el pago real y finalice el período de revisión.</p></div>
  </section>;
};
