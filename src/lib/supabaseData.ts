import type {
  ChecklistItem,
  Customer,
  MaterialInventory,
  OrderEvent,
  OrderPriority,
  OrderStatus,
  ServiceItem,
  ServiceOrder,
  ServiceType,
  CatalogCategory,
  CatalogSubcategory,
  TechnicalNote,
  TechnicianApplication,
  Technician,
  TimeLog,
  UsedMaterial,
  CurrentUserData,
  UserRole,
} from '../types';
import type {
  DbCategory,
  DbCustomer,
  DbMaterial,
  DbProfile,
  DbService,
  DbServiceOrder,
  DbSubcategory,
  DbOrderQuote,
  DbTechnician,
  DbTechnicianApplication,
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
    avatarUrl: profile.avatar_url ?? undefined,
  };
}

export function mapTechnician(row: DbTechnician, specialties: { id: string; name: string }[] = []): Technician {
  return {
    id: row.id,
    technicianNumber: row.technician_number ?? undefined,
    name: row.name,
    specialty: specialties.length ? specialties.map((s) => s.name).join(', ') : row.specialty,
    specialties,
    phone: row.phone,
    email: row.email,
    rating: Number(row.rating),
    avatarBg: row.avatar_bg,
    activeOrdersCount: row.active_orders_count,
    completedOrdersCount: row.completed_orders_count,
    zone: row.zone ?? '',
    province: row.province ?? '',
    address: row.address ?? '',
    profileId: row.profile_id ?? null,
    workPhone: row.work_phone ?? undefined,
    bio: row.bio ?? undefined,
    educationLevel: row.education_level ?? undefined,
    degreeTitle: row.degree_title ?? undefined,
    institutionName: row.institution_name ?? undefined,
    publicAvatarPath: row.public_avatar_path ?? undefined,
    validationStatus: row.validation_status ?? undefined,
    validationNotes: row.validation_notes ?? undefined,
    isEnabled: row.is_enabled ?? undefined,
    canReceiveOrders: row.can_receive_orders ?? false,
    isAvailable: row.is_available ?? undefined,
  };
}

export function mapCustomer(row: DbCustomer): Customer {
  return {
    id: row.id,
    customerNumber: row.customer_number ?? undefined,
    name: row.name,
    address: row.address,
    neighborhood: row.neighborhood,
    province: row.province ?? undefined,
    phone: row.phone,
    email: row.email,
    notes: row.notes ?? undefined,
    profileId: row.profile_id ?? null,
  };
}

export function mapTechnicianApplication(row: DbTechnicianApplication): TechnicianApplication {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    specialty: row.specialty,
    message: row.message ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at ?? undefined,
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

export function mapService(row: DbService): ServiceItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    subcategoria: row.subcategoria ?? null,
    categoryId: row.category_id ?? null,
    subcategoryId: row.subcategory_id ?? null,
    estimatedDurationMinutes: row.estimated_duration_minutes,
    features: row.features ?? [],
    active: row.active,
  };
}

export function mapCatalogCategory(row: DbCategory): CatalogCategory {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon,
    description: row.description,
    displayOrder: row.display_order,
    active: row.is_active,
  };
}

