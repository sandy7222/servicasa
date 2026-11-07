// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Informe de cobros repartidos (Fase 4): quién ve qué, el rango del mes y las cuentas. */

const m = vi.hoisted(() => ({
  caller: vi.fn(),
  rows: [] as any[],
  filters: [] as Array<[string, string, unknown]>,
  error: null as null | { message: string },
}));

vi.mock('../auth.js', () => ({ getAuthenticatedCaller: m.caller }));
vi.mock('../supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: () => {
      const q: any = {
        select: () => q,
        eq: (c: string, v: unknown) => { m.filters.push(['eq', c, v]); return q; },
        in: (c: string, v: unknown) => { m.filters.push(['in', c, v]); return q; },
        gte: (c: string, v: unknown) => { m.filters.push(['gte', c, v]); return q; },
        lt: (c: string, v: unknown) => { m.filters.push(['lt', c, v]); return q; },
        order: () => q,
        then: (resolve: any) => resolve({ data: m.error ? null : m.rows, error: m.error }),
      };
      return q;
    },
  },
}));

import handler, { monthRange } from './split-report';

const makeRes = () => {
  const res: any = {
    headers: {},
    status(c: number) { res.statusCode = c; return res; },
    json(b: unknown) { res.body = b; return res; },
    setHeader(k: string, v: string) { res.headers[k] = v; },
  };
  return res;
};
const call = async (query: Record<string, string> = {}) => {
  const res = makeRes();
  await handler({ method: 'GET', headers: { authorization: 'Bearer t' }, query } as never, res);
  return res;
};

beforeEach(() => {
  m.caller.mockReset();
  m.filters = [];
  m.error = null;
  m.rows = [
    { id: 'p1', order_id: 'o1', split_technician_id: 'tech-1', status: 'approved', amount: 1000, application_fee: 170, mp_fee_amount: 41, captured_at: '2026-11-10T15:00:00Z', service_orders: { title: 'Tablero' }, technicians: { name: 'Walter' } },
    { id: 'p2', order_id: 'o2', split_technician_id: 'tech-1', status: 'refunded', amount: 500, application_fee: 85, mp_fee_amount: 20.5, captured_at: '2026-11-11T15:00:00Z', service_orders: { title: 'Enchufe' }, technicians: { name: 'Walter' } },
  ];
});

describe('split-report', () => {
  it('el mes va de medianoche a medianoche en hora argentina', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01T03:00:00.000Z', to: '2026-12-01T03:00:00.000Z' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01T03:00:00.000Z', to: '2027-01-01T03:00:00.000Z' });
    expect(monthRange('2026-13')).toBeNull();
  });

  it('admin: ve todo, y los devueltos no suman', async () => {
    m.caller.mockResolvedValue({ userId: 'a', role: 'admin', customerId: null, technicianId: null });
    const res = await call({ month: '2026-11' });
    expect(res.statusCode).toBe(200);
    expect(res.body.rows).toHaveLength(2);
    expect(res.body.rows[0]).toMatchObject({ technicianName: 'Walter', orderTitle: 'Tablero', commission: 170, mpFee: 41, technicianNet: 789 });
    expect(res.body.totals).toEqual({ count: 1, amount: 1000, commission: 170, mpFee: 41, technicianNet: 789 });
    expect(m.filters).not.toContainEqual(['eq', 'split_technician_id', expect.anything()]);
    expect(m.filters).toContainEqual(['gte', 'captured_at', '2026-11-01T03:00:00.000Z']);
  });

  it('técnico: el servidor filtra por SU id (no confía en nada del navegador)', async () => {
    m.caller.mockResolvedValue({ userId: 'u', role: 'technician', customerId: null, technicianId: 'tech-1' });
    const res = await call({ month: '2026-11', technicianId: 'otro' });
    expect(res.statusCode).toBe(200);
    expect(m.filters).toContainEqual(['eq', 'split_technician_id', 'tech-1']);
  });

  it('un cliente no tiene acceso; sin sesión, 401; mes inválido, 400', async () => {
    m.caller.mockResolvedValue({ userId: 'c', role: 'customer', customerId: 'c1', technicianId: null });
    expect((await call()).statusCode).toBe(403);
    m.caller.mockResolvedValue(null);
    expect((await call()).statusCode).toBe(401);
    m.caller.mockResolvedValue({ userId: 'a', role: 'admin', customerId: null, technicianId: null });
    expect((await call({ month: '11-2026' })).statusCode).toBe(400);
  });
});
