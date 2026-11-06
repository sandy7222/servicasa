import { supabaseAdmin } from './supabaseAdmin.js';
import { syncOrderAfterApprovedPayment } from './orderPaymentSync.js';

/**
 * Cobro repartido del trabajo (plan-cobro-repartido.md, Fase 2). El pago se crea con el token OAuth del
 * TÉCNICO en /v1/payments, con `capture:false` (reserva de la tarjeta, 7 días) y `application_fee` (la
 * comisión de la plataforma). Validado en sandbox el 6/11/2026 (docs/guia-mp-split-reserva-sandbox.md).
 *
 * Reglas:
 * - Solo se usa si `system_settings.split_payments_enabled` es true Y el técnico asignado tiene Mercado Pago
 *   vinculado. Si no, el trabajo se cobra como siempre (Checkout Pro, api/payments/create.ts).
 * - Los tokens del técnico nunca salen del servidor ni se loguean.
 * - La comisión se lee de `platform_commission_rate`; nunca está escrita en el código.
 * - Una reserva autorizada cuenta como pago confirmado para la orden (el dinero ya está garantizado): el
 *   presupuesto queda aceptado y el trabajo puede empezar. La CAPTURA (cobro efectivo) es la Fase 3.
 */

const MP_API = 'https://api.mercadopago.com';
const MP_TIMEOUT_MS = 15000;

export type SplitTxStatus = 'pending' | 'authorized' | 'approved' | 'rejected' | 'cancelled' | 'refunded';

export type MpPayment = {
  id?: number | string;
  status?: string;
  status_detail?: string;
  captured?: boolean;
  transaction_amount?: number;
  external_reference?: string | null;
  collector_id?: number | string | null;
  payment_method_id?: string | null;
  installments?: number | null;
  date_approved?: string | null;
  fee_details?: Array<{ type?: string; amount?: number }>;
};

export type SplitTransaction = {
  id: string;
  order_id: string;
  quote_id: string | null;
  payment_type: string;
  status: SplitTxStatus;
  split_technician_id: string;
};

