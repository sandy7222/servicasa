import type { OrderStatus, PaymentStatus, QuoteStatus, ServiceOrder, WorkMode } from '../types';

type OrderPaymentShape = { workMode?: WorkMode; paymentStatus?: PaymentStatus };

type OrderTimerLabelShape = {
  status: OrderStatus;
  workMode?: WorkMode;
  technicianResponseStatus?: 'pending' | 'accepted' | 'rejected';
  travelStartedAt?: string;
  arrivedAt?: string;
};

export type TimerStatusLabel =
  | 'PENDIENTE'
  | 'ASIGNADA'
  | 'EN CAMINO'
  | 'PRESUPUESTANDO'
  | 'EN CURSO'
  | 'PAUSADO'
  | 'FINALIZADO'
  | 'CANCELADA';

/**
 * Etiqueta del cronómetro en la terminal del técnico. Antes era un binario
 * EN CURSO / PAUSADO que mostraba "PAUSADO" para cualquier cosa que no
 * fuera 'in_progress' — incluida una orden recién asignada, en camino,
 * presupuestando (diagnóstico esperando el pago) o ya finalizada, todas
 * mostradas como si el técnico hubiera pausado un trabajo que en realidad
 * ni empezó. Esta función distingue esos casos por lo que realmente son.
 */
export function getTimerStatusLabel(order: OrderTimerLabelShape): TimerStatusLabel {
  if (order.status === 'in_progress') return 'EN CURSO';
  if (order.status === 'paused') return 'PAUSADO';
  if (order.status === 'completed') return 'FINALIZADO';
  if (order.status === 'cancelled') return 'CANCELADA';
  // order.status === 'assigned' a partir de acá
  if (order.technicianResponseStatus === 'pending') return 'PENDIENTE';
  if (order.workMode === 'diagnosis' && order.arrivedAt) return 'PRESUPUESTANDO';
  if (order.travelStartedAt) return 'EN CAMINO';
  return 'ASIGNADA';
}

/**
 * Whether an order goes through the visit-deposit / precio-fijo payment flow
 * at all. Orders without workMode (created directly by admin, outside the
 * self-service flow) never carry a payment expectation.
 */
export function orderRequiresPaymentGate(order: OrderPaymentShape): boolean {
  return order.workMode === 'diagnosis' || order.workMode === 'direct';
}

/**
 * Single source of truth for "has this order been paid enough to move
 * forward" — same criteria that blocks assignTechnician in AppContext.tsx,
 * and also gates starting/resuming the work timer (assigned/paused ->
 * in_progress) in updateOrderStatus and TechnicianView: direct (precio fijo)
 * needs the full amount; diagnosis needs at least the visit deposit, since
 * the technician's first trip out is the diagnosis visit itself — the final
 * quote doesn't exist yet at that point. Orders with no workMode are treated
 * as settled (the gate doesn't apply to them at all — check
 * orderRequiresPaymentGate first).
 */
export function isOrderPaymentSettled(order: OrderPaymentShape): boolean {
  if (order.workMode === 'direct') return order.paymentStatus === 'paid_in_full';
  if (order.workMode === 'diagnosis') {
    return order.paymentStatus === 'deposit_paid' || order.paymentStatus === 'paid_in_full';
  }
  return true;
}

/**
 * Etapa que el cliente realmente está transitando. El portal no debe
 * mostrar bloques de etapas futuras (progreso vacío, firma, etc.) apenas
 * el técnico acepta la visita.
 *
 * No reutiliza isOrderPaymentSettled: esa función da true con la seña de
 * diagnóstico, y acá el seguimiento de obra pide el pago del presupuesto.
 * Tampoco usa workStartedAt: puede quedar sucio si se rebobina el status.
 */
export type CustomerOrderStage =
  | 'searching_technician'
  | 'technician_assigned'
  | 'quote_awaiting_payment'
  | 'work_in_progress'
  | 'awaiting_signature'
  | 'completed'
  | 'cancelled';

