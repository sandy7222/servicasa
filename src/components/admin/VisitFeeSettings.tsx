import React, { useState } from 'react';
import { DollarSign, Plus, Save, Trash2 } from 'lucide-react';
import { formatArs } from '../../lib/pricing';

type VisitFeeRule = { id: string; category: string; zone: string; schedule: string; amount: number; active: boolean };

const INITIAL_RULES: VisitFeeRule[] = [
  { id: 'fee-electric-caba', category: 'Electricidad', zone: 'CABA', schedule: 'Horario normal', amount: 30000, active: true },
  { id: 'fee-plumbing-caba', category: 'Plomería', zone: 'CABA', schedule: 'Horario normal', amount: 30000, active: true },
  { id: 'fee-general-gba', category: 'General', zone: 'GBA', schedule: 'Horario normal', amount: 25000, active: true },
];

/** Admin-only pricing editor. Persistence is connected after RLS policies are applied. */
export const VisitFeeSettings: React.FC = () => {
  const [rules, setRules] = useState(INITIAL_RULES);
  const [saved, setSaved] = useState(false);

  const updateRule = (id: string, patch: Partial<VisitFeeRule>) =>
    setRules((current) => current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));

  return (
    <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
        <div className="flex gap-2">
          <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center"><DollarSign className="w-4 h-4" /></span>
          <div><h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Tarifas de visita</h3><p className="text-[11px] text-slate-500">Seña para diagnóstico. Se descuenta del presupuesto si el cliente acepta.</p></div>
        </div>
        <span className="text-[10px] font-mono font-bold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded">CONFIGURABLE</span>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <input value={rule.category} onChange={(e) => updateRule(rule.id, { category: e.target.value })} className="min-w-0 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs" aria-label="Rubro" />
            <input value={rule.zone} onChange={(e) => updateRule(rule.id, { zone: e.target.value })} className="min-w-0 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs" aria-label="Zona" />
            <input value={rule.schedule} onChange={(e) => updateRule(rule.id, { schedule: e.target.value })} className="min-w-0 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs" aria-label="Modalidad" />
            <input type="number" min="0" value={rule.amount} onChange={(e) => updateRule(rule.id, { amount: Number(e.target.value) })} className="min-w-0 rounded border border-teal-200 bg-white px-2 py-1.5 text-xs font-mono font-bold text-teal-800" aria-label="Importe" />
            <div className="flex items-center justify-between gap-2"><button type="button" onClick={() => updateRule(rule.id, { active: !rule.active })} className={`text-[10px] font-bold px-2 py-1 rounded border ${rule.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{rule.active ? 'Activa' : 'Inactiva'}</button><button type="button" onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))} className="text-rose-600"><Trash2 className="w-4 h-4" /></button></div>
            <p className="col-span-2 sm:col-span-5 text-[10px] text-slate-500">Seña actual: <strong>{formatArs(rule.amount)}</strong></p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setRules((current) => [...current, { id: crypto.randomUUID(), category: 'General', zone: 'CABA', schedule: 'Horario normal', amount: 30000, active: true }])} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold hover:bg-slate-50"><Plus className="w-3.5 h-3.5" />Agregar tarifa</button>
        <button type="button" onClick={() => setSaved(true)} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-xs font-bold text-white hover:bg-teal-700"><Save className="w-3.5 h-3.5" />Guardar tarifas</button>
        {saved && <span className="self-center text-[11px] text-emerald-700 font-medium">Tarifas listas para sincronizar con Supabase.</span>}
      </div>
    </section>
  );
};
