import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Preference } from 'mercadopago';
import { mpClient } from '../_lib/mercadopago';
import { supabaseAdmin } from '../_lib/supabaseAdmin';
import { getAuthenticatedCaller } from '../_lib/auth';

type PaymentType = 'visit_deposit' | 'balance_payment' | 'full_advance' | 'extra_payment';
const VALID_PAYMENT_TYPES: PaymentType[] = ['visit_deposit', 'balance_payment', 'full_advance', 'extra_payment'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const { orderId, paymentType, quoteId } = (req.body ?? {}) as {
    orderId?: string;
    paymentType?: PaymentType;
    quoteId?: string;
  };

  if (!orderId || !paymentType || !VALID_PAYMENT_TYPES.includes(paymentType)) {
    return res.status(400).json({ error: 'Faltan datos o el tipo de pago no es válido.' });
  }

  const caller = await getAuthenticatedCaller(req);
  if (!caller) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('service_orders')
    .select('id, title, customer_id, visit_deposit_amount, total_quoted_amount, extra_amount, payment_status')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError || !order) {
    return res.status(404).json({ error: 'Orden no encontrada.' });
  }

  const isOwner = caller.role === 'customer' && caller.customerId === order.customer_id;
  if (!isOwner && caller.role !== 'admin') {
    return res.status(403).json({ error: 'No tenés permiso para pagar esta orden.' });
  }

  let amount = 0;
  let title = '';

  if (paymentType === 'visit_deposit') {
    amount = Number(order.visit_deposit_amount ?? 0);
    title = `Seña de visita — ${order.title}`;
  } else if (paymentType === 'balance_payment') {
    if (!quoteId) return res.status(400).json({ error: 'Falta el presupuesto a pagar.' });
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from('order_quotes')
      .select('id, order_id, status, remaining_amount')
      .eq('id', quoteId)
      .maybeSingle();
    if (quoteError || !quote || quote.order_id !== orderId) {
      return res.status(404).json({ error: 'Presupuesto no encontrado.' });
    }
    if (quote.status !== 'sent') {
      return res.status(409).json({ error: 'Este presupuesto no está disponible para pago.' });
    }
    amount = Number(quote.remaining_amount);
    title = `Saldo de presupuesto — ${order.title}`;
  } else if (paymentType === 'full_advance') {
    amount = Number(order.total_quoted_amount ?? 0);
    title = `Pago del servicio — ${order.title}`;
  } else if (paymentType === 'extra_payment') {
    amount = Number(order.extra_amount ?? 0);
    title = `Cargo adicional — ${order.title}`;
  }

  if (!amount || amount <= 0) {
    return res.status(409).json({ error: 'El monto a pagar debe ser mayor a cero.' });
  }

  const { data: transaction, error: insertError } = await supabaseAdmin
    .from('payment_transactions')
    .insert({
      order_id: orderId,
      quote_id: paymentType === 'balance_payment' ? quoteId : null,
      payment_type: paymentType,
      provider: 'mercadopago',
      status: 'pending',
      amount,
    })
    .select('id')
    .single();
  if (insertError || !transaction) {
    return res.status(500).json({ error: 'No se pudo iniciar el pago.' });
  }

  const origin = `https://${req.headers.host}`;
  const orderUrl = `${origin}/#/customer/orders/${encodeURIComponent(orderId)}`;

  try {
    const preference = await new Preference(mpClient).create({
      body: {
        items: [{ id: paymentType, title, quantity: 1, unit_price: amount, currency_id: 'ARS' }],
        external_reference: transaction.id,
        notification_url: `${origin}/api/payments/webhook`,
        back_urls: { success: orderUrl, failure: orderUrl, pending: orderUrl },
        auto_return: 'approved',
      },
    });

    await supabaseAdmin
      .from('payment_transactions')
      .update({ mp_preference_id: preference.id })
      .eq('id', transaction.id);

    const paymentUrl = preference.sandbox_init_point || preference.init_point;
    if (!paymentUrl) throw new Error('Mercado Pago no devolvió una URL de checkout.');

    return res.status(200).json({ paymentUrl, preferenceId: preference.id });
  } catch (err) {
    await supabaseAdmin.from('payment_transactions').update({ status: 'cancelled' }).eq('id', transaction.id);
    console.error('[payments/create] Mercado Pago error', err);
    return res.status(502).json({ error: 'No se pudo iniciar el pago seguro con Mercado Pago.' });
  }
}
