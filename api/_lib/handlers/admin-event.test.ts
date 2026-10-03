// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TECH = '11111111-1111-4111-8111-111111111111';

const state = vi.hoisted(() => ({
  telegram: vi.fn(),
  inserts: [] as Array<{ table: string; row: any }>,
  /** id del evento más antiguo que devuelve la consulta de ventana */
  oldestId: 'mine',
  todayCount: 1,
}));

vi.mock('../telegram.js', () => ({ sendTelegramMessage: state.telegram }));
vi.mock('../supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const chain: any = {
        insert: (row: unknown) => {
          state.inserts.push({ table, row });
          return { select: () => ({ single: async () => ({ data: { id: 'mine' }, error: null }) }), then: (r: any) => r({ error: null }) };
        },
        select: (_cols?: string, opts?: { head?: boolean }) => {
          if (opts?.head) return { eq: () => ({ gte: async () => ({ count: state.todayCount }) }) };
          const q: any = {
            eq: () => q,
            order: () => q,
            limit: async () => ({ data: [{ id: state.oldestId }] }),
            gte: () => q,
            maybeSingle: async () => ({ data: { name: 'Juan Pérez' } }),
            then: (r: any) =>
              r({
                data:
                  table === 'profiles'
                    ? [{ id: 'admin-1' }]
                    : table === 'technician_specialties'
                      ? [{ categories: { name: 'Electricidad' } }]
                      : [],
                error: null,
              }),
          };
          return q;
        },
      };
      return chain;
    },
  },
}));

import handler, { CUSTOMER_DAILY_CAP, startOfArgentinaDay } from './admin-event';

function makeRes() {
  const res: any = { headers: {}, status(c: number) { res.statusCode = c; return res; }, json(b: unknown) { res.body = b; return res; }, setHeader() {} };
  return res;
}
const call = (kind: string, secret: string | null = 'sekret', entityId = TECH, method = 'POST') => {
  const res = makeRes();
  return handler({ method, headers: secret === null ? {} : { 'x-admin-event-secret': secret }, body: { kind, entityId } } as never, res).then(() => res);
};

describe('api admin-event', () => {
  beforeEach(() => {
    process.env.ADMIN_EVENT_SECRET = 'sekret';
    state.telegram.mockReset().mockResolvedValue(true);
    state.inserts.length = 0;
    state.oldestId = 'mine';
    state.todayCount = 1;
  });

  it('rechaza sin el secreto compartido o con uno incorrecto', async () => {
    expect((await call('technician_registered', null)).statusCode).toBe(401);
    expect((await call('technician_registered', 'otro')).statusCode).toBe(401);
    expect(state.telegram).not.toHaveBeenCalled();
  });

  it('rechaza si el servidor no tiene secreto configurado', async () => {
    delete process.env.ADMIN_EVENT_SECRET;
    expect((await call('technician_registered', '')).statusCode).toBe(401);
  });

  it('solo POST, y valida tipo y id', async () => {
    expect((await call('technician_registered', 'sekret', TECH, 'GET')).statusCode).toBe(405);
    expect((await call('algo_raro')).statusCode).toBe(400);
    expect((await call('technician_registered', 'sekret', 'no-es-uuid')).statusCode).toBe(400);
  });

  it('técnico que se anota: Telegram con nombre y rubros + campanita, sin datos de contacto', async () => {
    const res = await call('technician_registered');
    expect(res.statusCode).toBe(200);
    const [text, button] = state.telegram.mock.calls[0];
    expect(text).toContain('SE ANOTÓ UN TÉCNICO');
    expect(text).toContain('Juan Pérez');
    expect(text).toContain('Electricidad');
    expect(button.url).toContain('/#/hub?tab=technicians');
    const bell = state.inserts.find((i) => i.table === 'notifications')!.row;
    expect(bell).toMatchObject({ type: 'technician_registered', entity_type: 'technician', recipient_profile_id: 'admin-1' });
  });

  it('no avisa dos veces el mismo técnico (otro evento más antiguo ya avisó)', async () => {
    state.oldestId = 'anterior';
    await call('technician_registered');
    expect(state.telegram).not.toHaveBeenCalled();
  });

  it('documentación: avisa una vez y agrupa los archivos siguientes', async () => {
    await call('technician_documents');
    expect(state.telegram.mock.calls[0][0]).toContain('DOCUMENTACIÓN PARA REVISAR');
    state.telegram.mockClear();
    state.oldestId = 'anterior';
    await call('technician_documents');
    expect(state.telegram).not.toHaveBeenCalled();
  });

  it('cliente nuevo: aviso sin nombre ni email', async () => {
    state.todayCount = 3;
    await call('customer_registered');
    const [text] = state.telegram.mock.calls[0];
    expect(text).toContain('3 hoy');
    expect(text).not.toMatch(/@|Juan/);
  });

  it('cliente nuevo: tope diario — avisa el límite una sola vez y después calla', async () => {
    state.todayCount = CUSTOMER_DAILY_CAP;
    await call('customer_registered');
    expect(state.telegram).toHaveBeenCalledTimes(1);
    state.telegram.mockClear();
    state.todayCount = CUSTOMER_DAILY_CAP + 1;
    await call('customer_registered');
    expect(state.telegram.mock.calls[0][0]).toContain('no te aviso más hasta mañana');
    state.telegram.mockClear();
    state.todayCount = CUSTOMER_DAILY_CAP + 2;
    await call('customer_registered');
    expect(state.telegram).not.toHaveBeenCalled();
  });

  it('si Telegram falla igual responde 200 (no trabar el alta)', async () => {
    state.telegram.mockRejectedValue(new Error('caído'));
    expect((await call('technician_registered')).statusCode).toBe(200);
  });
});

describe('startOfArgentinaDay', () => {
  it('es la medianoche de Argentina (03:00 UTC)', () => {
    expect(startOfArgentinaDay(Date.parse('2026-10-04T15:30:00Z'))).toBe('2026-10-04T03:00:00.000Z');
    expect(startOfArgentinaDay(Date.parse('2026-10-04T02:00:00Z'))).toBe('2026-10-03T03:00:00.000Z');
  });
});
