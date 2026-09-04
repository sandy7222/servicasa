import { supabase } from './supabase';

export const PAYOUT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export type PayoutRequestStatus = 'pending' | 'processing' | 'completed' | 'cancelled';

export type PayoutRequest = {
  id: string;
  technician_id: string;
  requested_amount: number;
  paid_amount: number | null;
  status: PayoutRequestStatus;
  requested_at: string;
  processed_at: string | null;
  completed_at: string | null;
  transfer_reference: string | null;
  payout_batch_id: string | null;
  settlement_count: number | null;
};

export type PayoutRequestItem = {
  request_id: string;
  settlement_id: string;
  net_amount: number;
};

export type PaymentAccount = {
  technician_id: string;
  account_holder: string;
  cbu_cvu: string;
  alias: string | null;
  provider: string;
};

export type AdminWithdrawal = {
  id: string;
  amount: number;
  transfer_reference: string;
  withdrawn_at: string;
  withdrawn_by: string;
  notes: string | null;
};

export function parseDailyProcessTime(value: unknown): string {
  const raw = typeof value === 'string' ? value : String(value ?? '');
  const match = raw.replace(/"/g, '').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : '20:00';
}

/** Próxima corrida del lote diario en hora de Buenos Aires. No transfiere sola. */
export function nextDailyProcessAt(timeHHMM: string, now = new Date()): Date {
  const [hour, minute] = parseDailyProcessTime(timeHHMM).split(':').map(Number);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: PAYOUT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const y = pick('year');
  const mo = pick('month');
  const d = pick('day');
  const nowH = pick('hour');
  const nowM = pick('minute');
  const alreadyPassed = nowH > hour || (nowH === hour && nowM >= minute);
  const utcGuess = new Date(Date.UTC(y, mo - 1, d + (alreadyPassed ? 1 : 0), hour + 3, minute));
  return utcGuess;
}

export function formatDailyProcessLabel(timeHHMM: string, now = new Date()): string {
  const next = nextDailyProcessAt(timeHHMM, now);
  const day = new Intl.DateTimeFormat('es-AR', {
    timeZone: PAYOUT_TIMEZONE,
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  }).format(next);
  return `${day} ${parseDailyProcessTime(timeHHMM)}`;
}

export async function fetchReservedSettlementIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('technician_reserved_settlements').select('settlement_id');
  if (error) throw error;
  return new Set((data ?? []).map((row) => String((row as { settlement_id: string }).settlement_id)));
}

export async function requestTechnicianPayout(amount: number): Promise<string> {
  const { data, error } = await supabase.rpc('request_technician_payout', { p_amount: amount });
  if (error) throw error;
  return String(data);
}

export async function cancelTechnicianPayoutRequest(requestId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc('cancel_technician_payout_request', {
    p_request_id: requestId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

export async function fulfillTechnicianPayoutRequest(args: {
  requestId: string;
  transferReference: string;
  receiptUrl?: string | null;
  destinationLast4?: string | null;
  transferMethod?: string;
}): Promise<void> {
  const { error } = await supabase.rpc('fulfill_technician_payout_request', {
    p_request_id: args.requestId,
    p_transfer_reference: args.transferReference,
    p_receipt_url: args.receiptUrl ?? null,
    p_destination_last4: args.destinationLast4 ?? null,
    p_transfer_method: args.transferMethod ?? 'bank_transfer',
  });
  if (error) throw error;
}

export async function withdrawAdminEarnings(amount: number, transferReference: string, notes?: string): Promise<void> {
  const { error } = await supabase.rpc('withdraw_admin_earnings', {
    p_amount: amount,
    p_transfer_reference: transferReference,
    p_notes: notes ?? null,
  });
  if (error) throw error;
}

export async function fetchTechnicianWalletAvailable(technicianId: string): Promise<number> {
  const { data, error } = await supabase.rpc('technician_wallet_available_guarded', {
    p_technician_id: technicianId,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchAdminPlatformWalletAvailable(): Promise<number> {
  const { data, error } = await supabase.rpc('admin_platform_wallet_available_guarded');
  if (error) throw error;
  return Number(data ?? 0);
}

export async function fetchPendingPayoutRequestCount(): Promise<number> {
  const { count, error } = await supabase
    .from('technician_payout_requests')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}
