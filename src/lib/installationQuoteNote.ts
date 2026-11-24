import type { BudgetResult } from './installationBudget';

/**
 * Nota de presupuesto de obra para el cliente (plan-proyecto-instalacion.md, Fase 3B.7).
 * Genera el HTML listo para imprimir o guardar como PDF (mismo formato que la nota del TP N° 1): logo de TecniUrbano,
 * datos del técnico y del cliente, alcance, detalle por opción, condiciones y garantía.
 *
 * Es una función pura: no abre ventanas ni toca el DOM (eso lo hace la pantalla).
 */

/**
 * Garantía con la redacción de los Términos (src/lib/legalTerms.ts, secciones 4 y 5). La ejecución del trabajo es
 * responsabilidad del técnico independiente; TecniUrbano respalda con sus canales de reclamo y garantía.
 */
export const QUOTE_WARRANTY_TEXT =
  'Obra respaldada por TecniUrbano: si el trabajo no queda bien, se soluciona sin cargo dentro de los 30 días posteriores a su finalización. El reclamo se puede abrir hasta 48 horas después de finalizado el servicio, desde la cuenta del cliente en la plataforma. La ejecución del trabajo es responsabilidad del técnico independiente que lo realiza (Términos y Condiciones, secciones 4 y 5).';

export type QuoteNoteOption = { label: string; result: BudgetResult };

export type QuoteNoteData = {
  logoUrl: string;
  /** Fecha de la nota, ya formateada (ej.: 24/11/2026). */
  date: string;
  projectName: string;
  technician: { name: string; phone?: string; email?: string };
  client: { name?: string; document?: string; address?: string };
  scope: string[];
  exclusions: string;
  options: QuoteNoteOption[];
  validityDays?: number;
};

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export const arsMoney = (n: number): string => `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pct = (n: number) => `${(n * 100).toFixed(1).replace('.', ',')} %`;
const blank = (s: string | undefined, line: string) => (s && s.trim() ? esc(s.trim()) : line);

export function buildQuoteNoteHtml(d: QuoteNoteData): string {
  const opts = d.options;
  const head = opts.map((o) => `<th>${esc(o.label)}</th>`).join('');
  const row = (label: string, pick: (r: BudgetResult) => string, cls = '') =>
    `<tr class="${cls}"><td>${label}</td>${opts.map((o) => `<td class="n">${pick(o.result)}</td>`).join('')}</tr>`;
  const validity = d.validityDays ?? 10;
  const days = Math.max(...opts.map((o) => o.result.days), 0);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Nota de presupuesto — ${esc(d.projectName || 'Obra')}</title>
<style>
@page { size: A4; margin: 14mm; }
body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #111; }
.top { display: flex; align-items: center; justify-content: space-between; gap: 6mm; }
.top img { height: 20mm; }
h1 { font-size: 15pt; margin: 0; flex: 1; }
.num { text-align: right; font-size: 9pt; }
.meta { margin: 3mm 0; border-collapse: collapse; }
.meta td { padding: 0.6mm 2mm 0.6mm 0; vertical-align: top; }
.meta td.k { width: 30mm; font-weight: bold; }
h2 { font-size: 10.5pt; margin: 4mm 0 1.5mm; border-bottom: 1px solid #999; padding-bottom: 0.8mm; }
ul { margin: 1mm 0 1mm 5mm; padding: 0; } li { margin: 0.6mm 0; }
table.p { border-collapse: collapse; width: 100%; margin: 1.5mm 0; font-size: 8.8pt; }
table.p th, table.p td { border: 1px solid #888; padding: 0.9mm 1.6mm; }
table.p th { background: #eee; }
table.p tr { page-break-inside: avoid; }
table.p td.n { text-align: right; white-space: nowrap; }
table.p tr.sub td { background: #f2f2f2; font-weight: bold; }
table.p tr.tot td { background: #dfe6f1; font-weight: bold; font-size: 9.6pt; }
.firmas { display: flex; justify-content: space-between; margin-top: 14mm; }
.firmas div { width: 46%; border-top: 1px solid #333; padding-top: 1mm; text-align: center; font-size: 8.6pt; }
.warranty { margin-top: 3mm; padding: 2mm 3mm; border: 1px solid #999; background: #f7f7f7; font-size: 8.8pt; }
</style></head><body>
<div class="top"><img src="${esc(d.logoUrl)}" alt="TecniUrbano"><h1>Nota de presupuesto</h1><div class="num"><b>${esc(d.date)}</b></div></div>
<table class="meta">
<tr><td class="k">Prestador:</td><td>${esc(d.technician.name)}</td></tr>
<tr><td class="k">Contacto:</td><td>Teléfono: ${blank(d.technician.phone, '______________')} &nbsp; Correo: ${blank(d.technician.email, '______________________')}</td></tr>
<tr><td class="k">Cliente:</td><td>${blank(d.client.name, '______________________________')} &nbsp; CUIT/DNI: ${blank(d.client.document, '______________')}</td></tr>
<tr><td class="k">Obra:</td><td>${blank(d.client.address, '______________________________')}${d.projectName && !(d.client.address ?? '').includes(d.projectName) ? ` — ${esc(d.projectName)}` : ''}</td></tr>
</table>
<h2>Alcance de los trabajos</h2>
<ul>${d.scope.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
<h2>Detalle del presupuesto</h2>
<table class="p"><tr><th>Concepto</th>${head}</tr>
${row('Materiales', (r) => arsMoney(r.materials))}
${row('Insumos', (r) => arsMoney(r.supplies))}
${row('Depreciación de herramientas', (r) => arsMoney(r.depreciation))}
${row(`Mano de obra (${opts[0]?.result.officialHours ?? 0} h oficial + ${opts[0]?.result.helperHours ?? 0} h ayudante, con cargas sociales)`, (r) => arsMoney(r.laborWithCharges))}
${row('Visita de presupuesto', (r) => arsMoney(r.visit))}
${row('Costo directo', (r) => arsMoney(r.directCost), 'sub')}
${row('Gastos generales', (r) => arsMoney(r.overhead))}
${row('Beneficio', (r) => arsMoney(r.profit))}
${row('PRECIO TOTAL (sin IVA)', (r) => arsMoney(r.total), 'tot')}
${row('Anticipo al aceptar', (r) => `${arsMoney(r.advance)} (${pct(r.advanceShare)})`)}
${row('Saldo al terminar', (r) => arsMoney(r.balance))}
</table>
<h2>Condiciones</h2>
<ul>
<li><b>Precios:</b> en pesos argentinos, <b>sin IVA</b>. Los materiales pueden variar hasta su compra.</li>
<li><b>Validez de la oferta:</b> ${validity} días corridos desde la fecha de esta nota.</li>
<li><b>Plazo estimado de obra:</b> ${days} día(s) hábil(es), a partir del cobro del anticipo y de la disponibilidad de los materiales.</li>
${d.exclusions.trim() ? `<li><b>No incluye:</b> ${esc(d.exclusions.trim())}</li>` : ''}
<li><b>Forma de pago:</b> anticipo al aceptar el presupuesto (visita, 50 % de materiales e insumos y depreciación de herramientas) y saldo al terminar y poner en servicio la instalación.</li>
</ul>
<div class="warranty"><b>Garantía.</b> ${esc(QUOTE_WARRANTY_TEXT)}</div>
<div class="firmas"><div>Por el prestador<br>${esc(d.technician.name)}</div><div>Conforme el cliente<br>Firma, aclaración y fecha</div></div>
</body></html>`;
}
