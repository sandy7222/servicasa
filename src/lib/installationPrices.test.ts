import { describe, expect, it } from 'vitest';
import { parsePastedPrices, priceMaterials, type PriceEntry, type PriceList } from './installationPrices';

// Lista de materiales del caso 2 del TP N° 1 (cantidades medidas sobre el plano; precios del 21/11/2026).
// [clave, cantidad, precio casa 1 (ET), precio casa 2 (EC)]; null = no hallado en esa casa.
const rows: Array<[string, number, number | null, number | null]> = [
  ['cable-2.5', 278, 1055.99, null], ['cable-4', 36, 1679.15, null],
  ['pipe-20', 30, 2569.28, null], ['pipe-25', 4, 3628.96, null],
  ['conn-20', 40, 194.23, 277], ['conn-25', 2, 414.27, 590], ['coupling-20', 20, 144.74, 206], ['coupling-25', 3, 208.63, 297],
  ['bend-20', 30, 433.72, 618], ['bend-25', 2, 556, 792],
  ['box-oct', 5, 1112.96, 1585], ['box-rect', 18, 464.64, 794],
  ['mech-switch', 4, 1092.86, 1318], ['mech-comb', 2, 1330.81, 1605], ['mech-outlet-10', 11, 1196.7, 1444], ['mech-outlet-20', 1, 3993.04, 4817], ['mech-cover', 18, 748.11, 903],
  ['luminaire', 5, null, 12625],
  ['itm-10', 1, 8619.83, 24028], ['itm-16', 2, 8619.83, 24028], ['itm-25', 1, 8619.83, 24028], ['rcd', 1, 36059.62, 55595], ['comb', 1, null, 80169],
  ['ground-bar', 1, 5954.11, 10812], ['ground-rod', 1, 21901.35, 29443], ['ground-cable', 6, 2543.87, 3246],
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
const house2 = list('Por calidad', 3, { 'cable-2.5': 422148, 'cable-4': 120418 });

describe('priceMaterials — caso 2 del TP N° 1', () => {
  const result = priceMaterials(lines, [house1, house2]);

  it('opción 1 (por precio): 796.246,56', () => {
    expect(result.totals[0]).toBe(796246.56);
  });
  it('opción 2 (por calidad, cables por rollo cerrado): 1.104.331,24', () => {
    expect(result.totals[1]).toBe(1104331.24);
  });
  it('lo que una casa no tiene se toma de la otra y se marca (asterisco)', () => {
    const lum = result.lines.find((l) => l.key === 'luminaire')!;
    expect(lum.options[0]).toMatchObject({ borrowed: true, unitPrice: 12625, subtotal: 63125 });
    expect(lum.options[1].borrowed).toBe(false);
    expect(result.borrowedCounts).toEqual([2, 2]); // casa 1: plafón y peine; casa 2: los dos caños (los cables tienen su subtotal por rollo)
  });
  it('un ítem sin precio en ninguna lista no suma y se avisa', () => {
    const r = priceMaterials([...lines, { key: 'raro', description: 'x', unit: 'u', quantity: 3 }], [house1, house2]);
    expect(r.missingKeys).toEqual(['raro']);
    expect(r.totals).toEqual(result.totals);
  });
});

describe('parsePastedPrices', () => {
  const known = [{ key: 'tape', description: 'Cinta aisladora PVC 19 mm × 20 m' }, { key: 'ties', description: 'Precintos 200 mm' }];
  it('lee "descripción ; precio" con formato argentino y avisa lo que no reconoce', () => {
    const r = parsePastedPrices('Cinta aisladora PVC 19 mm × 20 m ; 3.374,89\nprecintos  200 MM\t$ 9.110,17\nalgo que no existe ; 5\n\nsin precio ;', known);
    expect(r.prices).toEqual({ tape: { unitPrice: 3374.89 }, ties: { unitPrice: 9110.17 } });
    expect(r.unmatched).toHaveLength(2);
  });
});
