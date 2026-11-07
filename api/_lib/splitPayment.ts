import { supabaseAdmin } from './supabaseAdmin.js';
import { syncOrderAfterApprovedPayment } from './orderPaymentSync.js';
import { sendTelegramMessage } from './telegram.js';

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
    public readonly mpMessage: string,
    public readonly causes: string[] = []
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
  const json = (await response.json().catch(() => ({}))) as MpPayment & { message?: string; cause?: unknown };
  if (!response.ok) {
    throw new MpRequestError(response.status, typeof json.message === 'string' ? json.message : '', causeCodes(json.cause));
  }
  return json;
}

/** Códigos y descripciones de `cause` de un error de Mercado Pago (no trae tokens ni datos de tarjeta). */
function causeCodes(cause: unknown): string[] {
  if (!Array.isArray(cause)) return [];
  return cause
    .map((c) => {
      const item = (c ?? {}) as { code?: unknown; description?: unknown };
      return [item.code, item.description].filter((v) => v != null && v !== '').map(String).join(' ');
    })
    .filter(Boolean)
    .slice(0, 5)
    .map((s) => s.slice(0, 160));
}

/** Texto corto para guardar/loguear un error de Mercado Pago: estado HTTP, mensaje y códigos de causa. */
export function describeMpError(err: unknown): string {
  if (err instanceof MpRequestError) {
    return [`MP ${err.status}`, err.mpMessage, err.causes.length ? `[${err.causes.join('; ')}]` : '']
      .filter(Boolean)
      .join(' ')
      .slice(0, 500);
  }
  return err instanceof Error && err.name === 'TimeoutError' ? 'Sin respuesta de Mercado Pago (timeout)' : 'Error de conexión con Mercado Pago';
}

/**
 * Tarjetas que NO sirven para reservar (débito/prepaga): la reserva con capture:false es solo de crédito.
 * El formulario ya las excluye; esto es la defensa en el servidor por si alguien arma el pedido a mano.
 */
export function isReservableCardMethod(paymentMethodId: string): boolean {
  const id = paymentMethodId.toLowerCase();
  return !(id.startsWith('deb') || id === 'maestro' || id.includes('prepaid') || id === 'account_money');
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

  // Reserva que se cae (cancelada por nosotros, vencida por Mercado Pago o devuelta): el paso
  // authorized → cancelado es el candado, así la orden se revierte UNA sola vez.
  if (status === 'cancelled' || status === 'refunded') {
    const { data: reverted, error: revertError } = await supabaseAdmin
      .from('payment_transactions')
      .update({ ...common, cancelled_at: now })
      .eq('id', tx.id)
      .eq('status', 'authorized')
      .select('id, amount')
      .maybeSingle();
    if (revertError) throw new Error(`No se pudo registrar la cancelación: ${revertError.message}`);
    if (reverted) {
      await revertOrderAfterReservationDropped(tx, Number((reverted as { amount: number }).amount));
      return status;
    }
  }

  if (status === 'refunded') {
    // Devolución de un pago YA cobrado (la hace Sandy o un contracargo): se registra y se avisa.
    const { data: refunded } = await supabaseAdmin
      .from('payment_transactions')
      .update({ ...common, cancelled_at: now })
      .eq('id', tx.id)
      .eq('status', 'approved')
      .select('id')
      .maybeSingle();
    if (refunded) await alertSandy(`💸 Cobro repartido: se devolvió un pago de trabajo ya cobrado. Revisá la orden: ${orderLink(tx.order_id)}`);
    return status;
  }

  // rejected / cancelled / pending: nunca pisa un pago reservado o ya cobrado.
  const { error } = await supabaseAdmin
    .from('payment_transactions')
    .update(common)
    .eq('id', tx.id)
    .not('status', 'in', '(authorized,approved)');
  if (error) throw new Error(`No se pudo registrar el pago repartido: ${error.message}`);
  return status;
}

