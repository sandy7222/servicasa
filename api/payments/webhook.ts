import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Payment } from 'mercadopago';
import { mpClient } from '../lib/mercadopago.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

/**
 * Legacy IPN notifications (the only format available on this MP account —
 * no "Pagos" event exists separate from "Pagos (legacy)"). MP sends
 * ?topic=payment&id=<payment_id> with NO signature header at all; there is
 * nothing to validate on the request itself.
 *
 * Security model instead relies on never trusting the notification payload:
 * we always re-fetch the payment from Mercado Pago's API using our own
 * MP_ACCESS_TOKEN, and only act on that authenticated response. We then only
 * update a transaction if the fetched payment's external_reference matches a
 * payment_transactions.id we generated ourselves (a random uuid) — an
 * attacker spamming arbitrary payment ids can, at worst, trigger a lookup
 * that finds nothing to update.
 *
 * This endpoint's URL itself is not public: Vercel Deployment Protection
 * still gates every request behind the ?x-vercel-protection-bypass secret
 * configured in the Mercado Pago webhook URL.
 */
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
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).end();
  }

  // Legacy IPN uses topic/id; tolerate type/data.id too in case this account
  // ever gets access to the newer webhook format.
  const topic = (req.query.topic ?? req.query.type) as string | undefined;
  const paymentId = (req.query.id ?? req.query['data.id']) as string | undefined;

  if (topic !== 'payment' || !paymentId) {
    // Other topics (merchant_order, etc.) or malformed calls — nothing to do.
    return res.status(200).json({ received: true, ignored: true });
  }

  try {
    const payment = await new Payment(mpClient).get({ id: paymentId });
    const transactionId = payment.external_reference;
    if (!transactionId) {
      console.error('[payments/webhook] Pago sin external_reference', payment.id);
      return res.status(200).json({ received: true, warning: 'sin external_reference' });
    }

    const feeAmount = (payment.fee_details ?? []).reduce((sum, fee) => sum + (fee.amount ?? 0), 0);

    const { error, count } = await supabaseAdmin
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
      }, { count: 'exact' })
      .eq('id', transactionId);

    if (error) {
      console.error('[payments/webhook] Error actualizando payment_transactions', error);
      return res.status(500).json({ error: 'No se pudo registrar el pago.' });
    }
    if (!count) {
      // external_reference didn't match anything we created — ignore, not an error.
      console.warn('[payments/webhook] Sin transacción propia para external_reference', transactionId);
      return res.status(200).json({ received: true, warning: 'transacción no encontrada' });
    }

    // Intentionally does not touch service_orders / create any order here —
    // that gets wired in a separate pass once the guest-order flow exists.
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[payments/webhook] Error consultando Mercado Pago', err);
    return res.status(500).json({ error: 'No se pudo verificar el pago con Mercado Pago.' });
  }
}
