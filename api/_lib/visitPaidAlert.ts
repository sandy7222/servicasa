import { supabaseAdmin } from './supabaseAdmin.js';
import { sendTelegramMessage } from './telegram.js';

export type VisitPaidInfo = {
  orderId: string;
  title: string;
  serviceType: string;
  city?: string | null;
  neighborhood?: string | null;
  /** 'YYYY-MM-DD' */
  scheduledDate?: string | null;
  /** 'unscheduled' | 'morning' | 'midday' | 'afternoon' */
  appointmentBlock?: string | null;
  priority?: string | null;
  /** null/undefined = todavía no tiene técnico (el caso urgente). */
  assignedTechnicianName?: string | null;
};

const BLOCK_LABELS: Record<string, string> = {
  morning: 'Mañana (08–12 h)',
  midday: 'Mediodía (12–15 h)',
  afternoon: 'Tarde (15–19 h)',
  unscheduled: 'A coordinar',
};

/** Texto del cliente: una sola línea, sin links (podrían ser phishing en el
 * chat del admin) y con largo acotado. */
function clean(value: string | null | undefined, max: number): string {
  return String(value ?? '')
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function formatDate(value?: string | null): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : clean(value, 20);
}

function zone(info: VisitPaidInfo): string {
  return [clean(info.neighborhood, 60), clean(info.city, 60)].filter(Boolean).join(', ');
}

/**
 * Aviso mínimo a propósito: NO incluye teléfono ni dirección exacta del
 * cliente (Telegram no cifra de punta a punta); eso se ve en el panel.
 */
export function buildVisitPaidMessage(info: VisitPaidInfo): string {
  const unassigned = !info.assignedTechnicianName;
  const priority = clean(info.priority, 20);
  const lines = [
    '🔧 VISITA DE PRESUPUESTO PAGADA',
    unassigned ? '⚠️ Sin técnico asignado: asignalo ya.' : `Técnico asignado: ${clean(info.assignedTechnicianName, 60)}.`,
    '',
    `Servicio: ${clean(info.title, 120)} (${clean(info.serviceType, 40)})`,
    zone(info) ? `Zona: ${zone(info)}` : '',
    `Turno pedido: ${[formatDate(info.scheduledDate), BLOCK_LABELS[info.appointmentBlock ?? ''] ?? BLOCK_LABELS.unscheduled].filter(Boolean).join(' · ')}`,
    priority ? `Prioridad: ${priority === 'urgente' ? '🚨 URGENTE' : priority}` : '',
  ];
  return lines.filter((line, index) => line !== '' || index === 2).join('\n');
}

function panelUrl(orderId: string): string {
  const base = (process.env.PUBLIC_APP_URL || 'https://tecniurbano.online').replace(/\/$/, '');
  return `${base}/#/hub?order=${orderId}`;
}

async function notifyInApp(info: VisitPaidInfo): Promise<void> {
  const { data: admins, error } = await supabaseAdmin.from('profiles').select('id').eq('role', 'admin');
  if (error) {
    console.error('[visitPaidAlert] no se pudo listar admins', error);
    return;
  }
  const unassigned = !info.assignedTechnicianName;
  for (const admin of (admins ?? []) as Array<{ id: string }>) {
    const { error: insertError } = await supabaseAdmin.from('notifications').insert({
      recipient_profile_id: admin.id,
      type: 'visit_paid',
      title: 'Visita de Presupuesto pagada',
      body: `${clean(info.title, 120)}${zone(info) ? ` — ${zone(info)}` : ''}${unassigned ? '. Sin técnico: asignalo.' : ''}`,
      entity_type: 'order',
      entity_id: info.orderId,
      priority: 'high',
      dedupe_key: `visit_paid:${info.orderId}:${admin.id}`,
    });
    if (insertError) {
      console.error('[visitPaidAlert] no se pudo crear la notificación', insertError);
    }
  }
}

/**
 * Se llama cuando se confirma el pago de una visita de presupuesto: avisa por
 * Telegram y por la campanita del panel de admin. NUNCA lanza ni bloquea más
 * que el timeout de Telegram — el webhook de Mercado Pago no puede fallar por
 * un aviso. Cada canal es independiente: si Telegram cae, la campanita igual
 * sale, y viceversa.
 */
export async function notifyAdminsVisitPaid(info: VisitPaidInfo): Promise<void> {
  try {
    await Promise.allSettled([
      sendTelegramMessage(buildVisitPaidMessage(info), { text: 'Abrir panel de admin', url: panelUrl(info.orderId) }),
      notifyInApp(info),
    ]);
  } catch (err) {
    console.error('[visitPaidAlert] error inesperado', err instanceof Error ? err.name : 'desconocido');
  }
}
