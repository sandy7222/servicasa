// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Cobro repartido del trabajo (Fase 2). Se prueba el handler real contra una base falsa en memoria y un
 * Mercado Pago falso (fetch). Lo importante: con el interruptor apagado no cambia nada; el monto y la
 * comisión salen del servidor; el pago se crea con el token del TÉCNICO, reservado y con application_fee;
 * la reserva confirma la orden una sola vez; y el token nunca aparece en la respuesta ni en los logs.
 */

const TECH_TOKEN = 'TEST-TOKEN-DEL-TECNICO-SECRETO';

type Row = Record<string, any>;

const m = vi.hoisted(() => ({
  caller: vi.fn(),
  rpc: vi.fn(),
  tables: {} as Record<string, Row[]>,
  fetch: vi.fn(),
}));

vi.mock('../auth.js', () => ({ getAuthenticatedCaller: m.caller }));
vi.mock('../visitPaidAlert.js', () => ({ notifyAdminsVisitPaid: vi.fn() }));
vi.mock('../supabaseAdmin.js', () => {
  function from(table: string) {
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'insert' | 'update' = 'select';
    let payload: Row | null = null;
    let limitN: number | null = null;
    const rows = () => (m.tables[table] ??= []);
    const exec = (single: boolean) => {
      if (op === 'insert') {
        const row = { id: `tx-${rows().length + 1}`, ...payload };
        rows().push(row);
        return { data: single ? row : [row], error: null };
      }
      const matched = rows().filter((r) => filters.every((f) => f(r)));
      if (op === 'update') matched.forEach((r) => Object.assign(r, payload));
      const list = limitN != null ? matched.slice(0, limitN) : matched;
      return { data: single ? (list[0] ?? null) : list, error: null };
    };
    const q: any = {
      select: () => q,
      insert: (v: Row) => { op = 'insert'; payload = v; return q; },
      update: (v: Row) => { op = 'update'; payload = v; return q; },
      eq: (c: string, v: unknown) => { filters.push((r) => r[c] === v); return q; },
      neq: (c: string, v: unknown) => { filters.push((r) => r[c] !== v); return q; },
      in: (c: string, v: unknown[]) => { filters.push((r) => v.includes(r[c])); return q; },
      not: (c: string, _op: string, v: string) => {
        const list = v.replace(/[()]/g, '').split(',');
        filters.push((r) => !list.includes(r[c]));
        return q;
      },
      limit: (n: number) => { limitN = n; return q; },
      single: async () => exec(true),
      maybeSingle: async () => exec(true),
      then: (resolve: any) => resolve(exec(false)),
    };
    return q;
  }
  return { supabaseAdmin: { from, rpc: (...a: unknown[]) => m.rpc(...a) } };
});

import handler from './work-payment';

const makeRes = () => {
  const res: any = {
    headers: {} as Record<string, string>,
    status(c: number) { res.statusCode = c; return res; },
    json(b: unknown) { res.body = b; return res; },
    end() { return res; },
    setHeader(k: string, v: string) { res.headers[k] = v; },
  };
  return res;
};

const validBody = {
  orderId: 'order-1',
  quoteId: 'quote-1',
  token: 'card-token-1',
  paymentMethodId: 'master',
  installments: 1,
  payer: { email: 'cliente@example.com', identification: { type: 'DNI', number: '12345678' } },
  // Un navegador malicioso podría mandar otro monto o comisión: se ignoran.
  amount: 1,
  application_fee: 0,
};

const call = async (method: 'GET' | 'POST', opts: { query?: Row; body?: Row } = {}) => {
  const res = makeRes();
  await handler({ method, headers: { authorization: 'Bearer t', host: 'tecniurbano.online' }, query: opts.query ?? {}, body: opts.body } as never, res);
  return res;
};

const mpResponse = (status: number, body: Row) => ({ ok: status < 400, status, json: async () => body });

