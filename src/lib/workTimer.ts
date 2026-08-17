import type { ServiceOrder } from '../types';

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
