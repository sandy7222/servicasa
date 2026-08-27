import { supabase } from './supabase';

export type GoalType = 'monthly_earnings' | 'monthly_jobs' | 'weekly_jobs';

export type TechnicianGoal = {
  id: string;
  technicianId: string;
  goalType: GoalType;
  targetAmount: number | null;
  targetCount: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GoalProgress = {
  goal: TechnicianGoal;
  current: number;
  target: number;
  percent: number;
  remaining: number;
  met: boolean;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapGoal(row: {
  id: string; technician_id: string; goal_type: string; target_amount: number | null;
  target_count: number | null; is_active: boolean; created_at: string; updated_at: string;
}): TechnicianGoal {
  return {
    id: row.id,
    technicianId: row.technician_id,
    goalType: row.goal_type as GoalType,
    targetAmount: row.target_amount,
    targetCount: row.target_count,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Todas las metas del técnico (activas e históricas), más nuevas primero. */
export async function fetchGoals(technicianId: string): Promise<TechnicianGoal[]> {
  const { data, error } = await supabase
    .from('technician_goals')
    .select('*')
    .eq('technician_id', technicianId)
    .order('created_at', { ascending: false });
  throwIfError(error);
  return (data ?? []).map(mapGoal);
}

/** Crea o reemplaza la meta activa de un tipo — atómico vía RPC (el
 * technician_id se resuelve server-side, nunca se confía en el cliente). */
export async function setGoal(goalType: GoalType, targetAmount: number | null, targetCount: number | null): Promise<TechnicianGoal> {
  const { data, error } = await supabase.rpc('set_technician_goal', {
    p_goal_type: goalType,
    p_target_amount: targetAmount,
    p_target_count: targetCount,
  });
  throwIfError(error);
  return mapGoal(data);
}

/** Desactivar es una edición normal de la propia fila — RLS ya restringe a
 * "mis metas", y desactivar no rompe la restricción de una activa por tipo. */
export async function deactivateGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from('technician_goals').update({ is_active: false }).eq('id', goalId);
  throwIfError(error);
}

function currentPeriod(goalType: GoalType): { start: Date; end: Date; label: string } {
  const now = new Date();
  if (goalType === 'weekly_jobs') {
    const day = now.getDay() === 0 ? 7 : now.getDay(); // lunes=1..domingo=7
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(now.getDate() - (day - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end, label: 'esta semana' };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end, label: 'este mes' };
}

/** Avance real: nunca desde un valor guardado a mano (la tabla no tiene
 * columna de progreso) — se recalcula desde liquidaciones reales
 * (technician_settlements) u órdenes completadas (service_orders) dentro
 * del período vigente, que sale del propio goal_type. */
export async function computeGoalProgress(goal: TechnicianGoal): Promise<GoalProgress> {
  const { start, end, label } = currentPeriod(goal.goalType);
  let current = 0;

  if (goal.goalType === 'monthly_earnings') {
    const { data, error } = await supabase
      .from('technician_settlements')
      .select('net_amount, created_at')
      .eq('technician_id', goal.technicianId)
      .neq('status', 'cancelled')
      .gte('created_at', start.toISOString())
      .lt('created_at', end.toISOString());
    throwIfError(error);
    current = (data ?? []).reduce((sum, row) => sum + Number(row.net_amount), 0);
  } else {
    const { count, error } = await supabase
      .from('service_orders')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_technician_id', goal.technicianId)
      .eq('status', 'completed')
      .gte('completed_at', start.toISOString())
      .lt('completed_at', end.toISOString());
    throwIfError(error);
    current = count ?? 0;
  }

  const target = goal.goalType === 'monthly_earnings' ? Number(goal.targetAmount ?? 0) : Number(goal.targetCount ?? 0);
  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  return {
    goal,
    current,
    target,
    percent,
    remaining: Math.max(0, target - current),
    met: target > 0 && current >= target,
    periodLabel: label,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}
