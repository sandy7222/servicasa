import { toolDepreciation, round2, DEFAULT_BUDGET_RULES, type BudgetResult, type BudgetRules, type ToolInput } from './installationBudget';
import { arsMoney, esc } from './installationQuoteNote';

/**
 * Composición del precio de la obra, de USO INTERNO del técnico (plan-proyecto-instalacion.md, 3B.7): cuánto cuesta
 * hacer la obra, cuánto es gastos generales y beneficio, y a dónde va cada peso del precio. No se le muestra al
 * cliente (la nota para el cliente es otra salida). Reproduce la composición del TP N° 1.
 */

export type CompositionRow = { kind: 'row' | 'sub' | 'tot'; label: string; amount: number; share: number };
export type CompositionGroup = { label: string; amount: number; share: number };
export type ToolDepreciationRow = { name: string; originValue: number; hoursOnSite: number; annualQuota: number; charge: number };

export type Composition = {
  rows: CompositionRow[];
  groups: CompositionGroup[];
  /** Gastos generales + beneficio: lo que se suma al costo directo. */
  markup: { amount: number; shareOfTotal: number; overDirect: number };
  tools: ToolDepreciationRow[];
};

export type CompositionContext = { officialRate: number; helperRate: number; rules?: Partial<BudgetRules>; tools?: ToolInput[] };

const ars = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 2 });
export const pct = (n: number): string => `${(n * 100).toFixed(1).replace('.', ',')} %`;

export function buildComposition(r: BudgetResult, ctx: CompositionContext): Composition {
  const rules = { ...DEFAULT_BUDGET_RULES, ...ctx.rules };
  const share = (n: number) => (r.total > 0 ? n / r.total : 0);
  const line = (kind: CompositionRow['kind'], label: string, amount: number): CompositionRow => ({ kind, label, amount, share: share(amount) });
  const markupAmount = round2(r.overhead + r.profit);

  const rows: CompositionRow[] = [
    line('row', 'Materiales (precio de compra)', r.materials),
    line('row', 'Insumos (discos, mechas, fijación)', r.supplies),
    line('row', 'Depreciación de herramientas', r.depreciation),
    line('row', `Mano de obra básica (${r.officialHours} h de oficial × $ ${ars(ctx.officialRate)} + ${r.helperHours} h de ayudante × $ ${ars(ctx.helperRate)})`, r.laborBasic),
    line('row', `Cargas sociales y adicionales (${Math.round(rules.socialChargesRate * 100)} % del básico)`, r.socialCharges),
    line('row', 'Visita técnica y cálculo del presupuesto (monto fijo)', r.visit),
    line('sub', 'COSTO DIRECTO (lo que cuesta hacer la obra)', r.directCost),
    line('row', `Gastos generales (${Math.round(rules.overheadRate * 100)} % del costo directo)`, r.overhead),
    line('row', `Beneficio (${Math.round(rules.profitRate * 100)} % del costo directo + gastos generales)`, r.profit),
    line('tot', 'PRECIO TOTAL (sin IVA)', r.total),
  ];
  const groups: CompositionGroup[] = [
    { label: 'Materiales e insumos', amount: round2(r.materials + r.supplies) },
    { label: 'Mano de obra y visita (con cargas)', amount: round2(r.laborWithCharges + r.visit) },
    { label: 'Depreciación de herramientas', amount: r.depreciation },
    { label: 'Gastos generales y beneficio', amount: markupAmount },
  ].map((g) => ({ ...g, share: share(g.amount) }));

  return {
    rows,
    groups,
    markup: { amount: markupAmount, shareOfTotal: share(markupAmount), overDirect: r.directCost > 0 ? markupAmount / r.directCost : 0 },
    tools: (ctx.tools ?? []).map((t) => {
      const d = toolDepreciation(t, rules);
      return { name: t.name, originValue: t.originValue, hoursOnSite: t.hoursOnSite, annualQuota: round2(d.annualQuota), charge: round2(d.charge) };
    }),
  };
}

export type CompositionDocData = {
  date: string;
  projectName: string;
  options: Array<{ label: string; composition: Composition; advance: number; advanceShare: number }>;
  rules?: Partial<BudgetRules>;
};

