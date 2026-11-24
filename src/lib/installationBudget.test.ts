import { describe, expect, it } from 'vitest';
import { calculateBudget, DEFAULT_BUDGET_RULES, round2, toolDepreciation, type BudgetInput } from './installationBudget';

// Caso 2 del TP N° 1 (oráculo del plan, 3B.8).
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

describe('calculateBudget — caso 2 del TP N° 1', () => {
  it('opción 1 (por precio): coincide con la memoria, centavo a centavo', () => {
    const r = calculateBudget({ ...base, materials: 787626.73 });
    expect(r.depreciation).toBe(6586.99);
    expect(r.officialHours).toBe(78);
    expect(r.helperHours).toBe(66);
    expect(r.laborBasic).toBe(986520);
    expect(r.laborWithCharges).toBe(1479780);
    expect(r.directCost).toBe(2428703.72);
    expect(r.overhead).toBe(242870.37);
    expect(r.profit).toBe(267157.41);
    expect(r.total).toBe(2938731.5);
    expect(r.advance).toBe(507755.35);
    expect(r.advanceShare).toBeCloseTo(0.173, 3);
    expect(r.balance).toBe(2430976.15);
    expect(r.days).toBe(10);
  });

  it('opción 2 (por calidad): mismos números con otros materiales', () => {
    const r = calculateBudget({ ...base, materials: 1080303.24 });
    expect(r.total).toBe(3292870.08);
    expect(r.advance).toBe(654093.61);
    expect(r.advanceShare).toBeCloseTo(0.199, 3);
  });
});

describe('depreciación lineal', () => {
  it('cuota anual = (valor − 10 %) / 5 años y cargo por horas de obra (18 % del valor al año)', () => {
    const { annualQuota, charge } = toolDepreciation({ name: 'Amoladora', originValue: 483644.9, hoursOnSite: 16 }, DEFAULT_BUDGET_RULES);
    expect(round2(annualQuota)).toBe(87056.08);
    expect(round2(charge)).toBe(3482.24);
  });

  it('las reglas son editables', () => {
    const r = calculateBudget({ ...base, materials: 0, supplies: 0, tools: [{ name: 'X', originValue: 1000, hoursOnSite: 100 }], tasks: [], visit: 0, rules: { residualRate: 0, usefulLifeYears: 4, hoursPerYear: 100 } });
    expect(r.depreciation).toBe(250);
  });
});

describe('casos sueltos', () => {
  it('sin tareas ni materiales da cero y no divide por cero', () => {
    const r = calculateBudget({ materials: 0, supplies: 0, tools: [], tasks: [], officialHourlyRate: 0, helperHourlyRate: 0, visit: 0 });
    expect(r.total).toBe(0);
    expect(r.advanceShare).toBe(0);
    expect(r.days).toBe(0);
  });

  it('el plazo redondea hacia arriba (9 h de oficial = 2 jornadas)', () => {
    const r = calculateBudget({ ...base, materials: 0, tasks: [{ name: 'a', officialHours: 9, helperHours: 0 }] });
    expect(r.days).toBe(2);
  });
});
