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
