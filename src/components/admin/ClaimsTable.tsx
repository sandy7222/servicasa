import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { fetchClaims } from '../../lib/supportCases';
import type { ClaimCase, ClaimStatus, ClaimType } from '../../types';
import { NewClaimModal } from './NewClaimModal';
import { ClaimPriorityBadge, ClaimStatusBadge, CLAIM_TYPE_LABELS, formatDate } from './claimShared';

export function ClaimsTable({ onOpen }: { onOpen: (claimId: string) => void }) {
  const { showToast } = useApp();
  const [claims, setClaims] = useState<ClaimCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClaimStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ClaimType>('all');
  const [isNewOpen, setIsNewOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setClaims(await fetchClaims());
    } catch {
      showToast('No se pudieron cargar los reclamos. Confirmá la migración y tus permisos.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => claims.filter((claim) => {
    const haystack = `${claim.caseNumber} ${claim.subject} ${claim.customerName ?? ''} ${claim.technicianName ?? ''}`.toLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    const matchesType = typeFilter === 'all' || claim.type === typeFilter;
    return matchesQuery && matchesStatus && matchesType;
  }), [claims, query, statusFilter, typeFilter]);

  const openCount = claims.filter((c) => ['open', 'in_progress', 'waiting_client', 'waiting_technician', 'escalated'].includes(c.status)).length;

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <section className="rounded-2xl bg-[#0f1b35] text-white p-5 sm:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-teal-300">
            <ShieldAlert className="w-5 h-5" />
            <span className="font-mono text-xs uppercase tracking-wider">Administración</span>
          </div>
          <h1 className="text-2xl font-black mt-1">Reclamos y Garantías</h1>
          <p className="text-sm text-slate-300 mt-1">
            Casos abiertos, comunicación con las partes, pausa de liquidaciones y resolución.
          </p>
        </div>
        <button
          onClick={() => setIsNewOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 px-4 py-2.5 text-sm font-bold transition"
        >
          <Plus className="w-4 h-4" />
          Abrir caso
        </button>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Casos" value={String(claims.length)} />
        <Stat label="Activos" value={String(openCount)} tone="amber" />
        <Stat label="Resueltos" value={String(claims.filter((c) => c.status === 'resolved').length)} tone="emerald" />
        <Stat label="Liquidaciones pausadas" value={String(claims.filter((c) => c.settlementPaused).length)} tone="rose" />
      </section>

      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row gap-3 sm:items-center">
          <label className="relative block max-w-xl flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por número, asunto, cliente o técnico…"
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | ClaimStatus)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Todos los estados</option>
            {(['open', 'in_progress', 'waiting_client', 'waiting_technician', 'resolved', 'closed', 'escalated'] as ClaimStatus[]).map((s) => (
              <option key={s} value={s}>Estado: {s === 'open' ? 'Abierto' : s === 'in_progress' ? 'En progreso' : s === 'waiting_client' ? 'Esperando cliente' : s === 'waiting_technician' ? 'Esperando técnico' : s === 'resolved' ? 'Resuelto' : s === 'closed' ? 'Cerrado' : 'Escalado'}</option>
            ))}
          </select>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as 'all' | ClaimType)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="all">Todos los tipos</option>
            {(Object.keys(CLAIM_TYPE_LABELS) as ClaimType[]).map((t) => (
              <option key={t} value={t}>{CLAIM_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[880px] w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-slate-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Técnico</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3">Abierto</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-500">Cargando reclamos…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-slate-500">No encontramos reclamos con esos filtros.</td></tr>
              ) : (
                filtered.map((claim) => (
                  <tr key={claim.id} onClick={() => onOpen(claim.id)} className="border-t border-slate-100 cursor-pointer hover:bg-teal-50/60 transition">
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{claim.caseNumber}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-800">{claim.subject}</div>
                      {claim.settlementPaused && <span className="text-[11px] font-bold text-rose-600">⏸ Liquidación pausada</span>}
                    </td>
                    <td className="px-4 py-3">{claim.customerName || '—'}</td>
                    <td className="px-4 py-3">{claim.technicianName || '—'}</td>
                    <td className="px-4 py-3">{CLAIM_TYPE_LABELS[claim.type]}</td>
                    <td className="px-4 py-3"><ClaimStatusBadge status={claim.status} /></td>
                    <td className="px-4 py-3"><ClaimPriorityBadge priority={claim.priority} /></td>
                    <td className="px-4 py-3">{formatDate(claim.openedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <footer className="p-3 border-t border-slate-100 text-sm text-slate-500">
          {filtered.length} caso{filtered.length === 1 ? '' : 's'}
        </footer>
      </section>

      <NewClaimModal
        isOpen={isNewOpen}
        onClose={() => setIsNewOpen(false)}
        onCreated={() => {
          setIsNewOpen(false);
          void load();
        }}
      />
    </main>
  );
}

function Stat({ label, value, tone = 'slate' }: { label: string; value: string; tone?: 'slate' | 'amber' | 'emerald' | 'rose' }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
  };
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className={`font-mono font-black text-2xl ${tones[tone]}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mt-1">{label}</div>
    </div>
  );
}
