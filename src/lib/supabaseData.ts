import type {
  ChecklistItem,
  Customer,
  MaterialInventory,
  OrderEvent,
  OrderPriority,
  OrderStatus,
  ServiceOrder,
  ServiceType,
  TechnicalNote,
  Technician,
  TimeLog,
  UsedMaterial,
  CurrentUserData,
  UserRole,
} from '../types';
import type {
  DbCustomer,
  DbMaterial,
  DbProfile,
  DbServiceOrder,
  DbTechnician,
} from './supabase';
import { supabase } from './supabase';

export function profileToCurrentUser(profile: DbProfile): CurrentUserData {
  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    role: profile.role,
    technicianId: profile.technician_id ?? undefined,
    customerId: profile.customer_id ?? undefined,
    avatarText: profile.avatar_text || profile.full_name.slice(0, 2).toUpperCase(),
  };
}

export function mapTechnician(row: DbTechnician): Technician {
  return {
    id: row.id,
    name: row.name,
    specialty: row.specialty,
    phone: row.phone,
    email: row.email,
    rating: Number(row.rating),
    avatarBg: row.avatar_bg,
    activeOrdersCount: row.active_orders_count,
    completedOrdersCount: row.completed_orders_count,
    zone: row.zone ?? '',
    province: row.province ?? '',
    profileId: row.profile_id ?? null,
  };
}

export function mapCustomer(row: DbCustomer): Customer {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    neighborhood: row.neighborhood,
    phone: row.phone,
    email: row.email,
    notes: row.notes ?? undefined,
    profileId: row.profile_id ?? null,
  };
}

export function mapMaterial(row: DbMaterial): MaterialInventory {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    stock: row.stock,
    unit: row.unit,
    costEstimate: Number(row.cost_estimate),
  };
}

export function mapOrder(
  row: DbServiceOrder,
  extras?: {
    checklist?: ChecklistItem[];
    timeLogs?: TimeLog[];
    technicalNotes?: TechnicalNote[];
    usedMaterials?: UsedMaterial[];
    customerSignature?: ServiceOrder['customerSignature'];
    events?: OrderEvent[];
  }
): ServiceOrder {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    serviceType: row.service_type as ServiceType,
    priority: row.priority as OrderPriority,
    status: row.status as OrderStatus,
    scheduledDate: row.scheduled_date,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    clientId: row.customer_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    clientNeighborhood: row.client_neighborhood,
    assignedTechnicianId: row.assigned_technician_id,
    assignedTechnicianName: row.assigned_technician_name,
    checklist: extras?.checklist ?? [],
    timeLogs: extras?.timeLogs ?? [],
    technicalNotes: extras?.technicalNotes ?? [],
    usedMaterials: extras?.usedMaterials ?? [],
    customerSignature: extras?.customerSignature ?? null,
    events: extras?.events ?? [],
  };
}

export async function fetchProfile(userId: string): Promise<DbProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_text, technician_id, customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as DbProfile | null;
}

