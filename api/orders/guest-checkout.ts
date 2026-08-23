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
 * service. Does NOT create any customer/order yet — a guest has no way to
 * come back and see or cancel an order, so nothing real gets written until
 * Mercado Pago actually confirms the payment (see api/payments/webhook.ts).
 * This just validates the request, computes the trustworthy price
 * server-side, and stores it as a draft keyed to the Mercado Pago preference.
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

  // Solo para dar un error rápido si el email ya es de una cuenta real (debe
  // iniciar sesión en vez de pagar como invitado). No creamos nada todavía:
  // es una lectura, no un insert.
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

  // Nunca confiar en body.requestedTotal: se recalcula acá desde la fuente
  // confiable (system_settings para la seña de diagnóstico, o el precio real
  // del catálogo `services` para pago directo) — antes esto lo hacía un
  // trigger al insertar la orden, pero ahora la orden no existe todavía.
  let amount: number;
  if (workMode === 'diagnosis') {
    const { data: setting } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'visit_deposit_amount')
      .maybeSingle();
    const value = Number(setting?.value);
    amount = Number.isFinite(value) && value >= 0 ? value : VISIT_DEPOSIT_FALLBACK;
  } else {
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('price')
      .eq('id', fixedPriceServiceId)
      .eq('active', true)
      .maybeSingle();
    if (serviceError || !service) {
      return res.status(409).json({ error: 'Servicio de precio fijo inválido o inactivo.' });
    }
    amount = Number(service.price) * quantity;
  }
  if (!amount || amount <= 0) {
    return res.status(409).json({ error: 'No se pudo calcular el monto a cobrar.' });
  }

  const paymentType = workMode === 'diagnosis' ? 'visit_deposit' : 'full_advance';
  const requestedDescription = `${description}\n\nDisponibilidad solicitada: ${appointmentWindow}`;

  const payload = {
    fullName,
    email,
    phone,
    address,
    neighborhood,
    province,
    title,
    description: requestedDescription,
    serviceType,
    priority,
    scheduledDate,
    workMode,
    visitDepositAmount: workMode === 'diagnosis' ? amount : 0,
    totalQuotedAmount: workMode === 'direct' ? amount : 0,
    fixedPriceServiceId: workMode === 'direct' ? fixedPriceServiceId : null,
    fixedPriceQuantity: workMode === 'direct' ? quantity : null,
  };

  const { data: draft, error: draftError } = await supabaseAdmin
    .from('guest_checkout_drafts')
    .insert({ payment_type: paymentType, amount, payload })
    .select('id, guest_access_token')
    .single();
  if (draftError || !draft) {
    console.error('[orders/guest-checkout] Error creando borrador', draftError);
    return res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
  }

  const origin = `https://${req.headers.host}`;
  const statusUrl = `${origin}/#/pedido/${draft.guest_access_token}`;

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
        external_reference: draft.id,
        notification_url: `${origin}/api/payments/webhook`,
        back_urls: { success: statusUrl, failure: statusUrl, pending: statusUrl },
        auto_return: 'approved',
      },
    });

    await supabaseAdmin
      .from('guest_checkout_drafts')
      .update({ mp_preference_id: preference.id })
      .eq('id', draft.id);

    const paymentUrl = preference.sandbox_init_point || preference.init_point;
    if (!paymentUrl) throw new Error('Mercado Pago no devolvió una URL de checkout.');

    return res.status(200).json({ paymentUrl, statusUrl });
  } catch (err) {
    await supabaseAdmin.from('guest_checkout_drafts').update({ status: 'cancelled' }).eq('id', draft.id);
    console.error('[orders/guest-checkout] Mercado Pago error', err);
    return res.status(502).json({ error: 'No se pudo iniciar el pago seguro con Mercado Pago.' });
  }
}
