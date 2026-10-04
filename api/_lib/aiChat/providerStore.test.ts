// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../supabaseAdmin.js', () => ({ supabaseAdmin: { rpc: (...a: unknown[]) => m.rpc(...a) } }));

import { loadProviders } from './providerStore';
import { testProvider, validateBaseUrl, type Provider } from './providers';

const row = (over: Record<string, unknown> = {}) => ({ id: '1', label: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', reasoning_effort: null, api_key: 'sk-db-key', ...over });

describe('loadProviders', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    delete process.env.AI_PROVIDERS;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    process.env.GROQ_API_KEY = 'gsk_env';
  });

  it('primero los del panel en su orden y al final los de Vercel como respaldo', async () => {
    m.rpc.mockResolvedValue({ data: [row()], error: null });
    const list = await loadProviders();
    expect(list.map((p) => p.name)).toEqual(['DeepSeek', 'groq']);
    expect(list[0]).toMatchObject({ key: 'sk-db-key', model: 'deepseek-chat' });
  });

  it('no repite una clave que ya está en el panel (importada desde Vercel)', async () => {
    m.rpc.mockResolvedValue({ data: [row({ label: 'Groq', api_key: 'gsk_env' })], error: null });
    expect((await loadProviders()).map((p) => p.name)).toEqual(['Groq']);
  });

  it('el razonamiento solo se manda si está cargado', async () => {
    m.rpc.mockResolvedValue({ data: [row({ reasoning_effort: 'none' }), row({ id: '2', label: 'Otro', api_key: 'k2' })], error: null });
    const [a, b] = await loadProviders();
    expect(a.extra).toEqual({ reasoning_effort: 'none' });
    expect(b.extra).toBeUndefined();
  });

  it('si la base falla, el chat sigue con las variables de Vercel', async () => {
    m.rpc.mockResolvedValue({ data: null, error: { message: 'caída' } });
    expect((await loadProviders()).map((p) => p.name)).toEqual(['groq']);
  });
});

describe('validateBaseUrl', () => {
  it('acepta https público y saca la barra final', () => {
    expect(validateBaseUrl('https://api.groq.com/openai/v1/')).toEqual({ ok: true, url: 'https://api.groq.com/openai/v1' });
  });
  it.each(['http://api.x.com', 'https://localhost', 'https://127.0.0.1', 'https://10.0.0.5', 'https://172.20.1.1', 'https://192.168.0.1', 'https://169.254.169.254', 'https://miservidor.local', 'https://u:p@api.x.com', 'no es url'])('rechaza %s', (url) => {
    expect(validateBaseUrl(url).ok).toBe(false);
  });
});

describe('testProvider', () => {
  const provider: Provider = { name: 'x', baseUrl: 'https://api.x.com/v1', key: 'k', model: 'm', extra: { reasoning_effort: 'none' } };
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown = {}) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

  it('éxito', async () => {
    vi.stubGlobal('fetch', reply(200, { choices: [{ message: { content: 'OK' } }] }));
    expect(await testProvider(provider)).toMatchObject({ ok: true });
  });
  it('respuesta vacía no cuenta como éxito', async () => {
    vi.stubGlobal('fetch', reply(200, { choices: [{ message: { content: '<think>algo</think>' } }] }));
    expect((await testProvider(provider)).ok).toBe(false);
  });
  it('clave rechazada se explica', async () => {
    vi.stubGlobal('fetch', reply(401));
    expect((await testProvider(provider)).message).toMatch(/clave fue rechazada/);
  });
  it('modelo inexistente se explica', async () => {
    vi.stubGlobal('fetch', reply(404));
    expect((await testProvider(provider)).message).toMatch(/modelo o la dirección/);
  });
  it('429 significa clave válida pero sin cupo', async () => {
    vi.stubGlobal('fetch', reply(429));
    expect(await testProvider(provider)).toMatchObject({ ok: true, message: expect.stringMatching(/se agotó el cupo/) });
  });
  it('si rechaza el parámetro opcional (400), reintenta sin él', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 400 })).mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'OK' } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect((await testProvider(provider)).ok).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).reasoning_effort).toBeUndefined();
  });
  it('error de red no lanza', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('x')));
    expect((await testProvider(provider)).message).toMatch(/No se pudo conectar/);
  });
});
