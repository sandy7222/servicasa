import { createClient } from '@supabase/supabase-js';
import type { UserRole } from '../types';

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
  customer_id: string;
  client_name: string;
  client_phone: string;
  client_address: string;
  client_neighborhood: string;
  assigned_technician_id: string | null;
  assigned_technician_name: string | null;
};
