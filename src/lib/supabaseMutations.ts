import type {
  Customer,
  CustomerServiceRequestInput,
  MaterialInventory,
  OrderEventType,
  OrderPriority,
  OrderStatus,
  ServiceOrder,
  ServiceType,
  Technician,
  TechnicianInput,
} from '../types';
import { supabase } from './supabase';
import { mapCustomer, mapMaterial, mapOrder, mapTechnician } from './supabaseData';
import type { DbCustomer, DbMaterial, DbServiceOrder, DbTechnician } from './supabase';

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

const TECH_AVATAR_COLORS = ['bg-sky-600', 'bg-teal-600', 'bg-indigo-600', 'bg-violet-600', 'bg-cyan-600'];

function pickAvatarBg(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash + seed.charCodeAt(i) * (i + 1)) % TECH_AVATAR_COLORS.length;
  return TECH_AVATAR_COLORS[hash] ?? 'bg-sky-600';
}

export type TechnicianWriteInput = TechnicianInput;

async function linkTechnicianAsCustomer(
  tech: Technician,
  input: TechnicianWriteInput
): Promise<{ technician: Technician; customer: Customer | null }> {
  if (!input.alsoAsCustomer) {
    return { technician: tech, customer: null };
  }

  const address = (input.customerAddress ?? '').trim() || 'A completar';
  const neighborhood =
    (input.customerNeighborhood ?? '').trim() || input.zone.trim() || 'CABA';

  const { data: existingByEmail } = await supabase
    .from('customers')
    .select('*')
    .ilike('email', tech.email)
    .maybeSingle();

  let customerRow: DbCustomer;
  if (existingByEmail) {
    const { data, error } = await supabase
      .from('customers')
      .update({
        name: tech.name,
        phone: tech.phone,
        email: tech.email,
        address: address === 'A completar' ? (existingByEmail as DbCustomer).address : address,
        neighborhood:
          neighborhood === 'CABA'
            ? (existingByEmail as DbCustomer).neighborhood
            : neighborhood,
        notes: input.customerNotes ?? (existingByEmail as DbCustomer).notes,
        profile_id: tech.profileId ?? (existingByEmail as DbCustomer).profile_id,
      })
      .eq('id', (existingByEmail as DbCustomer).id)
      .select('*')
      .single();
    throwIfError(error);
    customerRow = data as DbCustomer;
  } else {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name: tech.name,
        phone: tech.phone,
        email: tech.email,
        address,
        neighborhood,
        notes: input.customerNotes ?? null,
        profile_id: tech.profileId ?? null,
      })
      .select('*')
      .single();
    throwIfError(error);
    customerRow = data as DbCustomer;
  }

  if (tech.profileId) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ customer_id: customerRow.id })
      .eq('id', tech.profileId);
    throwIfError(profileError);
  }

  return {
    technician: { ...tech, customerId: customerRow.id },
    customer: mapCustomer(customerRow),
  };
}