/** HTML imprimible de la composición (documento interno: lo dice en el encabezado). */
export function buildCompositionHtml(d: CompositionDocData): string {
  const rules = { ...DEFAULT_BUDGET_RULES, ...d.rules };
  const head = d.options.map((o) => `<th colspan="2">${esc(o.label)}</th>`).join('');
  const cell = (a: number, s: number) => `<td class="n">${arsMoney(a)}</td><td class="n">${pct(s)}</td>`;
  const first = d.options[0]?.composition;
  const body = (first?.rows ?? []).map((row, i) =>
    `<tr class="${row.kind}"><td>${esc(row.label)}</td>${d.options.map((o) => cell(o.composition.rows[i].amount, o.composition.rows[i].share)).join('')}</tr>`).join('');
  const groups = (first?.groups ?? []).map((g, i) =>
    `<tr><td>${esc(g.label)}</td>${d.options.map((o) => cell(o.composition.groups[i].amount, o.composition.groups[i].share)).join('')}</tr>`).join('');
  const tools = (first?.tools ?? []).map((t) =>
    `<tr><td>${esc(t.name || '—')}</td><td class="n">${arsMoney(t.originValue)}</td><td class="n">${arsMoney(t.annualQuota)}</td><td class="n">${t.hoursOnSite}</td><td class="n">${arsMoney(t.charge)}</td></tr>`).join('');
  const markup = d.options.map((o) => `<li><b>${esc(o.label)}:</b> gastos generales y beneficio suman ${arsMoney(o.composition.markup.amount)} (${pct(o.composition.markup.shareOfTotal)} del precio, ${pct(o.composition.markup.overDirect)} sobre el costo directo). Anticipo: ${arsMoney(o.advance)} (${pct(o.advanceShare)} del precio).</li>`).join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Composición del precio — ${esc(d.projectName || 'Obra')}</title>
<style>
@page { size: A4; margin: 14mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #111; }
h1 { font-size: 14pt; margin: 0 0 1mm; } .sub { color: #555; font-size: 9pt; margin-bottom: 3mm; }
h2 { font-size: 10.5pt; margin: 4mm 0 1.5mm; border-bottom: 1px solid #999; padding-bottom: 0.8mm; }
table { border-collapse: collapse; width: 100%; font-size: 8.8pt; margin: 1.5mm 0; }
th, td { border: 1px solid #888; padding: 0.9mm 1.6mm; } th { background: #eee; }
td.n { text-align: right; white-space: nowrap; } tr { page-break-inside: avoid; }
tr.sub td { background: #f2f2f2; font-weight: bold; } tr.tot td { background: #dfe6f1; font-weight: bold; }
.warn { border: 1px solid #b45309; background: #fffbeb; padding: 1.5mm 3mm; font-size: 8.8pt; }
ul { margin: 1mm 0 1mm 5mm; padding: 0; } li { margin: 0.6mm 0; }
</style></head><body>
<h1>Composición del precio de la obra</h1>
<div class="sub">${esc(d.projectName || 'Obra')} — ${esc(d.date)}</div>
<p class="warn"><b>Documento interno.</b> Muestra cuánto cuesta hacer la obra y cuánto es gastos generales y beneficio. No es para entregar al cliente: para eso está la nota de presupuesto.</p>
<h2>Cómo se arma el precio</h2>
<table><tr><th rowspan="2">Concepto</th>${head}</tr><tr>${d.options.map(() => '<th>Importe</th><th>% del precio</th>').join('')}</tr>${body}</table>
<h2>A dónde va cada peso del precio</h2>
<table><tr><th>Grupo</th>${head}</tr>${groups}</table>
<ul>${markup}</ul>
<h2>Depreciación de herramientas</h2>
<table><tr><th>Herramienta</th><th>Valor de origen</th><th>Cuota anual</th><th>Horas en obra</th><th>Cargo a la obra</th></tr>${tools || '<tr><td colspan="5">Sin herramientas cargadas.</td></tr>'}</table>
<p style="font-size:8.6pt;color:#333">Cuota anual = (valor de origen − ${Math.round(rules.residualRate * 100)} % de valor residual) / ${rules.usefulLifeYears} años. Cargo a la obra = cuota anual × horas en obra / ${rules.hoursPerYear} h de uso al año (método lineal).</p>
</body></html>`;
}
