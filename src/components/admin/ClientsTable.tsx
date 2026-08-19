import { useMemo, useState } from 'react';
import { Download, ExternalLink, Search, ShieldCheck, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';

type SortKey = 'name' | 'orders' | 'spent' | 'warranties' | 'lastOrder';

const money = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
});

function downloadCsv(filename: string, rows: string[][]) {
  const contents = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\n');
  const blob = new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ClientsTable({ onOpen }: { onOpen: (customerId: string) => void }) {
  const { customers, orders } = useApp();
  const [query, setQuery] = useState('');
  const [onlyWarranty, setOnlyWarranty] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const [page, setPage] = useState(1);
  const perPage = 25;

  const rows = useMemo(() => customers.map((customer) => {
    const customerOrders = orders.filter((order) => order.clientId === customer.id);
    const completed = customerOrders.filter((order) => order.status === 'completed');
    const warranties = completed.filter((order) => order.completedAt && Date.now() - new Date(order.completedAt).getTime() < 30 * 86400000);
    const last = customerOrders.reduce<string | undefined>((latest, order) => !latest || new Date(order.createdAt) > new Date(latest) ? order.createdAt : latest, undefined);
    return {
      customer, totalOrders: customerOrders.length, completedOrders: completed.length,
      totalSpent: completed.reduce((sum, order) => sum + (order.totalPaidAmount ?? 0), 0),
      warranties: warranties.length, lastOrder: last,
    };
  }), [customers, orders]);

  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = `${row.customer.name} ${row.customer.email} ${row.customer.phone}`.toLowerCase();
    return (!query.trim() || haystack.includes(query.toLowerCase())) && (!onlyWarranty || row.warranties > 0);
  }).sort((a, b) => {
    const value = (row: typeof a) => {
      if (sort.key === 'name') return row.customer.name;
      if (sort.key === 'orders') return row.totalOrders;
      if (sort.key === 'spent') return row.totalSpent;
      if (sort.key === 'warranties') return row.warranties;
      return row.lastOrder ?? '';
    };
    const left = value(a); const right = value(b);
    const comparison = typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right));
    return sort.direction === 'asc' ? comparison : -comparison;
  }), [rows, query, onlyWarranty, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / perPage));
  const visible = filtered.slice((page - 1) * perPage, page * perPage);
  const order = (key: SortKey) => { setPage(1); setSort((previous) => ({ key, direction: previous.key === key && previous.direction === 'asc' ? 'desc' : 'asc' })); };
  const indicator = (key: SortKey) => sort.key === key ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : '';

  const exportRows = () => downloadCsv('servicasa-clientes.csv', [
    ['Cliente', 'Email', 'Teléfono', 'Órdenes', 'Completadas', 'Total abonado', 'Garantías activas', 'Última orden'],
    ...filtered.map((row) => [row.customer.name, row.customer.email, row.customer.phone, String(row.totalOrders), String(row.completedOrders), String(row.totalSpent), String(row.warranties), row.lastOrder ? new Date(row.lastOrder).toLocaleDateString('es-AR') : '—']),
  ]);

  return <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
    <section className="rounded-2xl bg-[#0f1b35] text-white p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><div className="flex items-center gap-2 text-teal-300"><Users className="w-5 h-5" /><span className="font-mono text-xs uppercase tracking-wider">Administración</span></div><h1 className="text-2xl font-black mt-1">Planilla de clientes</h1><p className="text-sm text-slate-300 mt-1">Buscá, ordená y abrí la ficha completa sin recargar el dashboard operativo.</p></div>
      <button onClick={exportRows} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2.5 text-sm font-bold transition"><Download className="w-4 h-4" />Exportar CSV</button>
    </section>
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <label className="relative block max-w-xl flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por nombre, email o teléfono…" className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500" /></label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={onlyWarranty} onChange={(event) => { setOnlyWarranty(event.target.checked); setPage(1); }} className="accent-teal-600" />Con garantía activa</label>
      </div>
      <div className="overflow-x-auto"><table className="min-w-[960px] w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-slate-600 text-xs uppercase tracking-wide"><tr>{([['name', 'Cliente'], ['orders', 'Órdenes'], ['spent', 'Total abonado'], ['warranties', 'Garantías'], ['lastOrder', 'Última orden']] as [SortKey, string][]).map(([key, label]) => <th key={key} className="px-4 py-3"><button onClick={() => order(key)} className="font-bold hover:text-teal-700">{label}{indicator(key)}</button></th>)}<th className="px-4 py-3">Contacto</th><th className="px-4 py-3 text-right">Acción</th></tr></thead>
        <tbody>{visible.map((row) => <tr key={row.customer.id} onClick={() => onOpen(row.customer.id)} className="border-t border-slate-100 cursor-pointer hover:bg-teal-50/60 transition"><td className="px-4 py-3"><div className="font-bold text-slate-900">{row.customer.name}</div><div className="text-xs text-slate-500">{row.customer.address} · {row.customer.neighborhood}</div></td><td className="px-4 py-3"><strong>{row.totalOrders}</strong><span className="text-slate-500"> / {row.completedOrders} cerradas</span></td><td className="px-4 py-3 font-mono font-semibold">{money.format(row.totalSpent)}</td><td className="px-4 py-3">{row.warranties ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><ShieldCheck className="w-4 h-4" />{row.warranties} activa{row.warranties > 1 ? 's' : ''}</span> : <span className="text-slate-400">—</span>}</td><td className="px-4 py-3">{row.lastOrder ? new Date(row.lastOrder).toLocaleDateString('es-AR') : '—'}</td><td className="px-4 py-3"><div>{row.customer.phone || '—'}</div><div className="text-xs text-slate-500">{row.customer.email || '—'}</div></td><td className="px-4 py-3 text-right"><button onClick={(event) => { event.stopPropagation(); onOpen(row.customer.id); }} className="inline-flex items-center gap-1 text-teal-700 font-bold hover:underline">Abrir ficha <ExternalLink className="w-3.5 h-3.5" /></button></td></tr>)}{visible.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-slate-500">No encontramos clientes con esos filtros.</td></tr>}</tbody></table></div>
      <footer className="p-3 border-t border-slate-100 flex items-center justify-between text-sm"><span className="text-slate-500">{filtered.length} cliente{filtered.length === 1 ? '' : 's'}</span><div className="flex gap-2"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="px-3 py-1.5 rounded border disabled:opacity-40">Anterior</button><span className="px-2 py-1.5">{page} / {pages}</span><button disabled={page === pages} onClick={() => setPage((value) => value + 1)} className="px-3 py-1.5 rounded border disabled:opacity-40">Siguiente</button></div></footer>
    </section>
  </main>;
}
