import { createClient } from '@supabase/supabase-js';
import type { Technician, UserRole } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[ServiCasa] Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisá .env.local'
  );
}

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder'
);

export type DbProfile = {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  avatar_text: string | null;
  avatar_url?: string | null;
  technician_id: string | null;
  customer_id: string | null;
};

export type DbTechnician = {
  id: string;
  name: string;
  specialty: string;
  phone: string;
  email: string;
  rating: number;
  avatar_bg: string;
  active_orders_count: number;
  completed_orders_count: number;
  zone: string;
  province: string;
  profile_id: string | null;
  work_phone?: string | null;
  bio?: string | null;
  education_level?: Technician['educationLevel'] | null;
  degree_title?: string | null;
  institution_name?: string | null;
  public_avatar_path?: string | null;
  validation_status?: Technician['validationStatus'] | null;
  validation_notes?: string | null;
  is_enabled?: boolean | null;
  can_receive_orders?: boolean | null;
  is_available?: boolean | null;
};

export type DbCustomer = {
  id: string;
  name: string;
  address: string;
  neighborhood: string;
  phone: string;
  email: string;
  notes: string | null;
  profile_id: string | null;
};

export type DbMaterial = {
  id: string;
  name: string;
  category: 'Fijaciones' | 'Electricidad' | 'Plomería' | 'Ferretería' | 'Insumos';
  stock: number;
  unit: string;
  cost_estimate: number;
};

export type DbServiceOrder = {
  id: string;
  title: string;
  description: string;
  service_type: string;
  priority: string;
  status: string;
  scheduled_date: string;
  created_at: string;
  completed_at: string | null;
  work_started_at: string | null;
  work_elapsed_seconds: number | null;
  customer_id: string;
  client_name: string;
  client_phone: string;
  client_address: string;
  client_neighborhood: string;
  assigned_technician_id: string | null;
  assigned_technician_name: string | null;
  work_mode?: 'diagnosis' | 'direct' | null;
  service_status?: string | null;
  quote_status?: string | null;
  payment_status?: string | null;
  visit_deposit_amount?: number | null;
  total_quoted_amount?: number | null;
  total_paid_amount?: number | null;
  extra_amount?: number | null;
  cancellation_reason?: string | null;
  cancelled_at?: string | null;
  admin_incident_status?: 'none' | 'open' | 'resolved' | null;
  admin_incident_reason?: string | null;
  admin_incident_opened_at?: string | null;
  admin_incident_resolved_at?: string | null;
  admin_exception_reason?: string | null;
  admin_exception_closed_at?: string | null;
};

export type DbOrderQuote = {
  id: string;
  order_id: string;
  version: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  notes: string | null;
  subtotal_labor: number;
  subtotal_materials: number;
  total_amount: number;
  visit_deposit_credit: number;
  remaining_amount: number;
  valid_until: string | null;
  sent_at: string | null;
};

export type DbSupportCase = {
  id: string;
  case_number: string;
  customer_id: string | null;
  order_id: string | null;
  technician_id: string | null;
  customer_name: string | null;
  technician_name: string | null;
  case_type: string;
  status: string;
  priority: string;
  subject: string;
  description: string | null;
  resolution_type: string | null;
  resolution_amount: number | null;
  resolution_notes: string | null;
  settlement_paused: boolean;
  settlement_id: string | null;
  opened_by: string | null;
  opened_at: string;
  resolved_by: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbSupportCaseMessage = {
  id: string;
  case_id: string;
  sender_type: 'admin' | 'client' | 'technician' | 'system';
  channel: 'in_app' | 'phone' | 'email' | 'whatsapp' | 'internal_note';
  message: string;
  is_internal: boolean;
  created_by: string | null;
  created_at: string;
};

export type DbSupportCaseHistory = {
  id: string;
  case_id: string;
  changed_by: string | null;
  change_type: string;
  previous_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
};