// ---------------------------------------------------------------------------------------------------------
// Fase 3: cobrar (capturar) o cancelar la reserva.
// ---------------------------------------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
/** El cron corre una vez por día: aviso al día 4 y acción al día 5 deja 1-2 días de margen antes del vencimiento (7). */
export const ALERT_AFTER_DAYS = 4;
export const ACT_AFTER_DAYS = 5;
export const RESERVATION_LIFETIME_DAYS = 7;

function orderLink(orderId: string): string {
  const base = (process.env.PUBLIC_APP_URL || 'https://tecniurbano.online').replace(/\/$/, '');
  return `${base}/#/hub?order=${orderId}`;
}

async function alertSandy(text: string): Promise<void> {
  try {
    await sendTelegramMessage(text);
  } catch (err) {
    console.error('[splitPayment] no se pudo avisar por Telegram', err instanceof Error ? err.name : 'desconocido');
  }
}

/** La reserva se cayó después de haber confirmado la orden: se descuenta lo acreditado y queda saldo pendiente. */
async function revertOrderAfterReservationDropped(tx: SplitTransaction, amount: number): Promise<void> {
  const { data: order, error } = await supabaseAdmin
    .from('service_orders')
    .select('id, title, status, total_paid_amount')
    .eq('id', tx.order_id)
    .maybeSingle();
  if (error || !order) {
    console.error('[splitPayment] no se encontró la orden para revertir', tx.order_id);
    return;
  }
  const o = order as { id: string; title: string | null; status: string; total_paid_amount: number | null };
  const patch: Record<string, unknown> = { total_paid_amount: Math.max(0, Number(o.total_paid_amount ?? 0) - amount) };
  if (o.status !== 'cancelled') patch.payment_status = 'balance_pending';
  const { error: updateError } = await supabaseAdmin.from('service_orders').update(patch).eq('id', o.id);
  if (updateError) console.error('[splitPayment] no se pudo revertir la orden', updateError.message);

  if (o.status !== 'cancelled') {
    await alertSandy(
      `⚠️ Cobro repartido: se cayó la reserva del trabajo "${String(o.title ?? '').slice(0, 80)}" y la orden quedó con saldo pendiente` +
        `${o.status === 'completed' ? ' (¡la orden ya estaba completada: el técnico no cobró!)' : ''}. ${orderLink(o.id)}`
    );
  }
}

type AuthorizedSplit = SplitTransaction & { amount: number; application_fee: number | null; mp_payment_id: string | null; authorized_at: string | null; split_alerted_at: string | null };

const SPLIT_TX_COLUMNS = 'id, order_id, quote_id, payment_type, status, split_technician_id, amount, application_fee, mp_payment_id, authorized_at, split_alerted_at';

async function authorizedSplitForOrder(orderId: string): Promise<AuthorizedSplit | null> {
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select(SPLIT_TX_COLUMNS)
    .eq('order_id', orderId)
    .eq('split', true)
    .eq('status', 'authorized')
    .limit(1);
  if (error) throw new Error(`No se pudo leer la reserva: ${error.message}`);
  return ((data ?? [])[0] as AuthorizedSplit | undefined) ?? null;
}

async function hasOpenClaim(orderId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('support_cases')
    .select('id')
    .eq('order_id', orderId)
    .not('status', 'in', '(resolved,closed)')
    .limit(1);
  if (error) {
    // Ante la duda, se asume que hay reclamo: no se cobra solo.
    console.error('[splitPayment] no se pudo revisar reclamos', error.message);
    return true;
  }
  return (data ?? []).length > 0;
}

// Forma plana (sin unión discriminada): el proyecto compila sin strictNullChecks y ahí TS no estrecha por `ok`.
export type SplitActionResult = { ok: boolean; status?: SplitTxStatus; reason?: string };

