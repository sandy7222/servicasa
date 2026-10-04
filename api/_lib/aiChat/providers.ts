export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type Provider = {
  name: string;
  baseUrl: string;
  key: string;
  model: string;
  /** Parámetros opcionales (p. ej. apagar el "razonamiento" para ahorrar cupo). */
  extra?: Record<string, unknown>;
};

const TIMEOUT_MS = 12000;
const MAX_TOKENS = 350;

/**
 * Cadena de proveedores de IA gratuitos, en orden de preferencia
 * (AI_PROVIDERS, por defecto "groq,cloudflare"). Un proveedor sin credenciales se
 * saltea solo. Cambiar de modelo o de proveedor es cambiar variables de entorno,
 * sin tocar código: los planes gratuitos retiran modelos cada tanto
 * (ver plan-avisos-telegram-y-chat.md, Fase B).
 */
export function configuredProviders(env: Record<string, string | undefined> = process.env): Provider[] {
  const order = (env.AI_PROVIDERS ?? 'groq,cloudflare').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const out: Provider[] = [];
  for (const name of order) {
    if (name === 'groq' && env.GROQ_API_KEY) {
      out.push({
        name,
        baseUrl: 'https://api.groq.com/openai/v1',
        key: env.GROQ_API_KEY,
        model: env.AI_GROQ_MODEL || 'qwen/qwen3.8-27b',
        extra: { reasoning_effort: env.AI_GROQ_REASONING_EFFORT || 'none' },
      });
    } else if (name === 'cloudflare' && env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN) {
      out.push({
        name,
        baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
        key: env.CLOUDFLARE_API_TOKEN,
        model: env.AI_CLOUDFLARE_MODEL || '@cf/qwen/qwen3-30b-a3b-fp8',
      });
    }
  }
  return out;
}

/** Algunos modelos devuelven su razonamiento entre <think>…</think>: nunca se muestra. */
export function cleanReply(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/i, '')
    .trim()
    .slice(0, 1200);
}

async function callOnce(provider: Provider, messages: ChatMessage[], withExtra: boolean): Promise<Response> {
  return fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${provider.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: provider.model,
      messages,
      max_tokens: MAX_TOKENS,
      temperature: 0.3,
      ...(withExtra ? provider.extra : {}),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Prueba cada proveedor en orden. Ante 429, error de servidor, red o respuesta
 * vacía pasa al siguiente. Si un proveedor rechaza un parámetro opcional (400),
 * reintenta sin él. Nunca lanza ni loguea claves (solo nombre y estado HTTP).
 */
export async function askProviders(
  messages: ChatMessage[],
  providers: Provider[]
): Promise<{ text: string; provider: string } | null> {
  for (const provider of providers) {
    try {
      let response = await callOnce(provider, messages, true);
      if (response.status === 400 && provider.extra) response = await callOnce(provider, messages, false);
      if (!response.ok) {
        console.error('[aiChat] proveedor falló', provider.name, response.status);
        continue;
      }
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = cleanReply(json.choices?.[0]?.message?.content ?? '');
      if (text) return { text, provider: provider.name };
      console.error('[aiChat] respuesta vacía', provider.name);
    } catch (err) {
      console.error('[aiChat] error de red o timeout', provider.name, err instanceof Error ? err.name : 'desconocido');
    }
  }
  return null;
}

/**
 * Valida la dirección de un proveedor cargado por el admin. Solo https, sin
 * usuario/clave en la URL y sin apuntar a la máquina local ni a redes privadas
 * (el servidor hace el pedido: evita que se use para tocar servicios internos).
 * Devuelve la URL normalizada (sin "/" final) o un mensaje de error.
 */
export function validateBaseUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let parsed: URL;
  try {
    parsed = new URL(String(raw).trim());
  } catch {
    return { ok: false, error: 'La dirección no es una URL válida.' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'La dirección tiene que empezar con https://' };
  if (parsed.username || parsed.password) return { ok: false, error: 'La dirección no puede incluir usuario ni clave.' };
  const host = parsed.hostname.toLowerCase();
  const isPrivateIp =
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^(\[?::1\]?|\[?fe80:|\[?fc|\[?fd)/.test(host);
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || isPrivateIp) {
    return { ok: false, error: 'La dirección no puede ser de una red interna.' };
  }
  return { ok: true, url: parsed.toString().replace(/\/+$/, '') };
}

export type ProviderTestResult = { ok: boolean; ms: number; status?: number; message: string };

/** Prueba una conexión real (1 pedido corto) y explica el resultado en castellano. */
export async function testProvider(provider: Provider): Promise<ProviderTestResult> {
  const started = Date.now();
  const messages: ChatMessage[] = [{ role: 'user', content: 'Respondé solamente con la palabra: OK' }];
  try {
    let response = await callOnce(provider, messages, true);
    if (response.status === 400 && provider.extra) response = await callOnce(provider, messages, false);
    const ms = Date.now() - started;
    if (response.ok) {
      const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const text = cleanReply(json.choices?.[0]?.message?.content ?? '');
      return text
        ? { ok: true, ms, status: response.status, message: 'Funciona: el proveedor respondió.' }
        : { ok: false, ms, status: response.status, message: 'Respondió vacío. Revisá que el modelo sea correcto.' };
    }
    if (response.status === 401 || response.status === 403) return { ok: false, ms, status: response.status, message: 'La clave fue rechazada (vencida, mal copiada o sin permiso).' };
    if (response.status === 404) return { ok: false, ms, status: response.status, message: 'No se encontró el modelo o la dirección. Revisá el nombre del modelo y la URL.' };
    if (response.status === 429) return { ok: true, ms, status: response.status, message: 'La clave es válida, pero hoy se agotó el cupo gratuito de este proveedor.' };
    return { ok: false, ms, status: response.status, message: `El proveedor devolvió un error (${response.status}).` };
  } catch (err) {
    const timeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return { ok: false, ms: Date.now() - started, message: timeout ? 'El proveedor tardó demasiado en responder.' : 'No se pudo conectar con el proveedor.' };
  }
}
