import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Regression test for the race Sandy found live: a single Mercado Pago
 * payment (mp_payment_id=176084558890) fired two webhook notifications
 * 269ms apart, and the old SELECT-then-UPDATE check let both calls read
 * customer_order_drafts.status='pending' before either had written
 * 'approved' — creating two service_orders rows from one payment.
 *
 * This exercises the real handler twice in a row against an in-memory fake
 * of supabaseAdmin, asserting the atomic UPDATE...WHERE status='pending'
 * guard lets only the first call create the order.
 */

type Row = Record<string, unknown>;

function makeFakeSupabaseAdmin(tables: Record<string, Row[]>) {
  function matches(row: Row, filters: Array<[string, unknown]>) {
    return filters.every(([col, val]) => row[col] === val);
  }

  function builder(table: string) {
    const filters: Array<[string, unknown]> = [];
    let mode: 'select' | 'insert' | 'update' | null = null;
    let payload: Row | null = null;
    let selectCols: string | null = null;

    const api = {
      select(cols?: string) {
        if (!mode) mode = 'select';
        selectCols = cols ?? null;
        return api;
      },
      insert(row: Row) {
        mode = 'insert';
        payload = { id: row.id ?? `gen-${Math.random().toString(36).slice(2)}`, ...row };
        return api;
      },
      update(patch: Row) {
        mode = 'update';
        payload = patch;
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push([col, val]);
        return api;
      },
      is(col: string, val: unknown) {
        filters.push([col, val]);
        return api;
      },
      async single() {
        return exec(true);
      },
      async maybeSingle() {
        return exec(true);
      },
      then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
        exec(false).then(resolve, reject);
      },
    };

    async function exec(wantsSingle: boolean) {
      const rows = tables[table] ?? (tables[table] = []);
      if (mode === 'insert') {
        rows.push(payload as Row);
        return { data: wantsSingle ? payload : [payload], error: null };
      }
      if (mode === 'update') {
        const matched = rows.filter((r) => matches(r, filters));
        matched.forEach((r) => Object.assign(r, payload));
        if (wantsSingle) {
          return { data: matched[0] ?? null, error: null };
        }
        return { data: matched, error: null };
      }
      // select
      const matched = rows.filter((r) => matches(r, filters));
      if (wantsSingle) {
        return { data: matched[0] ?? null, error: null };
      }
      return { data: matched, error: null };
    }

    return api;
  }

  return { from: (table: string) => builder(table) };
}

const mpGetMock = vi.fn();

vi.mock('mercadopago', () => ({
  Payment: class {
    async get(args: { id: string }) {
      return mpGetMock(args);
    }
  },
  MPNotFoundError: class MPNotFoundError extends Error {},
}));
vi.mock('../lib/mercadopago.js', () => ({ mpClient: {} }));

let tables: Record<string, Row[]>;
vi.mock('../lib/supabaseAdmin.js', () => ({
  get supabaseAdmin() {
    return makeFakeSupabaseAdmin(tables);
  },
}));

describe('api/payments/webhook idempotency', () => {
  beforeEach(() => {
    tables = {
      customer_order_drafts: [
        {
          id: 'draft-1',
          customer_id: 'cust-1',
          status: 'pending',
          payment_type: 'visit_deposit',
          amount: 50000,
          payload: {
            title: 'Prueba E2E - flujo de borrador',
            description: 'desc',
            serviceType: 'Electricidad',
            priority: 'media',
            scheduledDate: '2026-08-28',
            workMode: 'diagnosis',
            address: 'Av. Corrientes 3421',
            neighborhood: 'Almagro',
            province: 'CABA',
            visitDepositAmount: 50000,
            totalQuotedAmount: 0,
            fixedPriceServiceId: null,
            fixedPriceQuantity: null,
          },
        },
      ],
      guest_checkout_drafts: [],
      payment_transactions: [],
      service_orders: [],
      customers: [{ id: 'cust-1', name: 'Julián Albarracín', phone: '1122334455', profile_id: 'profile-1' }],
      notifications: [],
    };
    mpGetMock.mockReset();
    mpGetMock.mockResolvedValue({
      id: 176084558890,
      status: 'approved',
      external_reference: 'draft-1',
      transaction_amount: 50000,
      date_approved: '2026-08-28T19:34:35.000Z',
      fee_details: [],
      payment_method_id: 'master',
      installments: 1,
    });
  });

  function makeReq() {
    return { method: 'GET', query: { topic: 'payment', id: '176084558890' } } as never;
  }
  function makeRes() {
    const res: { statusCode?: number; body?: unknown; status: (c: number) => typeof res; json: (b: unknown) => typeof res; end: () => typeof res; setHeader: () => void } = {
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json(body: unknown) {
        res.body = body;
        return res;
      },
      end() {
        return res;
      },
      setHeader() {},
    };
    return res;
  }

  it('creates exactly one order when the same webhook notification arrives twice', async () => {
    const { default: handler } = await import('./webhook');

    await handler(makeReq(), makeRes() as never);
    await handler(makeReq(), makeRes() as never);

    expect(tables.service_orders).toHaveLength(1);
    expect(tables.payment_transactions).toHaveLength(1);
    expect(tables.customer_order_drafts[0].status).toBe('approved');
  });
});