export function mapCatalogSubcategory(row: DbSubcategory): CatalogSubcategory {
  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    slug: row.slug,
    displayOrder: row.display_order,
    active: row.is_active,
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
    quotes?: ServiceOrder['quotes'];
  }
): ServiceOrder {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    serviceType: row.service_type as ServiceType,
    priority: row.priority as OrderPriority,
    status: row.status as OrderStatus,
    workMode: row.work_mode ?? undefined,
    serviceStatus: row.service_status as ServiceOrder['serviceStatus'],
    quoteStatus: row.quote_status as ServiceOrder['quoteStatus'],
    paymentStatus: row.payment_status as ServiceOrder['paymentStatus'],
    visitDepositAmount: row.visit_deposit_amount == null ? undefined : Number(row.visit_deposit_amount),
    totalQuotedAmount: row.total_quoted_amount == null ? undefined : Number(row.total_quoted_amount),
    totalPaidAmount: row.total_paid_amount == null ? undefined : Number(row.total_paid_amount),
    extraAmount: row.extra_amount == null ? undefined : Number(row.extra_amount),
    cancellationReason: row.cancellation_reason ?? undefined,
    cancelledAt: row.cancelled_at ?? undefined,
    pauseReason: row.pause_reason ?? undefined,
    technicianResponseStatus: row.technician_response_status ?? undefined,
    technicianResponseDueAt: row.technician_response_due_at ?? undefined,
    adminIncidentStatus: row.admin_incident_status ?? 'none',
    adminIncidentReason: row.admin_incident_reason ?? undefined,
    adminIncidentOpenedAt: row.admin_incident_opened_at ?? undefined,
    adminIncidentResolvedAt: row.admin_incident_resolved_at ?? undefined,
    adminExceptionReason: row.admin_exception_reason ?? undefined,
    adminExceptionClosedAt: row.admin_exception_closed_at ?? undefined,
    scheduledDate: row.scheduled_date,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    hiddenFromCustomerAt: row.hidden_from_customer_at ?? undefined,
    workStartedAt: row.work_started_at ?? undefined,
    workElapsedSeconds: Number(row.work_elapsed_seconds ?? 0),
    clientId: row.customer_id,
    clientName: row.client_name,
    clientPhone: row.client_phone,
    clientAddress: row.client_address,
    clientNeighborhood: row.client_neighborhood,
    clientCity: row.client_city ?? undefined,
    clientProvince: row.client_province ?? undefined,
    assignedTechnicianId: row.assigned_technician_id,
    assignedTechnicianName: row.assigned_technician_name,
    checklist: extras?.checklist ?? [],
    timeLogs: extras?.timeLogs ?? [],
    technicalNotes: extras?.technicalNotes ?? [],
    usedMaterials: extras?.usedMaterials ?? [],
    customerSignature: extras?.customerSignature ?? null,
    events: extras?.events ?? [],
    quotes: extras?.quotes ?? [],
  };
}

export async function fetchProfile(userId: string): Promise<DbProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_text, avatar_url, technician_id, customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as DbProfile | null;
}

/**
 * Public catalog read — works for anonymous visitors too (services has an
 * `anon` SELECT policy, unlike every other table in this project). Used so
 * the Landing / services-category pages show the real Supabase catalog
 * instead of the local mockData.ts fallback even before anyone logs in.
 */
export async function fetchPublicServices(): Promise<ServiceItem[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as DbService[]).map(mapService);
}

/** Same anon-safe pattern as fetchPublicServices, for the new relational
 * categories/subcategories (see plan-categorias-subcategorias.md Fase 3). */
export async function fetchPublicCatalogCategories(): Promise<CatalogCategory[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  if (error) throw error;
  return (data as DbCategory[]).map(mapCatalogCategory);
}

export async function fetchPublicCatalogSubcategories(): Promise<CatalogSubcategory[]> {
  const { data, error } = await supabase
    .from('subcategories')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  if (error) throw error;
  return (data as DbSubcategory[]).map(mapCatalogSubcategory);
}

const VISIT_DEPOSIT_FALLBACK = 30000;

/** Single source of truth for the diagnosis visit deposit amount (system_settings). */
export async function fetchVisitDepositAmount(): Promise<number> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'visit_deposit_amount')
    .maybeSingle();
  if (error || !data) return VISIT_DEPOSIT_FALLBACK;
  const value = Number(data.value);
  return Number.isFinite(value) && value >= 0 ? value : VISIT_DEPOSIT_FALLBACK;
}

const VISIT_SETTLEMENT_COMMISSION_FALLBACK = 0.15;

/** Comisión propia de la liquidación de visita — separada de
 * platform_commission_rate (17%, solo para completed_work). Ver
 * create_visit_settlement_on_started() y el ADR en docs/adr-liquidacion-visita.md. */
export async function fetchVisitSettlementCommissionRate(): Promise<number> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'visit_settlement_commission_rate')
    .maybeSingle();
  if (error || !data) return VISIT_SETTLEMENT_COMMISSION_FALLBACK;
  const value = Number(data.value);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : VISIT_SETTLEMENT_COMMISSION_FALLBACK;
}

