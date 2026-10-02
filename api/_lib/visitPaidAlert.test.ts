// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendTelegramMessage: vi.fn(),
  adminsResult: { data: [] as Array<{ id: string }> | null, error: null as unknown },
  inserted: [] as Array<Record<string, unknown>>,
  insertError: null as unknown,
}));

vi.mock('./telegram.js', () => ({ sendTelegramMessage: mocks.sendTelegramMessage }));
vi.mock('./supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({ eq: async () => (table === 'profiles' ? mocks.adminsResult : { data: [], error: null }) }),
      insert: async (row: Record<string, unknown>) => {
        mocks.inserted.push({ table, ...row });
        return { error: mocks.insertError };
      },
    }),
  },
}));

import { buildVisitPaidMessage, notifyAdminsVisitPaid, type VisitPaidInfo } from './visitPaidAlert';

const info: VisitPaidInfo = {
  orderId: 'order-1',
  title: 'Cambio de tablero',
  serviceType: 'Electricidad',
  city: 'Quilmes',
  neighborhood: 'Centro',
  scheduledDate: '2026-10-05',
  appointmentBlock: 'morning',
  priority: 'media',
  assignedTechnicianName: null,
};

describe('buildVisitPaidMessage', () => {
  it('arma el aviso mínimo con técnico sin asignar', () => {
    expect(buildVisitPaidMessage(info)).toBe(
      [
        '🔧 VISITA DE PRESUPUESTO PAGADA',
        '⚠️ Sin técnico asignado: asignalo ya.',
        '',
        'Servicio: Cambio de tablero (Electricidad)',
        'Zona: Centro, Quilmes',
        'Turno pedido: 05/10/2026 · Mañana (08–12 h)',
        'Prioridad: media',
      ].join('\n')
    );
  });

  it('si ya tiene técnico lo dice en vez de pedir que se asigne', () => {
    const text = buildVisitPaidMessage({ ...info, assignedTechnicianName: 'María Rodríguez' });
    expect(text).toContain('Técnico asignado: María Rodríguez.');
    expect(text).not.toContain('Sin técnico');
  });

  it('marca la prioridad urgente y usa "A coordinar" si no hay franja', () => {
    const text = buildVisitPaidMessage({ ...info, priority: 'urgente', appointmentBlock: 'unscheduled' });
    expect(text).toContain('Prioridad: 🚨 URGENTE');
    expect(text).toContain('A coordinar');
  });

  it('omite la zona si no hay localidad ni barrio', () => {
    const text = buildVisitPaidMessage({ ...info, city: null, neighborhood: '' });
    expect(text).not.toContain('Zona:');
  });

  it('limpia el texto del cliente: sin links, en una sola línea y con largo acotado', () => {
    const text = buildVisitPaidMessage({
      ...info,
      title: `Urgente\nentrá a https://phishing.example/login ${'x'.repeat(300)}`,
    });
    expect(text).not.toContain('phishing.example');
    expect(text).toContain('[link]');
    const serviceLine = text.split('\n').find((l) => l.startsWith('Servicio:')) as string;
    expect(serviceLine).not.toContain('\n');
    expect(serviceLine.length).toBeLessThan(200);
  });

  it('no incluye teléfono ni dirección aunque el objeto traiga esos datos de más', () => {
    const noisy = { ...info, phone: '1122334455', address: 'Av. Corrientes 3421' } as unknown as VisitPaidInfo;
    const text = buildVisitPaidMessage(noisy);
    expect(text).not.toContain('1122334455');
    expect(text).not.toContain('Corrientes');
  });
});

describe('notifyAdminsVisitPaid', () => {
  beforeEach(() => {
    mocks.sendTelegramMessage.mockReset();
    mocks.sendTelegramMessage.mockResolvedValue(true);
    mocks.adminsResult = { data: [{ id: 'admin-1' }, { id: 'admin-2' }], error: null };
    mocks.inserted = [];
    mocks.insertError = null;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('avisa por Telegram con botón al panel y crea una notificación por admin', async () => {
    await notifyAdminsVisitPaid(info);

    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    const [text, button] = mocks.sendTelegramMessage.mock.calls[0];
    expect(text).toContain('VISITA DE PRESUPUESTO PAGADA');
    expect(button).toEqual({ text: 'Abrir panel de admin', url: 'https://tecniurbano.online/#/hub?order=order-1' });

    expect(mocks.inserted).toHaveLength(2);
    expect(mocks.inserted[0]).toMatchObject({
      table: 'notifications',
      recipient_profile_id: 'admin-1',
      type: 'visit_paid',
      entity_type: 'order',
      entity_id: 'order-1',
      priority: 'high',
      dedupe_key: 'visit_paid:order-1:admin-1',
    });
    expect(mocks.inserted[1]).toMatchObject({ recipient_profile_id: 'admin-2', dedupe_key: 'visit_paid:order-1:admin-2' });
  });

  it('si Telegram falla (rechaza o lanza) igual sale la campanita y no lanza', async () => {
    mocks.sendTelegramMessage.mockRejectedValue(new Error('boom'));
    await expect(notifyAdminsVisitPaid(info)).resolves.toBeUndefined();
    expect(mocks.inserted).toHaveLength(2);
  });

  it('si no se pueden listar los admins igual sale Telegram y no lanza', async () => {
    mocks.adminsResult = { data: null, error: { message: 'db caída' } };
    await expect(notifyAdminsVisitPaid(info)).resolves.toBeUndefined();
    expect(mocks.sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(mocks.inserted).toHaveLength(0);
  });

  it('un error al insertar la notificación (p. ej. dedupe_key repetida) no lanza', async () => {
    mocks.insertError = { code: '23505' };
    await expect(notifyAdminsVisitPaid(info)).resolves.toBeUndefined();
  });
});
