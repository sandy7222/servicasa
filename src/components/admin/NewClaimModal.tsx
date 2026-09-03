import { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { createCase } from '../../lib/supportCases';
import type { ClaimPriority, ClaimType } from '../../types';
import { CLAIM_TYPE_LABELS } from './claimShared';

export function NewClaimModal({
  isOpen,
  onClose,
  onCreated,
  mode = 'admin',
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  /** 'customer': autoservicio desde el portal del cliente — cliente y órdenes
   * quedan fijos a la propia cuenta, la orden pasa a ser obligatoria (así lo
   * exige la política RLS support_cases_insert_customer). */
  mode?: 'admin' | 'customer';
}) {
  const { orders, customers, technicians, currentUser, showToast } = useApp();
  const isCustomerMode = mode === 'customer';
  const availableOrders = isCustomerMode ? orders.filter((o) => o.clientId === currentUser?.customerId) : orders;
  const [orderId, setOrderId] = useState('');
  const [customerId, setCustomerId] = useState(isCustomerMode ? currentUser?.customerId ?? '' : '');
  const [technicianId, setTechnicianId] = useState('');
  const [type, setType] = useState<ClaimType>('complaint');
  const [priority, setPriority] = useState<ClaimPriority>('medium');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [pauseSettlement, setPauseSettlement] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const selectedOrder = orders.find((o) => o.id === orderId);

  const onOrderChange = (value: string) => {
    setOrderId(value);
    const order = orders.find((o) => o.id === value);
    if (order) {
      setCustomerId(order.clientId);
      setTechnicianId(order.assignedTechnicianId ?? '');
      // El default a "pausar liquidación" solo aplica al flujo de admin — en
      // modo cliente el checkbox ni se muestra, y esto no dispara ninguna
      // pausa real (createCase salta ese paso para actores no-admin), así
      // que dejarlo en true acá solo mentiría en support_cases.settlement_paused.
      setPauseSettlement(!isCustomerMode);
    } else {
      setPauseSettlement(false);
    }
  };

  const submit = async () => {
    if (!subject.trim()) {
      showToast('Ingresá un asunto para el caso.', 'warning');
      return;
    }
    if (isCustomerMode && !orderId) {
      showToast('Elegí a qué pedido corresponde el reclamo.', 'warning');
      return;
    }
    setBusy(true);
    try {
      const customerName = customers.find((c) => c.id === customerId)?.name ?? selectedOrder?.clientName ?? undefined;
      const technicianName = technicians.find((t) => t.id === technicianId)?.name ?? selectedOrder?.assignedTechnicianName ?? undefined;
      await createCase(
        {
          orderId: orderId || null,
          customerId: customerId || null,
          technicianId: technicianId || null,
          customerName,
          technicianName,
          type,
          priority,
          subject: subject.trim(),
          description: description.trim() || undefined,
          pauseSettlement: pauseSettlement && Boolean(orderId),
        },
        { name: currentUser?.name ?? 'Administración', profileId: currentUser?.id },
        !isCustomerMode
      );
      showToast('Caso abierto correctamente.', 'success', 'Reclamos');
      onCreated();
    } catch {
      showToast('No se pudo abrir el caso.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 dark:border-slate-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Abrir caso</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{isCustomerMode ? 'Elegí a qué pedido corresponde.' : 'El caso queda vinculado a cliente, orden y técnico (opcional).'}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Orden vinculada{isCustomerMode ? ' *' : ' (opcional)'}</label>
            <select value={orderId} onChange={(e) => onOrderChange(e.target.value)} className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg">
              <option value="">{isCustomerMode ? 'Elegí el pedido…' : 'Sin orden vinculada'}</option>
              {availableOrders.map((o) => (
                <option key={o.id} value={o.id}>{isCustomerMode ? o.title : `${o.id} — ${o.title}`}</option>
              ))}
            </select>
            {isCustomerMode && availableOrders.length === 0 && (
              <p className="text-[11px] text-amber-700 mt-1">No tenés pedidos sobre los cuales abrir un reclamo todavía.</p>
            )}
          </div>

          {!isCustomerMode && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cliente</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg">
                  <option value="">Sin cliente</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Técnico</label>
                <select value={technicianId} onChange={(e) => setTechnicianId(e.target.value)} className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg">
                  <option value="">Sin técnico</option>
                  {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
              <select value={type} onChange={(e) => setType(e.target.value as ClaimType)} className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg">
                {(Object.keys(CLAIM_TYPE_LABELS) as ClaimType[]).map((t) => <option key={t} value={t}>{CLAIM_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Prioridad</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as ClaimPriority)} className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg">
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Asunto *</label>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej: Fuga no resuelta tras reparación" className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg" />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Descripción</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Detalle del reclamo o garantía…" className="w-full text-sm px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 rounded-lg" />
          </div>

          {orderId && !isCustomerMode && (
            <label className="flex gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-950">
              <input type="checkbox" checked={pauseSettlement} onChange={(e) => setPauseSettlement(e.target.checked)} className="mt-0.5" />
              <span><strong>Pausar liquidación al técnico.</strong><br />Las liquidaciones no pagadas de esta orden pasarán a revisión.</span>
            </label>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold">Cancelar</button>
            <button onClick={submit} disabled={busy || !subject.trim()} className="px-5 py-2 bg-[#0f1b35] disabled:opacity-50 text-white rounded-lg text-xs font-bold">Abrir caso</button>
          </div>
        </div>
      </div>
    </div>
  );
}
