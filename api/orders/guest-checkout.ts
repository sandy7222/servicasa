import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Preference } from 'mercadopago';
import { mpClient } from '../lib/mercadopago.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

type WorkMode = 'diagnosis' | 'direct';

type GuestCheckoutBody = {
  fullName?: string;
  email?: string;
  phone?: string;
  address?: string;
  neighborhood?: string;
  province?: string;
  title?: string;
  description?: string;
  serviceType?: string;
  priority?: 'baja' | 'media' | 'alta' | 'urgente';
  scheduledDate?: string;
  appointmentWindow?: string;
  workMode?: WorkMode;
  requestedTotal?: number;
  fixedPriceServiceId?: string;
  quantity?: number;
};

const MAX_TEXT = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VISIT_DEPOSIT_FALLBACK = 30000;

function trimmed(value: unknown, max = MAX_TEXT): string {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * Public, unauthenticated endpoint: lets a visitor with no account request a
 * service. Creates (or reuses) a customers row with no profile_id — same
 * shape admin uses for "cliente sin cuenta" — plus a pending-payment order,
 * then redirects to Mercado Pago exactly like the logged-in flow. Nothing
 * here is exposed via RLS: every write uses the service-role client.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const body = (req.body ?? {}) as GuestCheckoutBody;

  const fullName = trimmed(body.fullName, 120);
  const email = trimmed(body.email, 200).toLowerCase();
  const phone = trimmed(body.phone, 40);
  const address = trimmed(body.address, 200);
  const neighborhood = trimmed(body.neighborhood, 100);
  const province = trimmed(body.province, 60);
  const title = trimmed(body.title, 150);
  const description = trimmed(body.description, MAX_TEXT);
  const serviceType = trimmed(body.serviceType, 60) || 'Reparaciones del hogar';
  const priority = (['baja', 'media', 'alta', 'urgente'] as const).includes(body.priority as never)
    ? (body.priority as 'baja' | 'media' | 'alta' | 'urgente')
    : 'media';
  const scheduledDate = trimmed(body.scheduledDate, 20) || new Date().toISOString().slice(0, 10);
  const appointmentWindow = trimmed(body.appointmentWindow, 60) || 'A coordinar';
  const workMode: WorkMode = body.workMode === 'direct' ? 'direct' : 'diagnosis';
  const fixedPriceServiceId = trimmed(body.fixedPriceServiceId, 100) || null;
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(body.quantity) || 1)));

  if (!fullName || !EMAIL_RE.test(email) || !phone || !address || !province || !title || !description) {
    return res.status(400).json({ error: 'Completá todos los campos obligatorios con datos válidos.' });
  }
  if (workMode === 'direct' && !fixedPriceServiceId) {
    return res.status(400).json({ error: 'Elegí un servicio de precio fijo válido.' });
  }

  // Reuse an existing account-less customer with this email; refuse if the
  // email already belongs to someone with a real account (they should log in).
  const { data: existingCustomer, error: lookupError } = await supabaseAdmin
    .from('customers')
    .select('id, profile_id')
    .eq('email', email)
    .maybeSingle();
  if (lookupError) {
    console.error('[orders/guest-checkout] Error buscando cliente', lookupError);
    return res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
  }
  if (existingCustomer?.profile_id) {
    return res
      .status(409)
      .json({ error: 'Ya existe una cuenta con este email. Iniciá sesión para pedir el servicio.' });
  }

  let customerId = existingCustomer?.id as string | undefined;
  if (customerId) {
    await supabaseAdmin
      .from('customers')
      .update({ name: fullName, address, neighborhood, province, phone })
      .eq('id', customerId);
  } else {
    const { data: newCustomer, error: insertCustomerError } = await supabaseAdmin
      .from('customers')
      .insert({ name: fullName, address, neighborhood, province, phone, email, profile_id: null })
      .select('id')
      .single();
    if (insertCustomerError || !newCustomer) {
      console.error('[orders/guest-checkout] Error creando cliente', insertCustomerError);
      return res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
    }
    customerId = newCustomer.id as string;
  }

  let visitDepositAmount = VISIT_DEPOSIT_FALLBACK;
  if (workMode === 'diagnosis') {
    const { data: setting } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'visit_deposit_amount')
      .maybeSingle();
    const value = Number(setting?.value);
    if (Number.isFinite(value) && value >= 0) visitDepositAmount = value;
  }

  const guestAccessToken = crypto.randomUUID();
  const requestedDescription = `${description}\n\nDisponibilidad solicitada: ${appointmentWindow}`;

  const { data: order, error: orderError } = await supabaseAdmin
    .from('service_orders')
    .insert({
      title,
      description: requestedDescription,
      service_type: serviceType,
      priority,
      status: 'assigned',
      service_status: 'pending',
      work_mode: workMode,
      quote_status: 'none',
      payment_status: 'pending',
      visit_deposit_amount: workMode === 'diagnosis' ? visitDepositAmount : 0,
      total_quoted_amount: workMode === 'direct' ? Number(body.requestedTotal ?? 0) : 0,
      fixed_price_service_id: workMode === 'direct' ? fixedPriceServiceId : null,
      fixed_price_quantity: workMode === 'direct' ? quantity : null,
      total_paid_amount: 0,
      extra_amount: 0,
      scheduled_date: scheduledDate,
      customer_id: customerId,
      client_name: fullName,
      client_phone: phone,
      client_address: address,
      client_neighborhood: neighborhood || 'A confirmar',
      client_province: province,
      assigned_technician_id: null,
      assigned_technician_name: null,
      guest_access_token: guestAccessToken,
    })
    .select('id, total_quoted_amount, visit_deposit_amount')
    .single();
  if (orderError || !order) {
    console.error('[orders/guest-checkout] Error creando orden', orderError);
    return res.status(500).json({ error: 'No se pudo crear la solicitud.' });
  }

  // No confiar en body.requestedTotal para el monto real a cobrar: el
  // trigger service_orders_enforce_pricing ya recalculó estas columnas desde
  // el catálogo/system_settings al insertar, así que son la fuente confiable.
  const paymentType = workMode === 'diagnosis' ? 'visit_deposit' : 'full_advance';
  const amount = workMode === 'diagnosis' ? Number(order.visit_deposit_amount) : Number(order.total_quoted_amount);
  if (!amount || amount <= 0) {
    console.error('[orders/guest-checkout] Monto inválido tras el trigger de precios', order);
    return res.status(409).json({ error: 'No se pudo calcular el monto a cobrar.' });
  }

  const { data: transaction, error: txError } = await supabaseAdmin
    .from('payment_transactions')
    .insert({
      order_id: order.id,
      quote_id: null,
      payment_type: paymentType,
      provider: 'mercadopago',
      status: 'pending',
      amount,
    })
    .select('id')
    .single();
  if (txError || !transaction) {
    console.error('[orders/guest-checkout] Error creando transaccion', txError);
    return res.status(500).json({ error: 'No se pudo iniciar el pago.' });
  }

  const origin = `https://${req.headers.host}`;
  const statusUrl = `${origin}/#/pedido/${guestAccessToken}`;

  try {
    const preference = await new Preference(mpClient).create({
      body: {
        items: [
          {
            id: paymentType,
            title: workMode === 'diagnosis' ? `Seña de visita — ${title}` : `Pago del servicio — ${title}`,
            quantity: 1,
            unit_price: amount,
            currency_id: 'ARS',
          },
        ],
        external_reference: transaction.id,
        notification_url: `${origin}/api/payments/webhook`,
        back_urls: { success: statusUrl, failure: statusUrl, pending: statusUrl },
        auto_return: 'approved',
      },
    });

    await supabaseAdmin
      .from('payment_transactions')
      .update({ mp_preference_id: preference.id })
      .eq('id', transaction.id);

    const paymentUrl = preference.sandbox_init_point || preference.init_point;
    if (!paymentUrl) throw new Error('Mercado Pago no devolvió una URL de checkout.');

    return res.status(200).json({ paymentUrl, statusUrl });
  } catch (err) {
    await supabaseAdmin.from('payment_transactions').update({ status: 'cancelled' }).eq('id', transaction.id);
    console.error('[orders/guest-checkout] Mercado Pago error', err);
    return res.status(502).json({ error: 'No se pudo iniciar el pago seguro con Mercado Pago.' });
  }
}
