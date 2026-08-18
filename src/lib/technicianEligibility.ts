import { supabase } from './supabase';

const labels: Record<string, string> = { profile_complete: 'Perfil profesional', education_verified: 'Formación técnica', matricula_validated: 'Matrícula profesional', monotributo_approved: 'Constancia de monotributo', identity_verified: 'Identidad', bank_account_valid: 'Cuenta de cobro' };

export async function canTechnicianReceiveOrders(technicianId: string) {
  const { data: technician, error } = await supabase.from('technicians').select('validation_status,can_receive_orders').eq('id', technicianId).maybeSingle();
  if (error || !technician) return { canReceive: false, missingRequirements: ['Técnico no encontrado'] };
  if (technician.validation_status !== 'approved' || !technician.can_receive_orders) return { canReceive: false, missingRequirements: ['Técnico no habilitado por administración'] };
  const { data } = await supabase.from('technician_requirements').select('requirement_type,status,is_required').eq('technician_id', technicianId).eq('is_required', true);
  const missing = (data ?? []).filter((item) => item.status !== 'approved' && item.status !== 'not_required').map((item) => labels[item.requirement_type] ?? item.requirement_type);
  return { canReceive: missing.length === 0, missingRequirements: missing };
}

export async function getEligibleTechnicians() {
  const { data } = await supabase.from('technicians').select('*').eq('validation_status', 'approved').eq('can_receive_orders', true).eq('is_available', true);
  const rows = data ?? [];
  const checks = await Promise.all(rows.map(async (technician) => ({ technician, result: await canTechnicianReceiveOrders(technician.id) })));
  return checks.filter(({ result }) => result.canReceive).map(({ technician }) => technician);
}
