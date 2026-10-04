// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ID = '22222222-2222-4222-8222-222222222222';
const SECRET_KEY = 'gsk_SECRETO_COMPLETO_1234';

const m = vi.hoisted(() => ({
  caller: vi.fn(),
  rpc: vi.fn(),
  rows: [] as any[],
  updates: [] as any[],
  test: vi.fn(),
}));

vi.mock('../auth.js', () => ({ getAuthenticatedCaller: m.caller }));
vi.mock('../aiChat/providers.js', async (orig) => ({
  ...(await orig<typeof import('../aiChat/providers.js')>()),
  testProvider: m.test,
}));
vi.mock('../supabaseAdmin.js', () => ({
  supabaseAdmin: {
    rpc: (...a: unknown[]) => m.rpc(...a),
    from: () => {
      const q: any = {
        select: () => q,
        order: () => q,
        eq: () => q,
        limit: async () => ({ data: [] }),
        maybeSingle: async () => ({ data: m.rows[0] ?? null, error: null }),
        update: (v: unknown) => { m.updates.push(v); return { eq: async () => ({ error: null }) }; },
        then: (r: any) => r({ data: m.rows, error: null }),
      };
      return q;
    },
  },
}));

import handler from './ai-admin';

const makeRes = () => {
  const res: any = { headers: {}, status(c: number) { res.statusCode = c; return res; }, json(b: unknown) { res.body = b; return res; }, setHeader() {} };
  return res;
};
const call = async (body: Record<string, unknown>, method = 'POST') => {
  const res = makeRes();
  await handler({ method, headers: { authorization: 'Bearer t' }, body } as never, res);
  return res;
};
const row = { id: ID, label: 'Groq', preset: 'groq', base_url: 'https://api.groq.com/openai/v1', model: 'qwen/qwen3.8-27b', reasoning_effort: 'none', enabled: true, priority: 10, secret_id: 's1' };
const valid = { op: 'save', label: 'DeepSeek', preset: 'deepseek', baseUrl: 'https://api.deepseek.com/v1/', model: 'deepseek-chat', reasoningEffort: '', enabled: true, priority: 20, apiKey: 'sk-abcdefgh12345678' };