export function mapSplitStatus(mpStatus: string | undefined): SplitTxStatus {
  switch (mpStatus) {
    case 'authorized':
      return 'authorized';
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

export function commissionFor(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

async function readSetting(key: string): Promise<unknown> {
  const { data, error } = await supabaseAdmin.from('system_settings').select('value').eq('key', key).maybeSingle();
  if (error) {
    console.error('[splitPayment] no se pudo leer la configuración', key, error.message);
    return undefined;
  }
  return (data as { value?: unknown } | null)?.value;
}

/** El interruptor general. Ante cualquier duda (error, valor raro) se considera APAGADO. */
export async function isSplitEnabled(): Promise<boolean> {
  return (await readSetting('split_payments_enabled')) === true;
}

/** Tasa de comisión (0.17 = 17%). Null si no está configurada o es inválida: en ese caso no se cobra repartido. */
export async function getCommissionRate(): Promise<number | null> {
  const raw = Number(await readSetting('platform_commission_rate'));
  return Number.isFinite(raw) && raw > 0 && raw < 1 ? raw : null;
}

export type TechnicianMpCredentials = { accessToken: string; publicKey: string | null; mpUserId: string };

/** Credenciales del técnico (solo servidor). Null si no tiene Mercado Pago vinculado o venció. */
export async function getTechnicianMpCredentials(technicianId: string): Promise<TechnicianMpCredentials | null> {
  const { data, error } = await supabaseAdmin.rpc('mp_account_token', { p_technician_id: technicianId });
  if (error) {
    console.error('[splitPayment] no se pudo leer la cuenta del técnico', error.message);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as
    | { access_token?: string; public_key?: string | null; mp_user_id?: string; expires_at?: string | null }
    | null
    | undefined;
  if (!row?.access_token || !row.mp_user_id) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;
  return { accessToken: row.access_token, publicKey: row.public_key ?? null, mpUserId: String(row.mp_user_id) };
}

export class MpRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly mpMessage: string
  ) {
    super(`Mercado Pago respondió ${status}`);
  }
}

/** Llamada a la API de pagos con el token del técnico. Nunca loguea el token ni el cuerpo con datos de tarjeta. */
export async function mpPaymentsRequest(
  path: string,
  token: string,
  init: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; idempotencyKey?: string } = {}
): Promise<MpPayment> {
  const response = await fetch(`${MP_API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.idempotencyKey ? { 'X-Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(MP_TIMEOUT_MS),
  });
  const json = (await response.json().catch(() => ({}))) as MpPayment & { message?: string };
  if (!response.ok) {
    throw new MpRequestError(response.status, typeof json.message === 'string' ? json.message : '');
  }
  return json;
}

function feesOf(payment: MpPayment) {
  const details = payment.fee_details ?? [];
  const sum = (type: string) => details.filter((f) => f.type === type).reduce((s, f) => s + Number(f.amount ?? 0), 0);
  return { mpFee: sum('mercadopago_fee'), applicationFee: sum('application_fee') };
}

/**
 * Aplica el estado de un pago repartido (respuesta de la reserva o webhook). Idempotente:
 * - pending/rejected/cancelled → authorized|approved: marca el pago y confirma la orden UNA sola vez
 *   (el UPDATE con la condición de estado es el candado, igual que el webhook de siempre).
 * - authorized → approved (captura, Fase 3): actualiza el pago sin volver a sumar el monto a la orden.
 * - authorized → cancelled/refunded: se registra; revertir la orden es parte de la Fase 3.
 */
export async function applySplitPaymentStatus(tx: SplitTransaction, payment: MpPayment): Promise<SplitTxStatus> {
  const status = mapSplitStatus(payment.status);
  const { mpFee, applicationFee } = feesOf(payment);
  const now = new Date().toISOString();
  const common: Record<string, unknown> = {
    status,
    mp_payment_id: payment.id != null ? String(payment.id) : null,
    mp_payment_method: payment.payment_method_id ?? null,
    mp_installments: payment.installments ?? null,
    collector_mp_user_id: payment.collector_id != null ? String(payment.collector_id) : null,
    mp_fee_amount: mpFee,
    provider_payload: payment,
    updated_at: now,
  };
  // Mientras está reservado, Mercado Pago todavía no informa la comisión: no pisar la que guardamos al crear.
  if (applicationFee > 0) common.application_fee = applicationFee;

  if (status === 'authorized' || status === 'approved') {
    const patch = {
      ...common,
      authorized_at: now,
      ...(status === 'approved' ? { captured_at: now, paid_at: payment.date_approved ?? now } : {}),
    };
    const { data: claimed, error } = await supabaseAdmin
      .from('payment_transactions')
      .update(patch)
      .eq('id', tx.id)
      .not('status', 'in', '(authorized,approved)')
      .select('id, amount')
      .maybeSingle();
    if (error) throw new Error(`No se pudo registrar el pago repartido: ${error.message}`);
    if (claimed) {
      await syncOrderAfterApprovedPayment(tx.payment_type, tx.order_id, tx.quote_id, Number((claimed as { amount: number }).amount));
      return status;
    }
    if (status === 'approved') {
      // Ya estaba reservado (o aprobado): solo reflejar la captura, sin tocar la orden.
      const { error: captureError } = await supabaseAdmin
        .from('payment_transactions')
        .update({ ...common, captured_at: now, paid_at: payment.date_approved ?? now })
        .eq('id', tx.id)
        .eq('status', 'authorized');
      if (captureError) throw new Error(`No se pudo registrar la captura: ${captureError.message}`);
    }
    return status;
  }

  // rejected / cancelled / refunded / pending: nunca pisa un pago ya aprobado (captura hecha).
  const { error } = await supabaseAdmin
    .from('payment_transactions')
    .update(common)
    .eq('id', tx.id)
    .neq('status', 'approved');
  if (error) throw new Error(`No se pudo registrar el pago repartido: ${error.message}`);
  if (tx.status === 'authorized' && (status === 'cancelled' || status === 'refunded')) {
    console.warn('[splitPayment] reserva cancelada después de confirmar la orden; revisar (Fase 3)', tx.id);
  }
  return status;
}

/**
 * Para el webhook: si `mpPaymentId` es un pago repartido nuestro, lo consulta con el token del técnico y
 * aplica su estado. Devuelve false si no es un pago repartido (el webhook sigue con el circuito de siempre).
 */
export async function handleSplitPaymentNotification(mpPaymentId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select('id, order_id, quote_id, payment_type, status, split_technician_id')
    .eq('mp_payment_id', mpPaymentId)
    .eq('split', true)
    .maybeSingle();
  if (error || !data) return false;
  const tx = data as SplitTransaction;

  const creds = await getTechnicianMpCredentials(tx.split_technician_id);
  if (!creds) {
    console.error('[splitPayment] llegó un aviso de un pago repartido pero el técnico ya no tiene la cuenta vinculada', tx.id);
    return true;
  }
  const payment = await mpPaymentsRequest(`/v1/payments/${encodeURIComponent(mpPaymentId)}`, creds.accessToken);
  // Defensa extra: el pago tiene que ser el que nosotros creamos para esta transacción.
  if (payment.external_reference !== tx.id) {
    console.error('[splitPayment] external_reference no coincide con la transacción', tx.id);
    return true;
  }
  await applySplitPaymentStatus(tx, payment);
  return true;
}
