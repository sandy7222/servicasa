import React, { useState } from 'react';
import { CheckCircle2, FileText, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatArs } from '../../lib/pricing';
import { redirectToPayment } from '../../lib/paymentClient';
import { supabase } from '../../lib/supabase';
import type { OrderQuote, ServiceOrder } from '../../types';
import { RejectedVisitReceipt } from './RejectedVisitReceipt';

type Props = { order: ServiceOrder };

export const QuoteViewer: React.FC<Props> = ({ order }) => {
  const { refreshRemoteData, showToast } = useApp();
  const quote = order.quotes?.[0] as OrderQuote | undefined;
  const [busy, setBusy] = useState(false);
  const isExpired = Boolean(quote?.validUntil && new Date(quote.validUntil).getTime() < Date.now());

  const reject = async () => {
    if (!quote || !window.confirm('¿Confirmás que rechazás este presupuesto? La seña se gestionará según las condiciones aceptadas y el período de reclamo.')) return;
    setBusy(true);
    try {
      const { error } = await supabase.from('order_quotes').update({ status: 'rejected', rejected_at: new Date().toISOString() }).eq('id', quote.id);
      if (error) throw error;
      await refreshRemoteData();
      showToast('Presupuesto rechazado. El comprobante se emitirá cuando se cierre el período de reclamo.', 'info');
    } catch (error) { showToast(error instanceof Error ? error.message : 'No se pudo registrar el rechazo.', 'error'); }
    finally { setBusy(false); }
  };

  const accept = async () => {
    if (!quote) return;
    if (isExpired) {
      showToast('El presupuesto venció. Pedí una nueva versión al técnico.', 'warning');
      return;
    }
    setBusy(true);
    try {
      // Payment preference creation remains server-only. Do not mark accepted until its webhook confirms payment.
      await redirectToPayment(order.id, 'balance_payment', quote.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo iniciar el pago seguro.', 'error');
    } finally { setBusy(false); }
  };

  if (!quote || quote.status === 'draft') return null;
  return <section className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
    <div className="flex items-start gap-2"><FileText className="w-4 h-4 mt-0.5 text-teal-700" /><div><h3 className="text-sm font-bold text-slate-900">Presupuesto del diagnóstico</h3><p className="text-[11px] text-slate-500">Versión {quote.version}. Los ítems y precios enviados no pueden modificarse.</p></div></div>
    <div className="space-y-1.5">{quote.items.map((item) => <div key={item.id} className="flex justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"><span>🔧 Servicio · {item.description}<span className="block text-[10px] text-slate-500">{item.quantity} {item.unit} × {formatArs(item.unitPrice)}</span>{item.notes && <span className="mt-1 block text-[10px] text-slate-600">Nota: {item.notes}</span>}</span><strong className="shrink-0">{formatArs(item.subtotal)}</strong></div>)}</div>
    {quote.notes && <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-950"><strong>Informe del técnico</strong><p className="mt-1 whitespace-pre-line">{quote.notes}</p></div>}
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 space-y-1 text-xs"><div className="flex justify-between"><span>Total</span><strong>{formatArs(quote.totalAmount)}</strong></div><div className="flex justify-between text-slate-600"><span>Seña ya acreditada</span><span>-{formatArs(quote.visitDepositCredit)}</span></div><div className="flex justify-between border-t border-teal-200 pt-1 text-sm font-bold text-teal-900"><span>Restante a pagar</span><span>{formatArs(quote.remainingAmount)}</span></div></div>
    {isExpired && quote.status === 'sent' && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><strong>Presupuesto vencido.</strong> Ya no puede aceptarse; podés rechazarlo o solicitar una nueva versión.</div>}
    {quote.status === 'sent' && <div className="grid sm:grid-cols-2 gap-2"><button type="button" disabled={busy || isExpired} onClick={() => void accept()} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="w-4 h-4" />Aceptar y pagar</button><button type="button" disabled={busy} onClick={() => void reject()} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700 disabled:opacity-50"><XCircle className="w-4 h-4" />Rechazar presupuesto</button></div>}
    {quote.status === 'rejected' && <RejectedVisitReceipt order={order} quote={quote} />}
    {quote.status === 'accepted' && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900"><strong>Presupuesto aceptado.</strong> Estamos confirmando el pago seguro.</div>}
  </section>;
};
