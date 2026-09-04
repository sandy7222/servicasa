// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query, request, response } from './helpers';

const mocks = vi.hoisted(() => ({
  caller: vi.fn(),
  from: vi.fn(),
  createPreference: vi.fn(),
}));

vi.mock('../../api/_lib/auth.js', () => ({ getAuthenticatedCaller: mocks.caller }));
vi.mock('../../api/_lib/supabaseAdmin.js', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mocks.from(...args) },
}));
vi.mock('../../api/_lib/mercadopago.js', () => ({ mpClient: {} }));
vi.mock('mercadopago', () => ({
  Preference: class {
    create(args: unknown) {
      return mocks.createPreference(args);
    }
  },
}));

const { default: handler } = await import('../../api/orders/request-service');

const validBody = {
  title: 'Instalar tomacorriente',
  description: 'Agregar un tomacorriente en la cocina.',
  serviceType: 'Electricidad',
  address: 'Av. Siempre Viva 742',
  neighborhood: 'Centro',
  city: 'Rosario',
  province: 'Santa Fe',
  scheduledDate: '2026-09-05',
};

let insertedDraft: Record<string, unknown> | undefined;
let insertedNotification: Record<string, unknown> | undefined;
let ownedAddress: unknown = null;

function configureDatabase() {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'customer_addresses') return query({ data: ownedAddress, error: null });
    if (table === 'system_settings') return query({ data: { value: 42_000 }, error: null });
    if (table === 'services') return query({ data: { price: 15_000 }, error: null });
    if (table === 'customer_order_drafts') {
      return query(
        { data: { id: 'draft-1' }, error: null },
        { insert: (value) => { insertedDraft = value as Record<string, unknown>; } },
      );
    }
    if (table === 'notifications') {
      return query({ data: null, error: null }, {
        insert: (value) => { insertedNotification = value as Record<string, unknown>; },
      });
    }
    throw new Error(`Tabla inesperada en el test: ${table}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  insertedDraft = undefined;
  insertedNotification = undefined;
  ownedAddress = null;
  mocks.caller.mockResolvedValue({ userId: 'user-1', role: 'customer', customerId: 'customer-1', technicianId: null });
  mocks.createPreference.mockResolvedValue({ id: 'pref-1', init_point: 'https://checkout.test/pref-1' });
  configureDatabase();
});

describe('POST /api/orders/request-service — permisos y dinero', () => {
  it('rechaza solicitudes sin sesión', async () => {
    mocks.caller.mockResolvedValue(null);
    const res = response();
    await handler(request('POST', { body: validBody }), res);
    expect(res.statusCode).toBe(401);
    expect(insertedDraft).toBeUndefined();
  });

  it('rechaza a un técnico aunque esté autenticado', async () => {
    mocks.caller.mockResolvedValue({ userId: 'tech-user', role: 'technician', customerId: null, technicianId: 'tech-1' });
    const res = response();
    await handler(request('POST', { body: validBody }), res);
    expect(res.statusCode).toBe(403);
    expect(insertedDraft).toBeUndefined();
  });

  it('descarta un addressId ajeno y usa el precio fijo del catálogo', async () => {
    const res = response();
    await handler(request('POST', {
      body: {
        ...validBody,
        workMode: 'direct',
        fixedPriceServiceId: 'service-1',
        quantity: 2,
        requestedTotal: 1,
        addressId: 'address-from-another-customer',
      },
    }), res);

    expect(res.statusCode).toBe(200);
    expect(insertedDraft).toMatchObject({ customer_id: 'customer-1', payment_type: 'full_advance', amount: 30_000 });
    expect(insertedDraft?.payload).toMatchObject({ addressId: null, totalQuotedAmount: 30_000 });
    expect(insertedNotification).toMatchObject({ recipient_profile_id: 'user-1', entity_id: 'draft-1' });
  });

  it('conserva una dirección únicamente cuando pertenece al cliente autenticado', async () => {
    ownedAddress = { id: 'owned-address' };
    configureDatabase();
    const res = response();
    await handler(request('POST', {
      body: { ...validBody, workMode: 'diagnosis', addressId: 'owned-address' },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(insertedDraft?.payload).toMatchObject({ addressId: 'owned-address', visitDepositAmount: 42_000 });
  });
});
