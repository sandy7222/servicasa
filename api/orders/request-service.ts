import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Preference } from 'mercadopago';
import { mpClient } from '../lib/mercadopago.js';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';
import { getAuthenticatedCaller } from '../lib/auth.js';

type WorkMode = 'diagnosis' | 'direct';

type RequestServiceBody = {
  title?: string;
  description?: string;
  serviceType?: string;
  priority?: 'baja' | 'media' | 'alta' | 'urgente';
  address?: string;
  neighborhood?: string;
  city?: string;
  province?: string;
  scheduledDate?: string;
  appointmentWindow?: string;
  workMode?: WorkMode;
  fixedPriceServiceId?: string;
  quantity?: number;
  addressId?: string;
  photoStoragePath?: string;
};

const MAX_TEXT = 500;
const VISIT_DEPOSIT_FALLBACK = 30000;
// Ver el mismo comentario en api/orders/guest-checkout.ts.
const PENDING_PHOTO_PATH_RE = /^pending\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/photo\.jpg$/i;

function trimmed(value: unknown, max = MAX_TEXT): string {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * Authenticated equivalent of api/orders/guest-checkout.ts, for logged-in
 * customers. Same reasoning applies: does NOT create anything in
 * service_orders yet — only a draft (customer_order_drafts) keyed to the
 * Mercado Pago preference. The real order is created by the webhook once
 * the payment is confirmed 'approved' (see api/payments/webhook.ts).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const caller = await getAuthenticatedCaller(req);
  if (!caller) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
  if (caller.role !== 'customer' || !caller.customerId) {
    return res.status(403).json({ error: 'Solo un cliente puede solicitar un servicio.' });
  }

  const body = (req.body ?? {}) as RequestServiceBody;

  const address = trimmed(body.address, 200);
  const neighborhood = trimmed(body.neighborhood, 100);
  const city = trimmed(body.city, 100);
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
  const requestedPhotoPath = trimmed(body.photoStoragePath, 200);
  const photoStoragePath = PENDING_PHOTO_PATH_RE.test(requestedPhotoPath) ? requestedPhotoPath : null;

  if (!address || !city || !province || !title || !description) {
    return res.status(400).json({ error: 'Completá todos los campos obligatorios con datos válidos.' });
  }
  // Nunca confiar en la validación del cliente: mismo chequeo que
  // validateAddressDraft() en src/lib/address.ts, para el caso real de un
  // cliente que escribe la altura en el campo de localidad por error.
  if (/^\d+$/.test(city)) {
    return res.status(400).json({ error: 'La localidad no puede ser un número.' });
  }
  if (workMode === 'direct' && !fixedPriceServiceId) {
    return res.status(400).json({ error: 'Elegí un servicio de precio fijo válido.' });
  }

  // El id de dirección guardada lo manda el cliente, pero esta ruta corre
  // con supabaseAdmin (sin RLS) — hay que verificar acá que realmente sea
  // suya antes de confiarlo, o cualquiera podría mandar el id de la
  // dirección de otra persona. Si no es suya, se descarta en silencio (es
  // solo trazabilidad — el pedido igual guarda su propia copia de los
  // datos de dirección tipeados).
  let addressId: string | null = null;
  const requestedAddressId = trimmed(body.addressId, 100);
  if (requestedAddressId) {
    const { data: ownedAddress } = await supabaseAdmin
      .from('customer_addresses')
      .select('id')
      .eq('id', requestedAddressId)
      .eq('customer_id', caller.customerId)
      .maybeSingle();
    addressId = ownedAddress?.id ?? null;
  }

  // Nunca confiar en un monto que venga del cliente: se recalcula acá desde
  // la fuente confiable, igual que en guest-checkout.ts.
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
    title,
    description: requestedDescription,
    serviceType,
    priority,
    scheduledDate,
    workMode,
    address,
    neighborhood,
    city,
    province,
    addressId,
    visitDepositAmount: workMode === 'diagnosis' ? amount : 0,
    totalQuotedAmount: workMode === 'direct' ? amount : 0,
    fixedPriceServiceId: workMode === 'direct' ? fixedPriceServiceId : null,
    fixedPriceQuantity: workMode === 'direct' ? quantity : null,
    photoStoragePath,
  };

  const { data: draft, error: draftError } = await supabaseAdmin
    .from('customer_order_drafts')
    .insert({ customer_id: caller.customerId, payment_type: paymentType, amount, payload })
    .select('id')
    .single();
  if (draftError || !draft) {
    console.error('[orders/request-service] Error creando borrador', draftError);
    return res.status(500).json({ error: 'No se pudo procesar la solicitud.' });
  }

  const origin = `https://${req.headers.host}`;
  const orderUrl = `${origin}/#/customer`;

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
        back_urls: { success: orderUrl, failure: orderUrl, pending: orderUrl },
        auto_return: 'approved',
      },
    });

    await supabaseAdmin
      .from('customer_order_drafts')
      .update({ mp_preference_id: preference.id })
      .eq('id', draft.id);

    // Aviso inmediato de "pago pendiente" — no espera al webhook (que puede
    // tardar o nunca llegar si el cliente abandona el checkout). Se hace
    // aquí, no en retry-draft.ts, para no duplicar el aviso en cada reintento
    // del mismo borrador.
    await supabaseAdmin.from('notifications').insert({
      recipient_profile_id: caller.userId,
      type: 'payment_pending',
      title: 'Pago pendiente',
      body: title,
      entity_type: 'payment',
      entity_id: draft.id,
      dedupe_key: `payment_pending:${draft.id}`,
    });

    const paymentUrl = preference.sandbox_init_point || preference.init_point;
    if (!paymentUrl) throw new Error('Mercado Pago no devolvió una URL de checkout.');

    return res.status(200).json({ paymentUrl, draftId: draft.id });
  } catch (err) {
    await supabaseAdmin.from('customer_order_drafts').update({ status: 'cancelled' }).eq('id', draft.id);
    console.error('[orders/request-service] Mercado Pago error', err);
    return res.status(502).json({ error: 'No se pudo iniciar el pago seguro con Mercado Pago.' });
  }
}
