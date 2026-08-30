import React, { useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, ChevronDown, ChevronUp, ClipboardList, MapPin, Search, Timer } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { OrderStatus, ServiceOrder } from '../../types';
import { formatElapsedTime, getOrderElapsedSeconds } from '../../lib/workTimer';

type Filter = 'all' | OrderStatus;

const statusLabel: Record<OrderStatus, string> = {
  assigned: 'Asignadas', in_progress: 'En curso', paused: 'Pausadas', completed: 'Finalizadas', cancelled: 'Canceladas',
};

const date = (value?: string) => value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(new Date(value)) : 'Sin fecha';

export const WorkHistoryView: React.FC = () => {
  const { currentUser, orders, navigate } = useApp();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string>();
  const assigned = orders.filter((order) => order.assignedTechnicianId === currentUser?.technicianId);
  const filtered = useMemo(() => assigned.filter((order) => {
    const term = search.trim().toLocaleLowerCase();
    const hasTerm = !term || [order.title, order.clientName, order.clientAddress, order.serviceType].join(' ').toLocaleLowerCase().includes(term);
    return hasTerm && (filter === 'all' || order.status === filter);
  }).sort((a, b) => +new Date(b.completedAt ?? b.scheduledDate) - +new Date(a.completedAt ?? a.scheduledDate)), [assigned, filter, search]);

  return <main className="min-h-screen bg-slate-100/70 pb-12">
    <header className="border-b border-slate-800 bg-[#0F172A] text-white"><div className="mx-auto max-w-5xl px-4 py-5 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300"><ClipboardList className="w-5 h-5" /></div><div><h1 className="font-bold">Historial de trabajos</h1><p className="text-xs text-slate-400">Tus órdenes asignadas, con su progreso y registro operativo.</p></div></div><button onClick={() => navigate('/technician')} aria-label="Volver a la Terminal de Campo" className="shrink-0 rounded-lg border border-slate-700 p-2 text-slate-200 hover:border-teal-500 hover:text-teal-300"><ArrowLeft className="w-4 h-4" /></button></div></header>
    <div className="mx-auto max-w-5xl px-4 pt-5 space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por cliente, dirección o servicio…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500" /></label><select value={filter} onChange={(event) => setFilter(event.target.value as Filter)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><option value="all">Todos los estados</option>{(Object.keys(statusLabel) as OrderStatus[]).map((status) => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></div></section>
      <p className="text-xs font-semibold text-slate-500">{filtered.length} trabajo{filtered.length === 1 ? '' : 's'} encontrado{filtered.length === 1 ? '' : 's'}</p>
      {filtered.length === 0 ? <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><ClipboardList className="mx-auto w-8 h-8 text-slate-400" /><h2 className="mt-3 text-sm font-bold">No hay trabajos para este filtro</h2><p className="mt-1 text-xs text-slate-500">Cuando recibas o completes órdenes, vas a poder consultarlas aquí.</p></section> : <div className="space-y-3">{filtered.map((order) => <HistoryCard key={order.id} order={order} open={openId === order.id} onToggle={() => setOpenId(openId === order.id ? undefined : order.id)} />)}</div>}
    </div>
  </main>;
};

const HistoryCard: React.FC<{ order: ServiceOrder; open: boolean; onToggle: () => void }> = ({ order, open, onToggle }) => {
  const done = order.checklist.filter((item) => item.completed).length;
  const total = order.checklist.length;
  return <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><button onClick={onToggle} className="w-full text-left"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-teal-700">{statusLabel[order.status]}</span><span className="text-[10px] text-slate-400">#{order.id.slice(0, 8)}</span></div><h2 className="mt-1 text-sm font-bold text-slate-900">{order.title}</h2><p className="mt-1 text-xs text-slate-500">{order.clientName} · {order.serviceType}</p></div>{open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}</div><div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500"><span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{date(order.completedAt ?? order.scheduledDate)}</span><span className="inline-flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{formatElapsedTime(getOrderElapsedSeconds(order))}</span><span>{done}/{total} tareas</span></div></button>{open && <div className="mt-4 border-t border-slate-100 pt-3 grid gap-3 text-xs"><p className="text-slate-600">{order.description || 'Sin descripción adicional.'}</p><p className="inline-flex items-start gap-1.5 text-slate-600"><MapPin className="w-3.5 h-3.5 mt-0.5 text-teal-600" />{[order.clientAddress, order.clientNeighborhood, order.clientCity].filter(Boolean).join(', ')}</p><div className="rounded-lg bg-slate-50 p-3"><p className="font-bold text-slate-700">Checklist operativo</p><div className="mt-2 space-y-1">{order.checklist.length === 0 ? <p className="text-slate-500">No se cargaron tareas para esta orden.</p> : order.checklist.map((item) => <p key={item.id} className={item.completed ? 'text-emerald-700' : 'text-slate-500'}>{item.completed ? '✓' : '○'} {item.text}</p>)}</div></div><div className="flex flex-wrap gap-3 text-slate-600"><span>Materiales: <strong>{order.usedMaterials.length}</strong></span><span>Notas: <strong>{order.technicalNotes.length}</strong></span><span>Conformidad: <strong>{order.customerSignature ? 'Firmada' : 'Pendiente'}</strong></span></div></div>}</article>;
};
