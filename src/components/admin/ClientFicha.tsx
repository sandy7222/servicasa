import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, ClipboardList, Copy, CreditCard, FileText, Home, MapPin, Plus, ShieldCheck, StickyNote, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { PaymentStatusBadge } from '../common/Badge';
import { formatCustomerCode } from '../../lib/codes';
import { EntityActionsMenu } from '../common/EntityActionsMenu';

type Tab = 'summary' | 'orders' | 'quotes' | 'warranties' | 'payments' | 'notes';
type Address = { id: string; label: string | null; address_line: string; neighborhood: string | null; city: string; postal_code: string | null; is_default: boolean };
type AdminNote = { id: string; note: string; created_at: string };
type Payment = { id: string; order_id: string; payment_type: string; status: string; amount: number; currency: string; mp_payment_method: string | null; paid_at: string | null; created_at: string };
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  account_money: 'Dinero en cuenta (Mercado Pago)',
  master: 'Mastercard crédito', visa: 'Visa crédito', amex: 'American Express',
  debmaster: 'Mastercard débito', debvisa: 'Visa débito',
  pagofacil: 'Pago Fácil', rapipago: 'Rapipago',
};
const paymentMethodLabel = (code: string | null) => (code ? PAYMENT_METHOD_LABELS[code] ?? code : 'Sin confirmar');
const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });

export function ClientFicha({ customerId, onBack }: { customerId: string; onBack: () => void }) {
  const { customers, orders, technicians, showToast, createAccountInviteLink } = useApp();
  const [tab, setTab] = useState<Tab>('summary');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteLinkUrl, setInviteLinkUrl] = useState<string | null>(null);
  const customer = customers.find((item) => item.id === customerId);

  const handleGenerateInvite = async () => {
    if (!customer) return;
    try {
      const url = await createAccountInviteLink('customer', customer.id);
      setInviteLinkUrl(url);
      try {
        await navigator.clipboard.writeText(url);
        showToast('Enlace copiado al portapapeles', 'success', 'Invitación lista');
      } catch {
        showToast('Enlace generado. Copialo desde el cuadro.', 'info');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo generar el enlace', 'error');
    }
  };
  const customerOrders = useMemo(() => orders.filter((order) => order.clientId === customerId), [orders, customerId]);
  const completed = customerOrders.filter((order) => order.status === 'completed');
  const warranties = completed.filter((order) => order.completedAt && Date.now() - new Date(order.completedAt).getTime() < 30 * 86400000);
  const quotes = customerOrders.flatMap((order) => (order.quotes ?? []).map((quote) => ({ quote, order })));

  const loadPrivateData = async () => {
    if (!customer) return;
    const ids = customerOrders.map((order) => order.id);
    const [addressResult, noteResult, paymentResult] = await Promise.all([
      supabase.from('customer_addresses').select('*').eq('customer_id', customer.id).order('is_default', { ascending: false }),
      supabase.from('customer_admin_notes').select('id, note, created_at').eq('customer_id', customer.id).order('created_at', { ascending: false }),
      ids.length ? supabase.from('payment_transactions').select('id, order_id, payment_type, status, amount, currency, mp_payment_method, paid_at, created_at').in('order_id', ids).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null }),
    ]);
    if (addressResult.error || noteResult.error || paymentResult.error) {
      // It is normal before the SQL migration is run; the rest of the fiche remains useful.
      console.warn('Customer fiche extras unavailable', addressResult.error ?? noteResult.error ?? paymentResult.error);
      return;
    }
    setAddresses((addressResult.data ?? []) as Address[]);
    setNotes((noteResult.data ?? []) as AdminNote[]);
    setPayments((paymentResult.data ?? []) as Payment[]);
  };

  useEffect(() => { void loadPrivateData(); }, [customerId, customerOrders.length]);

  const addNote = async () => {
    if (!noteText.trim() || !customer) return;
    setBusy(true);
    const { error } = await supabase.from('customer_admin_notes').insert({ customer_id: customer.id, note: noteText.trim() });
    setBusy(false);
    if (error) { showToast('No se pudo guardar la nota interna. Confirmá la migración y tus permisos de administración.', 'error'); return; }
    setNoteText(''); await loadPrivateData(); showToast('Nota interna guardada', 'success');
  };

  if (!customer) return <main className="max-w-5xl mx-auto p-6"><button onClick={onBack} className="text-teal-700 font-bold">← Volver a clientes</button><p className="mt-6 text-slate-600">No encontramos este cliente.</p></main>;
  const paid = completed.reduce((sum, order) => sum + (order.totalPaidAmount ?? 0), 0);
  const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: 'summary', label: 'Resumen', icon: Home }, { id: 'orders', label: 'Órdenes', icon: ClipboardList }, { id: 'quotes', label: 'Presupuestos', icon: FileText }, { id: 'warranties', label: 'Garantías', icon: ShieldCheck }, { id: 'payments', label: 'Pagos', icon: CreditCard }, { id: 'notes', label: 'Notas', icon: StickyNote },
  ];
  const statusClass = (status: string) => status === 'completed' ? 'bg-emerald-50 text-emerald-700' : status === 'cancelled' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700';

  return <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
    <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-bold text-teal-700 hover:underline"><ArrowLeft className="w-4 h-4" />Volver a la planilla</button>
    <section className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"><div><p className="font-mono text-xs text-teal-700">FICHA DE CLIENTE {formatCustomerCode(customer.customerNumber) && `· ${formatCustomerCode(customer.customerNumber)}`}</p><h1 className="text-2xl font-black text-slate-900 mt-1">{customer.name}</h1><p className="text-sm text-slate-500 mt-1">{customer.phone || 'Sin teléfono'} · {customer.email || 'Sin email'}</p></div><div className="flex items-start gap-3"><div className="grid grid-cols-3 gap-2 text-center"><Metric value={String(customerOrders.length)} label="Órdenes" /><Metric value={money.format(paid)} label="Abonado" /><Metric value={String(warranties.length)} label="Garantías" /></div><EntityActionsMenu
      items={[
        {
          id: 'invite',
          label: customer.profileId ? 'Ya tiene cuenta' : 'Generar enlace de cuenta',
          icon: 'invite',
          disabled: Boolean(customer.profileId) || !customer.email,
          hint: !customer.email
            ? 'Completá el email primero'
            : customer.profileId
              ? 'Esta ficha ya está vinculada'
              : undefined,
          onSelect: () => void handleGenerateInvite(),
        },
      ]}
    /></div></div></section>
    <nav className="flex gap-2 overflow-x-auto pb-1">{tabs.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap inline-flex gap-1.5 items-center px-3 py-2 rounded-lg text-sm font-bold ${tab === item.id ? 'bg-[#0f1b35] text-teal-300' : 'bg-white border border-slate-200 text-slate-600'}`}><Icon className="w-4 h-4" />{item.label}</button>; })}</nav>
    {tab === 'summary' && <div className="grid md:grid-cols-2 gap-4"><Panel title="Domicilio principal" icon={MapPin}><p className="font-semibold">{customer.address}</p><p className="text-sm text-slate-500">{customer.neighborhood}</p></Panel><Panel title="Domicilios adicionales" icon={Home}>{addresses.length ? <div className="space-y-3">{addresses.map((address) => <div key={address.id} className="rounded-lg bg-slate-50 p-3"><div className="font-bold text-sm">{address.label || 'Domicilio'} {address.is_default && <span className="text-xs text-teal-700">· Predeterminado</span>}</div><div className="text-sm text-slate-600">{address.address_line}, {address.neighborhood || address.city}</div></div>)}</div> : <p className="text-sm text-slate-500">No hay domicilios adicionales registrados.</p>}</Panel></div>}
    {tab === 'orders' && <Panel title="Historial de órdenes" icon={ClipboardList}>{customerOrders.length ? <div className="divide-y">{customerOrders.map((order) => <div key={order.id} className="py-3 flex flex-col sm:flex-row justify-between gap-2"><div><div className="font-bold">{order.title}</div><div className="text-sm text-slate-500">{order.serviceType} · {order.assignedTechnicianName || 'Sin técnico'} · {new Date(order.createdAt).toLocaleDateString('es-AR')}</div></div><div className="self-start flex items-center gap-1.5"><PaymentStatusBadge order={order} size="sm" /><span className={`rounded px-2 py-1 text-xs font-bold ${statusClass(order.status)}`}>{order.status}</span></div></div>)}</div> : <p className="text-slate-500 text-sm">Sin órdenes registradas.</p>}</Panel>}
    {tab === 'quotes' && <Panel title="Presupuestos enviados" icon={FileText}>{quotes.length ? <div className="space-y-3">{quotes.map(({ quote, order }) => <div key={quote.id} className="rounded-xl border border-slate-200 p-4"><div className="flex justify-between gap-3"><div><div className="font-bold">{order.title}</div><p className="text-sm text-slate-500">Versión {quote.version} · {quote.status}</p></div><div className="font-mono font-bold">{money.format(quote.totalAmount)}</div></div><p className="mt-2 text-sm text-slate-600">{quote.status === 'accepted' ? <span className="text-emerald-700 font-semibold">Pagado</span> : `Restante: ${money.format(quote.remainingAmount)}`}</p></div>)}</div> : <p className="text-sm text-slate-500">No hay presupuestos para este cliente.</p>}</Panel>}
    {tab === 'warranties' && <Panel title="Garantías activas" icon={ShieldCheck}>{warranties.length ? <div className="space-y-3">{warranties.map((order) => { const end = new Date(new Date(order.completedAt!).getTime() + 30 * 86400000); const remaining = Math.max(0, Math.ceil((end.getTime() - Date.now()) / 86400000)); return <div key={order.id} className="rounded-xl bg-emerald-50 border border-emerald-200 p-4"><div className="font-bold text-emerald-900">{order.title}</div><div className="text-sm text-emerald-700">Vence el {end.toLocaleDateString('es-AR')} · quedan {remaining} días</div></div>; })}</div> : <p className="text-sm text-slate-500">No hay garantías activas.</p>}</Panel>}
    {tab === 'payments' && <Panel title="Historial de pagos" icon={CreditCard}>{payments.length ? <div className="divide-y">{payments.map((payment) => { const order = customerOrders.find((o) => o.id === payment.order_id); return <div key={payment.id} className="py-3 flex justify-between gap-3"><div><div className="font-semibold">{order?.title ?? 'Orden eliminada'}</div><div className="text-xs text-slate-500">{payment.payment_type} · {paymentMethodLabel(payment.mp_payment_method)}</div><div className="text-xs text-slate-500">{payment.paid_at ? new Date(payment.paid_at).toLocaleString('es-AR') : new Date(payment.created_at).toLocaleString('es-AR')} · {payment.status}</div></div><div className="font-mono font-bold shrink-0">{money.format(Number(payment.amount))}</div></div>; })}</div> : <p className="text-sm text-slate-500">No hay pagos registrados para sus órdenes.</p>}</Panel>}
    {tab === 'notes' && <Panel title="Notas internas" icon={StickyNote}><div className="flex gap-2 mb-5"><textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Nota visible solo para administración…" className="flex-1 min-h-20 rounded-lg border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-500" /><button disabled={busy || !noteText.trim()} onClick={() => void addNote()} className="self-end inline-flex items-center gap-1 rounded-lg bg-teal-600 text-white font-bold px-3 py-2 disabled:opacity-50"><Plus className="w-4 h-4" />Guardar</button></div>{notes.length ? <div className="space-y-3">{notes.map((note) => <article key={note.id} className="rounded-lg bg-amber-50 border border-amber-100 p-3"><p className="text-sm text-slate-800 whitespace-pre-wrap">{note.note}</p><time className="mt-2 block text-xs text-slate-500">{new Date(note.created_at).toLocaleString('es-AR')}</time></article>)}</div> : <p className="text-sm text-slate-500">Todavía no hay notas internas.</p>}</Panel>}
    {inviteLinkUrl && (
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        onClick={() => setInviteLinkUrl(null)}
      >
        <div
          className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">Enlace de alta de cuenta</h3>
              <p className="text-xs text-slate-600 mt-1">
                Enviá este enlace a <strong>{customer.name}</strong> para que cree su contraseña y
                entre como cliente. Vence en 14 días.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setInviteLinkUrl(null)}
              className="text-slate-400 hover:text-slate-700 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteLinkUrl}
              className="flex-1 text-[11px] font-mono px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(inviteLinkUrl);
                  showToast('Enlace copiado', 'success');
                } catch {
                  showToast('No se pudo copiar. Seleccioná el texto.', 'error');
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-2 bg-[#0F172A] text-teal-300 text-xs font-bold rounded-lg border border-slate-700"
            >
              <Copy className="w-3.5 h-3.5" />
              Copiar
            </button>
          </div>
        </div>
      </div>
    )}
  </main>;
}

function Metric({ value, label }: { value: string; label: string }) { return <div className="rounded-lg bg-slate-50 px-3 py-2"><div className="font-mono font-black text-slate-900">{value}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div></div>; }
function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Home; children: ReactNode }) { return <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5"><h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-teal-600" />{title}</h2>{children}</section>; }
