import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from '../auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import {
  applySplitPaymentStatus,
  commissionFor,
  describeMpError,
  getCommissionRate,
  getTechnicianMpCredentials,
  isReservableCardMethod,
  isSplitEnabled,
  MpRequestError,
  mpPaymentsRequest,
  type SplitTransaction,
} from '../splitPayment.js';

/**
 * Pago del TRABAJO (presupuesto aceptado) con cobro repartido — plan-cobro-repartido.md, Fase 2.
 * /api/payments/work → /api/gateway?action=work-payment
 *
 * GET  ?orderId=&quoteId=  → ¿este presupuesto se cobra repartido? Devuelve la public key del técnico para el
 *                            formulario de tarjeta (no es secreta). Si no aplica, el navegador sigue con el
 *                            Checkout Pro de siempre (api/payments/create.ts).
 * POST {orderId, quoteId, token, paymentMethodId, issuerId?, installments, payer}
 *                          → reserva la tarjeta (capture:false) en la cuenta del técnico con la comisión.
 *
 * Los datos de la tarjeta nunca llegan acá: solo el `token` que genera el formulario de Mercado Pago.
 * El monto y la comisión se calculan SIEMPRE en el servidor; lo que mande el navegador se ignora.
 */

const GENERIC_ERROR = 'No se pudo procesar el pago. Probá de nuevo en unos minutos.';

type Caller = NonNullable<Awaited<ReturnType<typeof getAuthenticatedCaller>>>;

type Eligible = {
  order: { id: string; title: string; customer_id: string; assigned_technician_id: string };
  quote: { id: string; remaining_amount: number };
  amount: number;
  applicationFee: number;
  credentials: { accessToken: string; publicKey: string | null; mpUserId: string };
};

type EligibilityResult =
  | { kind: 'ok'; value: Eligible }
  | { kind: 'error'; status: number; error: string }
  | { kind: 'fallback' };

