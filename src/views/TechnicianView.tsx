import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Play,
  Pause,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  Calendar,
  AlertCircle,
  FileSignature,
  Plus,
  Package,
  FileText,
  Lock,
  Sparkles,
  Timer,
  ChevronRight,
  ListTodo,
  Check,
  AlertTriangle,
  RotateCcw,
  X,
  Navigation,
  UserRound,
  Landmark,
  BarChart3,
  History,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { PriorityBadge, ServiceBadge, StatusBadge } from '../components/common/Badge';
import { ServiceOrder } from '../types';
import { canExecutePaidWork, formatElapsedTime, getOrderElapsedSeconds } from '../lib/workTimer';
import { QuoteBuilder } from '../components/technician/QuoteBuilder';
import { ProfessionalProfile } from '../components/technician/ProfessionalProfile';
import { EarningsView } from '../components/technician/EarningsView';
import { AvailabilityView } from '../components/technician/AvailabilityView';
import { WorkHistoryView } from '../components/technician/WorkHistoryView';
import { TechnicianStatisticsView } from '../components/technician/TechnicianStatisticsView';

// Google Maps URLs are cross-platform and require no Maps API key.
// The browser/Maps app obtains the technician's location; TecniUrbano never stores it.
const directionsUrl = (order: ServiceOrder) => {
  const destination = [order.clientAddress, order.clientNeighborhood, 'Argentina']
    .filter(Boolean)
    .join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
};