export async function persistCreateCustomer(input: Omit<Customer, 'id' | 'profileId'>): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .insert({
      name: input.name,
      address: input.address,
      neighborhood: input.neighborhood,
      phone: input.phone,
      email: input.email,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  throwIfError(error);
  return mapCustomer(data as DbCustomer);
}

export async function persistUpdateCustomer(
  customerId: string,
  input: Omit<Customer, 'id' | 'profileId'>
): Promise<Customer> {
  const { data, error } = await supabase
    .from('customers')
    .update({
      name: input.name,
      address: input.address,
      neighborhood: input.neighborhood,
      phone: input.phone,
      email: input.email,
      notes: input.notes ?? null,
    })
    .eq('id', customerId)
    .select('*')
    .single();
  throwIfError(error);

  // Campos denormalizados en órdenes
  const { error: ordersError } = await supabase
    .from('service_orders')
    .update({
      client_name: input.name,
      client_phone: input.phone,
      client_address: input.address,
      client_neighborhood: input.neighborhood,
    })
    .eq('customer_id', customerId);
  throwIfError(ordersError);

  return mapCustomer(data as DbCustomer);
}

export async function persistDeleteCustomer(customerId: string) {
  const { error } = await supabase.from('customers').delete().eq('id', customerId);
  throwIfError(error);
}

export async function persistCreateTechnician(
  input: TechnicianWriteInput
): Promise<{ technician: Technician; customer: Customer | null }> {
  const { data, error } = await supabase
    .from('technicians')
    .insert({
      name: input.name,
      specialty: input.specialty,
      phone: input.phone,
      email: input.email,
      rating: input.rating ?? 5,
      avatar_bg: pickAvatarBg(input.email || input.name),
      zone: input.zone,
      province: input.province,
    })
    .select('*')
    .single();
  throwIfError(error);

  const tech = mapTechnician(data as DbTechnician);
  return linkTechnicianAsCustomer(tech, input);
}

export async function persistUpdateTechnician(
  technicianId: string,
  input: TechnicianWriteInput
): Promise<{ technician: Technician; customer: Customer | null }> {
  const { data, error } = await supabase
    .from('technicians')
    .update({
      name: input.name,
      specialty: input.specialty,
      phone: input.phone,
      email: input.email,
      rating: input.rating ?? 5,
      zone: input.zone,
      province: input.province,
    })
    .eq('id', technicianId)
    .select('*')
    .single();
  throwIfError(error);

  const { error: ordersError } = await supabase
    .from('service_orders')
    .update({ assigned_technician_name: input.name })
    .eq('assigned_technician_id', technicianId);
  throwIfError(ordersError);

  const tech = mapTechnician(data as DbTechnician);

  if (tech.profileId) {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ full_name: input.name, email: input.email })
      .eq('id', tech.profileId);
    throwIfError(profileError);
  }

  return linkTechnicianAsCustomer(tech, input);
}

export async function persistDeleteTechnician(technicianId: string) {
  const { error } = await supabase.from('technicians').delete().eq('id', technicianId);
  throwIfError(error);
}

export async function persistCreateMaterial(
  input: Omit<MaterialInventory, 'id'>
): Promise<MaterialInventory> {
  const { data, error } = await supabase
    .from('materials')
    .insert({
      name: input.name,
      category: input.category,
      stock: input.stock,
      unit: input.unit,
      cost_estimate: input.costEstimate,
    })
    .select('*')
    .single();
  throwIfError(error);
  return mapMaterial(data as DbMaterial);
}

export async function persistUpdateMaterial(
  materialId: string,
  input: Omit<MaterialInventory, 'id'>
): Promise<MaterialInventory> {
  const { data, error } = await supabase
    .from('materials')
    .update({
      name: input.name,
      category: input.category,
      stock: input.stock,
      unit: input.unit,
      cost_estimate: input.costEstimate,
    })
    .eq('id', materialId)
    .select('*')
    .single();
  throwIfError(error);
  return mapMaterial(data as DbMaterial);
}

export async function persistUpdateMaterialStock(materialId: string, stock: number) {
  const { error } = await supabase.from('materials').update({ stock }).eq('id', materialId);
  throwIfError(error);
}

export async function persistDeleteMaterial(materialId: string) {
  const { error } = await supabase.from('materials').delete().eq('id', materialId);
  throwIfError(error);
}

