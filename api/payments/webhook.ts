import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MPNotFoundError, Payment } from 'mercadopago';
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

/**
 * Once a payment is confirmed approved, reflect it on the order itself —
 * not just payment_transactions — so the rest of the app (canExecutePaidWork,
 * assignTechnician gating, etc.) sees a consistent payment_status.
 */
/**
 * A payment just confirmed for a customer with no linked account (guest
 * checkout, or any admin-created "cliente sin cuenta" that happens to pay) —
 * auto-generate the same account_invites row the admin's "Generar enlace de
 * cuenta" button creates, so the customer-status page has something to show.
 * No-op if an unused invite already exists (avoids duplicate rows on webhook
 * retries) or the customer already has a linked profile.
 */
async function ensureAccountInviteForGuestCustomer(customerId: string) {
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, profile_id')
    .eq('id', customerId)
    .maybeSingle();
  if (customerError || !customer || customer.profile_id || !customer.email) return;

  const { data: existingInvite } = await supabaseAdmin
    .from('account_invites')
    .select('id')
    .eq('kind', 'customer')
    .eq('target_id', customerId)
    .is('used_at', null)
    .maybeSingle();
  if (existingInvite) return;

  const { error: insertError } = await supabaseAdmin.from('account_invites').insert({
    kind: 'customer',
    target_id: customerId,
    email: customer.email,
    full_name: customer.name,
  });
  if (insertError) {
    console.error('[payments/webhook] Error generando invitacion de cuenta', insertError);
  }
}

async function syncOrderAfterApprovedPayment(
  paymentType: string,
  orderId: string,
  quoteId: string | null,
  amount: number
) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from('service_orders')
    .select('total_paid_amount, customer_id')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError || !order) {
    console.error('[payments/webhook] No se encontró la orden para sincronizar', orderId, orderError);
    return;
  }

  const patch: Record<string, unknown> = {
    total_paid_amount: Number(order.total_paid_amount ?? 0) + amount,
  };

  if (paymentType === 'visit_deposit') {
    patch.payment_status = 'deposit_paid';
  } else if (paymentType === 'full_advance') {
    patch.payment_status = 'paid_in_full';
  } else if (paymentType === 'balance_payment') {
    patch.payment_status = 'paid_in_full';
    patch.quote_status = 'accepted';
  }
  // extra_payment: only accumulates total_paid_amount, no status change —
  // no flow triggers this payment type yet.

  const { error: updateError } = await supabaseAdmin.from('service_orders').update(patch).eq('id', orderId);
  if (updateError) {
    console.error('[payments/webhook] Error sincronizando service_orders', updateError);
  }

  // balance_payment finalizes the quote the customer was paying for — this is
  // what QuoteViewer.tsx's comment refers to: "Do not mark accepted until its
  // webhook confirms payment."
  if (paymentType === 'balance_payment' && quoteId) {
    const { error: quoteError } = await supabaseAdmin
      .from('order_quotes')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', quoteId);
    if (quoteError) {
      console.error('[payments/webhook] Error marcando presupuesto como aceptado', quoteError);
    }
  }

  if ((paymentType === 'visit_deposit' || paymentType === 'full_advance') && order.customer_id) {
    await ensureAccountInviteForGuestCustomer(order.customer_id as string);
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

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('payment_transactions')
      .select('id, order_id, quote_id, payment_type')
      .eq('id', transactionId)
      .maybeSingle();
    if (fetchError || !transaction) {
      // external_reference didn't match anything we created — ignore, not an error.
      console.warn('[payments/webhook] Sin transacción propia para external_reference', transactionId);
      return res.status(200).json({ received: true, warning: 'transacción no encontrada' });
    }

    const feeAmount = (payment.fee_details ?? []).reduce((sum, fee) => sum + (fee.amount ?? 0), 0);
    const status = mapStatus(payment.status);
    const amount = Number(payment.transaction_amount ?? 0);

    const { error: updateError } = await supabaseAdmin
      .from('payment_transactions')
      .update({
        status,
        mp_payment_id: String(payment.id),
        mp_payment_method: payment.payment_method_id ?? null,
        mp_installments: payment.installments ?? null,
        mp_fee_amount: feeAmount,
        provider_payload: payment,
        paid_at: status === 'approved' ? payment.date_approved ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transaction.id);

    if (updateError) {
      console.error('[payments/webhook] Error actualizando payment_transactions', updateError);
      return res.status(500).json({ error: 'No se pudo registrar el pago.' });
    }

    if (status === 'approved') {
      await syncOrderAfterApprovedPayment(transaction.payment_type, transaction.order_id, transaction.quote_id, amount);
    }

    // Intentionally does not CREATE any order here — that gets wired in a
    // separate pass once the guest-order flow exists. This only updates
    // orders that already exist.
    return res.status(200).json({ received: true });
  } catch (err) {
    // A payment id that doesn't exist under our credentials (bogus id, replay,
    // MP's own webhook simulator) is an expected, non-error outcome — ack it
    // with 200 so MP doesn't keep retrying forever. Anything else (auth,
    // network, MP outage) is a real failure: keep the 500 so MP retries later.
    if (err instanceof MPNotFoundError) {
      console.warn('[payments/webhook] Pago no encontrado en Mercado Pago', paymentId);
      return res.status(200).json({ received: true, warning: 'pago no encontrado' });
    }
    console.error('[payments/webhook] Error consultando Mercado Pago', err);
    return res.status(500).json({ error: 'No se pudo verificar el pago con Mercado Pago.' });
  }
}
