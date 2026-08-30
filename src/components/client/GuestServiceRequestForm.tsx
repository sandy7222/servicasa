import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CreditCard, Mail, MapPin, Phone, Search, User, Wrench } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatArs } from '../../lib/pricing';
import { groupItemsBySubcategory } from '../../lib/catalogOrder';
import { SubcategorySectionHeader } from '../common/SubcategorySectionHeader';
import { redirectToGuestPayment } from '../../lib/paymentClient';
import { validateAddressDraft } from '../../lib/address';
import { AddressFields, type AddressFieldsValue } from '../common/AddressFields';
import { ASSISTANT_DRAFT_EVENT, readAssistantDraft, clearAssistantDraft } from '../../lib/diagnosisDraft';
import type { AssistantDraft } from '../../lib/diagnosisAssistant';
import type { OrderPriority, ServiceItem, ServiceType, WorkMode } from '../../types';

const DATE_TODAY = new Date().toISOString().slice(0, 10);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same two-mode request as ServiceRequestForm, but for a visitor with no
 * account: asks for contact data up front, and posts straight to the public
 * guest-checkout endpoint instead of going through AppContext/RLS. */
export const GuestServiceRequestForm: React.FC = () => {
  const { services, catalogSubcategories, visitDepositAmount, showToast } = useApp();
  const [mode, setMode] = useState<WorkMode>('diagnosis');
  const [serviceType, setServiceType] = useState<ServiceType>('Electricidad');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [addressDraft, setAddressDraft] = useState<AddressFieldsValue>({
    street: '',
    streetNumber: '',
    neighborhood: '',
    city: '',
    province: '',
  });
  const [scheduledDate, setScheduledDate] = useState(DATE_TODAY);
  const [appointmentWindow, setAppointmentWindow] = useState('A coordinar');
  const [priority, setPriority] = useState<OrderPriority>('media');
  const [submitting, setSubmitting] = useState(false);
  const [fromAssistant, setFromAssistant] = useState(false);

  const categories = useMemo(() => {
    const values = new Set<string>(['Electricidad']);
    services.filter((service) => service.active !== false).forEach((service) => values.add(service.category));
    return [...values].sort((a, b) => a.localeCompare(b, 'es'));
  }, [services]);

  // Catálogo de precio fijo real, filtrado al rubro elegido y agrupado por
  // subcategoría — ver la misma nota en ServiceRequestForm.tsx.
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

    if (stored) {
      return () => window.removeEventListener(ASSISTANT_DRAFT_EVENT, onDraft);
    }

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
    return () => window.removeEventListener(ASSISTANT_DRAFT_EVENT, onDraft);
  }, [services]);

  const chooseMode = (nextMode: WorkMode) => {
    setMode(nextMode);
    if (nextMode === 'diagnosis') setSelectedService(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!fullName.trim() || !EMAIL_RE.test(email.trim()) || !phone.trim()) {
      showToast('Completá nombre, un email válido y teléfono.', 'warning');
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
      await redirectToGuestPayment({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
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
      });
      // redirectToGuestPayment navigates away on success — nothing else to do here.
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.', 'error', 'Solicitud no enviada');
      setSubmitting(false);
    }
  };

  return (
    <section id="solicitar-servicio" className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-4" aria-labelledby="guest-request-title">
      <div>
        <h2 id="guest-request-title" className="text-sm font-bold text-slate-900">Pedir un servicio como invitado</h2>
        <p className="text-[11px] text-slate-500">
          No hace falta crear cuenta ahora. Después de pagar te damos un link para armar tu contraseña y hacer seguimiento.
        </p>
        {fromAssistant && (
          <p className="mt-2 text-[11px] text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
            El asistente precargó este pedido. Revisá la descripción y confirmá cuando esté bien.
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => chooseMode('diagnosis')} className={`text-left rounded-xl border p-3 transition ${mode === 'diagnosis' ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20' : 'border-slate-200 hover:bg-slate-50'}`}>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900"><Search className="w-3.5 h-3.5 text-teal-700" />No sé exactamente qué necesito</span>
          <span className="block mt-1 text-[11px] text-slate-600">Visita de presupuesto: {formatArs(visitDepositAmount)}. Este monto corresponde a la visita y se cobra de forma independiente del valor del trabajo.</span>
        </button>
        <button type="button" onClick={() => chooseMode('direct')} className={`text-left rounded-xl border p-3 transition ${mode === 'direct' ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20' : 'border-slate-200 hover:bg-slate-50'}`}>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900"><Wrench className="w-3.5 h-3.5 text-teal-700" />Sé qué trabajo necesito</span>
          <span className="block mt-1 text-[11px] text-slate-600">Solo para tareas de precio fijo. El pago se habilitará antes de asignar un técnico.</span>
        </button>
      </div>

      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <div className="rounded-xl border border-slate-200 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-800"><User className="inline w-3.5 h-3.5 mr-1 text-teal-700" />Tus datos de contacto</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="relative">
              <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nombre completo" className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm" />
            </div>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm" />
            </div>
          </div>
          <div className="relative">
            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono" className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm" />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-700">Rubro<select value={serviceType} onChange={(event) => { setServiceType(event.target.value); setSelectedService(null); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
        </div>

        {mode === 'direct' ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-bold text-slate-800">Servicio de precio fijo</p>
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
                          className={`rounded-lg border p-2.5 text-left ${selectedService?.id === service.id ? 'border-teal-500 bg-white' : 'border-slate-200 bg-white hover:border-teal-300'}`}
                        >
                          <span className="block text-xs font-bold text-slate-900">{service.name}</span>
                          <span className="block text-[11px] text-slate-500 mt-0.5">{formatArs(service.price)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedService && <div className="flex items-end gap-2"><label className="text-xs font-semibold text-slate-700">Cantidad<input type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><p className="pb-2 text-sm font-black text-teal-800">Estimado: {formatArs(directTotal)}</p></div>}
          </div>
        ) : <label className="block text-xs font-semibold text-slate-700">Título del problema<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej.: Se corta la luz en la cocina" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>}

        <label className="block text-xs font-semibold text-slate-700">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Contanos qué sucede, desde cuándo y cualquier detalle útil para el técnico." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>

        <div className="rounded-xl border border-slate-200 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-800"><MapPin className="inline w-3.5 h-3.5 mr-1 text-teal-700" />Datos de esta visita</p>
          <AddressFields value={addressDraft} onChange={setAddressDraft} />
          <div className="grid sm:grid-cols-2 gap-2"><label className="text-xs text-slate-600"><CalendarDays className="inline w-3.5 h-3.5 mr-1" />Fecha<input type="date" min={DATE_TODAY} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-xs text-slate-600">Franja para este pedido<select value={appointmentWindow} onChange={(event) => setAppointmentWindow(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option>A coordinar</option><option>Mañana (08–12 h)</option><option>Mediodía (12–15 h)</option><option>Tarde (15–19 h)</option></select></label></div>
        </div>

        <button type="submit" disabled={submitting} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"><CreditCard className="w-4 h-4" />{submitting ? 'Enviando solicitud…' : mode === 'diagnosis' ? 'Pedir diagnóstico y pagar seña' : 'Pedir trabajo y pagar'}</button>
      </form>
    </section>
  );
};
