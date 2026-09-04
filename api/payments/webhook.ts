import type { VercelRequest, VercelResponse } from '@vercel/node';
import { MPNotFoundError, Payment } from 'mercadopago';
import { mpClient } from '../_lib/mercadopago.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

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
 * This endpoint IS publicly reachable — confirmed 27/8 with a direct
 * unauthenticated request against a live deployment (200, no auth
 * challenge): Vercel Deployment Protection is not actually enabled on this
 * project (ssoProtection is null), despite an earlier comment here claiming
 * otherwise. The `?x-vercel-protection-bypass` query param that may still be
 * configured on the Mercado Pago webhook URL is harmless but unnecessary —
 * this endpoint's real defense is entirely the re-fetch-and-match logic
 * above, not deployment-level gating.
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

type GuestDraftPayload = {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  neighborhood: string;
  city: string;
  province: string;
  title: string;
  description: string;
  serviceType: string;
  priority: 'baja' | 'media' | 'alta' | 'urgente';
  scheduledDate: string;
  workMode: 'diagnosis' | 'direct';
  visitDepositAmount: number;
  totalQuotedAmount: number;
  fixedPriceServiceId: string | null;
  fixedPriceQuantity: number | null;
  photoStoragePath: string | null;
};

type CustomerDraftPayload = {
  title: string;
  description: string;
  serviceType: string;
  priority: 'baja' | 'media' | 'alta' | 'urgente';
  scheduledDate: string;
  workMode: 'diagnosis' | 'direct';
  address: string;
  neighborhood: string;
  city: string;
  province: string;
  addressId: string | null;
  visitDepositAmount: number;
  totalQuotedAmount: number;
  fixedPriceServiceId: string | null;
  fixedPriceQuantity: number | null;
  photoStoragePath: string | null;
};

/**
 * Mueve la foto que quedó subida desde el asistente de diagnóstico
 * (`pending/<draftId>/photo.jpg`, ver api/orders/upload-diagnosis-photo.ts) a
 * la ruta definitiva de la orden ya creada y crea su fila en
 * order_diagnosis_photos. No bloqueante: si la foto ya no está (o cualquier
 * otro error), solo se loguea — la orden ya se creó bien de todos modos y no
 * hay nada más que el cliente pueda hacer para arreglarlo desde acá.
 */
async function linkDiagnosisPhotoToOrder(orderId: string, pendingPath: string | null) {
  if (!pendingPath) return;
  const finalPath = `${orderId}/photo.jpg`;

  const { error: moveError } = await supabaseAdmin.storage
    .from('diagnosis-photos')
    .move(pendingPath, finalPath);
  if (moveError) {
    console.error('[payments/webhook] Error moviendo foto de diagnóstico', orderId, moveError);
    return;
  }

  const { error: insertError } = await supabaseAdmin.from('order_diagnosis_photos').insert({
    order_id: orderId,
    storage_path: finalPath,
  });
  if (insertError) {
    console.error('[payments/webhook] Error guardando fila de foto de diagnóstico', orderId, insertError);
  }
}

/**
 * Guest checkout only reaches this point once Mercado Pago confirms the
 * payment as 'approved' — see api/orders/guest-checkout.ts for why nothing
 * is created earlier. Creates the customer (or reuses one already made from
 * a previous order with the same email) + the real service_order +
 * payment_transaction, already marked paid, from the draft's stored payload.
 * Idempotent: if the webhook retries after the draft is already 'approved',
 * the order already exists and this is skipped entirely.
 */
