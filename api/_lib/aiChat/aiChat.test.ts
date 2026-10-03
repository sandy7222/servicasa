// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectSafety, wantsHuman } from './safety';
import { askProviders, cleanReply, configuredProviders } from './providers';
import { buildSystemPrompt } from './knowledge';

describe('detectSafety', () => {
  it.each([
    ['Hay olor a quemado en el tablero', 'electricidad'],
    ['saltan chispas del enchufe', 'electricidad'],
    ['me dio la corriente', 'electricidad'],
    ['Siento olor a gas en la cocina', 'gas'],
    ['se está inundando el baño', 'plomeria'],
    ['mi nene quedó encerrado en el baño', 'cerrajeria'],
  ])('"%s" → %s', (text, category) => {
    expect(detectSafety(text)?.category).toBe(category);
  });

  it('no salta con consultas normales', () => {
    expect(detectSafety('¿Cuánto cuesta la visita?')).toBeNull();
    expect(detectSafety('Quiero cambiar una canilla')).toBeNull();
    expect(detectSafety('Necesito instalar un tomacorriente nuevo')).toBeNull();
  });

  it('devuelve un texto fijo que aclara que no hay servicio de emergencia', () => {
    expect(detectSafety('huele a quemado')?.message).toMatch(/no ofrecemos servicio de emergencia/i);
  });
});

describe('wantsHuman', () => {
  it('detecta el pedido de una persona', () => {
    expect(wantsHuman('Quiero hablar con una persona')).toBe(true);
    expect(wantsHuman('necesito atención humana')).toBe(true);
    expect(wantsHuman('quiero que me llamen')).toBe(true);
  });
  it('no confunde consultas normales', () => {
    expect(wantsHuman('¿Qué servicios tienen?')).toBe(false);
  });
});

describe('buildSystemPrompt', () => {
  it('usa el término oficial, nunca "seña", e inyecta el precio vigente', () => {
    const prompt = buildSystemPrompt(50000);
    expect(prompt).toContain('Visita de Presupuesto');
    expect(prompt).toContain('$50.000');
    expect(prompt).toContain('NO es una seña');
    expect(prompt.replace('NO es una seña ni un adelanto', '')).not.toMatch(/\bse(ñ|n)a\b/i);
  });
  it('rol administrativo: no da consejos técnicos y deriva a la Visita de Presupuesto', () => {
    const prompt = buildSystemPrompt(50000);
    expect(prompt).toMatch(/ADMINISTRATIVO/);
    expect(prompt).toMatch(/NO resolvés problemas técnicos/);
    expect(prompt).toMatch(/ofrecé pedir una Visita de Presupuesto/);
  });
  it('tono empático pero sin soluciones ni promesas', () => {
    const prompt = buildSystemPrompt(50000);
    expect(prompt).toMatch(/comprensivo y casi empático/);
    expect(prompt).toMatch(/NO des soluciones/);
    expect(prompt).toMatch(/Nunca prometas que se va a solucionar/);
  });
  it('incluye la guía de uso: formulario, escribirle al técnico, reclamos y calificación', () => {
    const prompt = buildSystemPrompt(50000);
    for (const s of ['Formulario del pedido', 'Escribirle al técnico', 'Abrir reclamo', 'Calificá este servicio']) expect(prompt).toContain(s);
  });
  it('sin precio no inventa uno', () => {
    expect(buildSystemPrompt(null)).toContain('se informa antes de confirmar el pedido');
  });
});

describe('configuredProviders', () => {
  it('saltea los proveedores sin credenciales y respeta el orden', () => {
    expect(configuredProviders({})).toEqual([]);
    const both = configuredProviders({ GROQ_API_KEY: 'g', CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'c' });
    expect(both.map((p) => p.name)).toEqual(['groq', 'cloudflare']);
    const reversed = configuredProviders({ AI_PROVIDERS: 'cloudflare,groq', GROQ_API_KEY: 'g', CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'c' });
    expect(reversed.map((p) => p.name)).toEqual(['cloudflare', 'groq']);
  });
  it('el modelo se cambia por variable de entorno', () => {
    const [p] = configuredProviders({ GROQ_API_KEY: 'g', AI_GROQ_MODEL: 'otro/modelo' });
    expect(p.model).toBe('otro/modelo');
  });
});

describe('cleanReply', () => {
  it('quita el razonamiento <think> y acota el largo', () => {
    expect(cleanReply('<think>pienso cosas</think>Hola, ¿en qué te ayudo?')).toBe('Hola, ¿en qué te ayudo?');
    expect(cleanReply('<think>sin cerrar')).toBe('');
    expect(cleanReply('a'.repeat(5000))).toHaveLength(1200);
  });
});

describe('askProviders', () => {
  const fetchMock = vi.fn();
  const providers = configuredProviders({ GROQ_API_KEY: 'SECRETO-G', CLOUDFLARE_ACCOUNT_ID: 'acc', CLOUDFLARE_API_TOKEN: 'SECRETO-C' });
  const ok = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    errorSpy.mockRestore();
  });

  it('usa el primer proveedor si responde', async () => {
    fetchMock.mockResolvedValueOnce(ok('Hola'));
    const r = await askProviders([{ role: 'user', content: 'hola' }], providers);
    expect(r).toEqual({ text: 'Hola', provider: 'groq' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si el primero da 429 pasa al segundo', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429 })).mockResolvedValueOnce(ok('Desde Cloudflare'));
    const r = await askProviders([{ role: 'user', content: 'hola' }], providers);
    expect(r).toEqual({ text: 'Desde Cloudflare', provider: 'cloudflare' });
  });

  it('si rechaza el parámetro opcional (400) reintenta sin él en el mismo proveedor', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 400 })).mockResolvedValueOnce(ok('Ok sin extra'));
    const r = await askProviders([{ role: 'user', content: 'hola' }], providers);
    expect(r?.provider).toBe('groq');
    const first = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    const second = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(first.reasoning_effort).toBe('none');
    expect(second.reasoning_effort).toBeUndefined();
  });

  it('devuelve null si todos fallan, sin lanzar y sin loguear claves', async () => {
    fetchMock.mockRejectedValue(new TypeError('red caída'));
    await expect(askProviders([{ role: 'user', content: 'hola' }], providers)).resolves.toBeNull();
    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain('SECRETO');
  });

  it('una respuesta vacía cuenta como fallo y pasa al siguiente', async () => {
    fetchMock.mockResolvedValueOnce(ok('<think>nada</think>')).mockResolvedValueOnce(ok('Respuesta real'));
    const r = await askProviders([{ role: 'user', content: 'hola' }], providers);
    expect(r?.provider).toBe('cloudflare');
  });
});