export async function persistCreateOrder(input: {
  title: string;
  description: string;
  serviceType: ServiceType;
  priority: OrderPriority;
  scheduledDate: string;
  customer: Customer;
  technician?: { id: string; name: string } | null;
  checklistLabels: string[];
  author: string;
}): Promise<ServiceOrder> {
  const { data: orderRow, error } = await supabase
    .from('service_orders')
    .insert({
      title: input.title,
      description: input.description,
      service_type: input.serviceType,
      priority: input.priority,
      status: input.technician ? 'assigned' : 'assigned',
      scheduled_date: /^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate)
        ? input.scheduledDate
        : new Date().toISOString().slice(0, 10),
      customer_id: input.customer.id,
      client_name: input.customer.name,
      client_phone: input.customer.phone,
      client_address: input.customer.address,
      client_neighborhood: input.customer.neighborhood,
      assigned_technician_id: input.technician?.id ?? null,
      assigned_technician_name: input.technician?.name ?? null,
    })
    .select('*')
    .single();
  throwIfError(error);

  const orderId = (orderRow as DbServiceOrder).id;

  if (input.checklistLabels.length > 0) {
    const { error: checklistError } = await supabase.from('order_checklist_items').insert(
      input.checklistLabels.map((label, index) => ({
        order_id: orderId,
        label,
        sort_order: index + 1,
        completed: false,
      }))
    );
    throwIfError(checklistError);
  }

  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: orderId,
    type: 'assigned' satisfies OrderEventType,
    description: input.technician
      ? `Orden creada y asignada a ${input.technician.name}.`
      : 'Orden creada pendiente de asignación.',
    author: input.author,
  });
  throwIfError(eventError);

  const full = await fetchOrderById(orderId);
  if (!full) throw new Error('No se pudo recargar la orden creada.');
  return full;
}

/**
 * Customer-side request creation deliberately stores an initial request only.
 * It never marks money as paid and never assigns a technician. A server-side
 * Mercado Pago endpoint will be the only authority that changes payment state.
 */
export async function persistCreateCustomerRequest(input: {
  request: CustomerServiceRequestInput;
  customer: Customer;
}): Promise<ServiceOrder> {
  const requestedDescription = `${input.request.description.trim()}\n\nDisponibilidad solicitada: ${input.request.appointmentWindow}`;
  const { data, error } = await supabase
    .from('service_orders')
    .insert({
      title: input.request.title.trim(),
      description: requestedDescription,
      service_type: input.request.serviceType,
      priority: input.request.priority,
      // The legacy enum does not have "pending". The separate service_status
      // holds the real lifecycle value introduced by the payments migration.
      status: 'assigned',
      service_status: 'pending',
      work_mode: input.request.workMode,
      quote_status: 'none',
      payment_status: 'pending',
      visit_deposit_amount: input.request.workMode === 'diagnosis' ? 30000 : 0,
      total_quoted_amount: input.request.workMode === 'direct' ? Number(input.request.requestedTotal ?? 0) : 0,
      total_paid_amount: 0,
      extra_amount: 0,
      scheduled_date: input.request.scheduledDate,
      customer_id: input.customer.id,
      client_name: input.customer.name,
      client_phone: input.customer.phone,
      client_address: input.request.address.trim(),
      client_neighborhood: input.request.neighborhood.trim() || input.customer.neighborhood || 'A confirmar',
      assigned_technician_id: null,
      assigned_technician_name: null,
    })
    .select('*')
    .single();
  throwIfError(error);
  return mapOrder(data as DbServiceOrder);
}

export async function fetchOrderById(orderId: string): Promise<ServiceOrder | null> {
  const { data, error } = await supabase.from('service_orders').select('*').eq('id', orderId).maybeSingle();
  throwIfError(error);
  if (!data) return null;

  const [checklist, timeLogs, notes, materials, events, signature] = await Promise.all([
    supabase.from('order_checklist_items').select('*').eq('order_id', orderId).order('sort_order'),
    supabase.from('order_time_logs').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('order_notes').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('order_materials_used').select('*').eq('order_id', orderId).order('added_at', { ascending: false }),
    supabase.from('order_events').select('*').eq('order_id', orderId).order('created_at', { ascending: false }),
    supabase.from('order_signatures').select('*').eq('order_id', orderId).maybeSingle(),
  ]);

  throwIfError(checklist.error);
  throwIfError(timeLogs.error);
  throwIfError(notes.error);
  throwIfError(materials.error);
  throwIfError(events.error);
  throwIfError(signature.error);

  return mapOrder(data as DbServiceOrder, {
    checklist: (checklist.data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      completed: row.completed,
      completedAt: row.completed_at ?? undefined,
    })),
    timeLogs: (timeLogs.data ?? []).map((row) => ({
      id: row.id,
      minutes: row.minutes,
      note: row.note,
      timestamp: row.created_at,
      technicianName: row.technician_name,
    })),
    technicalNotes: (notes.data ?? []).map((row) => ({
      id: row.id,
      text: row.text,
      author: row.author,
      timestamp: row.created_at,
    })),
    usedMaterials: (materials.data ?? []).map((row) => ({
      id: row.id,
      materialId: row.material_id ?? '',
      materialName: row.material_name,
      quantity: Number(row.quantity),
      unit: row.unit,
      note: row.note ?? undefined,
      addedAt: row.added_at,
    })),
    events: (events.data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      description: row.description,
      timestamp: row.created_at,
      author: row.author,
    })),
    customerSignature: signature.data
      ? {
          signerName: signature.data.signer_name,
          signatureDataUrl: signature.data.signature_data_url,
          signedAt: signature.data.signed_at,
          comments: signature.data.comments ?? undefined,
        }
      : null,
  });
}

