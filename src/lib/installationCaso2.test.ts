import { describe, expect, it } from 'vitest';
import { calculateBudget, type BudgetInput } from './installationBudget';
import { priceMaterials, type PriceEntry, type PriceList } from './installationPrices';
import { arsMoney, buildQuoteNoteHtml } from './installationQuoteNote';

/**
 * Oráculo de punta a punta (plan-proyecto-instalacion.md, 3B.8): el caso 2 del TP N° 1 pasa por listas de precios →
 * precio de la obra → nota para el cliente, y tiene que dar los números de la memoria al centavo.
 */

const rows: Array<[string, number, number | null, number | null]> = [
  ['cable-2.5', 278, 1055.99, null], ['cable-4', 36, 1679.15, null],
  ['pipe-20', 30, 2569.28, null], ['pipe-25', 4, 3628.96, null],
  ['conn-20', 40, 194.23, 277], ['conn-25', 2, 414.27, 590], ['coupling-20', 20, 144.74, 206], ['coupling-25', 3, 208.63, 297],
  ['bend-20', 30, 433.72, 618], ['bend-25', 2, 556, 792],
  ['box-oct', 5, 1112.96, 1585], ['box-rect', 18, 464.64, 794],
  ['mech-switch', 4, 1092.86, 1318], ['mech-comb', 2, 1330.81, 1605], ['mech-outlet-10', 11, 1196.7, 1444], ['mech-outlet-20', 1, 3993.04, 4817], ['mech-cover', 18, 748.11, 903],
  ['luminaire', 5, null, 12625],
  ['itm-10', 1, 8619.83, 24028], ['itm-16', 2, 8619.83, 24028], ['itm-25', 1, 8619.83, 24028], ['rcd', 1, 36059.62, 55595], ['comb', 1, null, 80169],
  ['ground-bar', 1, 5954.11, 10812], ['ground-rod', 1, 21901.35, 29443], ['ground-cable', 6, 1679.15, null],
  ['tape', 2, 3374.89, 2725], ['ties', 1, 9110.17, 4940],
];
const lines = rows.map(([key, quantity]) => ({ key, description: key, unit: 'u', quantity }));
const list = (name: string, col: 2 | 3, lump: Record<string, number> = {}): PriceList => ({
  name,
  prices: Object.fromEntries(
    rows.flatMap((r): Array<[string, PriceEntry]> => (lump[r[0]] !== undefined ? [[r[0], { lumpTotal: lump[r[0]] }]] : r[col] === null ? [] : [[r[0], { unitPrice: r[col] as number }]])),
  ),
});
// La casa 2 vende cable por rollo cerrado: subtotales reales de lo que hay que comprar.
const house1 = list('Por precio', 2);
const house2 = list('Por calidad', 3, { 'cable-2.5': 422148, 'cable-4': 120418, 'ground-cable': 27368 });

const tools = [
  { name: 'Amoladora', originValue: 483644.9, hoursOnSite: 16 },
  { name: 'Rotomartillo', originValue: 463649, hoursOnSite: 12 },
  { name: 'Telurímetro', originValue: 399644, hoursOnSite: 2 },
  { name: 'Multímetro', originValue: 47564, hoursOnSite: 6 },
  { name: 'Pinza pelacables', originValue: 17037, hoursOnSite: 10 },
  { name: 'Cinta pasacable', originValue: 8019.9, hoursOnSite: 8 },
  { name: 'Buscapolo', originValue: 2740, hoursOnSite: 6 },
];
const tasks = [
  { name: 'Replanteo y marcado', officialHours: 4, helperHours: 2 },
  { name: 'Canaletas y perforaciones', officialHours: 8, helperHours: 16 },
  { name: 'Caños, cajas y accesorios', officialHours: 20, helperHours: 10 },
  { name: 'Tapado', officialHours: 6, helperHours: 12 },
  { name: 'Pasado de conductores', officialHours: 8, helperHours: 8 },
  { name: 'Línea seccional', officialHours: 6, helperHours: 6 },
  { name: 'Tablero seccional', officialHours: 8, helperHours: 4 },
  { name: 'Mecanismos y plafones', officialHours: 10, helperHours: 4 },
  { name: 'Puesta a tierra', officialHours: 4, helperHours: 4 },
  { name: 'Ensayos y puesta en servicio', officialHours: 4, helperHours: 0 },
];
const base: Omit<BudgetInput, 'materials'> = { supplies: 94710, tools, tasks, officialHourlyRate: 7828, helperHourlyRate: 5696, visit: 60000 };


const SUPPLIES = 94710;
const VISIT = 60000;

describe('Caso 2 del TP N° 1, de punta a punta', () => {
  const materials = priceMaterials(lines, [house1, house2]);
  const common = { supplies: SUPPLIES, tools, tasks, officialHourlyRate: 7828, helperHourlyRate: 5696, visit: VISIT };
  const opt1 = calculateBudget({ ...common, materials: materials.totals[0] });
  const opt2 = calculateBudget({ ...common, materials: materials.totals[1] });

  it('opción 1: total 2.942.883,63, anticipo 509.471,11 y saldo 2.433.412,52', () => {
    expect(opt1.total).toBe(2942883.63);
    expect(opt1.advance).toBe(509471.11);
    expect(opt1.balance).toBe(2433412.52);
  });
  it('opción 2: total 3.331.493,28 y anticipo 670.053,61', () => {
    expect(opt2.total).toBe(3331493.28);
    expect(opt2.advance).toBe(670053.61);
  });
  it('la nota para el cliente muestra los mismos totales y el plazo de 10 días', () => {
    const html = buildQuoteNoteHtml({
      logoUrl: 'logo.png', date: '24/11/2026', projectName: 'Constitución 1734', technician: { name: 'Prestador' }, client: {},
      scope: ['Instalación eléctrica'], exclusions: 'IVA', options: [{ label: 'Opción 1', result: opt1 }, { label: 'Opción 2', result: opt2 }],
    });
    expect(html).toContain(arsMoney(2942883.63));
    expect(html).toContain(arsMoney(3331493.28));
    expect(html).toContain('10 día(s) hábil(es)');
  });
});
