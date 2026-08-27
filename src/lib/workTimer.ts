import type { PaymentStatus, ServiceOrder, WorkMode } from '../types';

/**
 * New payment-aware orders can execute only after the platform confirms the
 * payment. Legacy orders without workMode remain usable during migration.
 */
export function canExecutePaidWork(order: ServiceOrder): boolean {
  if (!order.workMode) return true;
  if (order.workMode === 'direct') return order.paymentStatus === 'paid_in_full';
  return order.quoteStatus === 'accepted' && order.paymentStatus === 'paid_in_full';
}

type OrderPaymentShape = { workMode?: WorkMode; paymentStatus?: PaymentStatus };

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
 * forward" — same criteria that blocks assignTechnician in AppContext.tsx:
 * direct (precio fijo) needs the full amount; diagnosis needs at least the
 * visit deposit. Orders with no workMode are treated as settled (the gate
 * doesn't apply to them at all — check orderRequiresPaymentGate first).
 */
export function isOrderPaymentSettled(order: OrderPaymentShape): boolean {
  if (order.workMode === 'direct') return order.paymentStatus === 'paid_in_full';
  if (order.workMode === 'diagnosis') {
    return order.paymentStatus === 'deposit_paid' || order.paymentStatus === 'paid_in_full';
  }
  return true;
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
