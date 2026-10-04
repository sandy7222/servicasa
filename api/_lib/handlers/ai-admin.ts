import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from '../auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { testProvider, validateBaseUrl, type Provider } from '../aiChat/providers.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  id: string;
  label: string;
  preset: string;
  base_url: string;
  model: string;
  reasoning_effort: string | null;
  enabled: boolean;
  priority: number;
  secret_id: string | null;
};

const hint = (key: string | null | undefined) => (key ? key.slice(-4) : null);

function fail(res: VercelResponse, status: number, error: string) {
  return res.status(status).json({ error });
}

type SaveInput = {
  id: string | null;
  label: string;
  preset: string;
  baseUrl: string;
  model: string;
  reasoningEffort: string;
  enabled: boolean;
  priority: number;
  apiKey: string;
};

/** Valida lo que manda el panel. Devuelve el error en castellano o los datos limpios. */
function parseSave(body: Record<string, unknown>): { error: string } | { data: SaveInput } {
  const id = body.id == null || body.id === '' ? null : String(body.id);
  if (id && !UUID.test(id)) return { error: 'Proveedor inválido.' };
  const label = String(body.label ?? '').trim();
  if (label.length < 1 || label.length > 60) return { error: 'El nombre tiene que tener entre 1 y 60 caracteres.' };
  const model = String(body.model ?? '').trim();
  if (model.length < 1 || model.length > 120) return { error: 'Falta el nombre del modelo.' };
  const url = validateBaseUrl(String(body.baseUrl ?? ''));
  if ('error' in url) return { error: url.error };
  const reasoningEffort = String(body.reasoningEffort ?? '').trim();
  if (reasoningEffort.length > 20) return { error: 'El valor de razonamiento es demasiado largo.' };
  const apiKey = String(body.apiKey ?? '').trim();
  if (!id && !apiKey) return { error: 'Falta la API key.' };
  if (apiKey && (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey))) {
    return { error: 'La API key no parece válida (sin espacios, entre 8 y 500 caracteres).' };
  }
  const priority = Number.isInteger(body.priority) ? Number(body.priority) : 100;
  if (priority < 0 || priority > 9999) return { error: 'El orden tiene que estar entre 0 y 9999.' };
  return {
    data: {
      id,
      label,
      preset: String(body.preset ?? 'custom').slice(0, 30),
      baseUrl: url.url,
      model,
      reasoningEffort,
      enabled: body.enabled !== false,
      priority,
      apiKey,
    },
  };
}

async function readKey(id: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.rpc('ai_provider_key', { p_id: id });
  if (error) {
    console.error('[ai-admin] no se pudo leer una clave', error.message);
    return null;
  }
  return typeof data === 'string' && data ? data : null;
}

