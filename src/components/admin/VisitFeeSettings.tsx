import React, { useEffect, useState } from 'react';
import { DollarSign, Save } from 'lucide-react';
import { formatArs } from '../../lib/pricing';
import { useApp } from '../../context/AppContext';

/** Monto único de seña para la visita de diagnóstico, para todos los rubros.
 * Persiste de verdad en system_settings (ver AppContext.updateVisitDepositAmount). */
export const VisitFeeSettings: React.FC = () => {
  const { visitDepositAmount, updateVisitDepositAmount } = useApp();
  const [draft, setDraft] = useState(visitDepositAmount);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(visitDepositAmount), [visitDepositAmount]);

  const save = async () => {
    setSaving(true);
    try {
      await updateVisitDepositAmount(draft);
    } catch {
      // updateVisitDepositAmount ya muestra el toast de error
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-3">
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
        <div className="flex gap-2">
          <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
            <DollarSign className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Seña de diagnóstico</h3>
            <p className="text-[11px] text-slate-500">Monto único para todas las visitas de diagnóstico. Se descuenta del presupuesto si el cliente acepta.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <label className="flex-1 text-xs font-semibold text-slate-700">
          Monto de la seña ($ ARS)
          <input
            type="number"
            min="0"
            step="500"
            value={draft}
            onChange={(e) => setDraft(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-mono font-bold text-teal-800"
          />
        </label>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || draft === visitDepositAmount}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>

      <p className="text-[11px] text-slate-500">
        Seña actual: <strong>{formatArs(visitDepositAmount)}</strong>
      </p>
    </section>
  );
};