export async function persistUpdateOrder(input: {
  orderId: string;
  title: string;
  description: string;
  serviceType: ServiceType;
  priority: OrderPriority;
  scheduledDate: string;
  customer: Customer;
  technician?: { id: string; name: string } | null;
  author: string;
}): Promise<ServiceOrder> {
  const scheduled =
    /^\d{4}-\d{2}-\d{2}$/.test(input.scheduledDate)
      ? input.scheduledDate
      : new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from('service_orders')
    .update({
      title: input.title,
      description: input.description,
      service_type: input.serviceType,
      priority: input.priority,
      scheduled_date: scheduled,
      customer_id: input.customer.id,
      client_name: input.customer.name,
      client_phone: input.customer.phone,
      client_address: input.customer.address,
      client_neighborhood: input.customer.neighborhood,
      assigned_technician_id: input.technician?.id ?? null,
      assigned_technician_name: input.technician?.name ?? null,
    })
    .eq('id', input.orderId);
  throwIfError(error);

  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: input.orderId,
    type: 'note_added',
    description: 'Datos de la orden actualizados por administración.',
    author: input.author,
  });
  throwIfError(eventError);

  const full = await fetchOrderById(input.orderId);
  if (!full) throw new Error('No se pudo recargar la orden actualizada.');
  return full;
}

export async function persistDeleteOrder(orderId: string) {
  const { error } = await supabase.from('service_orders').delete().eq('id', orderId);
  throwIfError(error);
}

export async function persistAdminCancelOrder(input: { orderId: string; reason: string; author: string; actorProfileId?: string; workElapsedSeconds: number }) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('service_orders').update({
    status: 'cancelled', cancellation_reason: input.reason, cancelled_at: now,
    cancelled_by: input.actorProfileId ?? null, work_started_at: null,
    work_elapsed_seconds: input.workElapsedSeconds,
  }).eq('id', input.orderId);
  throwIfError(error);
  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: input.orderId, type: 'cancelled',
    description: `Cancelación administrativa. Motivo: ${input.reason}`, author: input.author,
  });
  throwIfError(eventError);
}

export async function persistAdminIncident(input: { orderId: string; reason: string; author: string; actorProfileId?: string; pauseSettlements: boolean }) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('service_orders').update({
    admin_incident_status: 'open', admin_incident_reason: input.reason,
    admin_incident_opened_at: now, admin_incident_opened_by: input.actorProfileId ?? null,
    admin_incident_resolved_at: null, admin_incident_resolved_by: null,
  }).eq('id', input.orderId);
  throwIfError(error);
  if (input.pauseSettlements) {
    const { error: settlementError } = await supabase.from('technician_settlements')
      .update({ status: 'in_review', dispute_reason: input.reason })
      .eq('order_id', input.orderId)
      .in('status', ['pending_release', 'released', 'scheduled']);
    throwIfError(settlementError);
  }
  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: input.orderId, type: 'note_added',
    description: `Incidencia abierta por administración${input.pauseSettlements ? ' y liquidación puesta en revisión' : ''}. Motivo: ${input.reason}`,
    author: input.author,
  });
  throwIfError(eventError);
}

