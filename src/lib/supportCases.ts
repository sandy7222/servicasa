import type {
  ClaimCase,
  ClaimHistory,
  ClaimInput,
  ClaimMessage,
  ClaimResolutionType,
  ClaimSettlementAction,
  ClaimStatus,
} from '../types';
import { supabase } from './supabase';
import type {
  DbSupportCase,
  DbSupportCaseHistory,
  DbSupportCaseMessage,
} from './supabase';
import { persistAdminIncident, persistResolveAdminIncident } from './supabaseMutations';

export type ClaimActor = { name: string; profileId?: string };

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Acción sugerida sobre la liquidación según el tipo de resolución. */
export const RESOLUTION_SETTLEMENT_ACTION: Record<ClaimResolutionType, ClaimSettlementAction> = {
  full_refund: 'cancel',
  send_another_technician: 'cancel',
  credit_note: 'release',
  no_action: 'release',
  partial_refund: 'retain',
  redo_work: 'retain',
  other: 'retain',
};

export function suggestedSettlementAction(resolutionType: ClaimResolutionType): ClaimSettlementAction {
  return RESOLUTION_SETTLEMENT_ACTION[resolutionType] ?? 'retain';
}

export function mapClaimMessage(row: DbSupportCaseMessage): ClaimMessage {
  return {
    id: row.id,
    senderType: row.sender_type,
    channel: row.channel,
    message: row.message,
    isInternal: row.is_internal,
    createdAt: row.created_at,
  };
}

