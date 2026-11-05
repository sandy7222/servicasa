// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ACCESS = 'APP_USR-ACCESS-TOKEN-SECRETO';
const REFRESH = 'TG-REFRESH-TOKEN-SECRETO';
const CLIENT_SECRET = 'CLIENT-SECRET-SECRETO';

const m = vi.hoisted(() => ({
  caller: vi.fn(),
  rpc: vi.fn(),
  accepted: [{ id: 'a1' }] as any[],
  acceptedError: null as null | { message: string },
  consumed: { technician_id: 'tech-1' } as null | { technician_id: string },
  stateError: null as null | { message: string },
  insertError: null as null | { message: string },
  log: [] as Array<{ table: string; op: string; arg?: unknown }>,
}));

vi.mock('../auth.js', () => ({ getAuthenticatedCaller: m.caller }));
vi.mock('../telegram.js', () => ({ sendTelegramMessage: vi.fn() }));
vi.mock('../supabaseAdmin.js', () => ({
  supabaseAdmin: {
    rpc: (...a: unknown[]) => m.rpc(...a),
    from: (table: string) => {
      let op = 'select';
      const result = () => {
        if (table === 'legal_acceptances') return { data: m.accepted, error: m.acceptedError };
        if (table === 'mp_oauth_states' && op === 'update') return { data: m.consumed, error: m.stateError };
        if (op === 'insert') return { error: m.insertError };
        return { data: null, error: null };
      };
      const q: any = {
        select: () => q,
        eq: () => q,
        is: () => q,
        gte: () => q,
        limit: () => q,
        delete: () => { op = 'delete'; m.log.push({ table, op }); return q; },
        update: (v: unknown) => { op = 'update'; m.log.push({ table, op, arg: v }); return q; },
        insert: (v: unknown) => { op = 'insert'; m.log.push({ table, op, arg: v }); return Promise.resolve(result()); },
        maybeSingle: async () => result(),
        then: (resolve: any) => resolve(result()),
      };
      return q;
    },
  },
}));

import start from './mp-oauth-start';
import callback from './mp-oauth-callback';
import unlink from './mp-oauth-unlink';

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
const post = async (handler: any) => {
  const res = makeRes();
  await handler({ method: 'POST', headers: { authorization: 'Bearer t' }, body: {} } as never, res);
  return res;
};
const get = async (query: Record<string, string>) => {
  const res = makeRes();
  await callback({ method: 'GET', headers: {}, query } as never, res);
  return res;
};

const tokenResponse = { access_token: ACCESS, refresh_token: REFRESH, user_id: 12345, expires_in: 15552000, scope: 'offline_access read write', public_key: 'APP_USR-pk', token_type: 'Bearer' };

