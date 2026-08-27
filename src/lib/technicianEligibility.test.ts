import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock mínimo y explícito del query builder de supabase-js: cada método
// encadenable devuelve el mismo objeto, y el objeto es "thenable" para
// soportar tanto `await builder.maybeSingle()` como `await builder` directo
// (ambos patrones se usan en technicianEligibility.ts).
function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

const fromMock = vi.fn();
vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

// Importado después del mock para que tome la versión mockeada de supabase.
const { canTechnicianReceiveOrders, getEligibleTechnicians } = await import('./technicianEligibility');

type TableName = 'technicians' | 'technician_requirements';

function mockTables(responses: Partial<Record<TableName, { data: unknown; error: unknown }>>) {
  fromMock.mockImplementation((table: TableName) => makeQueryBuilder(responses[table] ?? { data: null, error: null }));
}

beforeEach(() => {
  fromMock.mockReset();
});

describe('canTechnicianReceiveOrders — única fuente de reglas de elegibilidad (Fase 6)', () => {
  it('técnico inexistente: no elegible, sin ambigüedad', async () => {
    mockTables({ technicians: { data: null, error: null } });
    const result = await canTechnicianReceiveOrders('tech-x');
    expect(result).toEqual({ canReceive: false, missingRequirements: ['Técnico no encontrado'] });
  });

  it('error de red/consulta: falla cerrado (no elegible), nunca abierto', async () => {
    mockTables({ technicians: { data: null, error: { message: 'timeout' } } });
    const result = await canTechnicianReceiveOrders('tech-x');
    expect(result.canReceive).toBe(false);
  });

  it('validation_status no aprobado: no elegible aunque can_receive_orders sea true', async () => {
    mockTables({ technicians: { data: { validation_status: 'observed', can_receive_orders: true }, error: null } });
    const result = await canTechnicianReceiveOrders('tech-x');
    expect(result).toEqual({ canReceive: false, missingRequirements: ['Técnico no habilitado por administración'] });
  });

  it('can_receive_orders=false: no elegible aunque validation_status sea approved', async () => {
    mockTables({ technicians: { data: { validation_status: 'approved', can_receive_orders: false }, error: null } });
    const result = await canTechnicianReceiveOrders('tech-x');
    expect(result.canReceive).toBe(false);
  });

  it('aprobado y habilitado, pero con un requisito obligatorio pendiente: NO elegible — este es el caso que el trigger de la base debía replicar (Fase 6)', async () => {
    mockTables({
      technicians: { data: { validation_status: 'approved', can_receive_orders: true }, error: null },
      technician_requirements: {
        data: [{ requirement_type: 'bank_account_valid', status: 'pending', is_required: true }],
        error: null,
      },
    });
    const result = await canTechnicianReceiveOrders('tech-x');
    expect(result.canReceive).toBe(false);
    expect(result.missingRequirements).toContain('Cuenta de cobro');
  });

  it('un requisito "not_required" no cuenta como faltante', async () => {
    mockTables({
      technicians: { data: { validation_status: 'approved', can_receive_orders: true }, error: null },
      technician_requirements: {
        data: [{ requirement_type: 'bank_account_valid', status: 'not_required', is_required: true }],
        error: null,
      },
    });
    const result = await canTechnicianReceiveOrders('tech-x');
    expect(result).toEqual({ canReceive: true, missingRequirements: [] });
  });

  it('todo aprobado: elegible, sin requisitos faltantes', async () => {
    mockTables({
      technicians: { data: { validation_status: 'approved', can_receive_orders: true }, error: null },
      technician_requirements: {
        data: [
          { requirement_type: 'profile_complete', status: 'approved', is_required: true },
          { requirement_type: 'identity_verified', status: 'approved', is_required: true },
        ],
        error: null,
      },
    });
    const result = await canTechnicianReceiveOrders('tech-x');
    expect(result).toEqual({ canReceive: true, missingRequirements: [] });
  });
});

describe('getEligibleTechnicians', () => {
  it('filtra por validation_status/can_receive_orders/is_available en la consulta, y además re-valida requisitos por técnico', async () => {
    fromMock.mockImplementation((table: TableName) => {
      if (table === 'technicians') {
        // Simula .select('*').eq(...).eq(...).eq(...) — el mock no necesita
        // aplicar los filtros de verdad, solo devolver la lista ya "pre-filtrada"
        // como lo haría Supabase, y probar que igual se re-chequean requisitos.
        return makeQueryBuilder({
          data: [{ id: 'tech-1', validation_status: 'approved', can_receive_orders: true, is_available: true }],
          error: null,
        });
      }
      return makeQueryBuilder({
        data: [{ requirement_type: 'bank_account_valid', status: 'pending', is_required: true }],
        error: null,
      });
    });

    const eligible = await getEligibleTechnicians();
    // Aunque technicians ya venía "pre-filtrado", el requisito pendiente lo saca.
    expect(eligible).toEqual([]);
  });
});