export const TechnicianView: React.FC = () => {
  const {
    orders,
    currentUser,
    materials,
    updateOrderStatus,
    toggleChecklistItem,
    addChecklistItem,
    addTimeLog,
    addTechnicalNote,
    addUsedMaterial,
    showToast,
    navigate,
    currentPath,
  } = useApp();

  if (currentPath.split('?')[0] === '/technician/profile') {
    return <ProfessionalProfile />;
  }
  if (currentPath.split('?')[0] === '/technician/earnings') {
    return <EarningsView />;
  }
  if (currentPath.split('?')[0] === '/technician/availability') {
    return <AvailabilityView />;
  }
  if (currentPath.split('?')[0] === '/technician/history') {
    return <WorkHistoryView />;
  }
  if (currentPath.split('?')[0] === '/technician/statistics') {
    return <TechnicianStatisticsView />;
  }

  const techId = currentUser?.technicianId || '';
  const assignedOrders = orders.filter((o) => o.assignedTechnicianId === techId);

  // Selected active order for operational work
  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    return assignedOrders[0]?.id || '';
  });

  // Keep selected order in sync if list changes
  useEffect(() => {
    if (!selectedOrderId && assignedOrders.length > 0) {
      setSelectedOrderId(assignedOrders[0].id);
    }
  }, [assignedOrders, selectedOrderId]);

  const activeOrder = orders.find((o) => o.id === selectedOrderId) || assignedOrders[0];

  // Tab inside order details: 'checklist' | 'time' | 'materials' | 'notes' | 'quote' | 'signature'
  const [activeTab, setActiveTab] = useState<'checklist' | 'time' | 'materials' | 'notes' | 'quote' | 'signature'>('checklist');

  // Form states
  const [newChecklistText, setNewChecklistText] = useState('');
  const [timeMinutes, setTimeMinutes] = useState<number>(30);
  const [timeNote, setTimeNote] = useState('');
  const [techNoteText, setTechNoteText] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState(materials[0]?.id || '');
  const [materialQty, setMaterialQty] = useState<number>(1);
  const [materialNote, setMaterialNote] = useState('');

  // Pause Reason Modal
  const [isPauseModalOpen, setIsPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');

  // The clock is calculated from the persisted start timestamp, never from browser state.
  const [clockNow, setClockNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const getElapsedSeconds = (order: ServiceOrder) => getOrderElapsedSeconds(order, clockNow);
  const formatStopwatch = formatElapsedTime;

  // Orders that were already in progress before the persistent timer existed
  // receive their start timestamp at the first opening after this upgrade.
  useEffect(() => {
    if (activeOrder?.status === 'in_progress' && !activeOrder.workStartedAt && canExecutePaidWork(activeOrder)) {
      updateOrderStatus(activeOrder.id, 'in_progress');
    }
  }, [activeOrder?.id, activeOrder?.status, activeOrder?.workStartedAt]);

  const handleStartOrResumeService = (order: ServiceOrder) => {
    if (!canExecutePaidWork(order)) {
      showToast(
        order.workMode === 'diagnosis'
          ? 'El trabajo se iniciará automáticamente al confirmarse el pago del presupuesto aceptado.'
          : 'El trabajo se iniciará automáticamente al confirmarse el pago completo.',
        'info',
        'Esperando pago'
      );
      return;
    }
    updateOrderStatus(order.id, 'in_progress');
  };

  const handlePauseService = (order: ServiceOrder, reason: string) => {
    return updateOrderStatus(order.id, 'paused', reason);
  };

  // Conditions for closing verification
  const checkClosingConditions = (order: ServiceOrder) => {
    const hasTimeLog = order.timeLogs.length > 0 || getElapsedSeconds(order) > 0;
    const isChecklistComplete =
      order.checklist.length > 0 && order.checklist.every((i) => i.completed);
    const hasSignature = !!order.customerSignature?.signatureDataUrl;

    return {
      canClose: hasTimeLog && isChecklistComplete && hasSignature,
      hasTimeLog,
      isChecklistComplete,
      hasSignature,
    };
  };

  const handleFinishService = (order: ServiceOrder) => {
    const res = updateOrderStatus(order.id, 'completed');
    if (res.success) {
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {}
    }
  };

  const handleAddMaterialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !selectedMaterialId) return;

    const ok = addUsedMaterial(activeOrder.id, selectedMaterialId, materialQty, materialNote);
    if (ok) {
      setMaterialQty(1);
      setMaterialNote('');
    }
  };

  const handleAddChecklistSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !newChecklistText.trim()) return;
    addChecklistItem(activeOrder.id, newChecklistText.trim());
    setNewChecklistText('');
  };

  const handleAddTimeLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || timeMinutes <= 0) return;
    addTimeLog(activeOrder.id, timeMinutes, timeNote);
    setTimeNote('');
  };

  const handleAddNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder || !techNoteText.trim()) return;
    addTechnicalNote(activeOrder.id, techNoteText);
    setTechNoteText('');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 pb-12" id="technician-view-container">
      {/* Top Banner - High Density Dark */}
      <div className="bg-[#0F172A] border-b border-slate-800 text-white shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center font-bold text-sm shadow-xs">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-bold text-white tracking-tight">
                    Terminal de Campo — Técnico
                  </h1>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.2 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                    {currentUser?.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Control de servicios asignados, registro de mano de obra, insumos y firma de conformidad.
                </p>
              </div>
            </div>

            {/* Visible timer only: its state comes from the service order in Supabase. */}
            <div className="bg-slate-900/90 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2.5" aria-live="polite">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-teal-300">
                <Timer className={`w-3.5 h-3.5 ${activeOrder?.status === 'in_progress' && activeOrder.workStartedAt ? 'text-teal-400 animate-spin' : 'text-slate-400'}`} />
                <span className="text-xs tracking-wider">{activeOrder ? formatStopwatch(getElapsedSeconds(activeOrder)) : '00:00:00'}</span>
              </div>
              <span className={`text-[10px] font-bold ${activeOrder?.status === 'in_progress' ? 'text-teal-300' : 'text-slate-400'}`}>
                {activeOrder?.status === 'in_progress' ? 'EN CURSO' : 'PAUSADO'}
              </span>
            </div>
            <button onClick={() => navigate('/technician/profile')} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-teal-500/60 hover:text-teal-300">
              <UserRound className="w-3.5 h-3.5" /> Mi perfil
            </button>
            <button onClick={() => navigate('/technician/earnings')} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-teal-500/60 hover:text-teal-300">
              <Landmark className="w-3.5 h-3.5" /> Mis ganancias
            </button>
            <button onClick={() => navigate('/technician/availability')} className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-teal-500/60 hover:text-teal-300">
              <Calendar className="w-3.5 h-3.5" /> Disponibilidad
            </button>
            <button onClick={() => navigate('/technician/history')} className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-teal-500/60 hover:text-teal-300">
              <History className="w-3.5 h-3.5" /> Historial
            </button>
            <button onClick={() => navigate('/technician/statistics')} className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-200 hover:border-teal-500/60 hover:text-teal-300">
              <BarChart3 className="w-3.5 h-3.5" /> Estadísticas
            </button>
          </div>

          {/* Mobile-only quick access: the buttons above are hidden below sm, so without this
              strip there is no way to reach these sub-pages from a phone. */}
          <div className="flex sm:hidden items-center gap-1.5 overflow-x-auto pb-2 -mx-3 px-3 mt-2">
            {[
              { path: '/technician/profile', label: 'Mi perfil', icon: UserRound },
              { path: '/technician/earnings', label: 'Ganancias', icon: Landmark },
              { path: '/technician/availability', label: 'Disponibilidad', icon: Calendar },
              { path: '/technician/history', label: 'Historial', icon: History },
              { path: '/technician/statistics', label: 'Estadísticas', icon: BarChart3 },
            ].map(({ path, label, icon: Icon }) => (
              <button
                key={path}
                onClick={() => navigate(path)}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-slate-200 whitespace-nowrap"
              >
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 pt-4">
        {assignedOrders.length === 0 ? (
          <div className="bg-white rounded-xl p-8 border border-slate-200 text-center max-w-md mx-auto mt-4 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto mb-2.5">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">¡Al día! No tenés órdenes pendientes</h3>
            <p className="text-xs text-slate-500 mt-1">
              Podés cambiar de técnico o ingresar al Admin Hub para asignarte una nueva orden.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left Column: Assigned Orders List (4 cols) */}
            <div className="lg:col-span-4 space-y-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                  Órdenes Asignadas ({assignedOrders.length})
                </h2>
              </div>

              <div className="space-y-2">
                {assignedOrders.map((ord) => {
                  const isSelected = activeOrder?.id === ord.id;

                  return (
                    <div
                      key={ord.id}
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-white border-teal-500 shadow-xs ring-1 ring-teal-500/20'
                          : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-1">
                        <span className="font-mono text-[11px] font-bold text-slate-800 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                          {ord.id}
                        </span>
                        <StatusBadge status={ord.status} size="sm" />
                      </div>

                      <h3 className="font-bold text-xs text-slate-900 line-clamp-1">{ord.title}</h3>
                      {ord.quoteStatus === 'rejected' && (
                        <span className="mt-1 inline-block rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                          Presupuesto rechazado
                        </span>
                      )}

                      <div className="space-y-1 mt-1.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-800">
                          <MapPin className="w-3 h-3 text-teal-600 shrink-0" />
                          <span className="truncate">{ord.clientAddress}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <PriorityBadge priority={ord.priority} />
                          <span className="font-mono">{ord.scheduledDate}</span>
                        </div>
                        <a
                          href={directionsUrl(ord)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(event) => event.stopPropagation()}
                          className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-bold text-teal-700 hover:text-teal-800"
                        >
                          <Navigation className="w-3.5 h-3.5" /> Cómo llegar
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Active Order Workspace (8 cols) */}
            {activeOrder && (
              <div className="lg:col-span-8 space-y-3">
                {/* Order Header Card */}
                <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
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

                    {/* Quick State Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {activeOrder.status === 'assigned' && canExecutePaidWork(activeOrder) && (
                        <button
                          onClick={() => handleStartOrResumeService(activeOrder)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          <span>Iniciar Servicio</span>
                        </button>
                      )}

                      {activeOrder.status === 'assigned' && !canExecutePaidWork(activeOrder) && activeOrder.quoteStatus === 'rejected' && (
                        <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-900">
                          Presupuesto rechazado por el cliente
                        </span>
                      )}

                      {activeOrder.status === 'assigned' && !canExecutePaidWork(activeOrder) && activeOrder.quoteStatus !== 'rejected' && (
                        <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900">
                          {activeOrder.workMode === 'diagnosis' ? 'Esperando aceptación y pago' : 'Esperando pago confirmado'}
                        </span>
                      )}

                      {activeOrder.status === 'in_progress' && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setIsPauseModalOpen(true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold rounded-lg border border-amber-300 transition-colors"
                          >
                            <Pause className="w-3 h-3" />
                            <span>Pausar</span>
                          </button>

                          <button
                            onClick={() => handleFinishService(activeOrder)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Finalizar</span>
                          </button>
                        </div>
                      )}

                      {activeOrder.status === 'paused' && canExecutePaidWork(activeOrder) && (
                        <button
                          onClick={() => handleStartOrResumeService(activeOrder)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors"
                        >
                          <Play className="w-3 h-3" />
                          <span>Reanudar</span>
                        </button>
                      )}

                      {activeOrder.status === 'completed' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 text-teal-300 border border-slate-800 rounded-lg text-xs font-bold font-mono">
                          <Lock className="w-3 h-3" />
                          Cerrado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer Info Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Cliente:</span>
                      <strong className="text-slate-800 text-xs">{activeOrder.clientName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Dirección:</span>
                      <span className="text-slate-700 text-xs truncate block">
                        {activeOrder.clientAddress} ({activeOrder.clientNeighborhood})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-medium uppercase tracking-wider">Teléfono:</span>
                      <span className="text-slate-700 font-mono text-xs">{activeOrder.clientPhone}</span>
                    </div>
                  </div>

                  {activeOrder.adminIncidentStatus === 'open' && (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                      <div className="font-bold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Orden en revisión por administración</div>
                      <p className="mt-1">{activeOrder.adminIncidentReason || 'Hay una incidencia registrada. Consultá con administración antes de continuar.'}</p>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={directionsUrl(activeOrder)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100"
                    >
                      <Navigation className="w-4 h-4" /> Abrir navegación al domicilio
                    </a>
                    <span className="text-[10px] text-slate-400">Google Maps usa la ubicación del dispositivo; TecniUrbano no la registra.</span>
                  </div>

                  {/* Closing Requirements Progress Meter */}
                  {(() => {
                    const cond = checkClosingConditions(activeOrder);
                    const isClosed = activeOrder.status === 'completed';

                    return (
                      <div
                        className={`p-2.5 rounded-lg border ${
                          isClosed
                            ? 'bg-slate-900 text-teal-300 border-slate-800'
                            : cond.canClose
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : 'bg-amber-50 text-amber-900 border-amber-200'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                          <span className="flex items-center gap-1.5">
                            {isClosed ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                            ) : cond.canClose ? (
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            <span className="text-xs">
                              {isClosed
                                ? 'Servicio Finalizado y Certificado por el Cliente'
                                : cond.canClose
                                ? '¡Listo para finalizar! Condiciones completas'
                                : 'Condiciones requeridas para cerrar el servicio:'}
                            </span>
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[11px]">
                          <div
                            className={`flex items-center gap-1.5 p-1.5 rounded ${
                              cond.hasTimeLog
                                ? 'bg-white/80 text-emerald-900 font-medium'
                                : 'bg-white/50 text-slate-500'
                            }`}
                          >
                            <Check
                              className={`w-3 h-3 ${
                                cond.hasTimeLog ? 'text-emerald-600 font-bold' : 'text-slate-300'
                              }`}
                            />
                            <span>1. Tiempo ({formatStopwatch(getElapsedSeconds(activeOrder))})</span>
                          </div>

                          <div
                            className={`flex items-center gap-1.5 p-1.5 rounded ${
                              cond.isChecklistComplete
                                ? 'bg-white/80 text-emerald-900 font-medium'
                                : 'bg-white/50 text-slate-500'
                            }`}
                          >
                            <Check
                              className={`w-3 h-3 ${
                                cond.isChecklistComplete ? 'text-emerald-600 font-bold' : 'text-slate-300'
                              }`}
                            />
                            <span>
                              2. Checklist ({activeOrder.checklist.filter((c) => c.completed).length}/
                              {activeOrder.checklist.length})
                            </span>
                          </div>

                          <div
                            className={`flex items-center gap-1.5 p-1.5 rounded ${
                              cond.hasSignature
                                ? 'bg-white/80 text-emerald-900 font-medium'
                                : 'bg-white/50 text-slate-500'
                            }`}
                          >
                            <Check
                              className={`w-3 h-3 ${
                                cond.hasSignature ? 'text-emerald-600 font-bold' : 'text-slate-300'
                              }`}
                            />
                            <span>3. Firma {cond.hasSignature ? '✓' : 'pendiente'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Operational Tabs (Checklist, Time, Materials, Notes, Signature) */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  {/* Tabs header */}
                  <div className="flex border-b border-slate-200 overflow-x-auto bg-slate-50/70 p-1 gap-1">
                    <button
                      onClick={() => setActiveTab('checklist')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                        activeTab === 'checklist'
                          ? 'bg-[#0F172A] text-teal-300 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <ListTodo className="w-3.5 h-3.5" />
                      <span>Checklist ({activeOrder.checklist.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('time')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                        activeTab === 'time'
                          ? 'bg-[#0F172A] text-teal-300 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Tiempo ({formatStopwatch(getElapsedSeconds(activeOrder))})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('materials')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                        activeTab === 'materials'
                          ? 'bg-[#0F172A] text-teal-300 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Materiales ({activeOrder.usedMaterials.length})</span>
                    </button>

                    <button
                      onClick={() => setActiveTab('notes')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                        activeTab === 'notes'
                          ? 'bg-[#0F172A] text-teal-300 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Notas ({activeOrder.technicalNotes.length})</span>
                    </button>

                    {activeOrder.workMode === 'diagnosis' && (
                      <button
                        onClick={() => setActiveTab('quote')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                          activeTab === 'quote'
                            ? 'bg-[#0F172A] text-teal-300 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Presupuesto</span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveTab('signature')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all whitespace-nowrap ${
                        activeTab === 'signature'
                          ? 'bg-[#0F172A] text-teal-300 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      <FileSignature className="w-3.5 h-3.5" />
                      <span>Firma</span>
                    </button>
                  </div>

                  {/* Tab Body */}
                  <div className="p-3.5">
                    {/* 1. CHECKLIST */}
                    {activeTab === 'checklist' && (
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          {activeOrder.checklist.map((item) => (
                            <div
                              key={item.id}
                              onClick={() => {
                                if (activeOrder.status !== 'completed') {
                                  toggleChecklistItem(activeOrder.id, item.id);
                                }
                              }}
                              className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition-all ${
                                item.completed
                                  ? 'bg-emerald-50/70 border-emerald-200'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              } ${activeOrder.status === 'completed' ? 'cursor-default' : ''}`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    item.completed
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {item.completed && <Check className="w-3 h-3" />}
                                </div>
                                <span
                                  className={`text-xs ${
                                    item.completed
                                      ? 'text-slate-800 font-medium line-through'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  {item.label}
                                </span>
                              </div>

                              {item.completedAt && (
                                <span className="text-[10px] text-emerald-700 font-mono font-bold">
                                  {item.completedAt} hs
                                </span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Add custom item if not completed */}
                        {activeOrder.status !== 'completed' && (
                          <form onSubmit={handleAddChecklistSubmit} className="flex gap-1.5 pt-1">
                            <input
                              type="text"
                              value={newChecklistText}
                              onChange={(e) => setNewChecklistText(e.target.value)}
                              placeholder="Añadir nueva tarea técnica al checklist..."
                              className="flex-1 text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-teal-500"
                            />
                            <button
                              type="submit"
                              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </form>
                        )}
                      </div>
                    )}

                    {/* 2. TIME REGISTRATION */}
                    {activeTab === 'time' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
                          <div>
                            <h4 className="text-xs font-bold text-teal-950">Cronómetro del servicio</h4>
                            <p className="text-[10px] text-teal-800">Se guarda automáticamente al iniciar, pausar, reanudar o finalizar.</p>
                          </div>
                          <span className="font-mono font-bold text-teal-900 text-sm">{formatStopwatch(getElapsedSeconds(activeOrder))}</span>
                        </div>
                        {activeOrder.status !== 'completed' && (
                          <form
                            onSubmit={handleAddTimeLogSubmit}
                            className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2"
                          >
                            <h4 className="text-xs font-bold text-slate-800">
                              Registrar Tiempo de Mano de Obra
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                  Minutos trabajados
                                </label>
                                <input
                                  type="number"
                                  value={timeMinutes}
                                  onChange={(e) => setTimeMinutes(Number(e.target.value))}
                                  min={5}
                                  step={5}
                                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500 font-mono font-bold"
                                  required
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                  Detalle de la labor realizada
                                </label>
                                <input
                                  type="text"
                                  value={timeNote}
                                  onChange={(e) => setTimeNote(e.target.value)}
                                  placeholder="Ej: Desarme de grifería y limpieza de asiento"
                                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
                                />
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-md transition-colors border border-slate-700"
                              >
                                Guardar Tiempo
                              </button>
                            </div>
                          </form>
                        )}

                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            Historial de Tiempos Registrados ({activeOrder.timeLogs.length})
                          </h4>
                          {activeOrder.timeLogs.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">
                              No hay registros de tiempo aún.
                            </p>
                          ) : (
                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                              {activeOrder.timeLogs.map((tl) => (
                                <div
                                  key={tl.id}
                                  className="p-2.5 flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-800">{tl.note}</span>
                                    <div className="text-[10px] text-slate-500">
                                      Por {tl.technicianName} a las {tl.timestamp} hs
                                    </div>
                                  </div>
                                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                                    {tl.minutes} min
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 3. MATERIALS USAGE */}
                    {activeTab === 'materials' && (
                      <div className="space-y-3">
                        {activeOrder.status !== 'completed' && (
                          <form
                            onSubmit={handleAddMaterialSubmit}
                            className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2"
                          >
                            <h4 className="text-xs font-bold text-slate-800">
                              Cargar Material Utilizado en Campo
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                  Seleccionar insumo de inventario
                                </label>
                                <select
                                  value={selectedMaterialId}
                                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500 font-medium"
                                >
                                  {materials.map((m) => (
                                    <option key={m.id} value={m.id}>
                                      {m.name} (Stock: {m.stock} {m.unit})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                  Cantidad utilizada
                                </label>
                                <input
                                  type="number"
                                  value={materialQty}
                                  onChange={(e) => setMaterialQty(Number(e.target.value))}
                                  min={1}
                                  className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500 font-mono font-bold"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">
                                Nota u observación del material (opcional)
                              </label>
                              <input
                                type="text"
                                value={materialNote}
                                onChange={(e) => setMaterialNote(e.target.value)}
                                placeholder="Ej: Tramo de reemplazo en baño principal"
                                className="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-md focus:ring-1 focus:ring-teal-500"
                              />
                            </div>

                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-md transition-colors shadow-xs"
                              >
                                Registrar y Descontar Stock
                              </button>
                            </div>
                          </form>
                        )}

                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            Materiales Cargados a esta Orden ({activeOrder.usedMaterials.length})
                          </h4>
                          {activeOrder.usedMaterials.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">
                              No se han registrado materiales aún.
                            </p>
                          ) : (
                            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                              {activeOrder.usedMaterials.map((um) => (
                                <div
                                  key={um.id}
                                  className="p-2.5 flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <span className="font-semibold text-slate-800">
                                      {um.materialName}
                                    </span>
                                    {um.note && (
                                      <div className="text-[10px] text-slate-500">{um.note}</div>
                                    )}
                                  </div>
                                  <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs">
                                    {um.quantity} {um.unit}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 4. TECHNICAL NOTES */}
                    {activeTab === 'notes' && (
                      <div className="space-y-3">
                        {activeOrder.status !== 'completed' && (
                          <form onSubmit={handleAddNoteSubmit} className="space-y-2">
                            <textarea
                              value={techNoteText}
                              onChange={(e) => setTechNoteText(e.target.value)}
                              placeholder="Escribí una nota técnica sobre el diagnóstico o reparación..."
                              rows={3}
                              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-teal-500"
                              required
                            />
                            <div className="flex justify-end">
                              <button
                                type="submit"
                                className="px-3 py-1.5 bg-[#0F172A] hover:bg-slate-800 text-teal-300 text-xs font-bold rounded-md transition-colors border border-slate-700 shadow-xs"
                              >
                                Agregar Nota
                              </button>
                            </div>
                          </form>
                        )}

                        <div className="space-y-1.5">
                          <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono">
                            Notas del Servicio ({activeOrder.technicalNotes.length})
                          </h4>
                          {activeOrder.technicalNotes.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No hay notas registradas.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {activeOrder.technicalNotes.map((nt) => (
                                <div
                                  key={nt.id}
                                  className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
                                >
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                                    <span className="font-bold text-slate-700">{nt.author}</span>
                                    <span className="font-mono">{nt.timestamp} hs</span>
                                  </div>
                                  <p className="text-slate-800 leading-relaxed">{nt.text}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {activeTab === 'quote' && <QuoteBuilder order={activeOrder} />}

                    {/* 5. SIGNATURE & CONFORMITY */}
                    {activeTab === 'signature' && (
                      <div className="space-y-3">
                        {activeOrder.customerSignature ? (
                          <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2">
                            <div className="flex items-center gap-2 text-emerald-900 font-bold text-xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Firma de Conformidad Registrada</span>
                            </div>

                            <div className="bg-white p-2.5 rounded-lg border border-emerald-200 inline-block">
                              <img
                                src={activeOrder.customerSignature.signatureDataUrl}
                                alt="Firma de conformidad"
                                className="h-14 max-w-xs object-contain"
                              />
                            </div>

                            <div className="text-xs text-slate-700 space-y-0.5">
                              <div>
                                Firmante: <strong>{activeOrder.customerSignature.signerName}</strong>
                              </div>
                              <div className="text-slate-500 font-mono text-[10px]">
                                Timestamp: {activeOrder.customerSignature.signedAt}
                              </div>
                              {activeOrder.customerSignature.comments && (
                                <div className="italic text-slate-600 text-[11px]">
                                  "{activeOrder.customerSignature.comments}"
                                </div>
                              )}
                            </div>
                          </div>
                        ) : activeOrder.status === 'completed' ? (
                          <div className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-lg">
                            Esta orden fue completada.
                          </div>
                        ) : (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex gap-3">
                              <div className="mt-0.5 rounded-lg bg-amber-100 p-2 text-amber-700">
                                <Lock className="h-4 w-4" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="text-sm font-bold text-amber-950">
                                  Firma pendiente del cliente
                                </h4>
                                <p className="text-xs leading-relaxed text-amber-900">
                                  Por seguridad, la conformidad solo puede ser registrada por{' '}
                                  <strong>{activeOrder.clientName}</strong> desde su cuenta de
                                  cliente autenticada. El técnico no puede dibujar ni reemplazar
                                  esta firma.
                                </p>
                              </div>
                            </div>
                            <div className="mt-3 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-xs text-slate-700">
                              Avisale al cliente que ingrese a <strong>Mi servicio</strong>, revise
                              el avance y firme cuando esté conforme.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Pause Service Modal */}
      {isPauseModalOpen && activeOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setIsPauseModalOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-slate-900 mb-1">Pausar Servicio Técnico</h3>
            <p className="text-xs text-slate-600 mb-3">
              Indicá el motivo por el cual se interrumpe temporalmente el servicio.
            </p>

            <input
              type="text"
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="Ej: En espera de repuesto especial / corte de luz en zona"
              className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-1 focus:ring-teal-500 mb-3"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPauseModalOpen(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-md transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const result = handlePauseService(activeOrder, pauseReason);
                  if (result.success) {
                    setIsPauseModalOpen(false);
                    setPauseReason('');
                  }
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-md shadow-xs transition-colors"
              >
                Confirmar Pausa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
