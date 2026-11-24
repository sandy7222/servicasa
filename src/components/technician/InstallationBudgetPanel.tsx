import React, { useMemo, useState } from 'react';
import { FileText, Plus, Sparkles, Trash2 } from 'lucide-react';
import logoTecniurbano from '../../assets/logo-tecniurbano.png';
import { buildQuoteNoteHtml } from '../../lib/installationQuoteNote';
import { buildComposition, buildCompositionHtml, pct } from '../../lib/installationComposition';
import { buildMaterialQuoteItems, type QuoteItemDraft } from '../../lib/installationQuoteItems';
import type { ProjectInput, ProjectResult } from '../../lib/installationProject';
import { computeTakeoff } from '../../lib/installationTakeoff';
import { priceMaterials, parsePastedPrices, type PriceEntry } from '../../lib/installationPrices';
import { calculateBudget, DEFAULT_BUDGET_RULES, type BudgetRules, type TaskInput, type ToolInput } from '../../lib/installationBudget';

/**
 * Presupuesto formal de obra (plan-proyecto-instalacion.md, Fase 3B): cómputo sugerido de materiales, dos listas de
 * precios, insumos, herramientas, mano de obra y precio final con anticipo. Es opcional y para obras completas.
 * Todo se guarda dentro del proyecto (`budget`).
 */

export type BudgetDraft = {
  /** Cantidades corregidas por el técnico (clave del cómputo → cantidad). */
  qty: Record<string, number>;
  listNames: [string, string];
  prices: [Record<string, PriceEntry>, Record<string, PriceEntry>];
  supplies: Array<{ name: string; amount: number }>;
  tools: ToolInput[];
  tasks: TaskInput[];
  officialRate: number;
  helperRate: number;
  visit: number;
  rules: Partial<BudgetRules>;
  /** Datos de la nota para el cliente. */
  clientName: string;
  clientDocument: string;
  clientAddress: string;
  scope: string;
  exclusions: string;
  showOptions: 'both' | 0 | 1;
};

export const EMPTY_BUDGET: BudgetDraft = {
  qty: {},
  listNames: ['Por precio', 'Por calidad / marca'],
  prices: [{}, {}],
  supplies: [],
  tools: [],
  tasks: [],
  officialRate: 0,
  helperRate: 0,
  visit: 0,
  rules: {},
  clientName: '',
  clientDocument: '',
  clientAddress: '',
  scope: '',
  exclusions: 'IVA, pintura y terminaciones de albañilería, y trámites ante la distribuidora.',
  showOptions: 'both',
};

const TYPICAL_TASKS = ['Replanteo y marcado', 'Canaletas y perforaciones', 'Caños, cajas y accesorios', 'Tapado', 'Pasado de conductores', 'Línea seccional', 'Tablero seccional', 'Mecanismos y plafones', 'Puesta a tierra', 'Ensayos y puesta en servicio'];

const money = (n: number) => n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v: string) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const input = 'w-full min-w-0 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs';

type Props = {
  project: ProjectInput & { name?: string };
  result: ProjectResult;
  value: BudgetDraft | undefined;
  onChange: (next: BudgetDraft) => void;
  technician?: { name: string; phone?: string; email?: string };
  /** Órdenes del técnico con presupuesto editable (borrador o sin presupuesto). */
  quoteOrders?: Array<{ id: string; title: string; clientName?: string }>;
  /** Pasa los ítems de material al borrador de la orden. */
  onPassToQuote?: (orderId: string, items: QuoteItemDraft[]) => Promise<void>;
};

