export type UserRole = 'admin' | 'technician' | 'customer';

export type ServiceType =
  | 'Plomería'
  | 'Electricidad'
  | 'Reparaciones del hogar'
  | 'Mantenimiento general'
  | 'Instalación de equipos'
  | 'Cerrajería'
  | 'Refrigeración'
  | 'Soldadura'
  | string;

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  subcategoria?: string | null;
  categoryId?: string | null;
  subcategoryId?: string | null;
  estimatedDurationMinutes?: number;
  features?: string[];
  active?: boolean;
}

/** Real relational categories/subcategories (Supabase-backed) — see
 * plan-categorias-subcategorias.md. Not to be confused with the legacy
 * `ServiceCategory`/`serviceCategories` below, which is localStorage-only. */
export interface CatalogCategory {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  description?: string | null;
  displayOrder: number;
  active: boolean;
}

export interface CatalogSubcategory {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  displayOrder: number;
  active: boolean;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  icon?: string; // Nombre del ícono (lucide-react)
  color?: string; // Clase de color Tailwind
  active?: boolean;
}

export type ServiceCategoryInput = {
  name: string;
  description: string;
  icon?: string;
  color?: string;
  active?: boolean;
};

export type ServiceItemInput = {
  name: string;
  description: string;
  price: number;
  category: string;
  categoryId?: string | null;
  subcategoria?: string | null;
  subcategoryId?: string | null;
  estimatedDurationMinutes?: number;
  features?: string[];
  active?: boolean;
};

export type OrderPriority = 'baja' | 'media' | 'alta' | 'urgente';

export type OrderStatus = 'assigned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type WorkMode = 'diagnosis' | 'direct';
export type ServiceStatus = 'pending' | 'assigned' | 'en_route' | 'in_progress' | 'paused' | 'completed' | 'cancelled';
export type QuoteStatus = 'none' | 'draft' | 'sent' | 'accepted' | 'rejected';
export type PaymentStatus = 'pending' | 'deposit_paid' | 'balance_pending' | 'paid_in_full' | 'refunded';
export type AdminIncidentStatus = 'none' | 'open' | 'resolved';