function seed({ splitEnabled = true, linked = true }: { splitEnabled?: boolean; linked?: boolean } = {}) {
  m.tables = {
    system_settings: [
      { key: 'split_payments_enabled', value: splitEnabled },
      { key: 'platform_commission_rate', value: 0.17 },
    ],
    service_orders: [{ id: 'order-1', title: 'Cambio de tablero', customer_id: 'cust-1', assigned_technician_id: 'tech-1', total_paid_amount: 5000 }],
    order_quotes: [{ id: 'quote-1', order_id: 'order-1', status: 'sent', remaining_amount: 1000, valid_until: null }],
    payment_transactions: [],
  };
  m.rpc.mockImplementation(async (fn: string) => {
    if (fn === 'mp_account_token' && linked) {
      return { data: [{ access_token: TECH_TOKEN, refresh_token: 'r', mp_user_id: '3406336975', public_key: 'TEST-PUBLIC-KEY', expires_at: '2099-01-01T00:00:00Z' }], error: null };
    }
    return { data: [], error: null };
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  m.caller.mockReset();
  m.rpc.mockReset();
  m.fetch.mockReset();
  m.caller.mockResolvedValue({ userId: 'u1', role: 'customer', customerId: 'cust-1', technicianId: null });
  vi.stubGlobal('fetch', m.fetch);
  seed();
});

describe('GET /api/payments/work (¿se cobra repartido?)', () => {
  it('con el interruptor apagado responde split:false (se paga como siempre)', async () => {
    seed({ splitEnabled: false });
    const res = await call('GET', { query: { orderId: 'order-1', quoteId: 'quote-1' } });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ split: false });
  });

  it('si el técnico no vinculó Mercado Pago responde split:false', async () => {
    seed({ linked: false });
    const res = await call('GET', { query: { orderId: 'order-1', quoteId: 'quote-1' } });
    expect(res.body).toEqual({ split: false });
  });

  it('si aplica devuelve la public key del técnico y el monto, nunca el token', async () => {
    const res = await call('GET', { query: { orderId: 'order-1', quoteId: 'quote-1' } });
    expect(res.body).toEqual({ split: true, publicKey: 'TEST-PUBLIC-KEY', amount: 1000 });
    expect(JSON.stringify(res.body)).not.toContain(TECH_TOKEN);
  });

  it('otro cliente no puede consultar la orden', async () => {
    m.caller.mockResolvedValue({ userId: 'u2', role: 'customer', customerId: 'otro', technicianId: null });
    const res = await call('GET', { query: { orderId: 'order-1', quoteId: 'quote-1' } });
    expect(res.statusCode).toBe(403);
  });

  it('sin sesión responde 401', async () => {
    m.caller.mockResolvedValue(null);
    const res = await call('GET', { query: { orderId: 'order-1', quoteId: 'quote-1' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /api/payments/work (reserva con comisión)', () => {
  it('reserva con el token del técnico, capture:false y la comisión calculada en el servidor', async () => {
    m.fetch.mockResolvedValue(mpResponse(201, { id: 555, status: 'authorized', status_detail: 'pending_capture', external_reference: 'tx-1', collector_id: 3406336975, fee_details: [] }));
    const res = await call('POST', { body: validBody });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ status: 'authorized' });

    const [url, init] = m.fetch.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/v1/payments');
    expect(init.headers.Authorization).toBe(`Bearer ${TECH_TOKEN}`);
    expect(init.headers['X-Idempotency-Key']).toBe('tx-1');
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({ transaction_amount: 1000, capture: false, application_fee: 170, external_reference: 'tx-1', token: 'card-token-1', binary_mode: true });
    expect(sent.notification_url).toBe('https://tecniurbano.online/api/payments/webhook');

    const tx = m.tables.payment_transactions[0];
    expect(tx).toMatchObject({ status: 'authorized', split: true, split_technician_id: 'tech-1', amount: 1000, application_fee: 170, mp_payment_id: '555' });
    // La reserva confirma la orden: presupuesto aceptado y pago completo.
    expect(m.tables.service_orders[0]).toMatchObject({ payment_status: 'paid_in_full', quote_status: 'accepted', total_paid_amount: 6000 });
    expect(m.tables.order_quotes[0].status).toBe('accepted');
  });

  it('el token del técnico nunca aparece en la respuesta ni en los logs', async () => {
    const logs: unknown[] = [];
    for (const k of ['log', 'warn', 'error'] as const) vi.spyOn(console, k).mockImplementation((...a) => { logs.push(a); });
    m.fetch.mockResolvedValue(mpResponse(400, { message: 'invalid token' }));
    const res = await call('POST', { body: validBody });
    expect(JSON.stringify(res.body)).not.toContain(TECH_TOKEN);
    expect(JSON.stringify(logs)).not.toContain(TECH_TOKEN);
  });

  it('con el interruptor apagado no crea nada ni llama a Mercado Pago', async () => {
    seed({ splitEnabled: false });
    const res = await call('POST', { body: validBody });
    expect(res.statusCode).toBe(409);
    expect(m.fetch).not.toHaveBeenCalled();
    expect(m.tables.payment_transactions).toHaveLength(0);
  });

  it('tarjeta rechazada: no confirma la orden y da un mensaje claro', async () => {
    m.fetch.mockResolvedValue(mpResponse(201, { id: 556, status: 'rejected', status_detail: 'cc_rejected_insufficient_amount', external_reference: 'tx-1' }));
    const res = await call('POST', { body: validBody });
    expect(res.statusCode).toBe(402);
    expect(res.body.error).toMatch(/saldo o límite/);
    expect(m.tables.payment_transactions[0].status).toBe('rejected');
    expect(m.tables.service_orders[0].payment_status).toBeUndefined();
    expect(m.tables.order_quotes[0].status).toBe('sent');
  });

  it('si el presupuesto ya tiene un pago vigente, no reserva otra vez', async () => {
    m.tables.payment_transactions.push({ id: 'old', quote_id: 'quote-1', status: 'authorized', split: true });
    const res = await call('POST', { body: validBody });
    expect(res.statusCode).toBe(409);
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it('presupuesto vencido o no enviado: 409', async () => {
    m.tables.order_quotes[0].valid_until = '2020-01-01T00:00:00Z';
    expect((await call('POST', { body: validBody })).statusCode).toBe(409);
    m.tables.order_quotes[0].valid_until = null;
    m.tables.order_quotes[0].status = 'accepted';
    expect((await call('POST', { body: validBody })).statusCode).toBe(409);
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it('un técnico o admin no puede pagar el presupuesto del cliente', async () => {
    m.caller.mockResolvedValue({ userId: 'u3', role: 'technician', customerId: null, technicianId: 'tech-1' });
    expect((await call('POST', { body: validBody })).statusCode).toBe(403);
  });

  it('valida email y cuotas antes de tocar nada', async () => {
    expect((await call('POST', { body: { ...validBody, payer: { email: 'no-es-email' } } })).statusCode).toBe(400);
    expect((await call('POST', { body: { ...validBody, installments: 99 } })).statusCode).toBe(400);
    expect(m.fetch).not.toHaveBeenCalled();
  });

  it('si Mercado Pago falla (5xx) la transacción queda cancelada', async () => {
    m.fetch.mockResolvedValue(mpResponse(500, { message: 'boom' }));
    const res = await call('POST', { body: validBody });
    expect(res.statusCode).toBe(502);
    expect(m.tables.payment_transactions[0].status).toBe('cancelled');
  });
});

import { applySplitPaymentStatus, handleSplitPaymentNotification } from '../splitPayment';

describe('estado del pago repartido (webhook y captura)', () => {
  const tx = { id: 'tx-9', order_id: 'order-1', quote_id: 'quote-1', payment_type: 'balance_payment', status: 'pending' as const, split_technician_id: 'tech-1' };

  beforeEach(() => {
    m.tables.payment_transactions.push({ ...tx, split: true, amount: 1000, mp_payment_id: '777' });
  });

  it('reserva y después captura: la orden suma el monto UNA sola vez', async () => {
    await applySplitPaymentStatus(tx, { id: 777, status: 'authorized', external_reference: 'tx-9' });
    // reintento del mismo aviso
    await applySplitPaymentStatus({ ...tx, status: 'authorized' }, { id: 777, status: 'authorized', external_reference: 'tx-9' });
    await applySplitPaymentStatus({ ...tx, status: 'authorized' }, {
      id: 777, status: 'approved', external_reference: 'tx-9', date_approved: '2026-11-06T10:00:00Z',
      fee_details: [{ type: 'mercadopago_fee', amount: 41 }, { type: 'application_fee', amount: 170 }],
    });
    expect(m.tables.service_orders[0].total_paid_amount).toBe(6000);
    expect(m.tables.payment_transactions[0]).toMatchObject({ status: 'approved', mp_fee_amount: 41, application_fee: 170 });
    expect(m.tables.payment_transactions[0].captured_at).toBeTruthy();
  });

  it('un aviso de "cancelado" nunca pisa un pago ya capturado', async () => {
    m.tables.payment_transactions[0].status = 'approved';
    await applySplitPaymentStatus({ ...tx, status: 'approved' }, { id: 777, status: 'cancelled', external_reference: 'tx-9' });
    expect(m.tables.payment_transactions[0].status).toBe('approved');
  });

  it('el webhook consulta el pago con el token del técnico', async () => {
    m.fetch.mockResolvedValue(mpResponse(200, { id: 777, status: 'authorized', external_reference: 'tx-9' }));
    expect(await handleSplitPaymentNotification('777')).toBe(true);
    const [url, init] = m.fetch.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/v1/payments/777');
    expect(init.headers.Authorization).toBe(`Bearer ${TECH_TOKEN}`);
    expect(m.tables.payment_transactions[0].status).toBe('authorized');
  });

  it('el webhook ignora el pago si external_reference no coincide', async () => {
    m.fetch.mockResolvedValue(mpResponse(200, { id: 777, status: 'authorized', external_reference: 'otra-cosa' }));
    expect(await handleSplitPaymentNotification('777')).toBe(true);
    expect(m.tables.payment_transactions[0].status).toBe('pending');
    expect(m.tables.service_orders[0].payment_status).toBeUndefined();
  });

  it('un pago que no es repartido sigue por el circuito de siempre', async () => {
    expect(await handleSplitPaymentNotification('no-existe')).toBe(false);
    expect(m.fetch).not.toHaveBeenCalled();
  });
});