export function mapClaimHistory(row: DbSupportCaseHistory): ClaimHistory {
  return {
    id: row.id,
    changeType: row.change_type,
    previousValue: row.previous_value ?? undefined,
    newValue: row.new_value ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapClaim(
  row: DbSupportCase,
  messages: DbSupportCaseMessage[] = [],
  history: DbSupportCaseHistory[] = []
): ClaimCase {
  return {
    id: row.id,
    caseNumber: row.case_number,
    orderId: row.order_id,
    customerId: row.customer_id,
    customerName: row.customer_name ?? undefined,
    technicianId: row.technician_id,
    technicianName: row.technician_name ?? undefined,
    type: row.case_type as ClaimCase['type'],
    status: row.status as ClaimStatus,
    priority: row.priority as ClaimCase['priority'],
    subject: row.subject,
    description: row.description ?? undefined,
    resolutionType: (row.resolution_type as ClaimResolutionType | null) ?? undefined,
    resolutionAmount: row.resolution_amount == null ? undefined : Number(row.resolution_amount),
    resolutionNotes: row.resolution_notes ?? undefined,
    settlementPaused: row.settlement_paused,
    openedAt: row.opened_at,
    resolvedAt: row.resolved_at,
    closedAt: row.closed_at,
    messages: messages.map(mapClaimMessage),
    history: history.map(mapClaimHistory),
  };
}

async function fetchKids(caseIds: string[]) {
  if (caseIds.length === 0) {
    return { messages: [] as DbSupportCaseMessage[], history: [] as DbSupportCaseHistory[] };
  }
  const [messages, history] = await Promise.all([
    supabase.from('support_case_messages').select('*').in('case_id', caseIds).order('created_at', { ascending: true }),
    supabase.from('support_case_history').select('*').in('case_id', caseIds).order('created_at', { ascending: false }),
  ]);
  throwIfError(messages.error);
  throwIfError(history.error);
  return {
    messages: (messages.data ?? []) as DbSupportCaseMessage[],
    history: (history.data ?? []) as DbSupportCaseHistory[],
  };
}

export async function fetchClaims(): Promise<ClaimCase[]> {
  const { data, error } = await supabase
    .from('support_cases')
    .select('*')
    .order('opened_at', { ascending: false });
  throwIfError(error);

  const rows = (data ?? []) as DbSupportCase[];
  const { messages, history } = await fetchKids(rows.map((r) => r.id));

  return rows.map((row) =>
    mapClaim(
      row,
      messages.filter((m) => m.case_id === row.id),
      history.filter((h) => h.case_id === row.id)
    )
  );
}

export async function fetchClaim(claimId: string): Promise<ClaimCase | null> {
  const { data, error } = await supabase
    .from('support_cases')
    .select('*')
    .eq('id', claimId)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;

  const row = data as DbSupportCase;
  const { messages, history } = await fetchKids([row.id]);
  return mapClaim(row, messages, history);
}

/** Aplica la acción de liquidación sobre la orden de un caso (pausado → liberar/cancelar). */
export async function applySettlementAction(orderId: string, action: 'release' | 'cancel') {
  const status = action === 'release' ? 'released' : 'cancelled';
  const { error } = await supabase
    .from('technician_settlements')
    .update({ status, dispute_reason: null, resolved_at: new Date().toISOString() })
    .eq('order_id', orderId)
    .in('status', ['in_review']);
  throwIfError(error);
}

async function insertHistory(caseId: string, actor: ClaimActor, change: {
  changeType: string;
  previousValue?: string;
  newValue?: string;
  notes?: string;
}) {
  const { error } = await supabase.from('support_case_history').insert({
    case_id: caseId,
    changed_by: actor.profileId ?? null,
    change_type: change.changeType,
    previous_value: change.previousValue ?? null,
    new_value: change.newValue ?? null,
    notes: change.notes ?? null,
  });
  throwIfError(error);
}

export async function createCase(
  input: ClaimInput,
  actor: ClaimActor,
  /** El espejo en service_orders.admin_incident_status (y la pausa de
   * liquidación) son escrituras admin-only en la base — un cliente o técnico
   * abriendo un caso sobre su propio pedido no tiene ese permiso, así que
   * NewClaimModal en modo autoservicio pasa isAdminActor=false para saltear
   * ese paso. El caso en sí (support_cases) se crea igual para todos. */
  isAdminActor = true
): Promise<ClaimCase> {
  const { data, error } = await supabase
    .from('support_cases')
    .insert({
      customer_id: input.customerId ?? null,
      order_id: input.orderId ?? null,
      technician_id: input.technicianId ?? null,
      customer_name: input.customerName ?? null,
      technician_name: input.technicianName ?? null,
      case_type: input.type,
      priority: input.priority,
      subject: input.subject,
      description: input.description ?? null,
      settlement_paused: Boolean(input.pauseSettlement && input.orderId),
      opened_by: actor.profileId ?? null,
    })
    .select('*')
    .single();
  throwIfError(error);

  const created = data as DbSupportCase;
  await insertHistory(created.id, actor, { changeType: 'created', notes: input.subject });

  // Espejo sobre la orden + pausa de liquidación (reutiliza la lógica existente).
  if (input.orderId && isAdminActor) {
    await persistAdminIncident({
      orderId: input.orderId,
      reason: input.subject,
      author: actor.name,
      actorProfileId: actor.profileId,
      pauseSettlements: Boolean(input.pauseSettlement),
    });
    if (input.pauseSettlement) {
      await insertHistory(created.id, actor, {
        changeType: 'settlement_paused',
        newValue: 'in_review',
        notes: 'Liquidación puesta en revisión al abrir el caso.',
      });
    }
  }

  return mapClaim(created);
}

export async function updateCaseStatus(claimId: string, status: ClaimStatus, actor: ClaimActor) {
  const previous = await fetchClaim(claimId);
  const { error } = await supabase
    .from('support_cases')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', claimId);
  throwIfError(error);
  await insertHistory(claimId, actor, {
    changeType: 'status_change',
    previousValue: previous?.status,
    newValue: status,
  });
}

export async function addCaseMessage(
  claimId: string,
  payload: {
    senderType: ClaimMessage['senderType'];
    channel: ClaimMessage['channel'];
    message: string;
    isInternal?: boolean;
  },
  actor: ClaimActor
) {
  const { error } = await supabase.from('support_case_messages').insert({
    case_id: claimId,
    sender_type: payload.senderType,
    channel: payload.isInternal ? 'internal_note' : payload.channel,
    message: payload.message,
    is_internal: Boolean(payload.isInternal),
    created_by: actor.profileId ?? null,
  });
  throwIfError(error);
  // Las notas internas no dejan rastro en el historial: cliente y técnico
  // tienen acceso de lectura al historial de su propio caso, y ni siquiera
  // la existencia de una nota interna debería filtrarse ahí.
  if (!payload.isInternal) {
    await insertHistory(claimId, actor, {
      changeType: 'message_added',
      notes: `Comunicación registrada vía ${payload.channel}.`,
    });
  }
}

export async function resolveCase(
  claimId: string,
  resolution: {
    resolutionType: ClaimResolutionType;
    resolutionAmount?: number;
    resolutionNotes?: string;
  },
  settlementAction: ClaimSettlementAction,
  actor: ClaimActor
) {
  const previous = await fetchClaim(claimId);
  if (!previous) throw new Error('Caso no encontrado');

  const stillHeld = settlementAction === 'retain';

  const { error } = await supabase
    .from('support_cases')
    .update({
      status: 'resolved',
      resolution_type: resolution.resolutionType,
      resolution_amount: resolution.resolutionAmount ?? null,
      resolution_notes: resolution.resolutionNotes ?? null,
      settlement_paused: stillHeld,
      resolved_by: actor.profileId ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', claimId);
  throwIfError(error);

  await insertHistory(claimId, actor, {
    changeType: 'resolution_added',
    newValue: resolution.resolutionType,
    notes: resolution.resolutionNotes,
  });

  if (previous.orderId) {
    if (settlementAction === 'release') {
      await applySettlementAction(previous.orderId, 'release');
      await insertHistory(claimId, actor, { changeType: 'settlement_released', newValue: 'released' });
    } else if (settlementAction === 'cancel') {
      await applySettlementAction(previous.orderId, 'cancel');
      await insertHistory(claimId, actor, { changeType: 'settlement_cancelled', newValue: 'cancelled' });
    } else {
      await insertHistory(claimId, actor, {
        changeType: 'settlement_retained',
        newValue: 'in_review',
        notes: 'Liquidación retenida para revisión manual.',
      });
    }

    // Espejo: la orden queda con la incidencia resuelta (reutiliza la lógica existente).
    await persistResolveAdminIncident({
      orderId: previous.orderId,
      author: actor.name,
      actorProfileId: actor.profileId,
    });
  }
}

export async function pauseCaseSettlement(claimId: string, orderId: string, reason: string, actor: ClaimActor) {
  const { error } = await supabase
    .from('technician_settlements')
    .update({ status: 'in_review', dispute_reason: reason })
    .eq('order_id', orderId)
    .in('status', ['pending_release', 'released', 'scheduled']);
  throwIfError(error);

  const { error: caseError } = await supabase
    .from('support_cases')
    .update({ settlement_paused: true, updated_at: new Date().toISOString() })
    .eq('id', claimId);
  throwIfError(caseError);

  await insertHistory(claimId, actor, { changeType: 'settlement_paused', newValue: 'in_review', notes: reason });
}

export async function releaseCaseSettlement(claimId: string, orderId: string, actor: ClaimActor) {
  await applySettlementAction(orderId, 'release');
  const { error } = await supabase
    .from('support_cases')
    .update({ settlement_paused: false, updated_at: new Date().toISOString() })
    .eq('id', claimId);
  throwIfError(error);
  await insertHistory(claimId, actor, { changeType: 'settlement_released', newValue: 'released' });
}

export async function cancelCaseSettlement(claimId: string, orderId: string, actor: ClaimActor) {
  await applySettlementAction(orderId, 'cancel');
  const { error } = await supabase
    .from('support_cases')
    .update({ settlement_paused: false, updated_at: new Date().toISOString() })
    .eq('id', claimId);
  throwIfError(error);
  await insertHistory(claimId, actor, { changeType: 'settlement_cancelled', newValue: 'cancelled' });
}

export async function closeCase(claimId: string, actor: ClaimActor) {
  const { error } = await supabase
    .from('support_cases')
    .update({ status: 'closed', closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', claimId);
  throwIfError(error);
  await insertHistory(claimId, actor, { changeType: 'closed', newValue: 'closed' });
}
