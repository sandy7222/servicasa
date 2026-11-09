// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NID = '33333333-3333-4333-8333-333333333333';

const m = vi.hoisted(() => ({
  send: vi.fn(),
  setVapid: vi.fn(),
  notification: null as any,
  subs: [] as any[],
  role: 'technician',
  deleted: [] as string[],
  updated: [] as string[],
}));

vi.mock('web-push', () => ({ default: { sendNotification: m.send, setVapidDetails: m.setVapid } }));
vi.mock('./supabaseAdmin.js', () => ({
  supabaseAdmin: {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: (_col: string, value: string) => {
          q._eq = value;
          return q;
        },
        maybeSingle: async () => ({ data: table === 'notifications' ? m.notification : table === 'profiles' ? { role: m.role } : null }),
        update: () => ({ eq: async (_c: string, id: string) => { m.updated.push(id); return { error: null }; } }),
        delete: () => ({ eq: async (_c: string, id: string) => { m.deleted.push(id); return { error: null }; } }),
        then: (resolve: any) => resolve({ data: table === 'push_subscriptions' ? m.subs : [], error: null }),
      };
      return q;
    },
  },
}));

import { sendPushForNotification } from './webPush';

const notification = (over: Record<string, unknown> = {}) => ({
  id: NID,
  recipient_profile_id: 'tech-1',
  title: 'Nueva visita asignada',
  body: 'Instalación de tomacorrientes — Quilmes',
  entity_type: 'order',
  entity_id: 'ord-9',
  priority: 'high',
  ...over,
});
const sub = (id: string) => ({ id, endpoint: `https://push.example/${id}`, p256dh: 'p256', auth: 'authkey' });

describe('sendPushForNotification', () => {
  beforeEach(() => {
    m.send.mockReset().mockResolvedValue({});
    m.setVapid.mockReset();
    m.notification = notification();
    m.subs = [sub('s1')];
    m.role = 'technician';
    m.deleted.length = 0;
    m.updated.length = 0;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.VAPID_PUBLIC_KEY = 'pub';
    process.env.VAPID_PRIVATE_KEY = 'priv';
    process.env.VAPID_SUBJECT = 'mailto:hola@tecniurbano.online';
  });

  it('sin claves VAPID no envía nada ni falla', async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(await sendPushForNotification(NID)).toEqual({ sent: 0, removed: 0 });
    expect(m.send).not.toHaveBeenCalled();
  });

  it('notificación inexistente o destinatario sin dispositivos: no envía', async () => {
    m.notification = null;
    expect((await sendPushForNotification(NID)).sent).toBe(0);
    m.notification = notification();
    m.subs = [];
    expect((await sendPushForNotification(NID)).sent).toBe(0);
    expect(m.send).not.toHaveBeenCalled();
  });

  it('envía a cada dispositivo con título, texto y la pantalla que corresponde al rol', async () => {
    m.subs = [sub('s1'), sub('s2')];
    const res = await sendPushForNotification(NID);
    expect(res.sent).toBe(2);
    const [subscription, payload, options] = m.send.mock.calls[0];
    expect(subscription).toEqual({ endpoint: 'https://push.example/s1', keys: { p256dh: 'p256', auth: 'authkey' } });
    expect(JSON.parse(payload)).toEqual({
      title: 'Nueva visita asignada',
      body: 'Instalación de tomacorrientes — Quilmes',
      url: '/#/technician?order=ord-9',
      tag: NID,
    });
    expect(options).toMatchObject({ urgency: 'high' });
    expect(m.updated).toEqual(['s1', 's2']);
  });

  it('un aviso de prioridad normal también sale con urgencia alta, para sonar con la pantalla apagada', async () => {
    m.notification = notification({ priority: 'normal' });
    await sendPushForNotification(NID);
    expect(m.send.mock.calls[0][2]).toMatchObject({ urgency: 'high' });
  });

  it('un dispositivo vencido (410) se borra y no impide enviar a los demás', async () => {
    m.subs = [sub('viejo'), sub('vivo')];
    m.send.mockRejectedValueOnce(Object.assign(new Error('gone'), { statusCode: 410 })).mockResolvedValueOnce({});
    const res = await sendPushForNotification(NID);
    expect(res).toEqual({ sent: 1, removed: 1 });
    expect(m.deleted).toEqual(['viejo']);
  });

  it('otro error de envío se registra sin romper y sin borrar el dispositivo', async () => {
    m.send.mockRejectedValue(Object.assign(new Error('boom'), { statusCode: 500 }));
    const res = await sendPushForNotification(NID);
    expect(res).toEqual({ sent: 0, removed: 0 });
    expect(m.deleted).toEqual([]);
  });

  it('recorta títulos y textos largos', async () => {
    m.notification = notification({ title: 'T'.repeat(200), body: 'x'.repeat(500) });
    await sendPushForNotification(NID);
    const payload = JSON.parse(m.send.mock.calls[0][1]);
    expect(payload.title.length).toBe(80);
    expect(payload.body.length).toBe(160);
  });
});
