/**
 * Presupuesto formal de obra (plan-proyecto-instalacion.md, Fase 3B): funciones puras que arman el precio de una obra
 * eléctrica completa. Reproduce las secciones 10 a 14 del TP N° 1: depreciación de herramientas (método lineal),
 * mano de obra con cargas sociales, gastos generales, beneficio y anticipo.
 *
 * Todos los porcentajes y valores son editables (`BudgetRules`); no hay precios de mercado acá: los precios de
 * materiales y el valor hora los carga el técnico.
 */

export type BudgetRules = {
  /** Valor residual de las herramientas (fracción del valor de origen). */
  residualRate: number;
  /** Vida útil de las herramientas, en años. */
  usefulLifeYears: number;
  /** Horas de uso de una herramienta por año. */
  hoursPerYear: number;
  /** Cargas sociales sobre la mano de obra básica. */
  socialChargesRate: number;
  /** Gastos generales sobre el costo directo. */
  overheadRate: number;
  /** Beneficio sobre (costo directo + gastos generales). */
  profitRate: number;
  /** Parte de materiales e insumos que se pide como anticipo. */
  advanceMaterialsRate: number;
  /** Horas de una jornada, para el plazo. */
  hoursPerDay: number;
};

export const DEFAULT_BUDGET_RULES: BudgetRules = {
  residualRate: 0.1,
  usefulLifeYears: 5,
  hoursPerYear: 400,
  socialChargesRate: 0.5,
  overheadRate: 0.1,
  profitRate: 0.1,
  advanceMaterialsRate: 0.5,
  hoursPerDay: 8,
};

export type ToolInput = { name: string; originValue: number; hoursOnSite: number };
export type TaskInput = { name: string; officialHours: number; helperHours: number };
export type BudgetInput = {
  /** Total de materiales (ya con precios y desperdicios). */
  materials: number;
  /** Insumos que se consumen (discos, mechas, grampas...), se cobran como material. */
  supplies: number;
  tools: ToolInput[];
  tasks: TaskInput[];
  officialHourlyRate: number;
  helperHourlyRate: number;
  /** Visita de presupuesto (monto fijo, la cobra la plataforma). */
  visit: number;
  rules?: Partial<BudgetRules>;
};

export type BudgetResult = {
  materials: number;
  supplies: number;
  depreciation: number;
  officialHours: number;
  helperHours: number;
  laborBasic: number;
  socialCharges: number;
  laborWithCharges: number;
  visit: number;
  directCost: number;
  overhead: number;
  profit: number;
  total: number;
  advance: number;
  advanceShare: number;
  balance: number;
  /** Jornadas de la obra (horas de oficial / horas por día, hacia arriba). */
  days: number;
};

/**
 * Redondeo a centavos del valor binario exacto (igual que `round()` de Python y que la planilla de la memoria del
 * TP N° 1): así los totales del programa coinciden con el documento al centavo.
 */
export const round2 = (n: number): number => Number(n.toFixed(2));

/** Depreciación lineal: cuota anual = (valor − residual) / vida; cargo = cuota anual × horas en obra / horas por año. */
export function toolDepreciation(tool: ToolInput, rules: BudgetRules = DEFAULT_BUDGET_RULES): { annualQuota: number; charge: number } {
  const annualQuota = (tool.originValue * (1 - rules.residualRate)) / rules.usefulLifeYears;
  const charge = (annualQuota * tool.hoursOnSite) / rules.hoursPerYear;
  return { annualQuota, charge };
}

export function calculateBudget(input: BudgetInput): BudgetResult {
  const rules = { ...DEFAULT_BUDGET_RULES, ...input.rules };
  const materials = round2(input.materials);
  const supplies = round2(input.supplies);
  const depreciation = round2(input.tools.reduce((sum, t) => sum + toolDepreciation(t, rules).charge, 0));

  const officialHours = input.tasks.reduce((s, t) => s + t.officialHours, 0);
  const helperHours = input.tasks.reduce((s, t) => s + t.helperHours, 0);
  const laborBasic = round2(officialHours * input.officialHourlyRate + helperHours * input.helperHourlyRate);
  const socialCharges = round2(laborBasic * rules.socialChargesRate);
  const laborWithCharges = round2(laborBasic + socialCharges);
  const visit = round2(input.visit);

  const directCost = round2(materials + supplies + depreciation + laborWithCharges + visit);
  const overhead = round2(directCost * rules.overheadRate);
  const profit = round2((directCost + overhead) * rules.profitRate);
  const total = round2(directCost + overhead + profit);

  // Anticipo: visita + parte de materiales e insumos + depreciación (lo que el técnico adelanta de su bolsillo).
  const advance = round2(visit + (materials + supplies) * rules.advanceMaterialsRate + depreciation);
  return {
    materials,
    supplies,
    depreciation,
    officialHours,
    helperHours,
    laborBasic,
    socialCharges,
    laborWithCharges,
    visit,
    directCost,
    overhead,
    profit,
    total,
    advance,
    advanceShare: total > 0 ? advance / total : 0,
    balance: round2(total - advance),
    days: Math.ceil(officialHours / rules.hoursPerDay),
  };
}