describe('mp-oauth-start', () => {
  beforeEach(() => {
    m.caller.mockReset().mockResolvedValue({ userId: 'u1', role: 'technician', technicianId: 'tech-1', customerId: null });
    m.accepted = [{ id: 'a1' }];
    m.acceptedError = null;
    m.insertError = null;
    m.log.length = 0;
    process.env.MP_APP_CLIENT_ID = '4873478128035371';
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('solo POST', async () => {
    const res = makeRes();
    await start({ method: 'GET', headers: {} } as never, res);
    expect(res.statusCode).toBe(405);
  });

  it('sin sesión: 401', async () => {
    m.caller.mockResolvedValue(null);
    expect((await post(start)).statusCode).toBe(401);
  });

  it('no técnico: 403', async () => {
    m.caller.mockResolvedValue({ userId: 'u1', role: 'customer', technicianId: null, customerId: 'c1' });
    expect((await post(start)).statusCode).toBe(403);
    m.caller.mockResolvedValue({ userId: 'u1', role: 'admin', technicianId: null, customerId: null });
    expect((await post(start)).statusCode).toBe(403);
  });

  it('sin la autorización de cobro registrada: 403 y no crea state', async () => {
    m.accepted = [];
    const res = await post(start);
    expect(res.statusCode).toBe(403);
    expect(m.log.find((l) => l.op === 'insert')).toBeUndefined();
  });

  it('ok: crea el state atado al técnico y devuelve la URL de Mercado Pago', async () => {
    const res = await post(start);
    expect(res.statusCode).toBe(200);
    const inserted = m.log.find((l) => l.table === 'mp_oauth_states' && l.op === 'insert')?.arg as { state: string; technician_id: string };
    expect(inserted.technician_id).toBe('tech-1');
    expect(inserted.state).toMatch(/^[0-9a-f]{48}$/);
    expect(res.body.url).toBe(
      `https://auth.mercadopago.com/authorization?client_id=4873478128035371&response_type=code&platform_id=mp&state=${inserted.state}&redirect_uri=https%3A%2F%2Ftecniurbano.online%2Foauth-callback`
    );
  });
});

describe('mp-oauth-callback', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    m.rpc.mockReset().mockResolvedValue({ data: null, error: null });
    m.consumed = { technician_id: 'tech-1' };
    m.stateError = null;
    m.log.length = 0;
    process.env.MP_APP_CLIENT_ID = '4873478128035371';
    process.env.MP_APP_CLIENT_SECRET = CLIENT_SECRET;
    fetchMock.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => tokenResponse });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('solo GET', async () => {
    const res = makeRes();
    await callback({ method: 'POST', headers: {}, query: {} } as never, res);
    expect(res.statusCode).toBe(405);
  });

  it('sin state: redirige a error y no llama a Mercado Pago', async () => {
    const res = await get({ code: 'c' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe('/#/technician/profile?mp=error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('state inválido, vencido o ya usado (no se pudo marcar usado): error y sin canje', async () => {
    m.consumed = null;
    const res = await get({ code: 'c', state: 'abc' });
    expect(res.headers.Location).toBe('/#/technician/profile?mp=error');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('el técnico rechazó en Mercado Pago (?error=): error, el state queda usado, sin canje', async () => {
    const res = await get({ error: 'access_denied', state: 'abc' });
    expect(res.headers.Location).toBe('/#/technician/profile?mp=error');
    expect(m.log.some((l) => l.table === 'mp_oauth_states' && l.op === 'update')).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('canje ok: guarda por la función de Vault, redirige a ok y no filtra tokens', async () => {
    const res = await get({ code: 'TG-CODE', state: 'abc' });
    expect(res.statusCode).toBe(302);
    expect(res.headers.Location).toBe('/#/technician/profile?mp=ok');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.mercadopago.com/oauth/token');
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      client_id: '4873478128035371',
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code: 'TG-CODE',
      redirect_uri: 'https://tecniurbano.online/oauth-callback',
      test_token: 'false',
    });

    expect(m.rpc).toHaveBeenCalledWith('mp_account_save', expect.objectContaining({
      p_technician_id: 'tech-1',
      p_mp_user_id: '12345',
      p_access_token: ACCESS,
      p_refresh_token: REFRESH,
    }));
    const visible = JSON.stringify({ headers: res.headers, body: res.body, status: res.statusCode });
    for (const secret of [ACCESS, REFRESH, CLIENT_SECRET]) expect(visible).not.toContain(secret);
    const logged = JSON.stringify((console.error as any).mock.calls);
    for (const secret of [ACCESS, REFRESH, CLIENT_SECRET]) expect(logged).not.toContain(secret);
  });

  it('Mercado Pago rechaza el canje: error', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'invalid_grant' }) });
    const res = await get({ code: 'TG-CODE', state: 'abc' });
    expect(res.headers.Location).toBe('/#/technician/profile?mp=error');
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('falla al guardar en Vault: error', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const res = await get({ code: 'TG-CODE', state: 'abc' });
    expect(res.headers.Location).toBe('/#/technician/profile?mp=error');
  });
});

describe('mp-oauth-unlink', () => {
  beforeEach(() => {
    m.caller.mockReset().mockResolvedValue({ userId: 'u1', role: 'technician', technicianId: 'tech-1', customerId: null });
    m.rpc.mockReset().mockResolvedValue({ data: null, error: null });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sin sesión 401, no técnico 403', async () => {
    m.caller.mockResolvedValue(null);
    expect((await post(unlink)).statusCode).toBe(401);
    m.caller.mockResolvedValue({ userId: 'u', role: 'customer', technicianId: null, customerId: 'c' });
    expect((await post(unlink)).statusCode).toBe(403);
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('borra SOLO la cuenta del técnico logueado', async () => {
    const res = await post(unlink);
    expect(res.statusCode).toBe(200);
    expect(m.rpc).toHaveBeenCalledWith('mp_account_delete', { p_technician_id: 'tech-1' });
  });

  it('error de base: 500 sin detalles', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'detalle interno' } });
    const res = await post(unlink);
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('detalle interno');
  });
});