export interface QuoteItem {
  id: string;
  categoryId?: string;
  serviceId?: string;
  itemType: 'labor' | 'material';
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export interface OrderQuote {
  id: string;
  version: number;
  status: Exclude<QuoteStatus, 'none'>;
  notes?: string;
  subtotalLabor: number;
  subtotalMaterials: number;
  totalAmount: number;
  visitDepositCredit: number;
  remainingAmount: number;
  validUntil?: string;
  sentAt?: string;
  items: QuoteItem[];
}

export type OrderEventType =
  | 'assigned'
  | 'started'
  | 'paused'
  | 'resumed'
  | 'material_added'
  | 'checklist_updated'
  | 'time_logged'
  | 'note_added'
  | 'signed'
  | 'completed'
  | 'cancelled'
  | 'reassigned';

export interface OrderEvent {
  id: string;
  type: OrderEventType;
  description: string;
  timestamp: string;
  author: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;
}

export interface TimeLog {
  id: string;
  minutes: number;
  note: string;
  timestamp: string;
  technicianName: string;
}

export interface TechnicalNote {
  id: string;
  text: string;
  author: string;
  timestamp: string;
}

export interface UsedMaterial {
  id: string;
  materialId: string;
  materialName: string;
  quantity: number;
  unit: string;
  note?: string;
  addedAt: string;
}

export interface CustomerSignature {
  signerName: string;
  signatureDataUrl: string;
  signedAt: string;
  comments?: string;
}

export interface ServiceOrder {
  id: string;
  title: string;
  description: string;
  serviceType: ServiceType;
  priority: OrderPriority;
  status: OrderStatus;
  workMode?: WorkMode;
  serviceStatus?: ServiceStatus;
  quoteStatus?: QuoteStatus;
  paymentStatus?: PaymentStatus;
  visitDepositAmount?: number;
  totalQuotedAmount?: number;
  totalPaidAmount?: number;
  extraAmount?: number;
  cancellationReason?: string;
  cancelledAt?: string;
  /** Motivo de la pausa actual del técnico (se limpia al reanudar). */
  pauseReason?: string;
  /** Respuesta del técnico a la asignación — condiciona si puede marcar salida. */
  technicianResponseStatus?: 'pending' | 'accepted' | 'rejected';
  technicianResponseDueAt?: string;
  adminIncidentStatus?: AdminIncidentStatus;
  adminIncidentReason?: string;
  adminIncidentOpenedAt?: string;
  adminIncidentResolvedAt?: string;
  adminExceptionReason?: string;
  adminExceptionClosedAt?: string;
  quotes?: OrderQuote[];
  scheduledDate: string;
  createdAt: string;
  completedAt?: string;
  archivedAt?: string;
  /** El cliente la "eliminó" de su propia lista — nunca se borra la fila,
   * solo deja de listarse en su portal. El admin la sigue viendo entera. */
  hiddenFromCustomerAt?: string;
  /** Inicio de la sesión de trabajo actualmente en curso. */
  workStartedAt?: string;
  /** Segundos de trabajo acumulados en sesiones ya pausadas o finalizadas. */
  workElapsedSeconds?: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientNeighborhood: string;
  clientProvince?: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  checklist: ChecklistItem[];
  timeLogs: TimeLog[];
  technicalNotes: TechnicalNote[];
  usedMaterials: UsedMaterial[];
  customerSignature: CustomerSignature | null;
  events: OrderEvent[];
}

/** Payload created from the customer portal before payment or technician assignment. */
export type CustomerServiceRequestInput = {
  title: string;
  description: string;
  serviceType: ServiceType;
  priority: OrderPriority;
  scheduledDate: string;
  appointmentWindow: string;
  address: string;
  neighborhood: string;
  province: string;
  workMode: WorkMode;
  /** Informative catalog price, only used for optimistic UI before the insert
   * returns. The DB trigger `service_orders_enforce_pricing` recalculates the
   * real amount server-side from `fixedPriceServiceId` + `quantity`. */
  requestedTotal?: number;
  /** Required when workMode === 'direct': which `services` catalog item
   * (filtered to the chosen rubro) and how many units, so the server can
   * recompute the real price. */
  fixedPriceServiceId?: string;
  quantity?: number;
};

/** Same as CustomerServiceRequestInput, plus the contact data a guest (no
 * account) has to provide since there's no customer record yet. Posted to
 * the public api/orders/guest-checkout.ts endpoint. */
export type GuestServiceRequestInput = CustomerServiceRequestInput & {
  fullName: string;
  email: string;
  phone: string;
};

export interface Technician {
  id: string;
  technicianNumber?: number;
  name: string;
  specialty: string;
  specialties: { id: string; name: string }[];
  phone: string;
  email: string;
  rating: number;
  avatarBg: string;
  activeOrdersCount: number;
  completedOrdersCount: number;
  zone: string;
  province: string;
  address?: string;
  profileId?: string | null;
  customerId?: string | null;
  workPhone?: string;
  bio?: string;
  educationLevel?: 'idoneo' | 'curso_certificado' | 'tecnico' | 'tecnico_superior' | 'ingeniero' | 'otro';
  degreeTitle?: string;
  institutionName?: string;
  publicAvatarPath?: string;
  validationStatus?: 'pending' | 'approved' | 'observed' | 'suspended';
  validationNotes?: string;
  isEnabled?: boolean;
  canReceiveOrders?: boolean;
  isAvailable?: boolean;
}

export type TechnicianInput = {
  name: string;
  specialtyIds: string[];
  phone: string;
  email: string;
  zone: string;
  province: string;
  address?: string;
  rating?: number;
  alsoAsCustomer?: boolean;
  customerAddress?: string;
  customerNeighborhood?: string;
  customerNotes?: string;
};

export interface Customer {
  id: string;
  customerNumber?: number;
  name: string;
  address: string;
  neighborhood: string;
  province?: string;
  phone: string;
  email: string;
  notes?: string;
  profileId?: string | null;
}

export type CustomerRegistrationInput = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  neighborhood: string;
};

export type TechnicianRegistrationInput = {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  specialtyIds: string[];
  message?: string;
};

