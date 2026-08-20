import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'node:crypto';
import { Payment } from 'mercadopago';
import { mpClient } from '../_lib/mercadopago';
import { supabaseAdmin } from '../_lib/supabaseAdmin';

/**
 * Validates the Mercado Pago webhook signature per their documented recipe:
 * https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks#editor_5
 *
 * manifest = "id:{data.id};request-id:{x-request-id};ts:{ts};"
 * expected  = HMAC_SHA256(manifest, MP_WEBHOOK_SECRET)
 * We never trust the notification payload itself — after verifying the
 * signature we re-fetch the payment from Mercado Pago's API by id.
 */
function isValidSignature(req: VercelRequest, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[payments/webhook] MP_WEBHOOK_SECRET no configurado — rechazando notificación.');
    return false;
  }

  const signatureHeader = req.headers['x-signature'];
  const requestId = req.headers['x-request-id'];
  if (typeof signatureHeader !== 'string' || typeof requestId !== 'string') return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((piece) => {
      const [key, value] = piece.split('=').map((s) => s.trim());
      return [key, value];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(v1, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function mapStatus(mpStatus: string | undefined): 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded' {
  switch (mpStatus) {
    case 'approved':
      return 'approved';
    case 'rejected':
      return 'rejected';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    default:
      return 'pending';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const type = (req.query.type ?? req.body?.type) as string | undefined;
  const dataId = (req.query['data.id'] ?? req.body?.data?.id) as string | undefined;

  if (type !== 'payment' || !dataId) {
    // Not a payment notification (Mercado Pago also sends other topics) — nothing to do.
    return res.status(200).json({ received: true, ignored: true });
  }

  if (!isValidSignature(req, String(dataId))) {
    console.error('[payments/webhook] Firma inválida, notificación rechazada.');
    return res.status(401).json({ error: 'Firma inválida.' });
  }

  try {
    const payment = await new Payment(mpClient).get({ id: dataId });
    const transactionId = payment.external_reference;
    if (!transactionId) {
      console.error('[payments/webhook] Pago sin external_reference', payment.id);
      return res.status(200).json({ received: true, warning: 'sin external_reference' });
    }

    const feeAmount = (payment.fee_details ?? []).reduce((sum, fee) => sum + (fee.amount ?? 0), 0);

    const { error } = await supabaseAdmin
      .from('payment_transactions')
      .update({
        status: mapStatus(payment.status),
        mp_payment_id: String(payment.id),
        mp_payment_method: payment.payment_method_id ?? null,
        mp_installments: payment.installments ?? null,
        mp_fee_amount: feeAmount,
        provider_payload: payment,
        paid_at: payment.status === 'approved' ? payment.date_approved ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transactionId);

    if (error) {
      console.error('[payments/webhook] Error actualizando payment_transactions', error);
      return res.status(500).json({ error: 'No se pudo registrar el pago.' });
    }

    // Intentionally does not touch service_orders / create any order here —
    // that gets wired in a separate pass once the guest-order flow exists.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[payments/webhook] Error consultando Mercado Pago', err);
    return res.status(500).json({ error: 'No se pudo verificar el pago con Mercado Pago.' });
  }
}
