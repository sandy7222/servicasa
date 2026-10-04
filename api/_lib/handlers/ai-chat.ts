import { createHash } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { sendTelegramMessage } from '../telegram.js';
import { askProviders, type ChatMessage } from '../aiChat/providers.js';
import { loadProviders } from '../aiChat/providerStore.js';
import { detectSafety, wantsHuman } from '../aiChat/safety.js';
import { buildSystemPrompt } from '../aiChat/knowledge.js';

const MAX_HISTORY = 6;
const MAX_CHARS = 500;
const VISITOR_DAILY_LIMIT = 15;
const GLOBAL_DAILY_LIMIT = 150;
const SAFETY_ALERTS_PER_DAY = 5;

type Kind = 'ai' | 'safety' | 'handoff' | 'limit' | 'unavailable';

const FIXED: Record<'handoff' | 'limit' | 'unavailable', string> = {
  handoff: 'Dale, para eso lo mejor es hablar con una persona del equipo. Escribinos por WhatsApp.',
  limit: 'Hoy ya respondí muchas consultas y llegué al límite. Probá de nuevo mañana o escribinos por WhatsApp.',
  unavailable: 'Ahora mismo no puedo responder. Escribinos por WhatsApp y te contestamos a la brevedad.',
};

function reply(res: VercelResponse, kind: Kind, text: string) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ kind, reply: text, whatsapp: process.env.PUBLIC_WHATSAPP || null });
}

async function allowed(scope: string, key: string, limit: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc('ai_chat_bump', { p_scope: scope, p_key: key, p_limit: limit });
  if (error) {
    console.error('[aiChat] no se pudo contar el uso', error.message);
    return false; // ante la duda, no gastar cupo
  }
  return data === true;
}

function sanitize(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is { role: string; content: unknown } => Boolean(m) && typeof m === 'object')
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: String(m.content).trim().slice(0, MAX_CHARS) }))
    .filter((m) => m.content.length > 0)
    .slice(-MAX_HISTORY);
}

/** Chat de consultas con IA (público). Ver plan-avisos-telegram-y-chat.md, Fase B. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const messages = sanitize((req.body ?? {}).messages);
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'user') {
    return res.status(400).json({ error: 'Escribí tu consulta.' });
  }

  // 1) Seguridad: texto fijo, sin IA y sin gastar cupo.
  const safety = detectSafety(last.content);
  if (safety) {
    if (await allowed('safety_alert', 'all', SAFETY_ALERTS_PER_DAY)) {
      await sendTelegramMessage(`⚠️ Alerta de seguridad en el chat web (${safety.category}). Se mostró el aviso fijo al visitante.`);
    }
    return reply(res, 'safety', safety.message);
  }

  // 2) Pide una persona: WhatsApp, sin IA.
  if (wantsHuman(last.content)) return reply(res, 'handoff', FIXED.handoff);

  const providers = await loadProviders();
  if (providers.length === 0) return reply(res, 'unavailable', FIXED.unavailable);

  // 3) Límites de uso (cupo gratuito).
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || 'sin-ip';
  const visitor = createHash('sha256').update(`tu-ai:${ip}`).digest('hex').slice(0, 32);
  if (!(await allowed('visitor', visitor, VISITOR_DAILY_LIMIT)) || !(await allowed('global', 'all', GLOBAL_DAILY_LIMIT))) {
    return reply(res, 'limit', FIXED.limit);
  }

  // 4) IA, con el precio vigente de la Visita de Presupuesto.
  const { data: setting } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'visit_deposit_amount').maybeSingle();
  const price = Number(setting?.value);
  const result = await askProviders(
    [{ role: 'system', content: buildSystemPrompt(Number.isFinite(price) && price > 0 ? price : null) }, ...messages],
    providers
  );
  if (!result) return reply(res, 'unavailable', FIXED.unavailable);
  return reply(res, 'ai', result.text);
}
