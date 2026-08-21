import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Public, unauthenticated endpoint: lets a guest poll the status of the
 * order they just paid for, using the opaque token from their checkout
 * redirect — never their raw order id (not guessable/enumerable). Once the
 * payment is confirmed, also returns the account-invite link the webhook
 * generated, so the guest can set a password and start tracking future
 * orders from a real account.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(400).json({ error: 'Falta el token de la solicitud.' });

  const { data: order, error } = await supabaseAdmin
    .from('service_orders')
    .select('id, title, payment_status, customer_id')
    .eq('guest_access_token', token)
    .maybeSingle();
  if (error || !order) {
    return res.status(404).json({ error: 'No encontramos esa solicitud.' });
  }

  const paid = order.payment_status === 'deposit_paid' || order.payment_status === 'paid_in_full';
  let inviteUrl: string | null = null;

  if (paid) {
    const { data: invite } = await supabaseAdmin
      .from('account_invites')
      .select('token')
      .eq('kind', 'customer')
      .eq('target_id', order.customer_id)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (invite?.token) {
      const origin = `https://${req.headers.host}`;
      inviteUrl = `${origin}/#/auth?invite=${invite.token}`;
    }
  }

  return res.status(200).json({
    title: order.title,
    paymentStatus: order.payment_status,
    paid,
    inviteUrl,
  });
}
