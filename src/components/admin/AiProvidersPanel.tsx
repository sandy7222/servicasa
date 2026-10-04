import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Pencil, Plus, Trash2, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AI_PRESETS, aiAdmin, type AiEnvRow, type AiProviderInput, type AiProviderRow, type AiProviderTest } from '../../lib/aiAdminClient';

const FIELD = 'w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500';
const LABEL = 'block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1';
const BTN = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50';
const BTN_PRIMARY = 'inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-700 disabled:opacity-50';
const HIDE_AFTER_MS = 30000;

const emptyForm = (): AiProviderInput => ({ id: null, label: '', preset: 'groq', baseUrl: AI_PRESETS[0].baseUrl, model: AI_PRESETS[0].model, reasoningEffort: AI_PRESETS[0].reasoningEffort, enabled: true, priority: 100, apiKey: '' });

/** Campo de clave: tapada con puntos, con ojito para verla. */
const KeyField: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }> = ({ value, onChange, placeholder }) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        className={`${FIELD} pr-9 font-mono`}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        aria-label="API key"
      />
      <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Ocultar la clave' : 'Mostrar la clave'} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
};

const ProviderForm: React.FC<{
  initial: AiProviderInput;
  editing: boolean;
  busy: boolean;
  onSave: (input: AiProviderInput) => void;
  onCancel: () => void;
}> = ({ initial, editing, busy, onSave, onCancel }) => {
  const [form, setForm] = useState(initial);
  const preset = AI_PRESETS.find((p) => p.id === form.preset);
  const set = <K extends keyof AiProviderInput>(key: K, value: AiProviderInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const choosePreset = (id: string) => {
    const next = AI_PRESETS.find((p) => p.id === id)!;
    setForm((f) => ({ ...f, preset: id, label: f.label || next.label, baseUrl: next.baseUrl, model: next.model, reasoningEffort: next.reasoningEffort }));
  };

  return (
    <form
      className="rounded-xl border border-teal-300 dark:border-teal-700 bg-teal-50/40 dark:bg-teal-950/20 p-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
    >
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{editing ? 'Editar proveedor' : 'Agregar proveedor de IA'}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="ai-preset">Proveedor</label>
          <select id="ai-preset" className={FIELD} value={form.preset} onChange={(e) => choosePreset(e.target.value)}>
            {AI_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="ai-label">Nombre para mostrar</label>
          <input id="ai-label" className={FIELD} value={form.label} onChange={(e) => set('label', e.target.value)} maxLength={60} required />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL} htmlFor="ai-url">Dirección (URL de la API)</label>
          <input id="ai-url" className={`${FIELD} font-mono`} value={form.baseUrl} onChange={(e) => set('baseUrl', e.target.value)} placeholder="https://…" required />
        </div>
        <div>
          <label className={LABEL} htmlFor="ai-model">Modelo</label>
          <input id="ai-model" className={`${FIELD} font-mono`} value={form.model} onChange={(e) => set('model', e.target.value)} required />
        </div>
        <div>
          <label className={LABEL} htmlFor="ai-reasoning">Razonamiento (opcional)</label>
          <input id="ai-reasoning" className={`${FIELD} font-mono`} value={form.reasoningEffort} onChange={(e) => set('reasoningEffort', e.target.value)} placeholder="none" maxLength={20} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>API key {editing && <span className="font-normal">(dejala vacía para conservar la actual)</span>}</label>
          <KeyField value={form.apiKey} onChange={(v) => set('apiKey', v)} placeholder={editing ? 'Sin cambios' : 'Pegá la clave acá'} />
        </div>
      </div>
      {preset?.note && <p className="text-[11px] text-slate-600 dark:text-slate-400">ℹ️ {preset.note}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={BTN_PRIMARY} disabled={busy}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}Guardar</button>
        <button type="button" className={BTN} onClick={onCancel} disabled={busy}>Cancelar</button>
      </div>
    </form>
  );
};

const KeyRow: React.FC<{ provider: AiProviderRow }> = ({ provider }) => {
  const { showToast } = useApp();
  const [key, setKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);

  const toggle = async () => {
    if (key) {
      clearTimeout(timer.current);
      setKey(null);
      return;
    }
    setLoading(true);
    try {
      setKey(await aiAdmin.reveal(provider.id));
      // Por seguridad la clave vuelve a taparse sola.
      timer.current = setTimeout(() => setKey(null), HIDE_AFTER_MS);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo mostrar la clave.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-[11px] text-slate-800 dark:text-slate-200" aria-label="API key actual">
        {key ?? (provider.keyHint ? `••••••••••••••••${provider.keyHint}` : 'Sin clave')}
      </code>
      <button type="button" className={BTN} onClick={toggle} disabled={loading || !provider.keyHint} aria-label={key ? 'Ocultar la clave' : 'Mostrar la clave'}>
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : key ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
};

export const AiProvidersPanel: React.FC = () => {
  const { showToast } = useApp();
  const [providers, setProviders] = useState<AiProviderRow[]>([]);
  const [env, setEnv] = useState<AiEnvRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<AiProviderInput | null>(null);
  const [tests, setTests] = useState<Record<string, AiProviderTest | 'running'>>({});

  const load = useCallback(async () => {
    try {
      const data = await aiAdmin.list();
      setProviders(data.providers);
      setEnv(data.env);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudieron cargar los proveedores.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, okMessage: string) => {
    setBusy(true);
    try {
      await action();
      showToast(okMessage, 'success');
      await load();
      return true;
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo completar la operación.', 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const save = async (input: AiProviderInput) => {
    if (await run(() => aiAdmin.save(input), input.id ? 'Proveedor actualizado.' : 'Proveedor agregado.')) setForm(null);
  };

  const move = (index: number, delta: number) => {
    const ids = providers.map((p) => p.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void run(() => aiAdmin.setOrder(ids), 'Orden actualizado.');
  };

  const test = async (id: string) => {
    setTests((t) => ({ ...t, [id]: 'running' }));
    try {
      const result = await aiAdmin.test(id);
      setTests((t) => ({ ...t, [id]: result }));
    } catch (err) {
      setTests((t) => ({ ...t, [id]: { ok: false, ms: 0, message: err instanceof Error ? err.message : 'No se pudo probar.' } }));
    }
  };

  const remove = (provider: AiProviderRow) => {
    if (!window.confirm(`¿Eliminar "${provider.label}"? Se borra también su clave guardada.`)) return;
    void run(() => aiAdmin.remove(provider.id), 'Proveedor eliminado.');
  };

  const groqImportable = env.some((e) => e.name === 'groq') && !providers.some((p) => p.preset === 'groq');

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Asistente IA</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Proveedores que usa el chat de ayuda de la tienda. El chat prueba el primero de la lista y, si falla o se queda sin cupo, pasa al siguiente. Las claves se guardan cifradas.
        </p>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500">Cargando…</p>
      ) : (
        <>
          {env.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 p-3 space-y-2">
              <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Claves cargadas en Vercel (respaldo)</p>
              {env.map((item) => (
                <p key={item.name} className="text-[11px] text-slate-600 dark:text-slate-400">
                  {item.label} — <code>{item.variable}</code> termina en <code>{item.hint}</code>
                </p>
              ))}
              <p className="text-[11px] text-slate-500">Se usan solo si fallan los proveedores de abajo. Para verlas o cambiarlas desde acá, importalas.</p>
              {groqImportable && (
                <button type="button" className={BTN_PRIMARY} onClick={() => void run(() => aiAdmin.importEnv(), 'Clave de Groq importada.')} disabled={busy}>
                  Importar la clave de Groq a este panel
                </button>
              )}
            </div>
          )}

          {providers.length === 0 && !form && (
            <p className="text-xs text-slate-500 dark:text-slate-400 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
              Todavía no hay proveedores en el panel. Agregá uno o importá la clave de Vercel.
            </p>
          )}

          <div className="space-y-3">
            {providers.map((provider, index) => {
              const result = tests[provider.id];
              return (
                <article key={provider.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        <span className="text-slate-400 mr-1.5">#{index + 1}</span>{provider.label}
                      </h3>
                      <p className="text-[11px] text-slate-500 break-all">{provider.model} · {provider.baseUrl}</p>
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                      <input type="checkbox" checked={provider.enabled} disabled={busy} onChange={(e) => void run(() => aiAdmin.setEnabled(provider.id, e.target.checked), e.target.checked ? 'Proveedor activado.' : 'Proveedor desactivado.')} />
                      Activo
                    </label>
                  </div>

                  <KeyRow provider={provider} />

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={BTN} onClick={() => setForm({ id: provider.id, label: provider.label, preset: provider.preset, baseUrl: provider.baseUrl, model: provider.model, reasoningEffort: provider.reasoningEffort, enabled: provider.enabled, priority: provider.priority, apiKey: '' })} disabled={busy}>
                      <Pencil className="w-3.5 h-3.5" />Editar o cambiar clave
                    </button>
                    <button type="button" className={BTN} onClick={() => void test(provider.id)} disabled={result === 'running'}>
                      {result === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}Probar
                    </button>
                    <button type="button" className={BTN} onClick={() => move(index, -1)} disabled={busy || index === 0} aria-label="Subir en la lista"><ArrowUp className="w-3.5 h-3.5" /></button>
                    <button type="button" className={BTN} onClick={() => move(index, 1)} disabled={busy || index === providers.length - 1} aria-label="Bajar en la lista"><ArrowDown className="w-3.5 h-3.5" /></button>
                    <button type="button" className={`${BTN} text-red-600 dark:text-red-400`} onClick={() => remove(provider)} disabled={busy}><Trash2 className="w-3.5 h-3.5" />Eliminar</button>
                  </div>

                  {result && result !== 'running' && (
                    <p role="status" className={`text-[11px] font-bold ${result.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {result.ok ? '✅' : '❌'} {result.message}{result.ms ? ` (${(result.ms / 1000).toFixed(1)} s)` : ''}
                    </p>
                  )}
                </article>
              );
            })}
          </div>

          {form ? (
            <ProviderForm key={form.id ?? 'new'} initial={form} editing={Boolean(form.id)} busy={busy} onSave={(input) => void save(input)} onCancel={() => setForm(null)} />
          ) : (
            <button type="button" className={BTN_PRIMARY} onClick={() => setForm(emptyForm())}>
              <Plus className="w-3.5 h-3.5" />Agregar proveedor
            </button>
          )}
        </>
      )}
    </div>
  );
};