type CustomerOrderStageShape = {
  status: OrderStatus;
  workMode?: WorkMode;
  paymentStatus?: PaymentStatus;
  quoteStatus?: QuoteStatus;
  assignedTechnicianId?: string | null;
  technicianResponseStatus?: 'pending' | 'accepted' | 'rejected';
  checklist?: Array<{ completed: boolean }>;
  customerSignature?: { signatureDataUrl?: string } | null;
  quotes?: Array<{ status: string }>;
  materialExpenses?: Array<unknown>;
};

function hasConfirmedTechnician(order: CustomerOrderStageShape): boolean {
  return Boolean(
    order.assignedTechnicianId &&
      order.technicianResponseStatus !== 'pending' &&
      order.technicianResponseStatus !== 'rejected'
  );
}

function quoteRecordStatus(order: CustomerOrderStageShape): string | undefined {
  return order.quotes?.[0]?.status ?? order.quoteStatus;
}

function isDiagnosisQuotePaid(order: CustomerOrderStageShape): boolean {
  return quoteRecordStatus(order) === 'accepted' && order.paymentStatus === 'paid_in_full';
}

function isWorkUnderway(order: CustomerOrderStageShape): boolean {
  return order.status === 'in_progress' || order.status === 'paused' || order.status === 'completed';
}

function isChecklistReadyForSignature(order: CustomerOrderStageShape): boolean {
  const list = order.checklist ?? [];
  return list.length > 0 && list.every((item) => item.completed);
}

export function canCustomerSeeQuote(order: CustomerOrderStageShape): boolean {
  const status = quoteRecordStatus(order);
  return status === 'sent' || status === 'rejected' || status === 'accepted';
}

export function canCustomerSeeWorkTracking(order: CustomerOrderStageShape): boolean {
  if (order.status === 'cancelled' || order.status === 'assigned') return false;
  if (!isWorkUnderway(order)) return false;
  if (order.workMode === 'diagnosis') return isDiagnosisQuotePaid(order);
  return true;
}

/** Lista de ferretería: no es factura. Recién cuando el presupuesto está pago y hay obra. */
export function canCustomerSeeShoppingList(order: CustomerOrderStageShape): boolean {
  if (order.status === 'cancelled') return false;
  if (!(order.materialExpenses && order.materialExpenses.length > 0)) return false;
  return canCustomerSeeWorkTracking(order);
}

export function canCustomerSeeSignature(order: CustomerOrderStageShape): boolean {
  if (!canCustomerSeeWorkTracking(order)) return false;
  if (order.customerSignature?.signatureDataUrl) return true;
  if (order.status === 'completed') return true;
  return isChecklistReadyForSignature(order);
}

export function getCustomerOrderStage(order: CustomerOrderStageShape): CustomerOrderStage {
  if (order.status === 'cancelled') return 'cancelled';
  if (order.status === 'completed') return 'completed';
  if (!hasConfirmedTechnician(order)) return 'searching_technician';
  if (canCustomerSeeSignature(order)) return 'awaiting_signature';
  if (canCustomerSeeWorkTracking(order)) return 'work_in_progress';

  const quoteStatus = quoteRecordStatus(order);
  if (order.workMode === 'diagnosis' && (quoteStatus === 'sent' || quoteStatus === 'rejected' || isDiagnosisQuotePaid(order))) {
    return 'quote_awaiting_payment';
  }
  return 'technician_assigned';
}

/**
 * The database is the source of truth: elapsed time is the saved total plus
 * the interval since work_started_at only while the order is in progress.
 */
export function getOrderElapsedSeconds(order: ServiceOrder, now = Date.now()): number {
  const accumulated = order.workElapsedSeconds ?? 0;
  if (order.status !== 'in_progress' || !order.workStartedAt) return accumulated;

  const startedAt = new Date(order.workStartedAt).getTime();
  if (Number.isNaN(startedAt)) return accumulated;
  return accumulated + Math.max(0, Math.floor((now - startedAt) / 1000));
}

export function formatElapsedTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
