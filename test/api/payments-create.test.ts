// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query, request, response } from './helpers';

const mocks = vi.hoisted(() => ({
  caller: vi.fn(),
  from: vi.fn(),
  createPreference: vi.fn(),
}));

vi.mock('../../api/lib/auth.js', () => ({ getAuthenticatedCaller: mocks.caller }));
vi.mock('../../api/lib/supabaseAdmin.js', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mocks.from(...args) },
}));
vi.mock('../../api/lib/mercadopago.js', () => ({ mpClient: {} }));
vi.mock('mercadopago', () => ({
  Preference: class {
    create(args: unknown) {
      return mocks.createPreference(args);
    }
  },
}));

const { default: handler } = await import('../../api/payments/create');

const order = {
  id: 'order-1',
  title: 'Tablero eléctrico',
  customer_id: 'customer-1',
  visit_deposit_amount: 45_000,
  total_quoted_amount: 120_000,
  extra_amount: 8_000,
  payment_status: 'pending',
};

let insertedTransaction: unknown;
let transactionUpdate: unknown;

function configureDatabase(overrides: { order?: unknown; quote?: unknown } = {}) {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'service_orders') return query({ data: overrides.order ?? order, error: null });
    if (table === 'order_quotes') {
      return query({
        data: overrides.quote ?? { id: 'quote-1', order_id: 'order-1', status: 'sent', remaining_amount: 75_000 },
        error: null,
      });
    }
    if (table === 'payment_transactions') {
      return query(
        { data: { id: 'txn-1' }, error: null },
        {
          insert: (value) => { insertedTransaction = value; },
          update: (value) => { transactionUpdate = value; },
        },
      );
    }
    throw new Error(`Tabla inesperada en el test: ${table}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  insertedTransaction = undefined;
  transactionUpdate = undefined;
  mocks.caller.mockResolvedValue({ userId: 'user-1', role: 'customer', customerId: 'customer-1', technicianId: null });
  mocks.createPreference.mockResolvedValue({ id: 'pref-1', init_point: 'https://checkout.test/pref-1' });
  configureDatabase();
});

describe('POST /api/payments/create — dinero y permisos', () => {
  it('rechaza métodos distintos de POST antes de consultar servicios externos', async () => {
    const res = response();
    await handler(request('GET'), res);
    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe('POST');
    expect(mocks.caller).not.toHaveBeenCalled();
  });

  it('rechaza una sesión ausente o inválida', async () => {
    mocks.caller.mockResolvedValue(null);
    const res = response();
    await handler(request('POST', { body: { orderId: 'order-1', paymentType: 'visit_deposit' } }), res);
    expect(res.statusCode).toBe(401);
    expect(mocks.createPreference).not.toHaveBeenCalled();
  });

  it('un técnico no puede pagar la orden de un cliente', async () => {
    mocks.caller.mockResolvedValue({ userId: 'tech-user', role: 'technician', customerId: null, technicianId: 'tech-1' });
    const res = response();
    await handler(request('POST', { body: { orderId: 'order-1', paymentType: 'visit_deposit' } }), res);
    expect(res.statusCode).toBe(403);
    expect(insertedTransaction).toBeUndefined();
  });

  it('ignora cualquier monto del navegador y cobra la seña persistida en la orden', async () => {
    const res = response();
    await handler(request('POST', {
      body: { orderId: 'order-1', paymentType: 'visit_deposit', amount: 1 },
    }), res);

    expect(res.statusCode).toBe(200);
    expect(insertedTransaction).toMatchObject({ order_id: 'order-1', amount: 45_000, payment_type: 'visit_deposit' });
    expect(mocks.createPreference).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({
        items: [expect.objectContaining({ unit_price: 45_000 })],
        external_reference: 'txn-1',
      }),
    }));
  });

  it('no permite pagar un presupuesto que pertenece a otra orden', async () => {
    configureDatabase({ quote: { id: 'quote-1', order_id: 'order-2', status: 'sent', remaining_amount: 75_000 } });
    const res = response();
    await handler(request('POST', { body: { orderId: 'order-1', paymentType: 'balance_payment', quoteId: 'quote-1' } }), res);
    expect(res.statusCode).toBe(404);
    expect(insertedTransaction).toBeUndefined();
  });

  it('no crea una preferencia con monto cero o negativo', async () => {
    configureDatabase({ order: { ...order, visit_deposit_amount: 0 } });
    const res = response();
    await handler(request('POST', { body: { orderId: 'order-1', paymentType: 'visit_deposit' } }), res);
    expect(res.statusCode).toBe(409);
    expect(mocks.createPreference).not.toHaveBeenCalled();
  });

  it('si Mercado Pago falla, cancela la transacción pendiente y devuelve 502', async () => {
    mocks.createPreference.mockRejectedValue(new Error('provider unavailable'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    await handler(request('POST', { body: { orderId: 'order-1', paymentType: 'visit_deposit' } }), res);
    expect(res.statusCode).toBe(502);
    expect(transactionUpdate).toEqual({ status: 'cancelled' });
    consoleSpy.mockRestore();
  });
});
