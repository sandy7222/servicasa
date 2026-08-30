import React, { useEffect, useState } from 'react';
import { DollarSign, Percent, Save } from 'lucide-react';
import { formatArs } from '../../lib/pricing';
import { useApp } from '../../context/AppContext';

/** Monto único de seña para la visita de diagnóstico, para todos los rubros,
 * más la comisión propia de esa liquidación (separada de
 * platform_commission_rate, que sigue siendo solo para el trabajo
 * completado). Persisten de verdad en system_settings (ver
 * AppContext.updateVisitDepositAmount / updateVisitSettlementCommissionRate). */
export const VisitFeeSettings: React.FC = () => {
  const {
    visitDepositAmount,
    updateVisitDepositAmount,
    visitSettlementCommissionRate,
    updateVisitSettlementCommissionRate,
  } = useApp();
  const [draftAmount, setDraftAmount] = useState(visitDepositAmount);
  const [savingAmount, setSavingAmount] = useState(false);
  const [draftRatePct, setDraftRatePct] = useState(Math.round(visitSettlementCommissionRate * 100));
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => setDraftAmount(visitDepositAmount), [visitDepositAmount]);
  useEffect(() => setDraftRatePct(Math.round(visitSettlementCommissionRate * 100)), [visitSettlementCommissionRate]);

  const saveAmount = async () => {
    setSavingAmount(true);
    try {
      await updateVisitDepositAmount(draftAmount);
    } catch {
      // updateVisitDepositAmount ya muestra el toast de error
    } finally {
      setSavingAmount(false);
    }
  };

  const saveRate = async () => {
    setSavingRate(true);
    try {
      await updateVisitSettlementCommissionRate(draftRatePct / 100);
    } catch {
      // updateVisitSettlementCommissionRate ya muestra el toast de error
    } finally {
      setSavingRate(false);
    }
  };

  return (
    <section className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs space-y-4">
      <div className="flex items-start gap-2 pb-2 border-b border-slate-100">
        <span className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
          <DollarSign className="w-4 h-4" />
        </span>
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">Visita de diagnóstico</h3>
          <p className="text-[11px] text-slate-500">Monto de la seña y comisión de la plataforma sobre esa liquidación al técnico.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <label className="flex-1 text-xs font-semibold text-slate-700">
          Monto de la seña ($ ARS)
          <input
            type="number"
            min="0"
            step="500"
            value={draftAmount}
            onChange={(e) => setDraftAmount(Math.max(0, Number(e.target.value) || 0))}
            className="mt-1 w-full rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm font-mono font-bold text-teal-800"
          />
        </label>
        <button
          type="button"
          onClick={() => void saveAmount()}
          disabled={savingAmount || draftAmount === visitDepositAmount}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {savingAmount ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Seña actual: <strong>{formatArs(visitDepositAmount)}</strong>. Se cobra aparte del presupuesto final, sin descuento entre ambos.
      </p>

      <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end gap-2">
        <label className="flex-1 text-xs font-semibold text-slate-700">
          Comisión sobre la liquidación de visita (%)
          <div className="relative mt-1">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={draftRatePct}
              onChange={(e) => setDraftRatePct(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
              className="w-full rounded-lg border border-teal-200 bg-white pl-3 pr-8 py-2 text-sm font-mono font-bold text-teal-800"
            />
            <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>
        </label>
        <button
          type="button"
          onClick={() => void saveRate()}
          disabled={savingRate || draftRatePct === Math.round(visitSettlementCommissionRate * 100)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          <Save className="w-3.5 h-3.5" />
          {savingRate ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
      <p className="text-[11px] text-slate-500">
        Comisión actual: <strong>{Math.round(visitSettlementCommissionRate * 100)}%</strong>. Propia de esta liquidación — no es la misma que la del trabajo completado.
      </p>
    </section>
  );
};
