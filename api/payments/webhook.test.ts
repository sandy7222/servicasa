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
  function matches(row: Row, filters: Array<[string, unknown, 'eq' | 'neq']>) {
    return filters.every(([col, val, op]) => (op === 'neq' ? row[col] !== val : row[col] === val));
  }

  function builder(table: string) {
    const filters: Array<[string, unknown, 'eq' | 'neq']> = [];
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
        filters.push([col, val, 'eq']);
        return api;
      },
      neq(col: string, val: unknown) {
        filters.push([col, val, 'neq']);
        return api;
      },
      is(col: string, val: unknown) {
        filters.push([col, val, 'eq']);
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
vi.mock('../_lib/mercadopago.js', () => ({ mpClient: {} }));

let tables: Record<string, Row[]>;
vi.mock('../_lib/supabaseAdmin.js', () => ({
  get supabaseAdmin() {
    return makeFakeSupabaseAdmin(tables);
  },
}));

// Sin red real: el aviso a Telegram se espía y la geocodificación (Nominatim)
// devuelve "sin resultado", que es el camino best-effort de siempre.
const telegramMock = vi.hoisted(() => vi.fn());
vi.mock('../_lib/telegram.js', () => ({ sendTelegramMessage: telegramMock }));
vi.mock('../_lib/geocoding.js', () => ({ geocodeLocality: async () => null }));

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

  it('only credits total_paid_amount once when a balance_payment notification arrives twice', async () => {
    tables.service_orders = [{ id: 'order-1', customer_id: 'cust-1', total_paid_amount: 50000, payment_status: 'deposit_paid', quote_status: 'pending' }];
    tables.payment_transactions = [
      { id: 'txn-1', order_id: 'order-1', quote_id: null, payment_type: 'balance_payment', status: 'pending' },
    ];
    mpGetMock.mockResolvedValue({
      id: 176084558891,
      status: 'approved',
      external_reference: 'txn-1',
      transaction_amount: 30000,
      date_approved: '2026-08-28T19:40:00.000Z',
      fee_details: [],
      payment_method_id: 'master',
      installments: 1,
    });

    const { default: handler } = await import('./webhook');
    const req = { method: 'GET', query: { topic: 'payment', id: '176084558891' } } as never;

    await handler(req, makeRes() as never);
    await handler(req, makeRes() as never);

    expect(tables.service_orders[0].total_paid_amount).toBe(80000);
    expect(tables.payment_transactions[0].status).toBe('approved');
  });
});

/**
 * Aviso al administrador cuando se confirma el pago de una visita de
 * presupuesto (plan-avisos-telegram-y-chat.md, Fase 1): una sola vez por pago,
 * solo para visitas, y sin poder romper nunca la creación de la orden.
 */