export interface TechnicianApplication {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  specialty: string;
  message?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string | null;
}

export interface MaterialInventory {
  id: string;
  name: string;
  category: 'Fijaciones' | 'Electricidad' | 'Plomería' | 'Ferretería' | 'Insumos';
  stock: number;
  unit: string;
  costEstimate: number;
}

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  technicianId?: string;
  customerId?: string;
  avatarText: string;
  avatarUrl?: string;
}

export type CurrentUserData = CurrentUser;

// ===== Reclamos y Garantías =====

export type ClaimType = 'warranty' | 'complaint' | 'dispute' | 'no_show' | 'damage' | 'other';

export type ClaimStatus =
  | 'open'
  | 'in_progress'
  | 'waiting_client'
  | 'waiting_technician'
  | 'resolved'
  | 'closed'
  | 'escalated';

export type ClaimPriority = 'low' | 'medium' | 'high' | 'urgent';

export type ClaimResolutionType =
  | 'full_refund'
  | 'partial_refund'
  | 'redo_work'
  | 'send_another_technician'
  | 'credit_note'
  | 'no_action'
  | 'other';

export type ClaimSettlementAction = 'release' | 'cancel' | 'retain';

export interface ClaimMessage {
  id: string;
  senderType: 'admin' | 'client' | 'technician' | 'system';
  channel: 'in_app' | 'phone' | 'email' | 'whatsapp' | 'internal_note';
  message: string;
  isInternal: boolean;
  author?: string;
  createdAt: string;
}

export interface ClaimHistory {
  id: string;
  changeType: string;
  previousValue?: string;
  newValue?: string;
  notes?: string;
  author?: string;
  createdAt: string;
}

export interface ClaimCase {
  id: string;
  caseNumber: string;
  orderId?: string | null;
  customerId?: string | null;
  customerName?: string;
  technicianId?: string | null;
  technicianName?: string | null;
  type: ClaimType;
  status: ClaimStatus;
  priority: ClaimPriority;
  subject: string;
  description?: string;
  resolutionType?: ClaimResolutionType | null;
  resolutionAmount?: number | null;
  resolutionNotes?: string | null;
  settlementPaused: boolean;
  openedAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  messages: ClaimMessage[];
  history: ClaimHistory[];
}

export type ClaimInput = {
  orderId?: string | null;
  customerId?: string | null;
  technicianId?: string | null;
  customerName?: string;
  technicianName?: string;
  type: ClaimType;
  priority: ClaimPriority;
  subject: string;
  description?: string;
  pauseSettlement?: boolean;
};

// ===== Mensajería general (Fase 3, ADR 0001 — separado de Reclamos) =====

export type MessageSenderRole = 'admin' | 'technician' | 'customer' | 'system';

export interface ConversationParticipant {
  id: string;
  profileId: string;
  role: 'admin' | 'technician' | 'customer';
  displayName?: string;
}

export interface ConversationMessage {
  id: string;
  senderId?: string;
  senderRole: MessageSenderRole;
  body: string;
  isInternal: boolean;
  createdAt: string;
}

export interface Conversation {
  id: string;
  orderId?: string | null;
  caseId?: string | null;
  subject?: string | null;
  orderTitle?: string | null;
  createdAt: string;
  lastMessageAt: string;
  participants: ConversationParticipant[];
  messages: ConversationMessage[];
  unreadCount: number;
}

export type NotificationType =
  | 'order_assigned'
  | 'quote_sent' | 'quote_accepted' | 'quote_rejected'
  | 'payment_approved' | 'payment_rejected' | 'payment_pending'
  | 'claim_opened' | 'claim_message' | 'claim_resolved'
  | 'message_new'
  | 'settlement_scheduled' | 'settlement_released' | 'settlement_paid'
  | 'technician_validation';

export type NotificationEntityType = 'order' | 'quote' | 'payment' | 'claim' | 'conversation' | 'settlement' | 'technician_validation';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  entityType?: NotificationEntityType | null;
  entityId?: string | null;
  priority: 'low' | 'normal' | 'high';
  readAt?: string | null;
  createdAt: string;
}
