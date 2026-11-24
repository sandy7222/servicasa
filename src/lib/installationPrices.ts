import { round2 } from './installationBudget';

/**
 * Listas de precios del presupuesto de obra (plan-proyecto-instalacion.md, Fase 3B.2).
 *
 * El técnico carga los precios de DOS casas (o dos criterios: "por precio" y "por calidad/marca"). La app no busca
 * precios en tiendas. Reglas:
 *  - Si una casa no tiene un ítem, se usa el precio de la otra y se marca con asterisco (`borrowed`).
 *  - Si ninguna lo tiene, el ítem queda "sin precio" y no suma (se avisa).
 *  - Si la casa vende por rollo cerrado, se carga el subtotal real de lo que hay que comprar (`lumpTotal`).
 */

export type PriceEntry = {
  /** Precio por unidad (por metro, por tira, por pieza). */
  unitPrice?: number;
  /** Subtotal real cuando la casa vende en envases cerrados (ej.: 3 rollos de 100 m). Reemplaza cantidad × precio. */
  lumpTotal?: number;
  /** Nota libre (marca, rollo comprado, etc.). */
  note?: string;
};

export type PriceList = { name: string; prices: Record<string, PriceEntry> };

export type QuantifiedLine = { key: string; description: string; unit: string; quantity: number };

export type PricedLine = {
  key: string;
  description: string;
  unit: string;
  quantity: number;
  /** Subtotal por cada lista, en el mismo orden que `lists`. */
  options: Array<{ subtotal: number; unitPrice: number | null; borrowed: boolean; missing: boolean; note?: string }>;
};

export type PricedMaterials = {
  lines: PricedLine[];
  /** Total de materiales por lista. */
  totals: number[];
  /** Ítems sin precio en ninguna lista. */
  missingKeys: string[];
  /** Cantidad de ítems con precio prestado de la otra lista, por lista. */
  borrowedCounts: number[];
};

const hasPrice = (e?: PriceEntry): e is PriceEntry => Boolean(e) && (e!.lumpTotal !== undefined || e!.unitPrice !== undefined);

/** Valoriza los materiales con una o dos listas de precios. */
export function priceMaterials(lines: QuantifiedLine[], lists: PriceList[]): PricedMaterials {
  const priced: PricedLine[] = lines.map((line) => ({
    key: line.key,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    options: lists.map((list, i) => {
      const own = list.prices[line.key];
      // Precio prestado: el de la primera otra lista que lo tenga.
      const other = hasPrice(own) ? undefined : lists.find((l, j) => j !== i && hasPrice(l.prices[line.key]))?.prices[line.key];
      const entry = hasPrice(own) ? own : other;
      if (!entry) return { subtotal: 0, unitPrice: null, borrowed: false, missing: true };
      const subtotal = entry.lumpTotal !== undefined ? entry.lumpTotal : line.quantity * (entry.unitPrice as number);
      return { subtotal: round2(subtotal), unitPrice: entry.unitPrice ?? null, borrowed: !hasPrice(own), missing: false, note: entry.note };
    }),
  }));
  return {
    lines: priced,
    totals: lists.map((_, i) => round2(priced.reduce((s, l) => s + l.options[i].subtotal, 0))),
    missingKeys: priced.filter((l) => l.options.every((o) => o.missing)).map((l) => l.key),
    borrowedCounts: lists.map((_, i) => priced.filter((l) => l.options[i].borrowed).length),
  };
}

/**
 * Lee precios pegados desde una planilla o un texto: una línea por ítem, "descripción ; precio" (también acepta tab).
 * Devuelve el precio por clave para las descripciones que coinciden (sin distinguir mayúsculas ni espacios de más).
 */
export function parsePastedPrices(text: string, lines: Array<{ key: string; description: string }>): { prices: Record<string, PriceEntry>; unmatched: string[] } {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const byDescription = new Map(lines.map((l) => [norm(l.description), l.key]));
  const prices: Record<string, PriceEntry> = {};
  const unmatched: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const row = raw.trim();
    if (!row) continue;
    const parts = row.split(/\t|;/);
    const priceText = parts.pop() ?? '';
    const description = parts.join(' ');
    // Formato argentino: 1.234,56 → 1234.56
    const value = Number(priceText.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
    const key = byDescription.get(norm(description));
    if (key && Number.isFinite(value) && value >= 0 && parts.length > 0) prices[key] = { unitPrice: value };
    else unmatched.push(row);
  }
  return { prices, unmatched };
}