async function createOrderFromApprovedGuestDraft(
  draftId: string,
  payload: GuestDraftPayload,
  payment: { id?: number | string; fee_details?: Array<{ amount?: number }>; payment_method_id?: string | null; installments?: number | null; date_approved?: string | null; transaction_amount?: number }
) {
  let customerId: string;
  const { data: existingCustomer } = await supabaseAdmin
    .from('customers')
    .select('id, profile_id')
    .eq('email', payload.email)
    .maybeSingle();

  if (existingCustomer && !existingCustomer.profile_id) {
    customerId = existingCustomer.id as string;
    await supabaseAdmin
      .from('customers')
      .update({ name: payload.fullName, address: payload.address, neighborhood: payload.neighborhood, province: payload.province, phone: payload.phone })
      .eq('id', customerId);
  } else {
    // existingCustomer con profile_id: alguien se registró con este email
    // entre el checkout y la confirmación del pago. No le atamos este pago a
    // una cuenta real sin su consentimiento — creamos un cliente "sin cuenta"
    // aparte, igual que hace el admin para clientes sin cuenta.
    const { data: newCustomer, error: insertCustomerError } = await supabaseAdmin
      .from('customers')
      .insert({
        name: payload.fullName,
        address: payload.address,
        neighborhood: payload.neighborhood,
        province: payload.province,
        phone: payload.phone,
        email: payload.email,
        profile_id: null,
      })
      .select('id')
      .single();
    if (insertCustomerError || !newCustomer) {
      console.error('[payments/webhook] Error creando cliente para orden confirmada', insertCustomerError);
      throw insertCustomerError ?? new Error('No se pudo crear el cliente.');
    }
    customerId = newCustomer.id as string;
  }

  const { data: draftRow } = await supabaseAdmin
    .from('guest_checkout_drafts')
    .select('guest_access_token')
    .eq('id', draftId)
    .single();

  const { data: order, error: orderError } = await supabaseAdmin
    .from('service_orders')
    .insert({
      title: payload.title,
      description: payload.description,
      service_type: payload.serviceType,
      priority: payload.priority,
      status: 'assigned',
      service_status: 'pending',
      work_mode: payload.workMode,
      quote_status: 'none',
      payment_status: payload.workMode === 'diagnosis' ? 'deposit_paid' : 'paid_in_full',
      visit_deposit_amount: payload.visitDepositAmount,
      total_quoted_amount: payload.totalQuotedAmount,
      fixed_price_service_id: payload.fixedPriceServiceId,
      fixed_price_quantity: payload.fixedPriceQuantity,
      total_paid_amount: payload.workMode === 'diagnosis' ? payload.visitDepositAmount : payload.totalQuotedAmount,
      extra_amount: 0,
      scheduled_date: payload.scheduledDate,
      customer_id: customerId,
      client_name: payload.fullName,
      client_phone: payload.phone,
      client_address: payload.address,
      // client_neighborhood es NOT NULL en la base y ahora es explícitamente
      // opcional (barrio dentro de la ciudad) — '' en vez del viejo
      // "A confirmar", que ya no aplica ahora que la localidad real vive en
      // client_city.
      client_neighborhood: payload.neighborhood || '',
      client_city: payload.city,
      client_province: payload.province,
      assigned_technician_id: null,
      assigned_technician_name: null,
      guest_access_token: draftRow?.guest_access_token ?? null,
    })
    .select('id')
    .single();
  if (orderError || !order) {
    console.error('[payments/webhook] Error creando orden confirmada', orderError);
    throw orderError ?? new Error('No se pudo crear la orden.');
  }

  await linkDiagnosisPhotoToOrder(order.id, payload.photoStoragePath);

  const feeAmount = (payment.fee_details ?? []).reduce((sum, fee) => sum + (fee.amount ?? 0), 0);
  const { error: txError } = await supabaseAdmin.from('payment_transactions').insert({
    order_id: order.id,
    quote_id: null,
    payment_type: payload.workMode === 'diagnosis' ? 'visit_deposit' : 'full_advance',
    provider: 'mercadopago',
    status: 'approved',
    amount: Number(payment.transaction_amount ?? (payload.workMode === 'diagnosis' ? payload.visitDepositAmount : payload.totalQuotedAmount)),
    mp_payment_id: String(payment.id),
    mp_payment_method: payment.payment_method_id ?? null,
    mp_installments: payment.installments ?? null,
    mp_fee_amount: feeAmount,
    provider_payload: payment,
    paid_at: payment.date_approved ?? new Date().toISOString(),
  });
  if (txError) {
    console.error('[payments/webhook] Error creando payment_transaction para orden confirmada', txError);
  }

  await ensureAccountInviteForGuestCustomer(customerId);
}

