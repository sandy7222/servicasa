import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from '../auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { cancelSplitForOrder, captureSplitForOrder, RESERVATION_LIFETIME_DAYS } from '../splitPayment.js';

/**
 * Cobro repartido, Fase 3: la reserva del pago del trabajo vista y manejada por administración.
 * /api/payments/split-admin → /api/gateway?action=split-admin   (solo admin)
 *
 * GET  ?orderId=                       → pagos repartidos de la orden (sin tokens ni datos de tarjeta).
 * POST {orderId, action, reason}       → action 'capture' (cobrar ya) o 'cancel' (cancelar la reserva).
 *                                        El motivo es obligatorio y queda guardado.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const caller = await getAuthenticatedCaller(req);
  if (!caller) return res.status(401).json({ error: 'Tu sesión expiró. Volvé a iniciar sesión.' });
  if (caller.role !== 'admin') return res.status(403).json({ error: 'Solo administración.' });
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const orderId = String(req.query.orderId ?? '');
    if (!UUID.test(orderId)) return res.status(400).json({ error: 'Orden inválida.' });
    const { data, error } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, status, amount, application_fee, mp_fee_amount, authorized_at, captured_at, cancelled_at, split_action_reason, created_at')
      .eq('order_id', orderId)
      .eq('split', true)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[split-admin] no se pudieron leer los pagos', error.message);
      return res.status(500).json({ error: 'No se pudo leer la reserva.' });
    }
    const payments = ((data ?? []) as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      expires_at: p.status === 'authorized' && p.authorized_at
        ? new Date(new Date(String(p.authorized_at)).getTime() + RESERVATION_LIFETIME_DAYS * DAY_MS).toISOString()
        : null,
    }));
    return res.status(200).json({ payments });
  }

  const body = (req.body ?? {}) as { orderId?: unknown; action?: unknown; reason?: unknown };
  const orderId = String(body.orderId ?? '');
  const action = body.action;
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (!UUID.test(orderId)) return res.status(400).json({ error: 'Orden inválida.' });
  if (action !== 'capture' && action !== 'cancel') return res.status(400).json({ error: 'Acción inválida.' });
  if (reason.length < 5) return res.status(400).json({ error: 'Escribí el motivo (al menos 5 letras).' });

  const fullReason = `Admin: ${reason.slice(0, 400)}`;
  const result = action === 'capture'
    ? await captureSplitForOrder(orderId, fullReason, true)
    : await cancelSplitForOrder(orderId, fullReason);
  if (!result.ok) return res.status(409).json({ error: result.reason });

  await supabaseAdmin.from('order_events').insert({
    order_id: orderId,
    type: 'note_added',
    description: action === 'capture'
      ? `Administración cobró la reserva del trabajo. Motivo: ${reason.slice(0, 300)}`
      : `Administración canceló la reserva del trabajo (el cliente no paga el trabajo). Motivo: ${reason.slice(0, 300)}`,
    author: 'Administración',
  });
  return res.status(200).json({ status: result.status });
}