/**
 * Gestor de proveedores de IA (panel admin → "Asistente IA"). SOLO admin. Las claves
 * viven cifradas en Vault: la lista nunca las devuelve (solo los últimos 4 caracteres);
 * el texto completo sale únicamente por la operación "reveal", cuando el admin toca el
 * ojito. Nunca se loguean claves.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'Método no permitido.');
  }
  const caller = await getAuthenticatedCaller(req);
  if (!caller) return fail(res, 401, 'Tu sesión expiró. Volvé a iniciar sesión.');
  if (caller.role !== 'admin') return fail(res, 403, 'Solo el administrador puede hacer esto.');

  const body = (req.body ?? {}) as Record<string, unknown>;
  const op = String(body.op ?? '');
  const id = String(body.id ?? '');

  try {
    if (op === 'list') {
      const { data, error } = await supabaseAdmin.from('ai_providers').select('*').order('priority', { ascending: true }).order('created_at', { ascending: true });
      if (error) throw error;
      const providers = await Promise.all(
        ((data ?? []) as Row[]).map(async (row) => ({
          id: row.id,
          label: row.label,
          preset: row.preset,
          baseUrl: row.base_url,
          model: row.model,
          reasoningEffort: row.reasoning_effort ?? '',
          enabled: row.enabled,
          priority: row.priority,
          keyHint: row.secret_id ? hint(await readKey(row.id)) : null,
        }))
      );
      const env = [
        { name: 'groq', label: 'Groq', variable: 'GROQ_API_KEY', hint: hint(process.env.GROQ_API_KEY) },
        { name: 'cloudflare', label: 'Cloudflare Workers AI', variable: 'CLOUDFLARE_API_TOKEN', hint: hint(process.env.CLOUDFLARE_API_TOKEN) },
      ].filter((item) => item.hint);
      return res.status(200).json({ providers, env });
    }

    if (op === 'reveal') {
      if (!UUID.test(id)) return fail(res, 400, 'Proveedor inválido.');
      const key = await readKey(id);
      if (!key) return fail(res, 404, 'No hay clave guardada para este proveedor.');
      return res.status(200).json({ key });
    }

    if (op === 'save') {
      const parsed = parseSave(body);
      if ('error' in parsed) return fail(res, 400, parsed.error);
      const d = parsed.data;
      const { data, error } = await supabaseAdmin.rpc('ai_provider_save', {
        p_id: d.id,
        p_label: d.label,
        p_preset: d.preset,
        p_base_url: d.baseUrl,
        p_model: d.model,
        p_reasoning_effort: d.reasoningEffort,
        p_enabled: d.enabled,
        p_priority: d.priority,
        p_api_key: d.apiKey,
      });
      if (error) throw error;
      return res.status(200).json({ id: data });
    }

    if (op === 'set-enabled') {
      if (!UUID.test(id)) return fail(res, 400, 'Proveedor inválido.');
      const { error } = await supabaseAdmin.from('ai_providers').update({ enabled: body.enabled === true, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (op === 'set-order') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      if (ids.length === 0 || ids.length > 50 || !ids.every((v) => UUID.test(v))) return fail(res, 400, 'Orden inválido.');
      for (const [index, providerId] of ids.entries()) {
        const { error } = await supabaseAdmin.from('ai_providers').update({ priority: (index + 1) * 10, updated_at: new Date().toISOString() }).eq('id', providerId);
        if (error) throw error;
      }
      return res.status(200).json({ ok: true });
    }

    if (op === 'delete') {
      if (!UUID.test(id)) return fail(res, 400, 'Proveedor inválido.');
      const { error } = await supabaseAdmin.rpc('ai_provider_delete', { p_id: id });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (op === 'test') {
      if (!UUID.test(id)) return fail(res, 400, 'Proveedor inválido.');
      const { data: row, error } = await supabaseAdmin.from('ai_providers').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      const key = row ? await readKey(id) : null;
      if (!row || !key) return fail(res, 404, 'No hay clave guardada para este proveedor.');
      const r = row as Row;
      const provider: Provider = {
        name: r.label,
        baseUrl: r.base_url,
        key,
        model: r.model,
        ...(r.reasoning_effort ? { extra: { reasoning_effort: r.reasoning_effort } } : {}),
      };
      return res.status(200).json(await testProvider(provider));
    }

    if (op === 'import-env') {
      const key = process.env.GROQ_API_KEY;
      if (!key) return fail(res, 404, 'No hay una clave de Groq en las variables de Vercel.');
      const { data: existing } = await supabaseAdmin.from('ai_providers').select('id').eq('preset', 'groq').limit(1);
      if ((existing ?? []).length > 0) return fail(res, 409, 'Ya hay un proveedor de Groq cargado en el panel.');
      const { data, error } = await supabaseAdmin.rpc('ai_provider_save', {
        p_id: null,
        p_label: 'Groq',
        p_preset: 'groq',
        p_base_url: 'https://api.groq.com/openai/v1',
        p_model: process.env.AI_GROQ_MODEL || 'qwen/qwen3.8-27b',
        p_reasoning_effort: process.env.AI_GROQ_REASONING_EFFORT || 'none',
        p_enabled: true,
        p_priority: 10,
        p_api_key: key,
      });
      if (error) throw error;
      return res.status(200).json({ id: data });
    }

    return fail(res, 400, 'Operación desconocida.');
  } catch (err) {
    console.error('[ai-admin] error', op, err instanceof Error ? err.message : 'desconocido');
    return fail(res, 500, 'No se pudo completar la operación.');
  }
}
