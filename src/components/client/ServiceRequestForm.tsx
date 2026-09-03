import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, ClipboardPlus, CreditCard, MapPin, Search, Wrench } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatArs } from '../../lib/pricing';
import { groupItemsBySubcategory } from '../../lib/catalogOrder';
import { SubcategorySectionHeader } from '../common/SubcategorySectionHeader';
import { redirectToCustomerServiceRequest, fetchPendingDraft, retryDraftPayment, type PendingCustomerDraft } from '../../lib/paymentClient';
import { validateAddressDraft, splitAddressLine } from '../../lib/address';
import { AddressFields, type AddressFieldsValue } from '../common/AddressFields';
import { useCustomerAddresses } from '../../lib/useCustomerAddresses';
import { ASSISTANT_DRAFT_EVENT, readAssistantDraft, clearAssistantDraft } from '../../lib/diagnosisDraft';
import type { AssistantDraft } from '../../lib/diagnosisAssistant';
import type { OrderPriority, ServiceItem, ServiceType, WorkMode } from '../../types';

const DATE_TODAY = new Date().toISOString().slice(0, 10);

/** A request only becomes a real order once Mercado Pago confirms the
 * payment — see api/orders/request-service.ts. Until then it's just a
 * draft, so nothing here ever touches the app's order list directly. */
