import webpush from 'web-push';
import { supabaseAdmin } from './supabaseAdmin.js';
import { pushUrlFor, type PushRole } from './pushRoute.js';

type NotificationRow = {
  id: string;
  recipient_profile_id: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  priority: string | null;
};

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

const TTL_SECONDS = 60 * 60;
let configured = false;

/** Sin las tres variables VAPID no se envía nada (y no falla). */
function configure(): boolean {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

function trim(value: string | null | undefined, max: number): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/**
 * Manda un aviso push por cada dispositivo del destinatario de una notificación. Nunca lanza:
 * un fallo de envío no puede afectar a quien creó la notificación. Los dispositivos que el
 * servicio de push da por vencidos (404/410) se borran solos. No loguea claves ni endpoints.
 */
export async function sendPushForNotification(notificationId: string): Promise<{ sent: number; removed: number }> {
  const result = { sent: 0, removed: 0 };
  if (!configure()) return result;

  const { data: notification } = await supabaseAdmin
    .from('notifications')
    .select('id, recipient_profile_id, title, body, entity_type, entity_id, priority')
    .eq('id', notificationId)
    .maybeSingle();
  const n = notification as NotificationRow | null;
  if (!n) return result;

  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('profile_id', n.recipient_profile_id);
  const subscriptions = (subs ?? []) as SubscriptionRow[];
  if (subscriptions.length === 0) return result;

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', n.recipient_profile_id).maybeSingle();
  const role = ((profile as { role?: string } | null)?.role ?? 'customer') as PushRole;

  const payload = JSON.stringify({
    title: trim(n.title, 80) || 'TecniUrbano',
    body: trim(n.body, 160),
    url: pushUrlFor(role, n.entity_type, n.entity_id),
    tag: n.id,
  });

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        payload,
        { TTL: TTL_SECONDS, urgency: n.priority === 'high' ? 'high' : 'normal' }
      );
      result.sent += 1;
      await supabaseAdmin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', subscription.id);
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', subscription.id);
        result.removed += 1;
      } else {
        console.error('[webPush] no se pudo enviar', status ?? (err instanceof Error ? err.name : 'desconocido'));
      }
    }
  }
  return result;
}