async function runSplitAction(tx: AuthorizedSplit, action: 'capture' | 'cancel', reason: string): Promise<SplitActionResult> {
  if (!tx.mp_payment_id) return { ok: false, reason: 'La reserva no tiene número de pago de Mercado Pago.' };
  const creds = await getTechnicianMpCredentials(tx.split_technician_id);
  if (!creds) {
    await alertSandy(`🚨 Cobro repartido: no se pudo ${action === 'capture' ? 'cobrar' : 'cancelar'} una reserva porque el técnico ya no tiene Mercado Pago vinculado. Resolvelo desde Mercado Pago. ${orderLink(tx.order_id)}`);
    return { ok: false, reason: 'El técnico ya no tiene Mercado Pago vinculado.' };
  }
  await supabaseAdmin.from('payment_transactions').update({ split_action_reason: reason.slice(0, 500) }).eq('id', tx.id).eq('status', 'authorized');
  try {
    const payment = await mpPaymentsRequest(`/v1/payments/${encodeURIComponent(tx.mp_payment_id)}`, creds.accessToken, {
      method: 'PUT',
      // La clave cambia por día: Mercado Pago recuerda la respuesta de cada clave, así que con una fija un fallo
      // de su lado se repetiría en todos los reintentos. Dentro del mismo día (trigger + cron, doble clic) es la
      // misma clave y no hay riesgo de operar dos veces.
      idempotencyKey: `${tx.id}-${action}-${new Date().toISOString().slice(0, 10)}`,
      body: action === 'capture' ? { capture: true } : { status: 'cancelled' },
    });
    const status = await applySplitPaymentStatus(tx, payment);
    return { ok: true, status };
  } catch (err) {
    const detail = describeMpError(err);
    console.error('[splitPayment] falló la acción sobre la reserva', action, tx.id, detail);
    // Queda el cuerpo del error en la transacción (sin tokens ni datos de tarjeta) para no tener que adivinar.
    await supabaseAdmin
      .from('payment_transactions')
      .update({ split_action_reason: `${reason.slice(0, 200)} — FALLÓ ${action === 'capture' ? 'el cobro' : 'la cancelación'}: ${detail}`.slice(0, 500) })
      .eq('id', tx.id)
      .eq('status', 'authorized');
    await alertSandy(`🚨 Cobro repartido: falló ${action === 'capture' ? 'el cobro' : 'la cancelación'} de una reserva (${detail}). Se reintenta mañana; revisalo antes de que venza. ${orderLink(tx.order_id)}`);
    return { ok: false, reason: `No se pudo completar en Mercado Pago (${detail}).` };
  }
}

/**
 * Orden completada → cobrar. Si hay un reclamo abierto NO se cobra solo: se avisa a Sandy para que decida.
 * `manual` = lo pidió un admin desde el panel (cobra aunque haya reclamo: ya lo decidió).
 */
export async function captureSplitForOrder(orderId: string, reason: string, manual = false): Promise<SplitActionResult> {
  const tx = await authorizedSplitForOrder(orderId);
  if (!tx) return { ok: false, reason: 'No hay una reserva vigente para esta orden.' };
  if (!manual && (await hasOpenClaim(orderId))) {
    await alertSandy(`🟠 Cobro repartido: la orden se completó pero tiene un reclamo abierto, así que NO se cobró solo. Decidí desde el panel (cobrar o cancelar) antes de que venza la reserva. ${orderLink(orderId)}`);
    return { ok: false, reason: 'Hay un reclamo abierto: decide administración.' };
  }
  return runSplitAction(tx, 'capture', reason);
}

/** Orden cancelada (o decisión de un admin) → cancelar la reserva: el cliente no paga el trabajo. */
export async function cancelSplitForOrder(orderId: string, reason: string): Promise<SplitActionResult> {
  const tx = await authorizedSplitForOrder(orderId);
  if (!tx) return { ok: false, reason: 'No hay una reserva vigente para esta orden.' };
  return runSplitAction(tx, 'cancel', reason);
}

export type SplitDailySummary = { checked: number; captured: number; cancelled: number; alerted: number; awaitingAdmin: number; failed: number };

/**
 * Paso del cron diario. No depende del interruptor: si alguna vez se apagó con reservas vigentes, igual hay que
 * resolverlas. Cada reserva es independiente: un fallo no frena a las demás.
 */
