/**
 * Cliente del gestor de proveedores de IA (panel admin → "Asistente IA").
 * Todo pasa por /api/gateway?action=ai-admin, que valida que quien llama sea
 * admin; las claves nunca se leen directo desde el navegador.
 */
import { supabase } from './supabase';

export type AiPreset = {
  id: string;
  label: string;
  baseUrl: string;
  model: string;
  reasoningEffort: string;
  /** Aviso de privacidad/cupo propio de ese proveedor. */
  note: string;
};

/** Todos hablan el formato OpenAI "chat/completions". El modelo se puede editar: los planes gratuitos los retiran cada tanto. */
export const AI_PRESETS: AiPreset[] = [
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'qwen/qwen3.8-27b', reasoningEffort: 'none', note: 'Plan gratis con cupo diario. Es el que está en uso hoy.' },
  { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', reasoningEffort: '', note: 'Crédito inicial limitado. Los datos se procesan en China.' },
  { id: 'qwen', label: 'Qwen (Alibaba)', baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', reasoningEffort: '', note: 'Crédito inicial limitado. Los datos se procesan en Singapur/China.' },
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', reasoningEffort: '', note: 'En el plan gratis Google puede usar lo que escriban los clientes para mejorar sus productos.' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '', reasoningEffort: '', note: 'Reúne muchos modelos; algunos tienen versión gratuita (terminan en :free). Escribí el modelo que elijas.' },
  { id: 'custom', label: 'Otro (compatible con OpenAI)', baseUrl: '', model: '', reasoningEffort: '', note: 'Cualquier servicio que acepte el formato OpenAI. Completá la dirección y el modelo según su documentación.' },
];

export type AiProviderRow = {
  id: string;
  label: string;
  preset: string;
  baseUrl: string;
  model: string;
  reasoningEffort: string;
  enabled: boolean;
  priority: number;
  keyHint: string | null;
};

export type AiEnvRow = { name: string; label: string; variable: string; hint: string | null };
export type AiProviderTest = { ok: boolean; ms: number; status?: number; message: string };

export type AiProviderInput = {
  id?: string | null;
  label: string;
  preset: string;
  baseUrl: string;
  model: string;
  reasoningEffort: string;
  enabled: boolean;
  priority: number;
  apiKey: string;
};

async function call<T>(payload: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.');
  const response = await fetch('/api/gateway?action=ai-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

export const aiAdmin = {
  list: () => call<{ providers: AiProviderRow[]; env: AiEnvRow[] }>({ op: 'list' }),
  reveal: (id: string) => call<{ key: string }>({ op: 'reveal', id }).then((r) => r.key),
  save: (input: AiProviderInput) => call<{ id: string }>({ op: 'save', ...input }),
  setEnabled: (id: string, enabled: boolean) => call<{ ok: true }>({ op: 'set-enabled', id, enabled }),
  setOrder: (ids: string[]) => call<{ ok: true }>({ op: 'set-order', ids }),
  remove: (id: string) => call<{ ok: true }>({ op: 'delete', id }),
  test: (id: string) => call<AiProviderTest>({ op: 'test', id }),
  importEnv: () => call<{ id: string }>({ op: 'import-env' }),
};
