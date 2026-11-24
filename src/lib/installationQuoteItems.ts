import type { PricedLine } from './installationPrices';
import { round2 } from './installationBudget';
import { supabase } from './supabase';

/**
 * "Pasar a presupuesto" (plan-proyecto-instalacion.md, Fase 3): lleva los MATERIALES (e insumos) del presupuesto de
 * obra a un borrador de presupuesto de una orden. La mano de obra no se pasa: la base exige que venga del catálogo
 * publicado (trigger apply_catalog_price_to_quote_item) y la elige el técnico en QuoteBuilder. Nada se envía al
 * cliente: el técnico revisa y envía el presupuesto como siempre.
 */

export type QuoteItemDraft = {
  item_type: 'material';
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

const UNIT_LABEL: Record<string, string> = { m: 'm', tira: 'tira', u: 'unidad', bolsa: 'bolsa' };

/** Ítems de material del presupuesto de la opción elegida. Se omiten los que no tienen precio o cantidad. */
export function buildMaterialQuoteItems(lines: PricedLine[], option: number, supplies: Array<{ name: string; amount: number }>): QuoteItemDraft[] {
  const items: QuoteItemDraft[] = [];
  for (const l of lines) {
    const o = l.options[option];
    if (!o || o.missing || l.quantity <= 0 || o.subtotal <= 0) continue;
    items.push({
      item_type: 'material',
      description: l.description.slice(0, 200),
      quantity: l.quantity,
      unit: UNIT_LABEL[l.unit] ?? 'unidad',
      // Precio unitario efectivo (cubre también los rollos cerrados, donde el subtotal manda).
      unit_price: round2(o.subtotal / l.quantity),
    });
  }
  for (const s of supplies) {
    if (s.name.trim() && s.amount > 0) items.push({ item_type: 'material', description: `Insumo: ${s.name.trim()}`.slice(0, 200), quantity: 1, unit: 'unidad', unit_price: round2(s.amount) });
  }
  return items;
}

/**
 * Crea (si no existe) el borrador del presupuesto de la orden y le agrega los ítems. Falla si el presupuesto ya fue
 * enviado. Devuelve la cantidad de ítems agregados.
 */
export async function addMaterialsToDraftQuote(
  order: { id: string; quotes?: Array<{ id: string; status: string; items: unknown[] }> },
  items: QuoteItemDraft[],
  createdBy: string | null,
): Promise<number> {
  if (items.length === 0) return 0;
  const existing = order.quotes?.[0];
  if (existing && existing.status !== 'draft') throw new Error('Ese presupuesto ya fue enviado: no se puede modificar.');
  let quoteId = existing?.id;
  if (!quoteId) {
    const { data, error } = await supabase.from('order_quotes').insert({
      order_id: order.id, version: 1, status: 'draft', visit_deposit_credit: 0,
      valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), created_by: createdBy,
    }).select('id').single();
    if (error || !data) throw new Error(error?.message || 'No se pudo crear el borrador.');
    quoteId = data.id as string;
  }
  const start = existing?.items.length ?? 0;
  const { error } = await supabase.from('order_quote_items').insert(items.map((it, i) => ({ ...it, quote_id: quoteId, sort_order: start + i })));
  if (error) throw new Error(error.message);
  return items.length;
}
