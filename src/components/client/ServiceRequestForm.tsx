import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ClipboardPlus, CreditCard, MapPin, Search, Wrench } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FIXED_PRICE_SERVICES, formatArs, type FixedPriceService } from '../../lib/pricing';
import type { OrderPriority, ServiceType, WorkMode } from '../../types';

const DATE_TODAY = new Date().toISOString().slice(0, 10);

/** A request starts a service workflow; it does not process a payment in the browser. */
export const ServiceRequestForm: React.FC = () => {
  const { currentUser, customers, services, createCustomerRequest, showToast } = useApp();
  const customer = customers.find((item) => item.id === currentUser?.customerId);
  const [mode, setMode] = useState<WorkMode>('diagnosis');
  const [serviceType, setServiceType] = useState<ServiceType>('Electricidad');
  const [selectedService, setSelectedService] = useState<FixedPriceService | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [scheduledDate, setScheduledDate] = useState(DATE_TODAY);
  const [appointmentWindow, setAppointmentWindow] = useState('A coordinar');
  const [priority, setPriority] = useState<OrderPriority>('media');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const categories = useMemo(() => {
    const values = new Set<string>(['Electricidad']);
    services.filter((service) => service.active !== false).forEach((service) => values.add(service.category));
    FIXED_PRICE_SERVICES.forEach((service) => values.add(service.category));
    return [...values].sort((a, b) => a.localeCompare(b, 'es'));
  }, [services]);

  const visibleFixedServices = useMemo(
    () => FIXED_PRICE_SERVICES.filter((service) => service.category === serviceType),
    [serviceType]
  );
  const directTotal = selectedService ? selectedService.unitPrice * quantity : 0;

  useEffect(() => {
    const pendingServiceId = localStorage.getItem('tecniurbano_selectedServiceId');
    if (!pendingServiceId) return;
    const catalogItem = services.find((service) => service.id === pendingServiceId);
    localStorage.removeItem('tecniurbano_selectedServiceId');
    if (!catalogItem) return;
    setServiceType(catalogItem.category);
    setTitle(catalogItem.name);
    setDescription(catalogItem.description);
  }, [services]);

  useEffect(() => {
    if (!address && customer?.address && customer.address !== 'A completar') setAddress(customer.address);
    if (!neighborhood && customer?.neighborhood) setNeighborhood(customer.neighborhood);
  }, [address, customer?.address, customer?.neighborhood, neighborhood]);

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
    if (!address.trim()) {
      showToast('Indicá el domicilio de atención para esta solicitud.', 'warning');
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
      await createCustomerRequest({
        title: requestTitle,
        description: description.trim(),
        serviceType,
        priority,
        scheduledDate,
        appointmentWindow,
        address: address.trim(),
        neighborhood: neighborhood.trim(),
        workMode: mode,
        requestedTotal: mode === 'direct' ? directTotal : undefined,
      });
      setSent(true);
      setTitle(''); setDescription(''); setSelectedService(null); setQuantity(1);
      showToast('Solicitud enviada. Aún no se realizó ningún cobro.', 'success', 'Pedido recibido');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.', 'error', 'Solicitud no enviada');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-4" aria-labelledby="service-request-title">
      <div className="flex gap-2.5">
        <span className="w-9 h-9 shrink-0 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center"><ClipboardPlus className="w-4.5 h-4.5" /></span>
        <div>
          <h2 id="service-request-title" className="text-sm font-bold text-slate-900">Solicitar un servicio</h2>
          <p className="text-[11px] text-slate-500">El domicilio y el horario se usan únicamente para este pedido.</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        <button type="button" onClick={() => chooseMode('diagnosis')} className={`text-left rounded-xl border p-3 transition ${mode === 'diagnosis' ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20' : 'border-slate-200 hover:bg-slate-50'}`}>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900"><Search className="w-3.5 h-3.5 text-teal-700" />No sé exactamente qué necesito</span>
          <span className="block mt-1 text-[11px] text-slate-600">Visita de diagnóstico. La seña vigente es {formatArs(30000)} y se descuenta si aceptás el presupuesto.</span>
        </button>
        <button type="button" onClick={() => chooseMode('direct')} className={`text-left rounded-xl border p-3 transition ${mode === 'direct' ? 'border-teal-500 bg-teal-50/60 ring-1 ring-teal-500/20' : 'border-slate-200 hover:bg-slate-50'}`}>
          <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-900"><Wrench className="w-3.5 h-3.5 text-teal-700" />Sé qué trabajo necesito</span>
          <span className="block mt-1 text-[11px] text-slate-600">Solo para tareas de precio fijo. El pago se habilitará antes de asignar un técnico.</span>
        </button>
      </div>

      {sent && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800"><CheckCircle2 className="inline w-4 h-4 mr-1" />Tu solicitud quedó registrada y pendiente de revisión/pago. No compartas datos de tarjeta por chat.</div>}

      <form onSubmit={(event) => void submit(event)} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs font-semibold text-slate-700">Rubro<select value={serviceType} onChange={(event) => { setServiceType(event.target.value); setSelectedService(null); }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Elegí un rubro</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="text-xs font-semibold text-slate-700">Prioridad<select value={priority} onChange={(event) => setPriority(event.target.value as OrderPriority)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select></label>
        </div>

        {mode === 'direct' ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-xs font-bold text-slate-800">Servicio de precio fijo</p>
            {visibleFixedServices.length === 0 ? <p className="text-xs text-amber-700">Este rubro aún no tiene servicios de precio fijo. Elegí diagnóstico para recibir un presupuesto.</p> : <div className="grid gap-2">{visibleFixedServices.map((service) => <button type="button" key={service.id} onClick={() => { setSelectedService(service); setTitle(service.name); setDescription(service.description); }} className={`rounded-lg border p-2.5 text-left ${selectedService?.id === service.id ? 'border-teal-500 bg-white' : 'border-slate-200 bg-white hover:border-teal-300'}`}><span className="block text-xs font-bold text-slate-900">{service.name}</span><span className="block text-[11px] text-slate-500 mt-0.5">{formatArs(service.unitPrice)} por {service.unit}</span></button>)}</div>}
            {selectedService && <div className="flex items-end gap-2"><label className="text-xs font-semibold text-slate-700">Cantidad<input type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))} className="mt-1 block w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><p className="pb-2 text-sm font-black text-teal-800">Estimado: {formatArs(directTotal)}</p></div>}
          </div>
        ) : <label className="block text-xs font-semibold text-slate-700">Título del problema<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej.: Se corta la luz en la cocina" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>}

        <label className="block text-xs font-semibold text-slate-700">Descripción<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Contanos qué sucede, desde cuándo y cualquier detalle útil para el técnico." className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label>

        <div className="rounded-xl border border-slate-200 p-3 space-y-2"><p className="text-xs font-bold text-slate-800"><MapPin className="inline w-3.5 h-3.5 mr-1 text-teal-700" />Datos de esta visita</p><div className="grid sm:grid-cols-2 gap-2"><input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Domicilio de atención" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /><input value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} placeholder="Barrio / localidad" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" /></div><div className="grid sm:grid-cols-2 gap-2"><label className="text-xs text-slate-600"><CalendarDays className="inline w-3.5 h-3.5 mr-1" />Fecha<input type="date" min={DATE_TODAY} value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" /></label><label className="text-xs text-slate-600">Franja para este pedido<select value={appointmentWindow} onChange={(event) => setAppointmentWindow(event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><option>A coordinar</option><option>Mañana (08–12 h)</option><option>Mediodía (12–15 h)</option><option>Tarde (15–19 h)</option></select></label></div></div>

        <button type="submit" disabled={submitting} className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50"><CreditCard className="w-4 h-4" />{submitting ? 'Enviando solicitud…' : mode === 'diagnosis' ? 'Solicitar diagnóstico' : 'Solicitar trabajo de precio fijo'}</button>
      </form>
    </section>
  );
};
