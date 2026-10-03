import { timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { sendTelegramMessage } from '../telegram.js';
import { clean } from '../visitPaidAlert.js';

type Kind = 'technician_registered' | 'technician_documents' | 'customer_registered';

const KINDS: Kind[] = ['technician_registered', 'technician_documents', 'customer_registered'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Varios archivos subidos seguidos = un solo aviso. */
const DOCUMENTS_WINDOW_MS = 2 * 60 * 60 * 1000;
/** Tope de avisos de clientes nuevos por día (hora Argentina, UTC-3 sin horario de verano). */
export const CUSTOMER_DAILY_CAP = 10;
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

function secretMatches(received: unknown): boolean {
  const expected = process.env.ADMIN_EVENT_SECRET;
  if (!expected || typeof received !== 'string') return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function appUrl(path: string): string {
  const base = (process.env.PUBLIC_APP_URL || 'https://tecniurbano.online').replace(/\/$/, '');
  return `${base}/#${path}`;
}

/** Medianoche argentina más reciente, en ISO UTC. */
export function startOfArgentinaDay(now = Date.now()): string {
  const day = 24 * 60 * 60 * 1000;
  return new Date(Math.floor((now - AR_OFFSET_MS) / day) * day + AR_OFFSET_MS).toISOString();
}

/**
 * Registra el evento y decide si este request es el que avisa. Se inserta primero
 * y después se mira quién es el más antiguo de la ventana (por fecha e id): así, si
 * llegan varios a la vez (varios archivos subidos juntos), solo uno gana.
 */
async function claimEvent(kind: Kind, entityId: string, windowStartIso: string | null): Promise<{ first: boolean; id: string | null }> {
  const { data: mine, error } = await supabaseAdmin
    .from('admin_event_log')
    .insert({ kind, entity_id: entityId })
    .select('id')
    .single();
  if (error || !mine) {
    console.error('[admin-event] no se pudo registrar el evento', error?.message);
    return { first: false, id: null };
  }
  let filtered = supabaseAdmin.from('admin_event_log').select('id').eq('kind', kind).eq('entity_id', entityId);
  if (windowStartIso) filtered = filtered.gte('created_at', windowStartIso);
  const { data: oldest } = await filtered
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1);
  return { first: (oldest?.[0] as { id: string } | undefined)?.id === (mine as { id: string }).id, id: (mine as { id: string }).id };
}

async function technicianSummary(technicianId: string): Promise<{ name: string; specialties: string }> {
  const [{ data: tech }, { data: specs }] = await Promise.all([
    supabaseAdmin.from('technicians').select('name').eq('id', technicianId).maybeSingle(),
    supabaseAdmin.from('technician_specialties').select('categories(name)').eq('technician_id', technicianId),
  ]);
  const names = ((specs ?? []) as unknown as Array<{ categories?: { name?: string } | null }>)
    .map((row) => clean(row.categories?.name, 40))
    .filter(Boolean);
  return { name: clean((tech as { name?: string } | null)?.name, 60) || 'Sin nombre', specialties: names.join(', ') };
}

async function bellForAdmins(type: 'technician_registered' | 'technician_documents', technicianId: string, title: string, body: string) {
  const { data: admins, error } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
  if (error) {
    console.error('[admin-event] no se pudo listar admins', error.message);
    return;
  }
  const bucket = type === 'technician_documents' ? Math.floor(Date.now() / DOCUMENTS_WINDOW_MS) : 'once';
  for (const admin of (admins ?? []) as Array<{ id: string }>) {
    const { error: insertError } = await supabaseAdmin.from('notifications').insert({
      recipient_profile_id: admin.id,
      type,
      title,
      body,
      entity_type: 'technician',
      entity_id: technicianId,
      priority: 'high',
      dedupe_key: `${type}:${technicianId}:${admin.id}:${bucket}`,
    });
    if (insertError) console.error('[admin-event] no se pudo crear la notificación', insertError.message);
  }
}

async function onTechnicianRegistered(technicianId: string) {
  const { first } = await claimEvent('technician_registered', technicianId, null);
  if (!first) return;
  const { name, specialties } = await technicianSummary(technicianId);
  const text = [
    '🆕 SE ANOTÓ UN TÉCNICO',
    `Nombre: ${name}`,
    specialties ? `Rubros: ${specialties}` : '',
    'Todavía no subió documentación: te aviso cuando lo haga.',
  ].filter(Boolean).join('\n');
  await Promise.allSettled([
    sendTelegramMessage(text, { text: 'Abrir técnicos', url: appUrl('/hub?tab=technicians') }),
    bellForAdmins('technician_registered', technicianId, 'Se anotó un técnico', `${name}${specialties ? ` — ${specialties}` : ''}`),
  ]);
}

async function onTechnicianDocuments(technicianId: string) {
  const { first } = await claimEvent('technician_documents', technicianId, new Date(Date.now() - DOCUMENTS_WINDOW_MS).toISOString());
  if (!first) return;
  const { name, specialties } = await technicianSummary(technicianId);
  const text = [
    '📎 DOCUMENTACIÓN PARA REVISAR',
    `${name} subió documentos de su legajo.`,
    specialties ? `Rubros: ${specialties}` : '',
  ].filter(Boolean).join('\n');
  await Promise.allSettled([
    sendTelegramMessage(text, { text: 'Revisar legajo', url: appUrl('/hub?tab=technicians') }),
    bellForAdmins('technician_documents', technicianId, 'Legajo para revisar', `${name} subió documentación.`),
  ]);
}

async function onCustomerRegistered(profileId: string) {
  const { id } = await claimEvent('customer_registered', profileId, null);
  if (!id) return;
  const { count } = await supabaseAdmin
    .from('admin_event_log')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'customer_registered')
    .gte('created_at', startOfArgentinaDay());
  const today = count ?? 0;
  // Sin nombre ni email a propósito: Telegram no cifra de punta a punta.
  if (today <= CUSTOMER_DAILY_CAP) {
    await sendTelegramMessage(`👤 Se registró un cliente nuevo (${today} hoy).`, { text: 'Abrir panel', url: appUrl('/hub') });
  } else if (today === CUSTOMER_DAILY_CAP + 1) {
    await sendTelegramMessage(
      `👤 Ya van ${CUSTOMER_DAILY_CAP} clientes nuevos hoy: no te aviso más hasta mañana. Las altas siguen entrando.`
    );
  }
}

/**
 * Lo llama la base de datos (pg_net, ver 20261004120000_admin_event_alerts.sql) cuando
 * se anota un técnico, sube documentación o se registra un cliente. Solo acepta el
 * secreto compartido ADMIN_EVENT_SECRET. Responde 200 aunque el aviso falle: es un
 * "timbre", reintentar no aporta y nunca debe trabar el alta del usuario.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  if (!secretMatches(req.headers['x-admin-event-secret'])) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  const body = (req.body ?? {}) as { kind?: unknown; entityId?: unknown };
  const kind = body.kind as Kind;
  const entityId = String(body.entityId ?? '');
  if (!KINDS.includes(kind) || !UUID.test(entityId)) {
    return res.status(400).json({ error: 'Evento inválido.' });
  }
  try {
    if (kind === 'technician_registered') await onTechnicianRegistered(entityId);
    else if (kind === 'technician_documents') await onTechnicianDocuments(entityId);
    else await onCustomerRegistered(entityId);
  } catch (err) {
    console.error('[admin-event] error inesperado', err instanceof Error ? err.name : 'desconocido');
  }
  return res.status(200).json({ ok: true });
}