export const InstallationBudgetPanel: React.FC<Props> = ({ project, result, value, onChange, technician, quoteOrders, onPassToQuote }) => {
  const budget: BudgetDraft = { ...EMPTY_BUDGET, ...value };
  const [pasting, setPasting] = useState<0 | 1 | null>(null);
  const [pasted, setPasted] = useState('');
  const [pasteMsg, setPasteMsg] = useState('');
  const [targetOrder, setTargetOrder] = useState('');
  const [targetOption, setTargetOption] = useState<0 | 1>(0);
  const [passing, setPassing] = useState(false);
  const set = (patch: Partial<BudgetDraft>) => onChange({ ...budget, ...patch });

  const takeoff = useMemo(() => computeTakeoff(project, result), [project, result]);
  const lines = takeoff.map((l) => ({ ...l, quantity: budget.qty[l.key] ?? l.quantity }));
  const priced = useMemo(
    () => priceMaterials(lines, [{ name: budget.listNames[0], prices: budget.prices[0] }, { name: budget.listNames[1], prices: budget.prices[1] }]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [takeoff, budget.qty, budget.prices, budget.listNames],
  );
  const suppliesTotal = budget.supplies.reduce((s, x) => s + x.amount, 0);
  const common = { supplies: suppliesTotal, tools: budget.tools, tasks: budget.tasks, officialHourlyRate: budget.officialRate, helperHourlyRate: budget.helperRate, visit: budget.visit, rules: budget.rules };
  const results = priced.totals.map((materials) => calculateBudget({ ...common, materials }));
  const rules = { ...DEFAULT_BUDGET_RULES, ...budget.rules };

  const setPrice = (list: 0 | 1, key: string, text: string) => {
    const next = { ...budget.prices[list] };
    if (text.trim() === '') delete next[key]; else next[key] = { unitPrice: num(text) };
    const prices: BudgetDraft['prices'] = list === 0 ? [next, budget.prices[1]] : [budget.prices[0], next];
    set({ prices });
  };
  const applyPaste = () => {
    if (pasting === null) return;
    const { prices, unmatched } = parsePastedPrices(pasted, takeoff);
    const merged = { ...budget.prices[pasting], ...prices };
    set({ prices: pasting === 0 ? [merged, budget.prices[1]] : [budget.prices[0], merged] });
    setPasteMsg(`${Object.keys(prices).length} precio(s) cargado(s)${unmatched.length ? `; ${unmatched.length} línea(s) no coinciden con ningún ítem` : ''}.`);
    setPasted('');
    setPasting(null);
  };
  const pctField = (label: string, rule: 'socialChargesRate' | 'overheadRate' | 'profitRate' | 'residualRate') => (
    <label className="text-[10px] text-slate-500">{label} %
      <input className={input} inputMode="decimal" value={Math.round(rules[rule] * 10000) / 100} onChange={(e) => set({ rules: { ...budget.rules, [rule]: num(e.target.value) / 100 } })} />
    </label>
  );
  const defaultScope = () => {
    const kinds = [...new Set(project.circuits.map((c) => c.kind))].join(', ');
    return [
      `Provisión de materiales y mano de obra para la instalación eléctrica${project.name ? ` de ${project.name}` : ''}: ${project.circuits.length} circuito(s) (${kinds}).`,
      'Tablero seccional con protecciones termomagnéticas e interruptor diferencial.',
      'Puesta a tierra y ensayos de puesta en servicio.',
    ].join('\n');
  };
  const compositions = results.map((r) => buildComposition(r, { officialRate: budget.officialRate, helperRate: budget.helperRate, rules: budget.rules, tools: budget.tools }));
  const openComposition = () => {
    const html = buildCompositionHtml({
      date: new Date().toLocaleDateString('es-AR'),
      projectName: project.name ?? '',
      rules: budget.rules,
      options: [0, 1].map((i) => ({ label: budget.listNames[i], composition: compositions[i], advance: results[i].advance, advanceShare: results[i].advanceShare })),
    });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };
  const openNote = () => {
    const idx = budget.showOptions === 'both' ? [0, 1] : [budget.showOptions];
    const html = buildQuoteNoteHtml({
      logoUrl: new URL(logoTecniurbano, window.location.href).href,
      date: new Date().toLocaleDateString('es-AR'),
      projectName: project.name ?? '',
      technician: technician ?? { name: '' },
      client: { name: budget.clientName, document: budget.clientDocument, address: budget.clientAddress },
      scope: (budget.scope.trim() || defaultScope()).split('\n').map((l) => l.trim()).filter(Boolean),
      exclusions: budget.exclusions,
      options: idx.map((i) => ({ label: budget.listNames[i], result: results[i] })),
    });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };
  const groups = [...new Set(priced.lines.map((l) => takeoff.find((t) => t.key === l.key)?.group ?? ''))];

  return (
    <section id="ip-presupuesto" className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-4 text-xs print:hidden" aria-label="Presupuesto de obra">
      <div>
        <h2 className="text-sm font-bold">Presupuesto de obra</h2>
        <p className="text-[11px] text-slate-500">Opcional, para obras completas. Las cantidades son una estimación a partir de los circuitos: corregilas con las medidas del plano. Los precios los cargás vos (no se buscan en tiendas).</p>
      </div>

      {/* Materiales */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold mr-auto">1. Materiales</h3>
          {([0, 1] as const).map((i) => (
            <button key={i} type="button" onClick={() => { setPasting(pasting === i ? null : i); setPasteMsg(''); }} className="rounded-lg border border-slate-200 px-2 py-1 font-bold">Pegar precios — {budget.listNames[i]}</button>
          ))}
        </div>
        {pasting !== null && (
          <div className="space-y-1">
            <textarea aria-label="Precios pegados" className={`${input} h-24`} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={'Una línea por ítem: descripción ; precio\nEj.: Cinta aisladora PVC 19 mm × 20 m ; 3.374,89'} />
            <button type="button" onClick={applyPaste} className="rounded-lg bg-teal-600 px-3 py-1 font-bold text-white">Cargar precios</button>
          </div>
        )}
        {pasteMsg && <p className="text-teal-700">{pasteMsg}</p>}
        <div className="grid grid-cols-2 gap-2 sm:max-w-md">
          {([0, 1] as const).map((i) => (
            <label key={i} className="text-[10px] text-slate-500">Nombre de la lista {i + 1}
              <input className={input} value={budget.listNames[i]} onChange={(e) => set({ listNames: i === 0 ? [e.target.value, budget.listNames[1]] : [budget.listNames[0], e.target.value] })} />
            </label>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead><tr className="text-[10px] text-slate-500"><th>Ítem</th><th>Cant.</th><th>Precio {budget.listNames[0]}</th><th>Subtotal</th><th>Precio {budget.listNames[1]}</th><th>Subtotal</th></tr></thead>
            <tbody>
              {groups.map((g) => (
                <React.Fragment key={g}>
                  <tr><td colSpan={6} className="pt-2 text-[10px] font-bold uppercase text-slate-500">{g}</td></tr>
                  {priced.lines.filter((l) => takeoff.find((t) => t.key === l.key)?.group === g).map((l) => {
                    const t = takeoff.find((x) => x.key === l.key)!;
                    return (
                      <tr key={l.key} className="border-t border-slate-100 dark:border-slate-800 align-top">
                        <td title={t.basis}>{l.description}<span className="block text-[10px] text-slate-400">{t.basis}</span></td>
                        <td className="w-20"><input aria-label={`Cantidad de ${l.description}`} className={input} inputMode="decimal" value={l.quantity} onChange={(e) => set({ qty: { ...budget.qty, [l.key]: num(e.target.value) } })} /> <span className="text-[10px] text-slate-400">{l.unit}</span></td>
                        {([0, 1] as const).map((i) => (
                          <React.Fragment key={i}>
                            <td className="w-28">
                              <input aria-label={`Precio de ${l.description} en ${budget.listNames[i]}`} className={input} inputMode="decimal" placeholder={l.options[i].borrowed ? String(l.options[i].unitPrice) : ''} value={budget.prices[i][l.key]?.unitPrice ?? ''} onChange={(e) => setPrice(i, l.key, e.target.value)} />
                            </td>
                            <td className="w-24 text-right">{l.options[i].missing ? <span className="text-rose-600">sin precio</span> : `${money(l.options[i].subtotal)}${l.options[i].borrowed ? '*' : ''}`}</td>
                          </React.Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-slate-300 font-bold"><td colSpan={3}>Total materiales</td><td className="text-right">{money(priced.totals[0])}</td><td></td><td className="text-right">{money(priced.totals[1])}</td></tr></tfoot>
          </table>
        </div>
        <p className="text-[10px] text-slate-500">* = precio tomado de la otra lista porque esta casa no lo tiene.{priced.missingKeys.length > 0 && <span className="text-rose-600"> Hay {priced.missingKeys.length} ítem(s) sin precio en ninguna lista: no suman.</span>}</p>
      </div>

      {/* Insumos */}
      <div className="space-y-2">
        <h3 className="font-bold">2. Insumos que se consumen (discos, mechas, grampas…) — se cobran como material</h3>
        {budget.supplies.map((s, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input aria-label="Insumo" className={input} value={s.name} onChange={(e) => set({ supplies: budget.supplies.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
            <input aria-label={`Importe de ${s.name || 'insumo'}`} className={`${input} w-32`} inputMode="decimal" value={s.amount} onChange={(e) => set({ supplies: budget.supplies.map((x, j) => (j === i ? { ...x, amount: num(e.target.value) } : x)) })} />
            <button type="button" aria-label="Quitar insumo" onClick={() => set({ supplies: budget.supplies.filter((_, j) => j !== i) })} className="text-rose-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => set({ supplies: [...budget.supplies, { name: '', amount: 0 }] })} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1 font-bold text-teal-700"><Plus className="w-3.5" />Agregar insumo</button>
        <p>Total insumos: <strong>{money(suppliesTotal)}</strong></p>
      </div>

      {/* Herramientas */}
      <div className="space-y-2">
        <h3 className="font-bold">3. Depreciación de herramientas (no se cobra la herramienta, solo su desgaste)</h3>
        {budget.tools.map((t, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-end">
            <label className="text-[10px] text-slate-500">Herramienta<input className={input} value={t.name} onChange={(e) => set({ tools: budget.tools.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></label>
            <label className="text-[10px] text-slate-500">Valor de origen<input className={input} inputMode="decimal" value={t.originValue} onChange={(e) => set({ tools: budget.tools.map((x, j) => (j === i ? { ...x, originValue: num(e.target.value) } : x)) })} /></label>
            <label className="text-[10px] text-slate-500">Horas en obra<input className={input} inputMode="decimal" value={t.hoursOnSite} onChange={(e) => set({ tools: budget.tools.map((x, j) => (j === i ? { ...x, hoursOnSite: num(e.target.value) } : x)) })} /></label>
            <button type="button" aria-label={`Quitar ${t.name || 'herramienta'}`} onClick={() => set({ tools: budget.tools.filter((_, j) => j !== i) })} className="pb-1 text-rose-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => set({ tools: [...budget.tools, { name: '', originValue: 0, hoursOnSite: 0 }] })} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1 font-bold text-teal-700"><Plus className="w-3.5" />Agregar herramienta</button>
        <p className="text-[10px] text-slate-500">Cuota anual = (valor − {Math.round(rules.residualRate * 100)} % residual) / {rules.usefulLifeYears} años. Cargo = cuota anual × horas en obra / {rules.hoursPerYear} h de uso al año.</p>
        <p>Depreciación total: <strong>{money(results[0].depreciation)}</strong></p>
      </div>

      {/* Mano de obra */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold mr-auto">4. Mano de obra</h3>
          {budget.tasks.length === 0 && <button type="button" onClick={() => set({ tasks: TYPICAL_TASKS.map((name) => ({ name, officialHours: 0, helperHours: 0 })) })} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1 font-bold"><Sparkles className="w-3.5" />Cargar tareas típicas</button>}
        </div>
        <div className="grid grid-cols-3 gap-2 sm:max-w-md">
          <label className="text-[10px] text-slate-500">Valor hora oficial<input className={input} inputMode="decimal" value={budget.officialRate} onChange={(e) => set({ officialRate: num(e.target.value) })} /></label>
          <label className="text-[10px] text-slate-500">Valor hora ayudante<input className={input} inputMode="decimal" value={budget.helperRate} onChange={(e) => set({ helperRate: num(e.target.value) })} /></label>
          <label className="text-[10px] text-slate-500">Visita (fija)<input className={input} inputMode="decimal" value={budget.visit} onChange={(e) => set({ visit: num(e.target.value) })} /></label>
        </div>
        {budget.tasks.map((t, i) => (
          <div key={i} className="grid grid-cols-[3fr_1fr_1fr_auto] gap-2 items-end">
            <label className="text-[10px] text-slate-500">Tarea<input className={input} value={t.name} onChange={(e) => set({ tasks: budget.tasks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} /></label>
            <label className="text-[10px] text-slate-500">h oficial<input aria-label={`Horas de oficial en ${t.name}`} className={input} inputMode="decimal" value={t.officialHours} onChange={(e) => set({ tasks: budget.tasks.map((x, j) => (j === i ? { ...x, officialHours: num(e.target.value) } : x)) })} /></label>
            <label className="text-[10px] text-slate-500">h ayudante<input aria-label={`Horas de ayudante en ${t.name}`} className={input} inputMode="decimal" value={t.helperHours} onChange={(e) => set({ tasks: budget.tasks.map((x, j) => (j === i ? { ...x, helperHours: num(e.target.value) } : x)) })} /></label>
            <button type="button" aria-label={`Quitar ${t.name || 'tarea'}`} onClick={() => set({ tasks: budget.tasks.filter((_, j) => j !== i) })} className="pb-1 text-rose-600"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        <button type="button" onClick={() => set({ tasks: [...budget.tasks, { name: '', officialHours: 0, helperHours: 0 }] })} className="inline-flex items-center gap-1 rounded-lg border border-teal-200 px-3 py-1 font-bold text-teal-700"><Plus className="w-3.5" />Agregar tarea</button>
        <p>Horas: <strong>{results[0].officialHours} h oficial</strong> + <strong>{results[0].helperHours} h ayudante</strong> · plazo estimado: <strong>{results[0].days} día(s)</strong> de {rules.hoursPerDay} h.</p>
      </div>

      {/* Porcentajes */}
      <div className="space-y-2">
        <h3 className="font-bold">5. Porcentajes (editables)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:max-w-xl">
          {pctField('Cargas sociales', 'socialChargesRate')}
          {pctField('Gastos generales', 'overheadRate')}
          {pctField('Beneficio', 'profitRate')}
          {pctField('Valor residual herramientas', 'residualRate')}
        </div>
      </div>

      {/* Precio */}
      <div className="space-y-2">
        <h3 className="font-bold">6. Precio de la obra (sin IVA)</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left">
            <thead><tr className="text-[10px] text-slate-500"><th>Concepto</th><th className="text-right">{budget.listNames[0]}</th><th className="text-right">{budget.listNames[1]}</th></tr></thead>
            <tbody>
              {([
                ['Materiales', 'materials'], ['Insumos', 'supplies'], ['Depreciación de herramientas', 'depreciation'],
                ['Mano de obra básica', 'laborBasic'], ['Cargas sociales', 'socialCharges'], ['Visita de presupuesto', 'visit'],
                ['Costo directo', 'directCost'], ['Gastos generales', 'overhead'], ['Beneficio', 'profit'],
              ] as const).map(([label, k]) => (
                <tr key={k} className={`border-t border-slate-100 dark:border-slate-800 ${k === 'directCost' ? 'font-bold' : ''}`}><td>{label}</td><td className="text-right">{money(results[0][k])}</td><td className="text-right">{money(results[1][k])}</td></tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold text-sm"><td>PRECIO TOTAL</td><td className="text-right">{money(results[0].total)}</td><td className="text-right">{money(results[1].total)}</td></tr>
              <tr className="border-t border-slate-100"><td>Anticipo (visita + {Math.round(rules.advanceMaterialsRate * 100)} % de materiales e insumos + depreciación)</td><td className="text-right">{money(results[0].advance)} ({(results[0].advanceShare * 100).toFixed(1).replace('.', ',')} %)</td><td className="text-right">{money(results[1].advance)} ({(results[1].advanceShare * 100).toFixed(1).replace('.', ',')} %)</td></tr>
              <tr className="border-t border-slate-100"><td>Saldo al terminar</td><td className="text-right">{money(results[0].balance)}</td><td className="text-right">{money(results[1].balance)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Composición interna del precio */}
      <details className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
        <summary className="cursor-pointer font-bold">Composición del precio (uso interno, no es para el cliente)</summary>
        <div className="mt-3 space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead><tr className="text-[10px] text-slate-500"><th>Concepto</th><th className="text-right">{budget.listNames[0]}</th><th className="text-right">%</th><th className="text-right">{budget.listNames[1]}</th><th className="text-right">%</th></tr></thead>
              <tbody>
                {compositions[0].rows.map((row, i) => (
                  <tr key={row.label} className={`border-t border-slate-100 dark:border-slate-800 ${row.kind !== 'row' ? 'font-bold' : ''}`}>
                    <td>{row.label}</td>
                    <td className="text-right">{money(row.amount)}</td><td className="text-right">{pct(row.share)}</td>
                    <td className="text-right">{money(compositions[1].rows[i].amount)}</td><td className="text-right">{pct(compositions[1].rows[i].share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <p className="font-bold">A dónde va cada peso del precio</p>
            <ul className="mt-1 space-y-0.5">
              {compositions[0].groups.map((g, i) => (
                <li key={g.label} className="flex flex-wrap gap-x-3"><span className="min-w-52">{g.label}</span><span>{pct(g.share)} · {money(g.amount)}</span><span className="text-slate-500">{pct(compositions[1].groups[i].share)} · {money(compositions[1].groups[i].amount)}</span></li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-slate-500">Gastos generales y beneficio suman {pct(compositions[0].markup.shareOfTotal)} del precio ({pct(compositions[0].markup.overDirect)} sobre el costo directo) en {budget.listNames[0]}.</p>
          </div>
          {compositions[0].tools.length > 0 && (
            <div className="overflow-x-auto">
              <p className="font-bold">Depreciación por herramienta</p>
              <table className="w-full min-w-[420px] text-left">
                <thead><tr className="text-[10px] text-slate-500"><th>Herramienta</th><th className="text-right">Valor de origen</th><th className="text-right">Cuota anual</th><th className="text-right">Horas</th><th className="text-right">Cargo a la obra</th></tr></thead>
                <tbody>{compositions[0].tools.map((t, i) => <tr key={i} className="border-t border-slate-100 dark:border-slate-800"><td>{t.name || '—'}</td><td className="text-right">{money(t.originValue)}</td><td className="text-right">{money(t.annualQuota)}</td><td className="text-right">{t.hoursOnSite}</td><td className="text-right">{money(t.charge)}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <button type="button" onClick={openComposition} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 font-bold"><FileText className="w-3.5" />Abrir composición para imprimir / guardar PDF</button>
        </div>
      </details>

      {/* Nota para el cliente */}
      <div className="space-y-2">
        <h3 className="font-bold">7. Nota de presupuesto para el cliente (PDF)</h3>
        <div className="grid sm:grid-cols-3 gap-2">
          <label className="text-[10px] text-slate-500">Cliente<input className={input} value={budget.clientName} onChange={(e) => set({ clientName: e.target.value })} /></label>
          <label className="text-[10px] text-slate-500">CUIT / DNI<input className={input} value={budget.clientDocument} onChange={(e) => set({ clientDocument: e.target.value })} /></label>
          <label className="text-[10px] text-slate-500">Domicilio de la obra<input className={input} value={budget.clientAddress} onChange={(e) => set({ clientAddress: e.target.value })} /></label>
        </div>
        <label className="block text-[10px] text-slate-500">Alcance (una línea por punto; si lo dejás vacío se arma uno)
          <textarea className={`${input} h-20`} value={budget.scope} placeholder={defaultScope()} onChange={(e) => set({ scope: e.target.value })} />
        </label>
        <label className="block text-[10px] text-slate-500">No incluye
          <input className={input} value={budget.exclusions} onChange={(e) => set({ exclusions: e.target.value })} />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[10px] text-slate-500">Mostrar
            <select className={input} value={String(budget.showOptions)} onChange={(e) => set({ showOptions: e.target.value === 'both' ? 'both' : (Number(e.target.value) as 0 | 1) })}>
              <option value="both">Las dos opciones</option>
              <option value="0">Solo {budget.listNames[0]}</option>
              <option value="1">Solo {budget.listNames[1]}</option>
            </select>
          </label>
          <button type="button" onClick={openNote} className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 font-bold text-white"><FileText className="w-3.5" />Abrir nota para imprimir / guardar PDF</button>
        </div>
        <p className="text-[10px] text-slate-500">Se abre en otra pestaña: elegí "Guardar como PDF" en la impresora. Lleva el logo de TecniUrbano y la garantía de la plataforma.</p>
      </div>

      {/* Pasar a presupuesto de una orden */}
      {onPassToQuote && (
        <div className="space-y-2" aria-label="Pasar a presupuesto">
          <h3 className="font-bold">8. Pasar los materiales al presupuesto de una orden</h3>
          <p className="text-[10px] text-slate-500">Crea los materiales e insumos como ítems del borrador de la orden. No se envía nada al cliente. La mano de obra la elegís vos desde el catálogo, en el presupuesto de la orden.</p>
          {(quoteOrders ?? []).length === 0 ? (
            <p className="text-slate-500">No tenés órdenes con un presupuesto que se pueda editar ahora.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[10px] text-slate-500">Orden
                <select className={input} value={targetOrder} onChange={(e) => setTargetOrder(e.target.value)}>
                  <option value="">Elegí una orden</option>
                  {(quoteOrders ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}{o.clientName ? ` — ${o.clientName}` : ''}</option>)}
                </select>
              </label>
              <label className="text-[10px] text-slate-500">Precios de
                <select className={input} value={targetOption} onChange={(e) => setTargetOption(Number(e.target.value) as 0 | 1)}>
                  <option value={0}>{budget.listNames[0]}</option>
                  <option value={1}>{budget.listNames[1]}</option>
                </select>
              </label>
              <button
                type="button"
                disabled={!targetOrder || passing}
                onClick={async () => {
                  setPassing(true);
                  try { await onPassToQuote(targetOrder, buildMaterialQuoteItems(priced.lines, targetOption, budget.supplies)); } finally { setPassing(false); }
                }}
                className="rounded-lg bg-teal-600 px-3 py-2 font-bold text-white disabled:opacity-60"
              >Pasar materiales al presupuesto</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