/**
 * Same idea as createOrderFromApprovedGuestDraft, for a logged-in customer's
 * draft (api/orders/request-service.ts) — the customer already exists (no
 * need to create/match one), so this just fetches its current name/phone
 * and inserts the real order + payment_transaction, then marks the draft
 * 'approved' and lets the customer know via a 'payment_approved' notification
 * pointing at the new order (closing the loop that started with the
 * 'payment_pending' notification created at request-service.ts).
 */
async function createOrderFromApprovedCustomerDraft(
  draftId: string,
  customerId: string,
  payload: CustomerDraftPayload,
  payment: { id?: number | string; fee_details?: Array<{ amount?: number }>; payment_method_id?: string | null; installments?: number | null; date_approved?: string | null; transaction_amount?: number }
) {
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('name, phone, profile_id')
    .eq('id', customerId)
    .maybeSingle();
  if (customerError || !customer) {
    console.error('[payments/webhook] No se encontró el cliente del borrador', customerId, customerError);
    throw customerError ?? new Error('No se encontró el cliente.');
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('service_orders')
    .insert({
      title: payload.title,
      description: payload.description,
      service_type: payload.serviceType,
      priority: payload.priority,
      status: 'assigned',
      service_status: 'pending',
      work_mode: payload.workMode,
      quote_status: 'none',
      payment_status: payload.workMode === 'diagnosis' ? 'deposit_paid' : 'paid_in_full',
      visit_deposit_amount: payload.visitDepositAmount,
      total_quoted_amount: payload.totalQuotedAmount,
      fixed_price_service_id: payload.fixedPriceServiceId,
      fixed_price_quantity: payload.fixedPriceQuantity,
      total_paid_amount: payload.workMode === 'diagnosis' ? payload.visitDepositAmount : payload.totalQuotedAmount,
      extra_amount: 0,
      scheduled_date: payload.scheduledDate,
      customer_id: customerId,
      client_name: customer.name,
      client_phone: customer.phone,
      client_address: payload.address,
      client_neighborhood: payload.neighborhood || '',
      client_city: payload.city,
      client_province: payload.province,
      client_address_id: payload.addressId,
      assigned_technician_id: null,
      assigned_technician_name: null,
    })
    .select('id')
    .single();
  if (orderError || !order) {
    console.error('[payments/webhook] Error creando orden confirmada (cliente)', orderError);
    throw orderError ?? new Error('No se pudo crear la orden.');
  }

  await linkDiagnosisPhotoToOrder(order.id, payload.photoStoragePath);

  const feeAmount = (payment.fee_details ?? []).reduce((sum, fee) => sum + (fee.amount ?? 0), 0);
  const { error: txError } = await supabaseAdmin.from('payment_transactions').insert({
    order_id: order.id,
    quote_id: null,
    payment_type: payload.workMode === 'diagnosis' ? 'visit_deposit' : 'full_advance',
    provider: 'mercadopago',
    status: 'approved',
    amount: Number(payment.transaction_amount ?? (payload.workMode === 'diagnosis' ? payload.visitDepositAmount : payload.totalQuotedAmount)),
    mp_payment_id: String(payment.id),
    mp_payment_method: payment.payment_method_id ?? null,
    mp_installments: payment.installments ?? null,
    mp_fee_amount: feeAmount,
    provider_payload: payment,
    paid_at: payment.date_approved ?? new Date().toISOString(),
  });
  if (txError) {
    console.error('[payments/webhook] Error creando payment_transaction (cliente)', txError);
  }

  if (customer.profile_id) {
    await supabaseAdmin.from('notifications').insert({
      recipient_profile_id: customer.profile_id,
      type: 'payment_approved',
      title: 'Pago confirmado',
      body: payload.title,
      entity_type: 'order',
      entity_id: order.id,
      dedupe_key: `payment_approved:${draftId}`,
    });
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
      // No es una transacción de cliente logueado ya con orden — puede ser un
      // checkout de invitado o de cliente logueado, cuya orden todavía no
      // existe (ver guest-checkout.ts / orders/request-service.ts).
      const { data: guestDraft, error: guestDraftFetchError } = await supabaseAdmin
        .from('guest_checkout_drafts')
        .select('id, status, payload')
        .eq('id', transactionId)
        .maybeSingle();

      const { data: customerDraft, error: customerDraftFetchError } = guestDraftFetchError || !guestDraft
        ? await supabaseAdmin
            .from('customer_order_drafts')
            .select('id, customer_id, status, payload')
            .eq('id', transactionId)
            .maybeSingle()
        : { data: null, error: null };

      if ((guestDraftFetchError || !guestDraft) && (customerDraftFetchError || !customerDraft)) {
        console.warn('[payments/webhook] Sin transacción ni borrador para external_reference', transactionId);
        return res.status(200).json({ received: true, warning: 'transacción no encontrada' });
      }

      const status = mapStatus(payment.status);

      if (guestDraft) {
        if (status === 'approved') {
          // Guard de idempotencia real: Mercado Pago reenvia notificaciones,
          // y dos llamadas casi simultaneas pueden leer 'pending' antes de
          // que ninguna termine de escribir 'approved' (pasó de verdad: un
          // solo pago, mp_payment_id=176084558890, creó 2 ordenes con 269ms
          // de diferencia). Un SELECT-luego-UPDATE no cierra esa ventana —
          // hace falta que el UPDATE mismo sea la condición: solo una
          // llamada concurrente puede ganar la fila con status='pending',
          // Postgres serializa el resto contra ese mismo UPDATE.
          const { data: claimed, error: claimError } = await supabaseAdmin
            .from('guest_checkout_drafts')
            .update({ status: 'approved', mp_payment_id: String(payment.id), updated_at: new Date().toISOString() })
            .eq('id', guestDraft.id)
            .eq('status', 'pending')
            .select('id, payload')
            .maybeSingle();
          if (claimError) {
            console.error('[payments/webhook] Error reclamando borrador de invitado', claimError);
            return res.status(500).json({ error: 'No se pudo procesar la confirmación de pago.' });
          }
          if (!claimed) {
            // Otra llamada (retry de MP o esta misma en paralelo) ya lo procesó.
            return res.status(200).json({ received: true, note: 'borrador ya procesado' });
          }
          try {
            await createOrderFromApprovedGuestDraft(claimed.id, claimed.payload as GuestDraftPayload, payment);
          } catch (err) {
            // La orden no llegó a crearse — revertir a 'pending' para que un
            // reintento genuino de MP pueda volver a intentarlo.
            await supabaseAdmin.from('guest_checkout_drafts').update({ status: 'pending' }).eq('id', guestDraft.id);
            console.error('[payments/webhook] Error creando orden desde borrador aprobado', err);
            return res.status(500).json({ error: 'No se pudo crear la orden confirmada.' });
          }
        } else if (status === 'rejected' || status === 'cancelled') {
          await supabaseAdmin.from('guest_checkout_drafts').update({ status }).eq('id', guestDraft.id).eq('status', 'pending');
        }
        // status === 'pending' (ej. boleto de Pago Fácil sin pagar todavía): el
        // borrador queda 'pending', sin crear nada — Mercado Pago mandará otro
        // webhook con 'approved' cuando el invitado efectivamente pague.
        return res.status(200).json({ received: true });
      }

      // customerDraft: mismo circuito, para "Solicitar diagnóstico"/"Sé qué
      // trabajo necesito" de un cliente ya logueado.
      if (status === 'approved') {
        const { data: claimed, error: claimError } = await supabaseAdmin
          .from('customer_order_drafts')
          .update({ status: 'approved', mp_payment_id: String(payment.id), updated_at: new Date().toISOString() })
          .eq('id', customerDraft!.id)
          .eq('status', 'pending')
          .select('id, customer_id, payload')
          .maybeSingle();
        if (claimError) {
          console.error('[payments/webhook] Error reclamando borrador de cliente', claimError);
          return res.status(500).json({ error: 'No se pudo procesar la confirmación de pago.' });
        }
        if (!claimed) {
          return res.status(200).json({ received: true, note: 'borrador ya procesado' });
        }
        try {
          await createOrderFromApprovedCustomerDraft(claimed.id, claimed.customer_id, claimed.payload as CustomerDraftPayload, payment);
        } catch (err) {
          await supabaseAdmin.from('customer_order_drafts').update({ status: 'pending' }).eq('id', customerDraft!.id);
          console.error('[payments/webhook] Error creando orden desde borrador de cliente aprobado', err);
          return res.status(500).json({ error: 'No se pudo crear la orden confirmada.' });
        }
      } else if (status === 'rejected' || status === 'cancelled') {
        await supabaseAdmin.from('customer_order_drafts').update({ status }).eq('id', customerDraft!.id).eq('status', 'pending');
      }
      return res.status(200).json({ received: true });
    }

    const feeAmount = (payment.fee_details ?? []).reduce((sum, fee) => sum + (fee.amount ?? 0), 0);
    const status = mapStatus(payment.status);
    const amount = Number(payment.transaction_amount ?? 0);

    if (status === 'approved') {
      // Mismo riesgo de fondo que el guard de borradores arriba: Mercado Pago
      // reenvía notificaciones (confirmado en producción, ver comentario más
      // arriba), y sin este guard cada reenvío volvería a sumar `amount` a
      // service_orders.total_paid_amount — a diferencia de la rama de
      // borradores, acá no se crea una fila duplicada fácil de detectar, se
      // duplica silenciosamente el monto acreditado. El UPDATE mismo es la
      // condición (neq status 'approved'), no un SELECT previo.
      const { data: claimed, error: updateError } = await supabaseAdmin
        .from('payment_transactions')
        .update({
          status,
          mp_payment_id: String(payment.id),
          mp_payment_method: payment.payment_method_id ?? null,
          mp_installments: payment.installments ?? null,
          mp_fee_amount: feeAmount,
          provider_payload: payment,
          paid_at: payment.date_approved ?? new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id)
        .neq('status', 'approved')
        .select('id')
        .maybeSingle();

      if (updateError) {
        console.error('[payments/webhook] Error actualizando payment_transactions', updateError);
        return res.status(500).json({ error: 'No se pudo registrar el pago.' });
      }

      if (claimed) {
        await syncOrderAfterApprovedPayment(transaction.payment_type, transaction.order_id, transaction.quote_id, amount);
      }
    } else {
      const { error: updateError } = await supabaseAdmin
        .from('payment_transactions')
        .update({
          status,
          mp_payment_id: String(payment.id),
          mp_payment_method: payment.payment_method_id ?? null,
          mp_installments: payment.installments ?? null,
          mp_fee_amount: feeAmount,
          provider_payload: payment,
          paid_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);

      if (updateError) {
        console.error('[payments/webhook] Error actualizando payment_transactions', updateError);
        return res.status(500).json({ error: 'No se pudo registrar el pago.' });
      }
    }

    // Esta rama es para pagos de clientes logueados (api/payments/create.ts):
    // la orden ya existe de antes, solo se sincroniza su estado. La rama de
    // arriba (sin `transaction`) es la que crea órdenes de invitado nuevas.
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
