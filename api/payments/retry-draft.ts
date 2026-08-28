import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Preference } from 'mercadopago';
import { mpClient } from '../lib/mercadopago.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getAuthenticatedCaller } from '../lib/auth.js';

/**
 * "Continuar pago" for a draft the customer already filled out
 * (api/orders/request-service.ts) but never finished paying — creates a
 * fresh Mercado Pago preference for the same draft instead of making the
 * customer redo the form. Does not touch customer_order_drafts.payload or
 * insert another 'payment_pending' notification (already exists from
 * creation) — only mp_preference_id changes.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { draftId } = (req.body ?? {}) as { draftId?: string };
  if (!draftId) {
    return res.status(400).json({ error: 'Falta el borrador a retomar.' });
  }

  const caller = await getAuthenticatedCaller(req);
  if (!caller) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
  if (caller.role !== 'customer' || !caller.customerId) {
    return res.status(403).json({ error: 'Solo un cliente puede retomar un pago.' });
  }

  const { data: draft, error: draftError } = await supabaseAdmin
    .from('customer_order_drafts')
    .select('id, customer_id, status, payment_type, amount, payload')
    .eq('id', draftId)
    .maybeSingle();
  if (draftError || !draft) {
    return res.status(404).json({ error: 'No encontramos esa solicitud.' });
  }
  if (draft.customer_id !== caller.customerId) {
    return res.status(403).json({ error: 'No tenés permiso sobre esta solicitud.' });
  }
  if (draft.status !== 'pending') {
    return res.status(409).json({ error: 'Esta solicitud ya no está disponible para pago.' });
  }

  const payload = draft.payload as { title?: string; workMode?: 'diagnosis' | 'direct' };
  const title = payload?.title ?? 'tu solicitud';
  const origin = `https://${req.headers.host}`;
  const orderUrl = `${origin}/#/customer`;

  try {
    const preference = await new Preference(mpClient).create({
      body: {
        items: [
          {
            id: draft.payment_type,
            title: payload?.workMode === 'diagnosis' ? `Seña de visita — ${title}` : `Pago del servicio — ${title}`,
            quantity: 1,
            unit_price: Number(draft.amount),
            currency_id: 'ARS',
          },
        ],
        external_reference: draft.id,
        notification_url: `${origin}/api/payments/webhook`,
        back_urls: { success: orderUrl, failure: orderUrl, pending: orderUrl },
        auto_return: 'approved',
      },
    });

    await supabaseAdmin
      .from('customer_order_drafts')
      .update({ mp_preference_id: preference.id, updated_at: new Date().toISOString() })
      .eq('id', draft.id);

    const paymentUrl = preference.sandbox_init_point || preference.init_point;
    if (!paymentUrl) throw new Error('Mercado Pago no devolvió una URL de checkout.');

    return res.status(200).json({ paymentUrl });
  } catch (err) {
    console.error('[payments/retry-draft] Mercado Pago error', err);
    return res.status(502).json({ error: 'No se pudo iniciar el pago seguro con Mercado Pago.' });
  }
}
