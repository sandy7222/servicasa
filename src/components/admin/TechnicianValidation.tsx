import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { TechnicianReviewCard } from './TechnicianReviewCard';

type Row = { id: string; name: string; specialty: string; validation_status: string };
type RawRow = { id: string; name: string; specialty: string; validation_status: string; technician_specialties: { categories: { name: string } | null }[] };

export const TechnicianValidation: React.FC = () => {
  const { refreshRemoteData } = useApp();
  const [rows, setRows] = useState<Row[]>([]); const [filter, setFilter] = useState('pending'); const [selected, setSelected] = useState<string | null>(null);
  const load = async () => {
    const query = supabase.from('technicians').select('id,name,specialty,validation_status,technician_specialties(categories(name))').order('name');
    const { data } = filter === 'all' ? await query : await query.eq('validation_status', filter);
    setRows(((data ?? []) as unknown as RawRow[]).map((row) => {
      const names = row.technician_specialties.map((ts) => ts.categories?.name).filter((name): name is string => Boolean(name));
      return { id: row.id, name: row.name, specialty: names.length ? names.join(', ') : row.specialty, validation_status: row.validation_status };
    }));
  };
  useEffect(() => { void load(); }, [filter]);
  if (selected) return <section className="rounded-xl border border-slate-200 bg-white p-4"><TechnicianReviewCard technicianId={selected} onClose={() => setSelected(null)} onChanged={async () => { await load(); await refreshRemoteData(); }} /></section>;
  return <section className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="flex gap-2"><ShieldCheck className="w-4 text-teal-600 mt-0.5" /><div><h3 className="text-sm font-bold">Validación de técnicos</h3><p className="text-[11px] text-slate-500">Revisá cada requisito antes de habilitar nuevas asignaciones.</p></div></div><select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs"><option value="pending">Pendientes</option><option value="observed">Observados</option><option value="suspended">Suspendidos</option><option value="all">Todos</option></select></div><div className="mt-3 space-y-2">{rows.length ? rows.map((tech) => <button key={tech.id} onClick={() => setSelected(tech.id)} className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-teal-400 hover:bg-teal-50/30"><b className="text-xs text-slate-900">{tech.name}</b><p className="text-[11px] text-slate-500">{tech.specialty} · {tech.validation_status}</p></button>) : <p className="text-xs text-slate-500">No hay técnicos para este filtro.</p>}</div></section>;
};