/** Admin-only: pending/reviewed "quiero ser técnico" applications. */
export async function fetchTechnicianApplications(): Promise<TechnicianApplication[]> {
  const { data, error } = await supabase
    .from('technician_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as DbTechnicianApplication[]).map(mapTechnicianApplication);
}

// Columnas de `technicians` seguras para cualquier usuario autenticado que
// pueda ver la fila (RLS ya restringe eso a admin / el propio técnico /
// cliente con una orden asignada a ese técnico). Quedan afuera a propósito
// validation_notes (nota interna del admin sobre el técnico) y work_phone
// (dato de contacto interno) — ninguna pantalla que lee del catálogo
// compartido los necesita; ProfessionalProfile.tsx y TechnicianReviewCard.tsx
// ya los piden aparte, con su propia consulta puntual, cuando corresponde.
// is_available NO se incluye porque esa columna no existe en la tabla real
// (verificado contra el esquema en vivo) -- nombrarla explícitamente hace
// que PostgREST tire "column does not exist" en vez de simplemente omitirla
// como hacía select('*').
export const TECHNICIAN_COLUMNS_SHARED =
  'id,technician_number,name,specialty,phone,email,rating,avatar_bg,active_orders_count,completed_orders_count,zone,province,profile_id,bio,education_level,degree_title,institution_name,public_avatar_path,validation_status,is_enabled,can_receive_orders';
// El admin sí necesita work_phone y address del catálogo compartido:
// AdminHubView los precarga al abrir el modal de edición del técnico.
// validation_notes sigue afuera — el admin la re-consulta puntualmente en
// TechnicianReviewCard.
export const TECHNICIAN_COLUMNS_ADMIN = `${TECHNICIAN_COLUMNS_SHARED},work_phone,address`;

export async function fetchCatalog(isAdmin: boolean) {
  const technicianColumns = isAdmin ? TECHNICIAN_COLUMNS_ADMIN : TECHNICIAN_COLUMNS_SHARED;
  const [techRes, techSpecialtiesRes, custRes, matRes, orderRes, svcRes, catRes, subcatRes] = await Promise.all([
    supabase.from('technicians').select(technicianColumns).order('name'),
    supabase.from('technician_specialties').select('technician_id, categories(id, name)'),
    supabase.from('customers').select('*').order('name'),
    supabase.from('materials').select('*').order('name'),
    supabase.from('service_orders').select('*').order('created_at', { ascending: false }),
    supabase.from('services').select('*').order('created_at', { ascending: false }),
    supabase.from('categories').select('*').order('display_order'),
    supabase.from('subcategories').select('*').order('display_order'),
  ]);

  if (techRes.error) throw techRes.error;
  if (techSpecialtiesRes.error) throw techSpecialtiesRes.error;
  if (custRes.error) throw custRes.error;
  if (matRes.error) throw matRes.error;
  if (orderRes.error) throw orderRes.error;
  if (svcRes.error) throw svcRes.error;
  if (catRes.error) throw catRes.error;
  if (subcatRes.error) throw subcatRes.error;

  const specialtiesByTechnician = new Map<string, { id: string; name: string }[]>();
  for (const row of (techSpecialtiesRes.data ?? []) as unknown as { technician_id: string; categories: { id: string; name: string } | null }[]) {
    if (!row.categories) continue;
    const list = specialtiesByTechnician.get(row.technician_id) ?? [];
    list.push({ id: row.categories.id, name: row.categories.name });
    specialtiesByTechnician.set(row.technician_id, list);
  }

  const orderRows = (orderRes.data ?? []) as DbServiceOrder[];
  const orderIds = orderRows.map((o) => o.id);

  const emptyKids = {
    checklist: [] as Array<Record<string, unknown>>,
    timeLogs: [] as Array<Record<string, unknown>>,
    notes: [] as Array<Record<string, unknown>>,
    materials: [] as Array<Record<string, unknown>>,
    events: [] as Array<Record<string, unknown>>,
    signatures: [] as Array<Record<string, unknown>>,
    quotes: [] as DbOrderQuote[],
    quoteItems: [] as Array<Record<string, unknown>>,
  };

  let kids = emptyKids;
  if (orderIds.length > 0) {
    const [checklist, timeLogs, notes, materials, events, signatures, quotes] = await Promise.all([
      supabase.from('order_checklist_items').select('*').in('order_id', orderIds).order('sort_order'),
      supabase.from('order_time_logs').select('*').in('order_id', orderIds).order('created_at', { ascending: false }),
      supabase.from('order_notes').select('*').in('order_id', orderIds).order('created_at', { ascending: false }),
      supabase.from('order_materials_used').select('*').in('order_id', orderIds).order('added_at', { ascending: false }),
      supabase.from('order_events').select('*').in('order_id', orderIds).order('created_at', { ascending: false }),
      supabase.from('order_signatures').select('*').in('order_id', orderIds),
      supabase.from('order_quotes').select('*').in('order_id', orderIds).order('version', { ascending: false }),
    ]);
    if (checklist.error) throw checklist.error;
    if (timeLogs.error) throw timeLogs.error;
    if (notes.error) throw notes.error;
    if (materials.error) throw materials.error;
    if (events.error) throw events.error;
    if (signatures.error) throw signatures.error;
    if (quotes.error) throw quotes.error;

    const quoteRows = (quotes.data ?? []) as DbOrderQuote[];
    const quoteIds = quoteRows.map((quote) => quote.id);
    const { data: quoteItems, error: quoteItemsError } = quoteIds.length
      ? await supabase.from('order_quote_items').select('*').in('quote_id', quoteIds).order('sort_order')
      : { data: [], error: null };
    if (quoteItemsError) throw quoteItemsError;

    kids = {
      checklist: (checklist.data ?? []) as Array<Record<string, unknown>>,
      timeLogs: (timeLogs.data ?? []) as Array<Record<string, unknown>>,
      notes: (notes.data ?? []) as Array<Record<string, unknown>>,
      materials: (materials.data ?? []) as Array<Record<string, unknown>>,
      events: (events.data ?? []) as Array<Record<string, unknown>>,
      signatures: (signatures.data ?? []) as Array<Record<string, unknown>>,
      quotes: quoteRows,
      quoteItems: (quoteItems ?? []) as Array<Record<string, unknown>>,
    };
  }

  const orders = orderRows.map((row) => {
    const checklistRows = kids.checklist.filter((r) => r.order_id === row.id);
    const timeRows = kids.timeLogs.filter((r) => r.order_id === row.id);
    const noteRows = kids.notes.filter((r) => r.order_id === row.id);
    const matRows = kids.materials.filter((r) => r.order_id === row.id);
    const eventRows = kids.events.filter((r) => r.order_id === row.id);
    const sig = kids.signatures.find((s) => s.order_id === row.id);
    const quoteRows = kids.quotes.filter((quote) => quote.order_id === row.id);

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
      quotes: quoteRows.map((quote) => ({
        id: quote.id,
        version: quote.version,
        status: quote.status,
        notes: quote.notes ?? undefined,
        subtotalLabor: Number(quote.subtotal_labor),
        subtotalMaterials: Number(quote.subtotal_materials),
        totalAmount: Number(quote.total_amount),
        visitDepositCredit: Number(quote.visit_deposit_credit),
        remainingAmount: Number(quote.remaining_amount),
        validUntil: quote.valid_until ?? undefined,
        sentAt: quote.sent_at ?? undefined,
        items: kids.quoteItems.filter((item) => item.quote_id === quote.id).map((item) => ({
          id: String(item.id),
          categoryId: (item.category_id as string | null) ?? undefined,
          serviceId: (item.service_id as string | null) ?? undefined,
          itemType: item.item_type as 'labor' | 'material',
          description: String(item.description),
          quantity: Number(item.quantity),
          unit: String(item.unit),
          unitPrice: Number(item.unit_price),
          subtotal: Number(item.subtotal),
          notes: (item.notes as string | null) ?? undefined,
        })),
      })),
    });
  });

  const technicians = (techRes.data as unknown as DbTechnician[]).map((row) =>
    mapTechnician(row, specialtiesByTechnician.get(row.id) ?? [])
  );
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
    services: (svcRes.data as DbService[]).map(mapService),
    catalogCategories: (catRes.data as DbCategory[]).map(mapCatalogCategory),
    catalogSubcategories: (subcatRes.data as DbSubcategory[]).map(mapCatalogSubcategory),
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

// redirectTo apunta a la raíz del sitio (sin hash): Supabase le agrega sus
// propios parámetros de recuperación como fragmento de la URL, y AppContext
// los detecta vía onAuthStateChange (evento PASSWORD_RECOVERY) antes de que
// el router por hash de la app llegue a interpretarlos.
export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
}

export async function updatePasswordForRecoverySession(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export const DEMO_CREDENTIALS: { role: UserRole; label: string; email: string; password: string }[] = [
  { role: 'admin', label: 'Admin', email: 'admin@tecniurbano.com.ar', password: 'TecnilFV2ly3Z!21' },
  { role: 'technician', label: 'Carlos (técnico)', email: 'carlos.mendez@tecniurbano.com.ar', password: 'TecnilFV2ly3Z!21' },
  { role: 'technician', label: 'María (técnica)', email: 'maria.rodriguez@tecniurbano.com.ar', password: 'TecnilFV2ly3Z!21' },
  { role: 'customer', label: 'Julián (cliente)', email: 'julian.albarracin@gmail.com', password: 'TecnilFV2ly3Z!21' },
];