/** Todas las validaciones de negocio. `fallback: true` = no aplica el cobro repartido (usar el de siempre). */
async function checkEligibility(caller: Caller, orderId: string, quoteId: string): Promise<EligibilityResult> {
  if (caller.role !== 'customer' || !caller.customerId) {
    return { kind: 'error', status: 403, error: 'Solo el cliente de la orden puede pagar el presupuesto.' };
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('service_orders')
    .select('id, title, customer_id, assigned_technician_id')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError || !order) return { kind: 'error', status: 404, error: 'Orden no encontrada.' };
  if (order.customer_id !== caller.customerId) {
    return { kind: 'error', status: 403, error: 'No tenés permiso para pagar esta orden.' };
  }

  const { data: quote, error: quoteError } = await supabaseAdmin
    .from('order_quotes')
    .select('id, order_id, status, remaining_amount, valid_until')
    .eq('id', quoteId)
    .maybeSingle();
  if (quoteError || !quote || quote.order_id !== orderId) return { kind: 'error', status: 404, error: 'Presupuesto no encontrado.' };
  if (quote.status !== 'sent') return { kind: 'error', status: 409, error: 'Este presupuesto no está disponible para pago.' };
  if (quote.valid_until && new Date(quote.valid_until as string).getTime() < Date.now()) {
    return { kind: 'error', status: 409, error: 'El presupuesto venció. Pedí una nueva versión al técnico.' };
  }
  const amount = Math.round(Number(quote.remaining_amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return { kind: 'error', status: 409, error: 'El monto a pagar debe ser mayor a cero.' };

  // De acá en adelante, si algo no está, NO es un error: el presupuesto se paga como siempre.
  if (!(await isSplitEnabled())) return { kind: 'fallback' };
  if (!order.assigned_technician_id) return { kind: 'fallback' };
  const rate = await getCommissionRate();
  if (rate === null) return { kind: 'fallback' };
  const credentials = await getTechnicianMpCredentials(order.assigned_technician_id as string);
  if (!credentials || !credentials.publicKey) return { kind: 'fallback' };

  return {
    kind: 'ok',
    value: {
      order: order as Eligible['order'],
      quote: { id: quote.id as string, remaining_amount: amount },
      amount,
      applicationFee: commissionFor(amount, rate),
      credentials,
    },
  };
}

/** Texto para el cliente según el motivo de rechazo de Mercado Pago (sin detalles técnicos). */
export function rejectionMessage(detail: string | undefined): string {
  switch (detail) {
    case 'cc_rejected_insufficient_amount':
      return 'La tarjeta no tiene saldo o límite suficiente. Probá con otra tarjeta.';
    case 'cc_rejected_bad_filled_security_code':
      return 'El código de seguridad no es correcto. Revisalo e intentá de nuevo.';
    case 'cc_rejected_bad_filled_date':
      return 'La fecha de vencimiento no es correcta. Revisala e intentá de nuevo.';
    case 'cc_rejected_bad_filled_other':
    case 'cc_rejected_bad_filled_card_number':
      return 'Algún dato de la tarjeta no es correcto. Revisalo e intentá de nuevo.';
    case 'cc_rejected_call_for_authorize':
      return 'Tu banco pide que autorices este pago. Llamalo y volvé a intentar, o usá otra tarjeta.';
    case 'cc_rejected_card_disabled':
      return 'La tarjeta está inactiva. Activala con tu banco o usá otra.';
    case 'cc_rejected_duplicated_payment':
      return 'Ya hiciste un pago por este mismo monto. Si necesitás pagar de nuevo, usá otra tarjeta.';
    case 'cc_rejected_high_risk':
    case 'cc_rejected_blacklist':
      return 'Mercado Pago no aprobó el pago. Probá con otra tarjeta.';
    default:
      return 'La tarjeta fue rechazada. Probá con otra tarjeta o revisá los datos.';
  }
}

function str(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

async function handleGet(req: VercelRequest, res: VercelResponse, caller: Caller) {
  const orderId = str(req.query.orderId);
  const quoteId = str(req.query.quoteId);
  if (!orderId || !quoteId) return res.status(400).json({ error: 'Faltan datos del presupuesto.' });

  const result = await checkEligibility(caller, orderId, quoteId);
  res.setHeader('Cache-Control', 'no-store');
  if (result.kind === 'fallback') return res.status(200).json({ split: false });
  if (result.kind === 'error') return res.status(result.status).json({ error: result.error });
  return res.status(200).json({ split: true, publicKey: result.value.credentials.publicKey, amount: result.value.amount });
}

async function handlePost(req: VercelRequest, res: VercelResponse, caller: Caller) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const orderId = str(body.orderId);
  const quoteId = str(body.quoteId);
  const cardToken = str(body.token, 100);
  const paymentMethodId = str(body.paymentMethodId, 40);
  const issuerId = str(body.issuerId, 40);
  const installments = Number(body.installments ?? 1);
  const payer = (body.payer ?? {}) as { email?: unknown; identification?: { type?: unknown; number?: unknown } };
  const payerEmail = str(payer.email, 200);
  const idType = str(payer.identification?.type, 20);
  const idNumber = str(payer.identification?.number, 30);

  if (!orderId || !quoteId || !cardToken || !paymentMethodId) {
    return res.status(400).json({ error: 'Faltan datos del pago.' });
  }
  if (!Number.isInteger(installments) || installments < 1 || installments > 24) {
    return res.status(400).json({ error: 'La cantidad de cuotas no es válida.' });
  }
  if (!isReservableCardMethod(paymentMethodId)) {
    return res.status(400).json({ error: 'Para reservar el pago hace falta una tarjeta de crédito. Las de débito no sirven.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)) {
    return res.status(400).json({ error: 'Falta un email válido para el comprobante.' });
  }

  const result = await checkEligibility(caller, orderId, quoteId);
  if (result.kind === 'fallback') {
    return res.status(409).json({ error: 'Este presupuesto se paga con el pago seguro habitual. Recargá la página.' });
  }
  if (result.kind === 'error') return res.status(result.status).json({ error: result.error });
  const { order, quote, amount, applicationFee, credentials } = result.value;

  const { data: existing } = await supabaseAdmin
    .from('payment_transactions')
    .select('id')
    .eq('quote_id', quote.id)
    .in('status', ['authorized', 'approved'])
    .limit(1);
  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'Este presupuesto ya tiene un pago registrado.' });
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('payment_transactions')
    .insert({
      order_id: order.id,
      quote_id: quote.id,
      payment_type: 'balance_payment',
      provider: 'mercadopago',
      status: 'pending',
      amount,
      split: true,
      split_technician_id: order.assigned_technician_id,
      collector_mp_user_id: credentials.mpUserId,
      application_fee: applicationFee,
    })
    .select('id, order_id, quote_id, payment_type, status, split_technician_id')
    .single();
  if (insertError || !inserted) {
    console.error('[work-payment] no se pudo crear la transacción', insertError?.message);
    return res.status(500).json({ error: GENERIC_ERROR });
  }
  const tx = inserted as SplitTransaction;

  let payment;
  try {
    payment = await mpPaymentsRequest('/v1/payments', credentials.accessToken, {
      method: 'POST',
      idempotencyKey: tx.id,
      body: {
        transaction_amount: amount,
        token: cardToken,
        description: `Trabajo — ${String(order.title ?? '').slice(0, 200)}`,
        installments,
        payment_method_id: paymentMethodId,
        ...(issuerId ? { issuer_id: issuerId } : {}),
        payer: {
          email: payerEmail,
          ...(idType && idNumber ? { identification: { type: idType, number: idNumber } } : {}),
        },
        capture: false,
        binary_mode: true,
        application_fee: applicationFee,
        external_reference: tx.id,
        notification_url: `https://${req.headers.host}/api/payments/webhook`,
      },
    });
  } catch (err) {
    const detail = describeMpError(err);
    // Se guarda el cuerpo del error (estado, mensaje, códigos de causa; sin token ni datos de tarjeta).
    await supabaseAdmin
      .from('payment_transactions')
      .update({ status: 'cancelled', provider_payload: { mp_error: detail }, updated_at: new Date().toISOString() })
      .eq('id', tx.id);
    if (err instanceof MpRequestError && err.status >= 400 && err.status < 500) {
      console.warn('[work-payment] Mercado Pago rechazó el pedido', detail);
      return res.status(402).json({ error: 'Mercado Pago no pudo procesar la tarjeta. Revisá los datos o probá con otra.' });
    }
    console.error('[work-payment] error con Mercado Pago', detail);
    return res.status(502).json({ error: GENERIC_ERROR });
  }

  if (payment.external_reference && payment.external_reference !== tx.id) {
    console.error('[work-payment] Mercado Pago devolvió otro external_reference', tx.id);
    return res.status(502).json({ error: GENERIC_ERROR });
  }

  let status;
  try {
    status = await applySplitPaymentStatus(tx, payment);
  } catch (err) {
    console.error('[work-payment] reserva hecha pero no se pudo registrar', tx.id, err instanceof Error ? err.message : '');
    // La reserva existe en Mercado Pago pero no quedó bien registrada acá: se cancela para no retener dinero
    // del cliente sin que la orden lo refleje.
    if (payment.id != null && payment.status === 'authorized') {
      try {
        await mpPaymentsRequest(`/v1/payments/${encodeURIComponent(String(payment.id))}`, credentials.accessToken, {
          method: 'PUT',
          idempotencyKey: `${tx.id}-cancel`,
          body: { status: 'cancelled' },
        });
      } catch (cancelErr) {
        console.error('[work-payment] no se pudo cancelar la reserva huérfana', tx.id, cancelErr instanceof Error ? cancelErr.message : '');
      }
    }
    return res.status(500).json({ error: GENERIC_ERROR });
  }

  res.setHeader('Cache-Control', 'no-store');
  if (status === 'authorized' || status === 'approved') {
    return res.status(200).json({ status });
  }
  return res.status(402).json({ status, error: rejectionMessage(payment.status_detail) });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }
  const caller = await getAuthenticatedCaller(req);
  if (!caller) return res.status(401).json({ error: 'Tu sesión expiró. Volvé a iniciar sesión.' });
  return req.method === 'GET' ? handleGet(req, res, caller) : handlePost(req, res, caller);
}