describe('api ai-admin', () => {
  beforeEach(() => {
    m.caller.mockReset().mockResolvedValue({ userId: 'u', role: 'admin' });
    m.rpc.mockReset().mockImplementation(async (name: string) => (name === 'ai_provider_key' ? { data: SECRET_KEY, error: null } : { data: ID, error: null }));
    m.rows = [row];
    m.updates.length = 0;
    m.test.mockReset().mockResolvedValue({ ok: true, ms: 120, message: 'Funciona' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.GROQ_API_KEY;
  });

  it('solo POST', async () => {
    expect((await call({ op: 'list' }, 'GET')).statusCode).toBe(405);
  });

  it('sin sesión: 401. Cliente o técnico: 403. Nunca toca las claves', async () => {
    m.caller.mockResolvedValue(null);
    expect((await call({ op: 'reveal', id: ID })).statusCode).toBe(401);
    m.caller.mockResolvedValue({ userId: 'u', role: 'customer' });
    expect((await call({ op: 'reveal', id: ID })).statusCode).toBe(403);
    m.caller.mockResolvedValue({ userId: 'u', role: 'technician' });
    expect((await call({ op: 'list' })).statusCode).toBe(403);
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it('la lista NUNCA trae la clave completa, solo los últimos 4 caracteres', async () => {
    const res = await call({ op: 'list' });
    expect(res.statusCode).toBe(200);
    expect(JSON.stringify(res.body)).not.toContain(SECRET_KEY);
    expect(res.body.providers[0].keyHint).toBe('1234');
  });

  it('muestra las claves de Vercel solo como pista de 4 caracteres', async () => {
    process.env.GROQ_API_KEY = 'gsk_clave_de_entorno_9999';
    const res = await call({ op: 'list' });
    expect(res.body.env).toEqual([{ name: 'groq', label: 'Groq', variable: 'GROQ_API_KEY', hint: '9999' }]);
    expect(JSON.stringify(res.body)).not.toContain('clave_de_entorno');
  });

  it('reveal devuelve la clave completa al admin', async () => {
    const res = await call({ op: 'reveal', id: ID });
    expect(res.body).toEqual({ key: SECRET_KEY });
  });

  it('reveal rechaza ids que no son uuid', async () => {
    expect((await call({ op: 'reveal', id: 'x; drop table' })).statusCode).toBe(400);
  });

  it('guardar: normaliza la URL y manda todo a la función de base', async () => {
    const res = await call(valid);
    expect(res.statusCode).toBe(200);
    expect(m.rpc).toHaveBeenCalledWith('ai_provider_save', expect.objectContaining({ p_id: null, p_base_url: 'https://api.deepseek.com/v1', p_api_key: 'sk-abcdefgh12345678' }));
  });

  it.each([
    ['URL sin https', { baseUrl: 'http://api.ejemplo.com/v1' }],
    ['localhost', { baseUrl: 'https://localhost/v1' }],
    ['red interna', { baseUrl: 'https://192.168.1.10/v1' }],
    ['metadata de la nube', { baseUrl: 'https://169.254.169.254/latest' }],
    ['URL con usuario', { baseUrl: 'https://user:pass@api.ejemplo.com/v1' }],
    ['sin modelo', { model: '  ' }],
    ['sin nombre', { label: '' }],
    ['alta sin clave', { apiKey: '' }],
    ['clave con espacios', { apiKey: 'sk abc defghijk' }],
    ['clave demasiado corta', { apiKey: 'abc' }],
    ['orden fuera de rango', { priority: 99999 }],
  ])('guardar rechaza: %s', async (_name, patch) => {
    const res = await call({ ...valid, ...patch });
    expect(res.statusCode).toBe(400);
    expect(m.rpc).not.toHaveBeenCalledWith('ai_provider_save', expect.anything());
  });

  it('editar sin clave nueva conserva la actual (manda clave vacía)', async () => {
    const res = await call({ ...valid, id: ID, apiKey: '' });
    expect(res.statusCode).toBe(200);
    expect(m.rpc).toHaveBeenCalledWith('ai_provider_save', expect.objectContaining({ p_id: ID, p_api_key: '' }));
  });

  it('probar: usa la clave guardada y devuelve el resultado explicado', async () => {
    const res = await call({ op: 'test', id: ID });
    expect(res.body).toMatchObject({ ok: true, message: 'Funciona' });
    expect(m.test.mock.calls[0][0]).toMatchObject({ key: SECRET_KEY, model: 'qwen/qwen3.8-27b', extra: { reasoning_effort: 'none' } });
    expect(JSON.stringify(res.body)).not.toContain(SECRET_KEY);
  });

  it('eliminar y ordenar pasan por la base', async () => {
    expect((await call({ op: 'delete', id: ID })).statusCode).toBe(200);
    expect(m.rpc).toHaveBeenCalledWith('ai_provider_delete', { p_id: ID });
    expect((await call({ op: 'set-order', ids: [ID] })).statusCode).toBe(200);
    expect(m.updates[0]).toMatchObject({ priority: 10 });
  });

  it('importar la clave de Vercel: error claro si no hay', async () => {
    const res = await call({ op: 'import-env' });
    expect(res.statusCode).toBe(404);
  });

  it('importar la clave de Vercel la guarda como proveedor Groq', async () => {
    process.env.GROQ_API_KEY = 'gsk_clave_de_entorno_9999';
    const res = await call({ op: 'import-env' });
    expect(res.statusCode).toBe(200);
    expect(m.rpc).toHaveBeenCalledWith('ai_provider_save', expect.objectContaining({ p_preset: 'groq', p_api_key: 'gsk_clave_de_entorno_9999' }));
  });

  it('operación desconocida: 400; error interno: 500 sin filtrar detalles', async () => {
    expect((await call({ op: 'borrar-todo' })).statusCode).toBe(400);
    m.rpc.mockResolvedValue({ data: null, error: { message: 'detalle interno secreto' } });
    const res = await call({ op: 'delete', id: ID });
    expect(res.statusCode).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('detalle interno');
  });
});