export async function fetchCatalog() {
  const [techRes, custRes, matRes, orderRes] = await Promise.all([
    supabase.from('technicians').select('*').order('name'),
    supabase.from('customers').select('*').order('name'),
    supabase.from('materials').select('*').order('name'),
    supabase.from('service_orders').select('*').order('created_at', { ascending: false }),
  ]);

  if (techRes.error) throw techRes.error;
  if (custRes.error) throw custRes.error;
  if (matRes.error) throw matRes.error;
  if (orderRes.error) throw orderRes.error;

  const orderRows = (orderRes.data ?? []) as DbServiceOrder[];
  const orderIds = orderRows.map((o) => o.id);

  const emptyKids = {
    checklist: [] as Array<Record<string, unknown>>,
    timeLogs: [] as Array<Record<string, unknown>>,
    notes: [] as Array<Record<string, unknown>>,
    materials: [] as Array<Record<string, unknown>>,
    events: [] as Array<Record<string, unknown>>,
    signatures: [] as Array<Record<string, unknown>>,
  };

  let kids = emptyKids;
  if (orderIds.length > 0) {
    const [checklist, timeLogs, notes, materials, events, signatures] = await Promise.all([
      supabase.from('order_checklist_items').select('*').in('order_id', orderIds).order('sort_order'),
      supabase.from('order_time_logs').select('*').in('order_id', orderIds).order('created_at', { ascending: false }),
      supabase.from('order_notes').select('*').in('order_id', orderIds).order('created_at', { ascending: false }),
      supabase.from('order_materials_used').select('*').in('order_id', orderIds).order('added_at', { ascending: false }),
      supabase.from('order_events').select('*').in('order_id', orderIds).order('created_at', { ascending: false }),
      supabase.from('order_signatures').select('*').in('order_id', orderIds),
    ]);
    if (checklist.error) throw checklist.error;
    if (timeLogs.error) throw timeLogs.error;
    if (notes.error) throw notes.error;
    if (materials.error) throw materials.error;
    if (events.error) throw events.error;
    if (signatures.error) throw signatures.error;

    kids = {
      checklist: (checklist.data ?? []) as Array<Record<string, unknown>>,
      timeLogs: (timeLogs.data ?? []) as Array<Record<string, unknown>>,
      notes: (notes.data ?? []) as Array<Record<string, unknown>>,
      materials: (materials.data ?? []) as Array<Record<string, unknown>>,
      events: (events.data ?? []) as Array<Record<string, unknown>>,
      signatures: (signatures.data ?? []) as Array<Record<string, unknown>>,
    };
  }

  const orders = orderRows.map((row) => {
    const checklistRows = kids.checklist.filter((r) => r.order_id === row.id);
    const timeRows = kids.timeLogs.filter((r) => r.order_id === row.id);
    const noteRows = kids.notes.filter((r) => r.order_id === row.id);
    const matRows = kids.materials.filter((r) => r.order_id === row.id);
    const eventRows = kids.events.filter((r) => r.order_id === row.id);
    const sig = kids.signatures.find((s) => s.order_id === row.id);

    return mapOrder(row, {
      checklist: checklistRows.map((r) => ({
        id: String(r.id),
        label: String(r.label),
        completed: Boolean(r.completed),
        completedAt: (r.completed_at as string | null) ?? undefined,
      })),
      timeLogs: timeRows.map((r) => ({
        id: String(r.id),
        minutes: Number(r.minutes),
        note: String(r.note ?? ''),
        timestamp: String(r.created_at),
        technicianName: String(r.technician_name ?? ''),
      })),
      technicalNotes: noteRows.map((r) => ({
        id: String(r.id),
        text: String(r.text),
        author: String(r.author ?? ''),
        timestamp: String(r.created_at),
      })),
      usedMaterials: matRows.map((r) => ({
        id: String(r.id),
        materialId: String(r.material_id ?? ''),
        materialName: String(r.material_name),
        quantity: Number(r.quantity),
        unit: String(r.unit ?? 'u'),
        note: (r.note as string | null) ?? undefined,
        addedAt: String(r.added_at),
      })),
      events: eventRows.map((r) => ({
        id: String(r.id),
        type: r.type as OrderEvent['type'],
        description: String(r.description),
        timestamp: String(r.created_at),
        author: String(r.author ?? ''),
      })),
      customerSignature: sig
        ? {
            signerName: String(sig.signer_name),
            signatureDataUrl: String(sig.signature_data_url),
            signedAt: String(sig.signed_at),
            comments: (sig.comments as string | null) ?? undefined,
          }
        : null,
    });
  });

  const technicians = (techRes.data as DbTechnician[]).map(mapTechnician);
  const customers = (custRes.data as DbCustomer[]).map(mapCustomer);

  const { data: profileLinks } = await supabase
    .from('profiles')
    .select('id, technician_id, customer_id');

  const techCustomerByProfile = new Map<string, string>();
  (profileLinks ?? []).forEach((p) => {
    if (p.technician_id && p.customer_id) {
      techCustomerByProfile.set(String(p.technician_id), String(p.customer_id));
    }
  });

  const customersByEmail = new Map(
    customers.filter((c) => c.email).map((c) => [c.email.toLowerCase(), c.id])
  );

  return {
    technicians: technicians.map((t) => ({
      ...t,
      customerId:
        techCustomerByProfile.get(t.id) ??
        (t.email ? customersByEmail.get(t.email.toLowerCase()) ?? null : null),
    })),
    customers,
    materials: (matRes.data as DbMaterial[]).map(mapMaterial),
    orders,
  };
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUpWithPassword(input: {
  email: string;
  password: string;
  fullName: string;
}) {
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.fullName },
    },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export const DEMO_CREDENTIALS: { role: UserRole; label: string; email: string; password: string }[] = [
  { role: 'admin', label: 'Admin', email: 'admin@servicasa.com.ar', password: 'ServiCasa2026!' },
  { role: 'technician', label: 'Carlos (técnico)', email: 'carlos.mendez@servicasa.com.ar', password: 'ServiCasa2026!' },
  { role: 'technician', label: 'María (técnica)', email: 'maria.rodriguez@servicasa.com.ar', password: 'ServiCasa2026!' },
  { role: 'customer', label: 'Julián (cliente)', email: 'julian.albarracin@gmail.com', password: 'ServiCasa2026!' },
];
