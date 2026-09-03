import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Save, Settings2, ShieldAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ARGENTINA_PROVINCES } from '../../lib/argentina';
import { fetchSettings, getSettingValue, updateSetting } from '../../lib/settings';
import type { SettingKey, SettingRow } from '../../lib/settings';

const dateTime = (value?: string | null) =>
  value ? new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';

/** Panel de configuración central (Fase 7). visit_deposit_amount tiene su
 * propia UI ya existente y probada (VisitFeeSettings.tsx) — no se duplica
 * acá. Los cambios "sensibles" (los que tocan cálculos de dinero) piden
 * confirmación explícita antes de guardar. */
export const SystemSettingsPanel: React.FC = () => {
  const { showToast } = useApp();
  const [rows, setRows] = useState<SettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<SettingKey | null>(null);
  const [saving, setSaving] = useState<SettingKey | null>(null);

  const load = async () => {
    try {
      const data = await fetchSettings();
      setRows(data);
    } catch {
      showToast('No se pudo cargar la configuración.', 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const row = (key: SettingKey) => rows.find((r) => r.key === key);
  const draftFor = (key: SettingKey, fallback: string) => drafts[key] ?? fallback;

  const saveNumber = async (key: SettingKey, sensitive: boolean) => {
    const raw = drafts[key];
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      showToast('Ingresá un número válido (≥ 0).', 'warning');
      return;
    }
    if (sensitive && confirming !== key) {
      setConfirming(key);
      return;
    }
    setSaving(key);
    try {
      await updateSetting(key, value);
      showToast('Configuración actualizada.', 'success');
      setConfirming(null);
      setDrafts((d) => { const next = { ...d }; delete next[key]; return next; });
      await load();
    } catch {
      showToast('No se pudo guardar el cambio.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const enabledProvinces = useMemo(() => {
    const r = row('enabled_provinces');
    return r ? getSettingValue<string[]>(rows, 'enabled_provinces') : ARGENTINA_PROVINCES;
  }, [rows]);

  const toggleProvince = async (province: string) => {
    const current = new Set(enabledProvinces);
    if (current.has(province)) current.delete(province); else current.add(province);
    setSaving('enabled_provinces');
    try {
      await updateSetting('enabled_provinces', Array.from(current));
      await load();
    } catch {
      showToast('No se pudo actualizar la provincia.', 'error');
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-xs text-slate-500 dark:text-slate-400">Cargando configuración…</section>;
  }

  const NumberField: React.FC<{
    settingKey: SettingKey; label: string; suffix?: string; sensitive?: boolean; step?: string;
  }> = ({ settingKey, label, suffix, sensitive, step = '1' }) => {
    const r = row(settingKey);
    const current = r ? String(r.value) : '';
    const draft = draftFor(settingKey, current);
    const changed = draft !== current;
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</label>
          {sensitive && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700"><ShieldAlert className="w-3 h-3" />sensible</span>}
        </div>
        {r?.description && <p className="text-[11px] text-slate-500 dark:text-slate-400">{r.description}</p>}
        <div className="flex items-center gap-2">
          <input
            type="number" min="0" step={step}
            value={draft}
            onChange={(e) => { setDrafts((d) => ({ ...d, [settingKey]: e.target.value })); setConfirming(null); }}
            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-mono"
          />
          {suffix && <span className="text-xs text-slate-500 dark:text-slate-400">{suffix}</span>}
          {changed && confirming !== settingKey && (
            <button
              onClick={() => void saveNumber(settingKey, Boolean(sensitive))}
              disabled={saving === settingKey}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-teal-300 disabled:opacity-40"
            >
              <Save className="w-3.5 h-3.5" /> Guardar
            </button>
          )}
        </div>
        {confirming === settingKey && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2 text-[11px] text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>Cambiar de <strong>{current}</strong> a <strong>{draft}</strong> afecta cálculos reales. ¿Confirmás?</span>
            <button
              onClick={() => void saveNumber(settingKey, true)}
              disabled={saving === settingKey}
              className="ml-auto inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2 py-1 text-white font-bold"
            >
              <Check className="w-3 h-3" /> Confirmar
            </button>
          </div>
        )}
        <p className="text-[10px] text-slate-400 font-mono">v{r?.version ?? 1} · actualizado {dateTime(r?.updated_at)}</p>
      </div>
    );
  };

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4">
      <div className="flex items-start gap-2">
        <Settings2 className="w-4 text-teal-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold">Configuración central</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            La seña de diagnóstico tiene su propio panel arriba. Estos valores quedan auditados: cada cambio registra quién, cuándo y el valor anterior.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <NumberField settingKey="platform_commission_rate" label="Comisión de plataforma" suffix="(0–1)" sensitive step="0.01" />
        <NumberField settingKey="settlement_release_days" label="Días hasta liberar liquidación" suffix="días" sensitive />
        <NumberField settingKey="warranty_days" label="Días de garantía" suffix="días" />
        <NumberField settingKey="urgent_surcharge_percent" label="Recargo urgente" suffix="%" />
        <NumberField settingKey="message_max_length" label="Largo máximo de mensaje" suffix="caracteres" />
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Provincias habilitadas</label>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">Hoy se aceptan pedidos de cualquiera de estas — desmarcar todavía no bloquea pedidos en el formulario (reservado para cuando se conecte la validación).</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {ARGENTINA_PROVINCES.map((p) => (
            <label key={p} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={enabledProvinces.includes(p)}
                disabled={saving === 'enabled_provinces'}
                onChange={() => void toggleProvince(p)}
              />
              {p}
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 p-3 text-[11px] text-slate-500 dark:text-slate-400">
        <strong className="text-slate-700 dark:text-slate-300">Banderas de funciones sensibles:</strong> contenedor reservado (<code>feature_flags</code>), vacío por ahora — se activa cuando exista una función concreta que lo necesite.
      </div>
    </section>
  );
};