export async function persistResolveAdminIncident(input: { orderId: string; author: string; actorProfileId?: string }) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('service_orders').update({
    admin_incident_status: 'resolved', admin_incident_resolved_at: now,
    admin_incident_resolved_by: input.actorProfileId ?? null,
  }).eq('id', input.orderId);
  throwIfError(error);
  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: input.orderId, type: 'note_added',
    description: 'Incidencia resuelta por administración. Las liquidaciones retenidas requieren revisión administrativa antes de liberarse.',
    author: input.author,
  });
  throwIfError(eventError);
}

export async function persistAdminExceptionalClose(input: { orderId: string; reason: string; author: string; actorProfileId?: string; workElapsedSeconds: number }) {
  const now = new Date().toISOString();
  const { error } = await supabase.from('service_orders').update({
    status: 'completed', completed_at: now, work_started_at: null,
    work_elapsed_seconds: input.workElapsedSeconds, admin_exception_reason: input.reason,
    admin_exception_closed_at: now, admin_exception_closed_by: input.actorProfileId ?? null,
  }).eq('id', input.orderId);
  throwIfError(error);
  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: input.orderId, type: 'completed',
    description: `Cierre excepcional realizado por administración. Motivo: ${input.reason}`, author: input.author,
  });
  throwIfError(eventError);
}

export async function persistUpdateOrderStatus(input: {
  orderId: string;
  status: OrderStatus;
  eventType: OrderEventType;
  eventDescription: string;
  author: string;
  completedAt?: string | null;
  workStartedAt?: string | null;
  workElapsedSeconds?: number;
}) {
  const { error } = await supabase
    .from('service_orders')
    .update({
      status: input.status,
      completed_at: input.completedAt ?? null,
      work_started_at: input.workStartedAt ?? null,
      work_elapsed_seconds: input.workElapsedSeconds ?? 0,
    })
    .eq('id', input.orderId);
  throwIfError(error);

  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: input.orderId,
    type: input.eventType,
    description: input.eventDescription,
    author: input.author,
  });
  throwIfError(eventError);
}

export async function persistAssignTechnician(input: {
  orderId: string;
  technicianId: string;
  technicianName: string;
  author: string;
}) {
  const { error } = await supabase
    .from('service_orders')
    .update({
      assigned_technician_id: input.technicianId,
      assigned_technician_name: input.technicianName,
      status: 'assigned',
    })
    .eq('id', input.orderId);
  throwIfError(error);

  const { error: eventError } = await supabase.from('order_events').insert({
    order_id: input.orderId,
    type: 'reassigned',
    description: `Orden reasignada al técnico ${input.technicianName}.`,
    author: input.author,
  });
  throwIfError(eventError);
}

