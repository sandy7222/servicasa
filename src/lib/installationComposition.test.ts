import { describe, expect, it } from 'vitest';
import { calculateBudget } from './installationBudget';
import { buildComposition, buildCompositionHtml, pct } from './installationComposition';

// Caso 2 del TP N° 1, opción 1.
const tools = [
  { name: 'Amoladora', originValue: 483644.9, hoursOnSite: 16 },
  { name: 'Rotomartillo', originValue: 463649, hoursOnSite: 12 },
];
const full = calculateBudget({
  materials: 787626.73, supplies: 94710, officialHourlyRate: 7828, helperHourlyRate: 5696, visit: 60000,
  tools: [...tools, { name: 'Telurímetro', originValue: 399644, hoursOnSite: 2 }, { name: 'Multímetro', originValue: 47564, hoursOnSite: 6 }, { name: 'Pinza pelacables', originValue: 17037, hoursOnSite: 10 }, { name: 'Cinta pasacable', originValue: 8019.9, hoursOnSite: 8 }, { name: 'Buscapolo', originValue: 2740, hoursOnSite: 6 }],
  tasks: [{ name: 'Obra', officialHours: 78, helperHours: 66 }],
});
const ctx = { officialRate: 7828, helperRate: 5696, tools };

describe('buildComposition — caso 2 del TP N° 1', () => {
  const c = buildComposition(full, ctx);

  it('cada renglón con su importe y su porcentaje del precio total', () => {
    const by = (label: string) => c.rows.find((r) => r.label.startsWith(label))!;
    expect(by('Materiales').amount).toBe(787626.73);
    expect(pct(by('Materiales').share)).toBe('26,8 %');
    expect(by('COSTO DIRECTO').amount).toBe(2428703.72);
    expect(by('Gastos generales').amount).toBe(242870.37);
    expect(by('Beneficio').amount).toBe(267157.41);
    expect(by('PRECIO TOTAL').amount).toBe(2938731.5);
    expect(by('PRECIO TOTAL').share).toBe(1);
  });

  it('los renglones previos al costo directo lo suman y el detalle de la mano de obra dice las horas y los valores', () => {
    const direct = c.rows.slice(0, 6).reduce((s, r) => s + r.amount, 0);
    expect(Math.round(direct * 100) / 100).toBe(2428703.72);
    expect(c.rows[3].label).toBe('Mano de obra básica (78 h de oficial × $ 7.828 + 66 h de ayudante × $ 5.696)');
    expect(c.rows[4].label).toContain('50 %');
  });

  it('"a dónde va cada peso": los cuatro grupos suman el precio y gastos + beneficio es 17,4 %', () => {
    expect(c.groups.map((g) => g.amount)).toEqual([882336.73, 1539780, 6586.99, 510027.78]);
    expect(Math.round(c.groups.reduce((s, g) => s + g.amount, 0) * 100) / 100).toBe(2938731.5);
    expect(pct(c.markup.shareOfTotal)).toBe('17,4 %');
    expect(pct(c.markup.overDirect)).toBe('21,0 %'); // 1,10 × 1,10 − 1
  });

  it('detalle de depreciación por herramienta (cuota anual y cargo a la obra)', () => {
    expect(c.tools[0]).toEqual({ name: 'Amoladora', originValue: 483644.9, hoursOnSite: 16, annualQuota: 87056.08, charge: 3482.24 });
  });

  it('con precio cero no divide por cero', () => {
    const empty = buildComposition(calculateBudget({ materials: 0, supplies: 0, tools: [], tasks: [], officialHourlyRate: 0, helperHourlyRate: 0, visit: 0 }), { officialRate: 0, helperRate: 0 });
    expect(empty.rows.every((r) => r.share === 0)).toBe(true);
    expect(empty.markup.overDirect).toBe(0);
  });
});

describe('buildCompositionHtml', () => {
  const c = buildComposition(full, ctx);
  const html = buildCompositionHtml({ date: '24/11/2026', projectName: '<b>Obra</b>', options: [{ label: 'Opción 1', composition: c, advance: full.advance, advanceShare: full.advanceShare }, { label: 'Opción 2', composition: c, advance: full.advance, advanceShare: full.advanceShare }] });
  it('dice que es un documento interno y no para el cliente', () => {
    expect(html).toContain('Documento interno');
    expect(html).toContain('No es para entregar al cliente');
  });
  it('muestra los totales, el anticipo y la depreciación, con dos columnas de opciones', () => {
    expect(html).toContain('$ 2.938.731,50');
    expect(html).toContain('26,8 %');
    expect(html).toContain('Anticipo: $ 507.755,35 (17,3 %');
    expect(html).toContain('Amoladora');
    expect(html).toContain('<th colspan="2">Opción 1</th><th colspan="2">Opción 2</th>');
  });
  it('escapa el texto del usuario', () => {
    expect(html).not.toContain('<b>Obra</b>');
    expect(html).toContain('&lt;b&gt;Obra&lt;/b&gt;');
  });
});
