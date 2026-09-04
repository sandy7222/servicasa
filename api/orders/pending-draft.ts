import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getAuthenticatedCaller } from '../_lib/auth.js';

/**
 * Lets the logged-in customer check for a draft request they started but
 * never finished paying (api/orders/request-service.ts) — used two ways:
 *  - no `id`: "do you have anything pending?" on the request form, so the
 *    customer never has to retype it, just resumes payment.
 *  - with `id`: resolves a `entity_type=payment` notification link
 *    (see src/lib/notifications.ts) that points at a draft, not an order.
 * Always scoped to the caller's own customer_id — never trusts the id alone.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const caller = await getAuthenticatedCaller(req);
  if (!caller) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
  if (caller.role !== 'customer' || !caller.customerId) {
    return res.status(403).json({ error: 'Solo un cliente puede consultar sus solicitudes.' });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : null;

  let query = supabaseAdmin
    .from('customer_order_drafts')
    .select('id, status, payment_type, amount, payload, created_at')
    .eq('customer_id', caller.customerId);

  query = id ? query.eq('id', id) : query.eq('status', 'pending').order('created_at', { ascending: false });

  const { data: draft, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.error('[orders/pending-draft] Error consultando borrador', error);
    return res.status(500).json({ error: 'No se pudo consultar el borrador.' });
  }
  if (!draft) {
    return res.status(200).json({ draft: null });
  }

  const payload = draft.payload as { title?: string };
  return res.status(200).json({
    draft: {
      id: draft.id,
      status: draft.status,
      title: payload?.title ?? 'tu solicitud',
      amount: draft.amount,
      paymentType: draft.payment_type,
      createdAt: draft.created_at,
    },
  });
}