export const ServiceRequestForm: React.FC = () => {
  const { currentUser, customers, services, catalogSubcategories, showToast, visitDepositAmount } = useApp();
  const customer = customers.find((item) => item.id === currentUser?.customerId);
  const [mode, setMode] = useState<WorkMode>('diagnosis');
  const [serviceType, setServiceType] = useState<ServiceType>('Electricidad');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [addressDraft, setAddressDraft] = useState<AddressFieldsValue>({
    street: '',
    streetNumber: '',
    neighborhood: '',
    city: '',
    province: '',
  });
  const { addresses: savedAddresses, createAddress: createSavedAddress } = useCustomerAddresses(currentUser?.customerId);
  // '' = todavía sin decidir (antes de que carguen las direcciones guardadas),
  // 'new' = cargando una dirección nueva, cualquier otro valor = el id de una
  // dirección guardada elegida del selector.
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [saveAddressChecked, setSaveAddressChecked] = useState(false);
  const [scheduledDate, setScheduledDate] = useState(DATE_TODAY);
  const [appointmentWindow, setAppointmentWindow] = useState('A coordinar');
  const [priority, setPriority] = useState<OrderPriority>('media');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [fromAssistant, setFromAssistant] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<PendingCustomerDraft | null>(null);
  const [resumingPayment, setResumingPayment] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPendingDraft()
      .then((draft) => {
        if (!cancelled) setPendingDraft(draft);
      })
      .catch(() => {
        /* silencioso: si falla, el cliente igual puede armar una solicitud nueva */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resumePayment = async () => {
    if (!pendingDraft) return;
    setResumingPayment(true);
    try {
      await retryDraftPayment(pendingDraft.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo retomar el pago.', 'error');
      setResumingPayment(false);
    }
  };

  const categories = useMemo(() => {
    const values = new Set<string>(['Electricidad']);
    services.filter((service) => service.active !== false).forEach((service) => values.add(service.category));
    return [...values].sort((a, b) => a.localeCompare(b, 'es'));
  }, [services]);

  // Catálogo de precio fijo real, filtrado al rubro elegido y agrupado por
  // subcategoría (mismo criterio que ya usa el técnico en el presupuestador
  // y el cliente en el portal de servicios) — reemplaza la lista chica de 6
  // ítems que solo tenía 1-2 opciones por rubro.
  const directServiceGroups = useMemo(() => {
    const items = services.filter((s) => s.category === serviceType && s.active !== false);
    return groupItemsBySubcategory<ServiceItem>(items, catalogSubcategories).map((g) => ({
      ...g,
      items: [...g.items].sort((a, b) => a.name.localeCompare(b.name, 'es')),
    }));
  }, [services, catalogSubcategories, serviceType]);
  const directTotal = selectedService ? selectedService.price * quantity : 0;

  useEffect(() => {
    const applyDraft = (draft: AssistantDraft) => {
      setFromAssistant(true);
      setServiceType(draft.serviceType);
      setTitle(draft.title);
      setDescription(draft.description);
      setPriority(draft.priority);
      setQuantity(draft.quantity || 1);
      if (draft.workMode === 'direct' && draft.fixedPriceServiceId) {
        const catalogItem = services.find((service) => service.id === draft.fixedPriceServiceId);
        if (!catalogItem && services.length === 0) return false;
        setMode('direct');
        if (catalogItem) setSelectedService(catalogItem);
      } else {
        setMode('diagnosis');
        setSelectedService(null);
      }
      clearAssistantDraft();
      return true;
    };

    const stored = readAssistantDraft();
    if (stored) applyDraft(stored);

    const onDraft = (event: Event) => {
      const draft = (event as CustomEvent<AssistantDraft>).detail;
      if (draft) applyDraft(draft);
    };
    window.addEventListener(ASSISTANT_DRAFT_EVENT, onDraft);

    if (!stored) {
      const pendingServiceId = localStorage.getItem('tecniurbano_selectedServiceId');
      if (pendingServiceId) {
        const catalogItem = services.find((service) => service.id === pendingServiceId);
        if (catalogItem) {
          localStorage.removeItem('tecniurbano_selectedServiceId');
          setServiceType(catalogItem.category);
          setTitle(catalogItem.name);
          setDescription(catalogItem.description);
        }
      }
    }
    return () => window.removeEventListener(ASSISTANT_DRAFT_EVENT, onDraft);
  }, [services]);

  // customers.neighborhood venía haciendo las veces de localidad por
  // convención (ver docs/adr-address-redesign.md) — se usa acá como punto de
  // partida razonable para el campo nuevo "Localidad", sin pisar lo que el
  // cliente ya haya tipeado.
  useEffect(() => {
    setAddressDraft((prev) => ({
      ...prev,
      city: prev.city || customer?.neighborhood || '',
      province: prev.province || customer?.province || '',
    }));
  }, [customer?.neighborhood, customer?.province]);

  // Apenas cargan las direcciones guardadas, elegí la default (o la primera)
  // como punto de partida — sin pisar una elección que el cliente ya haya
  // hecho a mano en esta sesión.
  useEffect(() => {
    if (selectedAddressId !== '') return;
    if (savedAddresses.length === 0) {
      setSelectedAddressId('new');
      return;
    }
    const defaultAddress = savedAddresses.find((a) => a.isDefault) ?? savedAddresses[0];
    setSelectedAddressId(defaultAddress.id);
    const { street, streetNumber } = splitAddressLine(defaultAddress.addressLine);
    setAddressDraft((prev) => ({ ...prev, street, streetNumber, neighborhood: defaultAddress.neighborhood ?? '', city: defaultAddress.city }));
  }, [savedAddresses, selectedAddressId]);

  const selectSavedAddress = (value: string) => {
    setSelectedAddressId(value);
    if (value === 'new') {
      setAddressDraft((prev) => ({ street: '', streetNumber: '', neighborhood: '', city: '', province: prev.province }));
      return;
    }
    const picked = savedAddresses.find((a) => a.id === value);
    if (!picked) return;
    const { street, streetNumber } = splitAddressLine(picked.addressLine);
    setAddressDraft((prev) => ({ ...prev, street, streetNumber, neighborhood: picked.neighborhood ?? '', city: picked.city }));
  };

  const chooseMode = (nextMode: WorkMode) => {
    setMode(nextMode);
    setSent(false);
    if (nextMode === 'diagnosis') setSelectedService(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser?.customerId) {
      showToast('Tu cuenta todavía no tiene un perfil de cliente vinculado.', 'error');
      return;
    }
    const addressError = validateAddressDraft(addressDraft);
    if (addressError) {
      showToast(addressError, 'warning');
      return;
    }
    if (mode === 'direct' && !selectedService) {
      showToast('Elegí un servicio de precio fijo.', 'warning');
      return;
    }
    const requestTitle = mode === 'direct' ? selectedService!.name : title.trim();
    if (!requestTitle || !description.trim()) {
      showToast('Completá qué necesitás y una breve descripción.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // Guardado de dirección best-effort: si falla, no debe impedir llegar
      // al pago — el pedido igual se crea con los datos tipeados (ver
      // docs/adr-address-redesign.md, Fase 3, criterio de tolerancia a fallos).
      let addressId: string | undefined = selectedAddressId !== 'new' ? selectedAddressId : undefined;
      if (selectedAddressId === 'new' && saveAddressChecked) {
        try {
          const saved = await createSavedAddress(
            {
              addressLine: `${addressDraft.street.trim()} ${addressDraft.streetNumber.trim()}`.trim(),
              neighborhood: addressDraft.neighborhood.trim(),
              city: addressDraft.city.trim(),
            },
            savedAddresses.length === 0
          );
          addressId = saved?.id;
        } catch {
          // best-effort — seguimos sin addressId
        }
      }

      showToast('Te llevamos a pagar de forma segura...', 'info', 'Un paso más');
      await redirectToCustomerServiceRequest({
        title: requestTitle,
        description: description.trim(),
        serviceType,
        priority,
        scheduledDate,
        appointmentWindow,
        address: `${addressDraft.street.trim()} ${addressDraft.streetNumber.trim()}`.trim(),
        neighborhood: addressDraft.neighborhood.trim(),
        city: addressDraft.city.trim(),
        province: addressDraft.province,
        workMode: mode,
        requestedTotal: mode === 'direct' ? directTotal : undefined,
        fixedPriceServiceId: mode === 'direct' ? selectedService!.id : undefined,
        quantity: mode === 'direct' ? quantity : undefined,
        addressId,
      });
      // redirectToCustomerServiceRequest navega afuera si sale bien — nada más que hacer acá.
      setSent(true);
      setSaveAddressChecked(false);
      setTitle(''); setDescription(''); setSelectedService(null); setQuantity(1);
    } catch (error) {
      // Acá el pedido todavía NO existe en ningún lado — a diferencia del
      // flujo viejo, no queda un pedido a medias esperando pago: el cliente
      // puede reintentar directamente.
      showToast(error instanceof Error ? error.message : 'No se pudo iniciar el pago seguro.', 'error', 'No se pudo enviar la solicitud');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="solicitar-servicio" className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs space-y-4" aria-labelledby="service-request-title">
      <div className="flex gap-2.5">
        <span className="w-9 h-9 shrink-0 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-700 flex items-center justify-center"><ClipboardPlus className="w-4.5 h-4.5" /></span>
        <div>
          <h2 id="service-request-title" className="text-sm font-bold text-slate-900 dark:text-slate-100">Solicitar un servicio</h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">El domicilio y el horario se usan únicamente para este pedido.</p>
          {fromAssistant && (
            <p className="mt-2 text-[11px] text-teal-800 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-lg px-3 py-2">
              El asistente precargó este pedido. Revisá la descripción antes de confirmar.
            </p>
          )}
        </div>
      </div>

      {pendingDraft && pendingDraft.status === 'pending' && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 flex flex-col sm:flex-row sm:items-center gap-2.5 justify-between">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-950">Tenés un pago pendiente</p>
              <p className="text-[11px] text-amber-800">
                "{pendingDraft.title}" — {formatArs(pendingDraft.amount)}. Retomá el pago sin tener que cargar todo de nuevo.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void resumePayment()}
            disabled={resumingPayment}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <CreditCard className="w-3.5 h-3.5" />
            {resumingPayment ? 'Abriendo pago…' : 'Continuar pago'}
          </button>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => chooseMode('diagnosis')} className={`text-left rounded-xl border p-3 transition ${mode === 'diagnosis' ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100"><Search className="w-3.5 h-3.5 text-teal-700" />No sé exactamente qué necesito</span>
          <span className="block mt-1 text-[11px] text-slate-600 dark:text-slate-400">Visita de presupuesto: {formatArs(visitDepositAmount)}. Este monto corresponde a la visita y se cobra de forma independiente del valor del trabajo.</span>
        </button>
        <button type="button" onClick={() => chooseMode('direct')} className={`text-left rounded-xl border p-3 transition ${mode === 'direct' ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-slate-100"><Wrench className="w-3.5 h-3.5 text-teal-700" />Sé qué trabajo necesito</span>
          <span className="block mt-1 text-[11px] text-slate-600 dark:text-slate-400">Solo para tareas de precio fijo. El pago se habilitará antes de asignar un técnico.</span>
        </button>
      </div>

      {sent && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="inline w-4 h-4 mr-1" />Tu solicitud quedó registrada y pendiente de revisión/pago. No compartas datos de tarjeta por chat.</div>}

      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Rubro<select value={serviceType} onChange={(event) => { setServiceType(event.target.value); setSelectedService(null); }} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"><option value="">Elegí un rubro</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)} className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
        </div>

        {mode === 'direct' ? (
          <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 p-3">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Servicio de precio fijo</p>
            {directServiceGroups.length === 0 ? (
              <p className="text-xs text-amber-700">Este rubro aún no tiene servicios de precio fijo. Elegí diagnóstico para recibir un presupuesto.</p>
            ) : (
              <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {directServiceGroups.map((group) => (
                  <div key={group.id ?? 'sin-subcategoria'}>
                    <SubcategorySectionHeader name={group.name} count={group.items.length} ungrouped={!group.id} compact sticky />
                    <div className="grid gap-2">
                      {group.items.map((service) => (
                        <button
                          type="button"
                          key={service.id}
                          onClick={() => {
                            setSelectedService(service);
                            setTitle(service.name);
                            setDescription(service.description);
                          }}
                          className={`rounded-lg border p-2.5 text-left ${selectedService?.id === service.id ? 'border-teal-500 bg-white dark:bg-slate-900' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-teal-300'}`}
                        >
                          <span className="block text-xs font-bold text-slate-900 dark:text-slate-100">{service.name}</span>
                          <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{formatArs(service.price)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedService && <div className="flex items-end gap-2"><label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Cantidad<input type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1 block w-24 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" /></label><p className="pb-2 text-sm font-black text-teal-800">Estimado: {formatArs(directTotal)}</p></div>}
          </div>
        ) : <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Título del problema<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej.: Se corta la luz en la cocina" className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" /></label>}

        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Contanos qué sucede, desde cuándo y cualquier detalle útil para el técnico." className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" /></label>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200"><MapPin className="inline w-3.5 h-3.5 mr-1 text-teal-700" />Datos de esta visita</p>
          {savedAddresses.length > 0 && (
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Dirección
              <select
                value={selectedAddressId === '' ? 'new' : selectedAddressId}
                onChange={(event) => selectSavedAddress(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                {savedAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label ? `${a.label} — ` : ''}{a.addressLine}, {a.city}{a.isDefault ? ' (predeterminada)' : ''}
                  </option>
                ))}
                <option value="new">+ Agregar nueva dirección</option>
              </select>
            </label>
          )}
          <AddressFields value={addressDraft} onChange={setAddressDraft} />
          {selectedAddressId === 'new' && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={saveAddressChecked} onChange={(event) => setSaveAddressChecked(event.target.checked)} className="rounded border-slate-300" />
              Guardar esta dirección para próximos pedidos
            </label>
          )}
          <div className="grid sm:grid-cols-2 gap-2"><label className="text-xs text-slate-600 dark:text-slate-400"><CalendarDays className="inline w-3.5 h-3.5 mr-1" />Fecha<input type="date" min={DATE_TODAY} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" /></label><label className="text-xs text-slate-600 dark:text-slate-400">Franja para este pedido<select value={appointmentWindow} onChange={(event) => setAppointmentWindow(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"><option>A coordinar</option><option>Mañana (08–12 h)</option><option>Mediodía (12–15 h)</option><option>Tarde (15–19 h)</option></select></label></div>
        </div>

        <button type="submit" disabled={submitting} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"><CreditCard className="w-4 h-4" />{submitting ? 'Enviando solicitud…' : mode === 'diagnosis' ? 'Solicitar diagnóstico' : 'Solicitar trabajo de precio fijo'}</button>
      </form>
    </section>
  );
};
