export type UserRole = 'admin' | 'technician' | 'customer';

export type ServiceType =
  | 'Plomería'
  | 'Electricidad'
  | 'Reparaciones del hogar'
  | 'Mantenimiento general'
  | 'Instalación de equipos'
  | string;

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  estimatedDurationMinutes?: number;
  features?: string[];
  active?: boolean;
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
  estimatedDurationMinutes?: number;
  features?: string[];
  active?: boolean;
};

export type OrderPriority = 'baja' | 'media' | 'alta' | 'urgente';

export type OrderStatus = 'assigned' | 'in_progress' | 'paused' | 'completed' | 'cancelled';

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
  scheduledDate: string;
  createdAt: string;
  completedAt?: string;
  /** Inicio de la sesión de trabajo actualmente en curso. */
  workStartedAt?: string;
  /** Segundos de trabajo acumulados en sesiones ya pausadas o finalizadas. */
  workElapsedSeconds?: number;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  clientNeighborhood: string;
  assignedTechnicianId: string | null;
  assignedTechnicianName: string | null;
  checklist: ChecklistItem[];
  timeLogs: TimeLog[];
  technicalNotes: TechnicalNote[];
  usedMaterials: UsedMaterial[];
  customerSignature: CustomerSignature | null;
  events: OrderEvent[];
}

export interface Technician {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  rating: number;
  avatarBg: string;
  activeOrdersCount: number;
  completedOrdersCount: number;
  zone: string;
  province: string;
  profileId?: string | null;
  customerId?: string | null;
}

export type TechnicianInput = {
  name: string;
  specialty: string;
  phone: string;
  email: string;
  zone: string;
  province: string;
  rating?: number;
  alsoAsCustomer?: boolean;
  customerAddress?: string;
  customerNeighborhood?: string;
  customerNotes?: string;
};

export interface Customer {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  phone: string;
  email: string;
  notes?: string;
  profileId?: string | null;
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
}

export type CurrentUserData = CurrentUser;
