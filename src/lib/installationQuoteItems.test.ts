import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PricedLine } from './installationPrices';

const inserts: Array<{ table: string; payload: any }> = [];
let quoteInsertResult: { data: any; error: any } = { data: { id: 'q-new' }, error: null };
let itemsError: { message: string } | null = null;
vi.mock('./supabase', () => ({
  supabase: {
    from: (table: string) => ({
      insert: (payload: unknown) => {
        inserts.push({ table, payload });
        const res = table === 'order_quotes' ? quoteInsertResult : { data: null, error: itemsError };
        return { select: () => ({ single: () => Promise.resolve(res) }), then: (f: (v: unknown) => unknown) => Promise.resolve(res).then(f) };
      },
    }),
  },
}));
const { addMaterialsToDraftQuote, buildMaterialQuoteItems } = await import('./installationQuoteItems');

const opt = (subtotal: number, extra: object = {}) => ({ subtotal, unitPrice: null, borrowed: false, missing: false, ...extra });
const lines: PricedLine[] = [
  { key: 'a', description: 'Cable 2,5 mm²', unit: 'm', quantity: 100, options: [opt(105599), opt(140000)] },
  { key: 'b', description: 'Sin precio', unit: 'u', quantity: 2, options: [opt(0, { missing: true }), opt(0, { missing: true })] },
  { key: 'c', description: 'Jabalina', unit: 'u', quantity: 1, options: [opt(21901.35), opt(29443)] },
];

beforeEach(() => { inserts.length = 0; quoteInsertResult = { data: { id: 'q-new' }, error: null }; itemsError = null; });

describe('buildMaterialQuoteItems', () => {
  it('arma ítems de material con el precio unitario efectivo de la opción elegida y omite los sin precio', () => {
    const items = buildMaterialQuoteItems(lines, 0, []);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({ item_type: 'material', description: 'Cable 2,5 mm²', quantity: 100, unit: 'm', unit_price: 1055.99 });
    expect(buildMaterialQuoteItems(lines, 1, [])[0].unit_price).toBe(1400);
  });
  it('suma los insumos como ítems de material y descarta los vacíos', () => {
    const items = buildMaterialQuoteItems([], 0, [{ name: 'Discos', amount: 5000 }, { name: '', amount: 10 }, { name: 'Mechas', amount: 0 }]);
    expect(items).toEqual([{ item_type: 'material', description: 'Insumo: Discos', quantity: 1, unit: 'unidad', unit_price: 5000 }]);
  });
});

describe('addMaterialsToDraftQuote', () => {
  const items = buildMaterialQuoteItems(lines, 0, []);
  it('crea el borrador si no hay presupuesto y agrega los ítems con su orden', async () => {
    expect(await addMaterialsToDraftQuote({ id: 'o1' }, items, 'u1')).toBe(2);
    expect(inserts[0]).toMatchObject({ table: 'order_quotes', payload: { order_id: 'o1', status: 'draft', created_by: 'u1' } });
    expect(inserts[1].payload.map((p: any) => [p.quote_id, p.sort_order])).toEqual([['q-new', 0], ['q-new', 1]]);
  });
  it('si ya hay un borrador lo usa y sigue la numeración', async () => {
    await addMaterialsToDraftQuote({ id: 'o1', quotes: [{ id: 'q9', status: 'draft', items: [1, 2, 3] }] }, items, null);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload[0]).toMatchObject({ quote_id: 'q9', sort_order: 3 });
  });
  it('si el presupuesto ya fue enviado no toca nada', async () => {
    await expect(addMaterialsToDraftQuote({ id: 'o1', quotes: [{ id: 'q9', status: 'sent', items: [] }] }, items, null)).rejects.toThrow('ya fue enviado');
    expect(inserts).toHaveLength(0);
  });
  it('propaga el error de la base y no hace nada con una lista vacía', async () => {
    itemsError = { message: 'rls' };
    await expect(addMaterialsToDraftQuote({ id: 'o1', quotes: [{ id: 'q9', status: 'draft', items: [] }] }, items, null)).rejects.toThrow('rls');
    expect(await addMaterialsToDraftQuote({ id: 'o1' }, [], null)).toBe(0);
  });
});
