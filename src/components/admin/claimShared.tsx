import type { ClaimPriority, ClaimResolutionType, ClaimSettlementAction, ClaimStatus, ClaimType } from '../../types';

export const money = new Intl.NumberFormat('es-AR', {
  style: 'currency', currency: 'ARS', maximumFractionDigits: 0,
});

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  warranty: 'Garantía',
  complaint: 'Queja',
  dispute: 'Disputa de pago',
  no_show: 'Técnico no se presentó',
  damage: 'Daño',
  other: 'Otro',
};

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  open: 'Abierto',
  in_progress: 'En progreso',
  waiting_client: 'Esperando cliente',
  waiting_technician: 'Esperando técnico',
  resolved: 'Resuelto',
  closed: 'Cerrado',
  escalated: 'Escalado',
};

export const CLAIM_PRIORITY_LABELS: Record<ClaimPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
};

export const RESOLUTION_TYPE_LABELS: Record<ClaimResolutionType, string> = {
  full_refund: 'Reembolso total',
  partial_refund: 'Reembolso parcial',
  redo_work: 'Rehacer trabajo',
  send_another_technician: 'Enviar otro técnico',
  credit_note: 'Nota de crédito',
  no_action: 'Sin acción',
  other: 'Otro',
};

export const SETTLEMENT_ACTION_LABELS: Record<ClaimSettlementAction, string> = {
  release: 'Liberar liquidación',
  cancel: 'Cancelar liquidación',
  retain: 'Retener para revisión',
};

const STATUS_TONE: Record<ClaimStatus, string> = {
  open: 'bg-rose-50 text-rose-700 border-rose-200',
  in_progress: 'bg-sky-50 text-sky-700 border-sky-200',
  waiting_client: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 border-amber-200 dark:border-amber-800',
  waiting_technician: 'bg-violet-50 text-violet-700 border-violet-200',
  resolved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  closed: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  escalated: 'bg-rose-100 text-rose-800 border-rose-300',
};

const PRIORITY_TONE: Record<ClaimPriority, string> = {
  low: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  medium: 'bg-sky-50 text-sky-700 border-sky-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  urgent: 'bg-rose-50 text-rose-700 border-rose-200',
};

export function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold border ${STATUS_TONE[status]}`}>
      {CLAIM_STATUS_LABELS[status]}
    </span>
  );
}

export function ClaimPriorityBadge({ priority }: { priority: ClaimPriority }) {
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-bold border ${PRIORITY_TONE[priority]}`}>
      {CLAIM_PRIORITY_LABELS[priority]}
    </span>
  );
}

export function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('es-AR') : '—';
}

export function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString('es-AR') : '—';
}