export async function processSplitReservations(now = Date.now()): Promise<SplitDailySummary> {
  const summary: SplitDailySummary = { checked: 0, captured: 0, cancelled: 0, alerted: 0, awaitingAdmin: 0, failed: 0 };
  const { data, error } = await supabaseAdmin
    .from('payment_transactions')
    .select(SPLIT_TX_COLUMNS)
    .eq('split', true)
    .eq('status', 'authorized');
  if (error) {
    console.error('[splitPayment] no se pudieron listar las reservas', error.message);
    return summary;
  }
  const toAlert: string[] = [];

  for (const tx of (data ?? []) as AuthorizedSplit[]) {
    summary.checked += 1;
    try {
      const { data: orderRow } = await supabaseAdmin.from('service_orders').select('id, title, status').eq('id', tx.order_id).maybeSingle();
      const order = orderRow as { id: string; title: string | null; status: string } | null;
      if (!order) continue;
      const ageDays = tx.authorized_at ? (now - new Date(tx.authorized_at).getTime()) / DAY_MS : 0;
      const expiresOn = tx.authorized_at
        ? new Date(new Date(tx.authorized_at).getTime() + RESERVATION_LIFETIME_DAYS * DAY_MS).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
        : 'pronto';

      let result: SplitActionResult | null = null;
      if (order.status === 'completed') {
        result = await captureSplitForOrder(order.id, 'Orden completada (control diario)');
        if (!result.ok) summary.awaitingAdmin += 1;
      } else if (order.status === 'cancelled') {
        result = await cancelSplitForOrder(order.id, 'Orden cancelada (control diario)');
      } else if (ageDays >= ACT_AFTER_DAYS) {
        if (await hasOpenClaim(order.id)) {
          summary.awaitingAdmin += 1;
          await alertSandy(`🟠 Cobro repartido: la reserva de "${String(order.title ?? '').slice(0, 80)}" vence el ${expiresOn} y hay un reclamo abierto. Decidí desde el panel: cobrar o cancelar. Si no, Mercado Pago la cancela sola. ${orderLink(order.id)}`);
          continue;
        }
        if (order.status === 'in_progress' || order.status === 'paused') {
          result = await runSplitAction(tx, 'capture', `Cobro automático al día ${ACT_AFTER_DAYS}: el técnico trabajó y no hay reclamo abierto`);
        } else {
          result = await runSplitAction(tx, 'cancel', `Cancelación automática al día ${ACT_AFTER_DAYS}: el trabajo no empezó`);
        }
      } else if (ageDays >= ALERT_AFTER_DAYS && !tx.split_alerted_at) {
        const { data: marked } = await supabaseAdmin
          .from('payment_transactions')
          .update({ split_alerted_at: new Date(now).toISOString() })
          .eq('id', tx.id)
          .is('split_alerted_at', null)
          .select('id')
          .maybeSingle();
        if (marked) toAlert.push(`• "${String(order.title ?? '').slice(0, 60)}" (vence el ${expiresOn}) ${orderLink(order.id)}`);
        continue;
      }

      if (result?.ok) {
        if (result.status === 'approved') summary.captured += 1;
        else if (result.status === 'cancelled') summary.cancelled += 1;
      } else if (result && !result.ok && order.status !== 'completed') {
        summary.failed += 1;
      }
    } catch (err) {
      summary.failed += 1;
      console.error('[splitPayment] error procesando una reserva', tx.id, err instanceof Error ? err.message : 'desconocido');
    }
  }

  if (toAlert.length > 0) {
    summary.alerted = toAlert.length;
    await alertSandy(
      `⏳ Cobro repartido: ${toAlert.length} reserva${toAlert.length === 1 ? '' : 's'} sin cerrar hace ${ALERT_AFTER_DAYS} días. ` +
        `Mañana se resuelve${toAlert.length === 1 ? '' : 'n'} solas (cobro si el técnico trabajó, cancelación si no empezó), salvo que haya reclamo abierto.\n${toAlert.join('\n')}`
    );
  }
  return summary;
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
