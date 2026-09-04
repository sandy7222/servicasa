// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { query, request, response } from './helpers';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  createPreference: vi.fn(),
}));

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

const { default: handler } = await import('../../api/orders/guest-checkout');

const validBody = {
  fullName: 'Persona invitada',
  email: 'invitado@example.com',
  phone: '1112345678',
  address: 'Av. Siempre Viva 742',
  neighborhood: 'Centro',
  city: 'Córdoba',
  province: 'Córdoba',
  title: 'Instalar luminaria',
  description: 'Necesito instalar una luminaria en el comedor.',
  serviceType: 'Electricidad',
  scheduledDate: '2026-09-05',
};

let insertedDraft: Record<string, unknown> | undefined;
let draftUpdate: unknown;
let settingValue: unknown = 40_000;
let servicePrice = 12_500;
let existingCustomer: unknown = null;

function configureDatabase() {
  mocks.from.mockImplementation((table: string) => {
    if (table === 'customers') return query({ data: existingCustomer, error: null });
    if (table === 'system_settings') return query({ data: { value: settingValue }, error: null });
    if (table === 'services') return query({ data: { price: servicePrice }, error: null });
    if (table === 'guest_checkout_drafts') {
      return query(
        { data: { id: 'draft-1', guest_access_token: 'opaque-token' }, error: null },
        {
          insert: (value) => { insertedDraft = value as Record<string, unknown>; },
          update: (value) => { draftUpdate = value; },
        },
      );
    }
    throw new Error(`Tabla inesperada en el test: ${table}`);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  insertedDraft = undefined;
  draftUpdate = undefined;
  settingValue = 40_000;
  servicePrice = 12_500;
  existingCustomer = null;
  mocks.createPreference.mockResolvedValue({ id: 'pref-1', init_point: 'https://checkout.test/pref-1' });
  configureDatabase();
});

describe('POST /api/orders/guest-checkout — monto confiable', () => {
  it('rechaza datos obligatorios incompletos sin escribir un borrador', async () => {
    const res = response();
    await handler(request('POST', { body: { ...validBody, email: 'invalido' } }), res);
    expect(res.statusCode).toBe(400);
    expect(insertedDraft).toBeUndefined();
  });

  it('obliga a iniciar sesión si el email ya pertenece a una cuenta', async () => {
    existingCustomer = { id: 'customer-1', profile_id: 'profile-1' };
    configureDatabase();
    const res = response();
    await handler(request('POST', { body: validBody }), res);
    expect(res.statusCode).toBe(409);
    expect(mocks.createPreference).not.toHaveBeenCalled();
  });

  it('en diagnóstico ignora requestedTotal y usa la seña configurada en el servidor', async () => {
    const res = response();
    await handler(request('POST', { body: { ...validBody, workMode: 'diagnosis', requestedTotal: 1 } }), res);
    expect(res.statusCode).toBe(200);
    expect(insertedDraft).toMatchObject({ amount: 40_000, payment_type: 'visit_deposit' });
    expect(mocks.createPreference).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ items: [expect.objectContaining({ unit_price: 40_000 })] }),
    }));
  });

  it('en precio fijo recalcula precio × cantidad desde el catálogo activo', async () => {
    const res = response();
    await handler(request('POST', {
      body: { ...validBody, workMode: 'direct', fixedPriceServiceId: 'service-1', quantity: 3, requestedTotal: 2 },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(insertedDraft).toMatchObject({ amount: 37_500, payment_type: 'full_advance' });
    expect(mocks.createPreference).toHaveBeenCalledWith(expect.objectContaining({
      body: expect.objectContaining({ items: [expect.objectContaining({ unit_price: 37_500 })] }),
    }));
  });

  it('si Mercado Pago falla, deja el borrador cancelado', async () => {
    mocks.createPreference.mockRejectedValue(new Error('provider unavailable'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = response();
    await handler(request('POST', { body: validBody }), res);
    expect(res.statusCode).toBe(502);
    expect(draftUpdate).toEqual({ status: 'cancelled' });
    consoleSpy.mockRestore();
  });
});