describe('api/payments/webhook — aviso de visita pagada', () => {
  const visitPayload = {
    title: 'Cambio de tablero',
    description: 'desc',
    serviceType: 'Electricidad',
    priority: 'alta',
    scheduledDate: '2026-10-05',
    appointmentBlock: 'morning',
    workMode: 'diagnosis',
    address: 'Av. Corrientes 3421',
    neighborhood: 'Centro',
    city: 'Quilmes',
    province: 'Buenos Aires',
    visitDepositAmount: 30000,
    totalQuotedAmount: 0,
    fixedPriceServiceId: null,
    fixedPriceQuantity: null,
  };
  const directPayload = {
    ...visitPayload,
    workMode: 'direct',
    visitDepositAmount: 0,
    totalQuotedAmount: 80000,
    fixedPriceServiceId: 'svc-1',
    fixedPriceQuantity: 1,
  };

  function approvedPayment(externalReference: string, extra: Record<string, unknown> = {}) {
    return {
      id: 5550001,
      status: 'approved',
      external_reference: externalReference,
      transaction_amount: 30000,
      date_approved: '2026-10-02T21:00:00.000Z',
      fee_details: [],
      payment_method_id: 'master',
      installments: 1,
      ...extra,
    };
  }
  const req = { method: 'GET', query: { topic: 'payment', id: '5550001' } } as never;
  function makeRes() {
    const res: { statusCode?: number; status: (c: number) => typeof res; json: (b: unknown) => typeof res; end: () => typeof res; setHeader: () => void } = {
      status(code: number) {
        res.statusCode = code;
        return res;
      },
      json() {
        return res;
      },
      end() {
        return res;
      },
      setHeader() {},
    };
    return res;
  }
  const visitNotifications = () => tables.notifications.filter((n) => n.type === 'visit_paid');

  beforeEach(() => {
    tables = {
      customer_order_drafts: [
        { id: 'draft-v', customer_id: 'cust-1', status: 'pending', payment_type: 'visit_deposit', amount: 30000, payload: visitPayload },
      ],
      guest_checkout_drafts: [],
      payment_transactions: [],
      service_orders: [],
      customers: [{ id: 'cust-1', name: 'Julián Albarracín', phone: '1122334455', profile_id: 'profile-1' }],
      notifications: [],
      profiles: [
        { id: 'admin-1', role: 'admin' },
        { id: 'profile-1', role: 'customer' },
      ],
    };
    telegramMock.mockReset();
    telegramMock.mockResolvedValue(true);
    mpGetMock.mockReset();
    mpGetMock.mockResolvedValue(approvedPayment('draft-v'));
  });

  it('cliente logueado: avisa una sola vez aunque Mercado Pago repita la notificación', async () => {
    const { default: handler } = await import('./webhook');

    await handler(req, makeRes() as never);
    await handler(req, makeRes() as never);

    expect(tables.service_orders).toHaveLength(1);
    expect(telegramMock).toHaveBeenCalledTimes(1);
    const [text, button] = telegramMock.mock.calls[0];
    expect(text).toContain('VISITA DE PRESUPUESTO PAGADA');
    expect(text).toContain('Sin técnico asignado');
    expect(text).toContain('Quilmes');
    expect(text).not.toContain('Corrientes');
    expect(text).not.toContain('1122334455');
    expect(button.url).toBe(`https://tecniurbano.online/#/hub?order=${tables.service_orders[0].id}`);

    expect(visitNotifications()).toHaveLength(1);
    expect(visitNotifications()[0]).toMatchObject({
      recipient_profile_id: 'admin-1',
      entity_type: 'order',
      entity_id: tables.service_orders[0].id,
      priority: 'high',
    });
  });

  it('invitado: también avisa, una sola vez', async () => {
    tables.customer_order_drafts = [];
    tables.guest_checkout_drafts = [
      {
        id: 'guest-v',
        status: 'pending',
        payment_type: 'visit_deposit',
        amount: 30000,
        guest_access_token: 'tok-1',
        payload: { ...visitPayload, fullName: 'Ana Invitada', email: 'ana@example.com', phone: '1155556666', appointmentBlock: 'afternoon' },
      },
    ];
    mpGetMock.mockResolvedValue(approvedPayment('guest-v'));
    const { default: handler } = await import('./webhook');

    await handler(req, makeRes() as never);
    await handler(req, makeRes() as never);

    expect(tables.service_orders).toHaveLength(1);
    expect(telegramMock).toHaveBeenCalledTimes(1);
    expect(telegramMock.mock.calls[0][0]).toContain('Tarde (15–19 h)');
    expect(telegramMock.mock.calls[0][0]).not.toContain('1155556666');
    expect(visitNotifications()).toHaveLength(1);
  });

  it('pago directo (no es una visita): no avisa', async () => {
    tables.customer_order_drafts[0].payload = directPayload;
    tables.customer_order_drafts[0].payment_type = 'full_advance';
    const { default: handler } = await import('./webhook');

    await handler(req, makeRes() as never);

    expect(tables.service_orders).toHaveLength(1);
    expect(telegramMock).not.toHaveBeenCalled();
    expect(visitNotifications()).toHaveLength(0);
  });

  it('pago rechazado: no crea orden ni avisa', async () => {
    mpGetMock.mockResolvedValue(approvedPayment('draft-v', { status: 'rejected' }));
    const { default: handler } = await import('./webhook');

    await handler(req, makeRes() as never);

    expect(tables.service_orders).toHaveLength(0);
    expect(telegramMock).not.toHaveBeenCalled();
    expect(visitNotifications()).toHaveLength(0);
  });

  it('orden que ya existía y recibe la seña: avisa una sola vez y dice que falta técnico', async () => {
    tables.customer_order_drafts = [];
    tables.service_orders = [
      {
        id: 'order-9',
        customer_id: 'cust-1',
        title: 'Revisar térmica',
        service_type: 'Electricidad',
        client_city: 'Berazategui',
        client_neighborhood: '',
        scheduled_date: '2026-10-06',
        appointment_block: 'midday',
        priority: 'media',
        assigned_technician_name: null,
        total_paid_amount: 0,
        payment_status: 'pending',
      },
    ];
    tables.payment_transactions = [{ id: 'txn-v9', order_id: 'order-9', quote_id: null, payment_type: 'visit_deposit', status: 'pending' }];
    mpGetMock.mockResolvedValue(approvedPayment('txn-v9'));
    const { default: handler } = await import('./webhook');

    await handler(req, makeRes() as never);
    await handler(req, makeRes() as never);

    expect(telegramMock).toHaveBeenCalledTimes(1);
    const [text, button] = telegramMock.mock.calls[0];
    expect(text).toContain('Sin técnico asignado');
    expect(text).toContain('Berazategui');
    expect(text).toContain('Mediodía (12–15 h)');
    expect(button.url).toBe('https://tecniurbano.online/#/hub?order=order-9');
    expect(visitNotifications()).toHaveLength(1);
  });

  it('orden existente que ya tiene técnico: el aviso lo dice', async () => {
    tables.customer_order_drafts = [];
    tables.service_orders = [
      { id: 'order-10', customer_id: 'cust-1', title: 'Revisar térmica', service_type: 'Electricidad', client_city: 'Quilmes', scheduled_date: '2026-10-06', appointment_block: 'morning', priority: 'media', assigned_technician_name: 'María Rodríguez', total_paid_amount: 0 },
    ];
    tables.payment_transactions = [{ id: 'txn-v10', order_id: 'order-10', quote_id: null, payment_type: 'visit_deposit', status: 'pending' }];
    mpGetMock.mockResolvedValue(approvedPayment('txn-v10'));
    const { default: handler } = await import('./webhook');

    await handler(req, makeRes() as never);

    expect(telegramMock.mock.calls[0][0]).toContain('Técnico asignado: María Rodríguez.');
    expect(telegramMock.mock.calls[0][0]).not.toContain('Sin técnico');
  });

  it('pago del saldo de un presupuesto (balance_payment): no avisa', async () => {
    tables.customer_order_drafts = [];
    tables.service_orders = [{ id: 'order-11', customer_id: 'cust-1', total_paid_amount: 30000, payment_status: 'deposit_paid', quote_status: 'pending' }];
    tables.payment_transactions = [{ id: 'txn-b11', order_id: 'order-11', quote_id: null, payment_type: 'balance_payment', status: 'pending' }];
    mpGetMock.mockResolvedValue(approvedPayment('txn-b11'));
    const { default: handler } = await import('./webhook');

    await handler(req, makeRes() as never);

    expect(telegramMock).not.toHaveBeenCalled();
    expect(visitNotifications()).toHaveLength(0);
  });

  it('si el aviso falla, la orden se crea igual y el webhook responde 200', async () => {
    telegramMock.mockRejectedValue(new Error('Telegram caído'));
    const res = makeRes();
    const { default: handler } = await import('./webhook');

    await handler(req, res as never);

    expect(res.statusCode).toBe(200);
    expect(tables.service_orders).toHaveLength(1);
    expect(tables.payment_transactions).toHaveLength(1);
    expect(tables.customer_order_drafts[0].status).toBe('approved');
    expect(visitNotifications()).toHaveLength(1);
  });
});
