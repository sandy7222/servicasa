import React, { useEffect, useState } from 'react';
import {
  UserCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  FileSignature,
  Package,
  Wrench,
  FileText,
  Lock,
  Sparkles,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { PriorityBadge, ServiceBadge, StatusBadge } from '../components/common/Badge';
import { SignaturePad } from '../components/common/SignaturePad';
import { ServiceOrder } from '../types';
import { formatElapsedTime, getOrderElapsedSeconds } from '../lib/workTimer';
import { CustomerProfilePanel } from '../components/client/CustomerProfilePanel';
import { ServiceRequestForm } from '../components/client/ServiceRequestForm';

export const CustomerView: React.FC = () => {
  const { orders, currentUser, saveCustomerSignature, showToast, currentPath, navigate } = useApp();

  const customerId = currentUser?.customerId || '';
  const customerOrders = orders.filter((o) => o.clientId === customerId);

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    return customerOrders[0]?.id || '';
  });
  const [clockNow, setClockNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const orderIdFromPath = currentPath.match(/^\/customer\/orders\/([^/?]+)/)?.[1];
  const isDetailPage = Boolean(orderIdFromPath);
  const activeOrder = isDetailPage
    ? customerOrders.find((order) => order.id === orderIdFromPath)
    : customerOrders.find((order) => order.id === selectedOrderId) || customerOrders[0];

  const completedChecklistCount = activeOrder?.checklist.filter((item) => item.completed).length ?? 0;
  const checklistTotal = activeOrder?.checklist.length ?? 0;
  const checklistProgress = checklistTotal > 0 ? Math.round((completedChecklistCount / checklistTotal) * 100) : 0;
  const nextChecklistItem = activeOrder?.checklist.find((item) => !item.completed);

  const handleSaveSignature = (sigData: {
    signerName: string;
    signatureDataUrl: string;
    comments?: string;
  }) => {
    if (!activeOrder) return;
    const ok = saveCustomerSignature(activeOrder.id, sigData);
    if (ok) {
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.7 },
        });
      } catch {}
      showToast('¡Firma registrada con éxito! Tu conformidad ha sido otorgada.', 'success');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-12" id="customer-view-container">
      {/* Top Banner - High Density Dark */}
      <div className="bg-[#0F172A] border-b border-slate-800 text-white shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm shadow-xs">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Portal del Cliente — ServiCasa
                  </h1>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.2 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                    {currentUser?.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Seguimiento transparente de tus servicios en domicilio, reporte de insumos y firma de conformidad.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 pt-4">
        {!isDetailPage && <><CustomerProfilePanel /><div className="h-4" /><ServiceRequestForm /><div className="h-4" /></>}
        {isDetailPage && (
          <button type="button" onClick={() => navigate('/customer')} className="mb-4 inline-flex items-center gap-1.5 text-xs font-bold text-teal-700 hover:text-teal-800">
            <ArrowLeft className="w-4 h-4" /> Volver a mis servicios
          </button>
        )}
        {customerOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center max-w-md mx-auto mt-4 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-2.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Sin servicios registrados</h3>
            <p className="text-xs text-slate-500 mt-1">
              Actualmente no tenés órdenes asociadas a esta cuenta demo.
            </p>
          </div>
        ) : isDetailPage && !activeOrder ? (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center max-w-md mx-auto shadow-xs">
            <AlertCircle className="w-6 h-6 text-amber-500 mx-auto mb-2" />
            <h2 className="text-sm font-bold text-slate-900">No encontramos ese servicio</h2>
            <p className="text-xs text-slate-500 mt-1">Puede que no pertenezca a tu cuenta o que ya no esté disponible.</p>
          </div>
        ) : (
          <div className={`grid grid-cols-1 gap-4 ${isDetailPage ? '' : 'lg:grid-cols-12'}`}>
            {/* Left Column: My Orders List (4 cols) */}
            {!isDetailPage && <div className="lg:col-span-4 space-y-2">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono px-1">
                Mis Servicios a Domicilio ({customerOrders.length})
              </h2>

              <div className="space-y-2">
                {customerOrders.map((ord) => {
                  return (
                    <button
                      type="button"
                      key={ord.id}
                      onClick={() => navigate(`/customer/orders/${encodeURIComponent(ord.id)}`)}
                      className="w-full p-3 rounded-xl border cursor-pointer transition-all text-left bg-white border-slate-200 hover:bg-slate-50 hover:border-teal-400 hover:shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {ord.id}
                        </span>
                        <StatusBadge status={ord.status} size="sm" />
                      </div>

                      <h3 className="font-bold text-xs text-slate-900 line-clamp-1">{ord.title}</h3>

                      <div className="space-y-1 mt-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">{ord.scheduledDate}</span>
                        </div>

                        <div className="flex items-center justify-between pt-0.5 text-[10px]">
                          <span className="text-slate-500">
                            Técnico: <strong className="text-slate-700">{ord.assignedTechnicianName || 'Asignando...'}</strong>
                          </span>
                          {ord.customerSignature && (
                            <span className="text-teal-700 font-mono font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200 text-[9px]">
                              ✓ Firmado
                            </span>
                          )}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-teal-700">Ver detalle y seguimiento <ChevronRight className="w-3.5 h-3.5" /></div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>}

            {/* Right Column: Service Summary & Signature Area (8 cols) */}
            {isDetailPage && activeOrder && (
              <div className="lg:col-span-12 max-w-4xl mx-auto w-full space-y-3">
                {/* Header card */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {activeOrder.id}
                        </span>
                        <StatusBadge status={activeOrder.status} size="sm" />
                        <PriorityBadge priority={activeOrder.priority} />
                        <ServiceBadge service={activeOrder.serviceType} size="sm" />
                      </div>
                      <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">{activeOrder.title}</h2>
                      <p className="text-xs text-slate-600 mt-0.5">{activeOrder.description}</p>
                    </div>

                    {activeOrder.status === 'completed' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-teal-300 border border-slate-800 rounded-lg text-xs font-bold font-mono shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                        Aprobado
                      </span>
                    )}
                  </div>

                  {/* Technician & Appointment Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Técnico a cargo:</span>
                      <strong className="text-slate-800 text-xs">
                        {activeOrder.assignedTechnicianName || 'Pendiente de asignación'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Dirección de atención:</span>
                      <span className="text-slate-700 text-xs truncate block">{activeOrder.clientAddress}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Fecha y hora acordada:</span>
                      <span className="text-slate-700 font-mono text-xs">{activeOrder.scheduledDate}</span>
                    </div>
                  </div>
                </div>

                {/* Read-only work progress: lets the customer follow the agreed service transparently. */}
                <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3" aria-label="Progreso del trabajo técnico">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 shrink-0 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">Progreso del trabajo</h3>
                        <p className="text-[11px] text-slate-500">Podés seguir las tareas acordadas a medida que el técnico las completa.</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-black text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded-lg shrink-0">
                      {completedChecklistCount}/{checklistTotal} completadas
                    </span>
                  </div>

                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden" aria-label={`${checklistProgress}% completado`}>
                    <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${checklistProgress}%` }} />
                  </div>

                  {nextChecklistItem ? (
                    <div className="text-[11px] text-sky-800 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                      <strong>Siguiente paso:</strong> {nextChecklistItem.label}
                    </div>
                  ) : checklistTotal > 0 ? (
                    <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-medium">
                      El técnico completó todas las tareas previstas. Falta tu conformidad para cerrar el servicio.
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      El checklist técnico se actualizará cuando el profesional inicie el trabajo.
                    </div>
                  )}

                  <div className="space-y-1.5">
                    {activeOrder.checklist.map((item) => (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${
                          item.completed ? 'bg-emerald-50/70 border-emerald-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle2 className={`w-4 h-4 shrink-0 ${item.completed ? 'text-emerald-600' : 'text-slate-300'}`} />
                          <span className={item.completed ? 'font-medium text-slate-800' : 'text-slate-600'}>{item.label}</span>
                        </div>
                        <span className={`shrink-0 text-[10px] font-bold ${item.completed ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {item.completed ? 'Completada' : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" />
                    Este seguimiento es informativo; la ejecución y actualización corresponden al técnico.
                  </p>
                </section>

                {/* Breakdown: Time, Materials & Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Time Logs */}
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-600" />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
                          Tiempo Registrado
                        </h3>
                      </div>
                      <span className="font-mono text-xs font-bold text-teal-700">
                        {formatElapsedTime(getOrderElapsedSeconds(activeOrder, clockNow))}
                      </span>
                    </div>

                    <p className="text-[10px] text-teal-700 font-medium">
                      {activeOrder.status === 'in_progress' ? 'El técnico se encuentra trabajando en este momento.' : 'Tiempo acumulado del servicio.'}
                    </p>

                    {activeOrder.timeLogs.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">
                        {getOrderElapsedSeconds(activeOrder, clockNow) > 0
                          ? 'El cronómetro del servicio se actualiza automáticamente.'
                          : 'El técnico aún no inició el cronómetro del servicio.'}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeOrder.timeLogs.map((tl) => (
                          <div
                            key={tl.id}
                            className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-700 text-[11px]">{tl.note}</span>
                            <span className="font-mono font-bold text-teal-800 bg-teal-50 px-1.5 py-0.2 rounded text-[11px] border border-teal-200">
                              {tl.minutes} min
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Materials Used */}
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-slate-700" />
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
                          Materiales Usados
                        </h3>
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-700">
                        {activeOrder.usedMaterials.length} ítems
                      </span>
                    </div>

                    {activeOrder.usedMaterials.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">
                        No se han utilizado repuestos adicionales en este trabajo.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {activeOrder.usedMaterials.map((um) => (
                          <div
                            key={um.id}
                            className="p-2 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-semibold text-slate-800 text-[11px]">{um.materialName}</span>
                              {um.note && (
                                <div className="text-[10px] text-slate-500">{um.note}</div>
                              )}
                            </div>
                            <span className="font-mono font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded shrink-0 text-[11px] border border-slate-200">
                              {um.quantity} {um.unit}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Technician Notes */}
                {activeOrder.technicalNotes.length > 0 && (
                  <div className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs space-y-2">
                    <div className="flex items-center gap-1.5 pb-1.5 border-b border-slate-100">
                      <FileText className="w-3.5 h-3.5 text-teal-600" />
                      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-700 font-mono">
                        Notas y Recomendaciones del Técnico
                      </h3>
                    </div>

                    <div className="space-y-1.5">
                      {activeOrder.technicalNotes.map((note) => (
                        <div
                          key={note.id}
                          className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                            <span className="font-bold text-slate-700">{note.author}</span>
                            <span className="font-mono">{note.timestamp} hs</span>
                          </div>
                          <p className="text-slate-800 leading-relaxed text-[11px]">{note.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Digital Signature & Conformity Section */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <FileSignature className="w-4 h-4 text-teal-600" />
                      <div>
                        <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                          Firma Digital de Conformidad
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Tu firma avala la recepción y correcta finalización del trabajo a domicilio.
                        </p>
                      </div>
                    </div>
                  </div>

                  {activeOrder.customerSignature ? (
                    <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>¡Conformidad Otorgada con Éxito!</span>
                      </div>

                      <div className="bg-white p-2.5 rounded-lg border border-emerald-200 inline-block shadow-2xs">
                        <img
                          src={activeOrder.customerSignature.signatureDataUrl}
                          alt="Firma del cliente"
                          className="h-14 max-w-xs object-contain"
                        />
                      </div>

                      <div className="text-xs text-slate-700 space-y-0.5">
                        <div>
                          Firmado por: <strong>{activeOrder.customerSignature.signerName}</strong>
                        </div>
                        <div className="text-slate-500 font-mono text-[10px]">
                          Fecha y hora certificada: {activeOrder.customerSignature.signedAt}
                        </div>
                        {activeOrder.customerSignature.comments && (
                          <div className="italic text-slate-600 text-[11px]">
                            Comentario: "{activeOrder.customerSignature.comments}"
                          </div>
                        )}
                      </div>
                    </div>
                  ) : activeOrder.status === 'completed' ? (
                    <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                      Este servicio se encuentra cerrado.
                    </div>
                  ) : (
                    <div>
                      <div className="p-2.5 bg-teal-50/60 border border-teal-200 rounded-lg text-xs text-teal-900 mb-3 flex items-center gap-2">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-teal-600" />
                        <span>
                          Al firmar a continuación, confirmás que el servicio fue realizado a tu entera
                          satisfacción.
                        </span>
                      </div>
                      <SignaturePad
                        initialSignerName={activeOrder.clientName}
                        onSave={handleSaveSignature}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