export async function persistToggleChecklistItem(itemId: string, completed: boolean) {
  const { error } = await supabase
    .from('order_checklist_items')
    .update({
      completed,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', itemId);
  throwIfError(error);
}

export async function persistAddChecklistItem(orderId: string, label: string) {
  const { data, error } = await supabase
    .from('order_checklist_items')
    .insert({ order_id: orderId, label, completed: false })
    .select('*')
    .single();
  throwIfError(error);
  return data;
}

export async function persistAddTimeLog(input: {
  orderId: string;
  minutes: number;
  note: string;
  technicianName: string;
  author: string;
}) {
  const { data, error } = await supabase
    .from('order_time_logs')
    .insert({
      order_id: input.orderId,
      minutes: input.minutes,
      note: input.note,
      technician_name: input.technicianName,
    })
    .select('*')
    .single();
  throwIfError(error);

  await supabase.from('order_events').insert({
    order_id: input.orderId,
    type: 'time_logged',
    description: `Se registraron ${input.minutes} minutos de trabajo.`,
    author: input.author,
  });

  return data;
}

export async function persistAddNote(input: {
  orderId: string;
  text: string;
  author: string;
}) {
  const { data, error } = await supabase
    .from('order_notes')
    .insert({
      order_id: input.orderId,
      text: input.text,
      author: input.author,
    })
    .select('*')
    .single();
  throwIfError(error);

  await supabase.from('order_events').insert({
    order_id: input.orderId,
    type: 'note_added',
    description: 'Se agregó una nota técnica.',
    author: input.author,
  });

  return data;
}

export async function persistAddUsedMaterial(input: {
  orderId: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  note?: string;
  author: string;
}) {
  const { data, error } = await supabase
    .from('order_materials_used')
    .insert({
      order_id: input.orderId,
      material_id: input.materialId,
      material_name: input.materialName,
      quantity: input.quantity,
      unit: input.unit,
      note: input.note ?? null,
    })
    .select('*')
    .single();
  throwIfError(error);

  await supabase.from('order_events').insert({
    order_id: input.orderId,
    type: 'material_added',
    description: `Material usado: ${input.materialName} x${input.quantity}.`,
    author: input.author,
  });

  return data;
}

export async function persistSignature(input: {
  orderId: string;
  signerName: string;
  signatureDataUrl: string;
  comments?: string;
  author: string;
}) {
  // A conformity signature is an acceptance record, not editable work data.
  // Insert (rather than upsert) makes a second attempt fail instead of silently
  // replacing the customer's original approval.
  const { error } = await supabase.from('order_signatures').insert({
    order_id: input.orderId,
    signer_name: input.signerName,
    signature_data_url: input.signatureDataUrl,
    comments: input.comments ?? null,
    signed_at: new Date().toISOString(),
  });
  throwIfError(error);

  await supabase.from('order_events').insert({
    order_id: input.orderId,
    type: 'signed',
    description: `Firma de conformidad de ${input.signerName}.`,
    author: input.author,
  });
}

export async function reloadTechnicians() {
  const { data, error } = await supabase.from('technicians').select('*').order('name');
  throwIfError(error);
  return (data as DbTechnician[]).map(mapTechnician);
}

export type AccountInviteKind = 'technician' | 'customer';

export type AccountInvitePreview = {
  kind: AccountInviteKind;
  email: string;
  fullName: string;
  expiresAt: string;
  alreadyUsed: boolean;
};

export function buildAccountInviteUrl(token: string) {
  const origin = window.location.origin;
  const pathname = window.location.pathname.replace(/\/$/, '') || '';
  return `${origin}${pathname}#/auth?invite=${encodeURIComponent(token)}`;
}

export async function persistCreateAccountInvite(input: {
  kind: AccountInviteKind;
  targetId: string;
  email: string;
  fullName: string;
}): Promise<string> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Este registro no tiene email. Completalo antes de generar el enlace.');

  await supabase
    .from('account_invites')
    .update({ expires_at: new Date().toISOString() })
    .eq('kind', input.kind)
    .eq('target_id', input.targetId)
    .is('used_at', null);

  const { data, error } = await supabase
    .from('account_invites')
    .insert({
      kind: input.kind,
      target_id: input.targetId,
      email,
      full_name: input.fullName,
    })
    .select('token')
    .single();
  throwIfError(error);
  if (!data?.token) throw new Error('No se pudo generar el enlace de invitación.');
  return buildAccountInviteUrl(String(data.token));
}

export async function fetchAccountInvite(token: string): Promise<AccountInvitePreview | null> {
  const { data, error } = await supabase.rpc('get_account_invite', { p_token: token });
  throwIfError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return {
    kind: row.kind as AccountInviteKind,
    email: String(row.email),
    fullName: String(row.full_name),
    expiresAt: String(row.expires_at),
    alreadyUsed: Boolean(row.already_used),
  };
}

export async function redeemAccountInvite(token: string) {
  const { error } = await supabase.rpc('redeem_account_invite', { p_token: token });
  throwIfError(error);
}
