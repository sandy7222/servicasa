-- Fase 6: Metas y elegibilidad técnica.
--
-- 1) Elegibilidad consolidada (ver migración aplicada por separado
--    tighten_technician_assignment_eligibility): el trigger
--    require_eligible_technician_assignment() ahora también exige que no
--    haya requisitos obligatorios pendientes, igual que
--    src/lib/technicianEligibility.ts (antes el trigger era más laxo que
--    lo que el panel de admin daba a entender). El chequeo inline
--    duplicado en AdminHubView.tsx se reemplazó por una llamada a esa
--    misma función — ya no quedan 3 implementaciones distintas.
--
-- 2) Metas del técnico: una activa por tipo y período. `goal_type` ya
--    encodifica el período (weekly_jobs vs monthly_*), así que no hace
--    falta guardar fechas de período — se calcula "el período actual"
--    dinámicamente al pedir el avance. El avance sale de datos reales
--    (technician_settlements para plata, service_orders para trabajos
--    completados), nunca de un valor guardado a mano — la tabla no tiene
--    ninguna columna de progreso.

-- ============================================================
-- Una meta activa por técnico y tipo.
-- ============================================================
create unique index if not exists technician_goals_one_active_per_type
  on public.technician_goals (technician_id, goal_type)
  where is_active;

-- ============================================================
-- Crear/reemplazar la meta activa de un tipo, de forma atómica: el
-- technician_id se resuelve del propio auth.uid() (nunca se confía en un
-- id mandado por el cliente), se desactiva la meta activa anterior del
-- mismo tipo si existía, y se crea la nueva. Evita el error crudo de
-- unique_violation y da un flujo de "reemplazar meta" limpio.
-- ============================================================
create or replace function public.set_technician_goal(
  p_goal_type text,
  p_target_amount numeric default null,
  p_target_count integer default null
) returns public.technician_goals
language plpgsql security definer set search_path = '' as $$
declare
  v_technician_id uuid;
  v_goal public.technician_goals;
begin
  select technician_id into v_technician_id from public.profiles where id = (select auth.uid());
  if v_technician_id is null then
    raise exception 'Solo un técnico con cuenta puede definir metas';
  end if;

  if p_goal_type not in ('monthly_earnings', 'monthly_jobs', 'weekly_jobs') then
    raise exception 'Tipo de meta inválido: %', p_goal_type;
  end if;
  if p_goal_type = 'monthly_earnings' and (p_target_amount is null or p_target_amount <= 0) then
    raise exception 'Las metas de ganancias necesitan un monto objetivo mayor a 0';
  end if;
  if p_goal_type in ('monthly_jobs', 'weekly_jobs') and (p_target_count is null or p_target_count <= 0) then
    raise exception 'Las metas de trabajos necesitan una cantidad objetivo mayor a 0';
  end if;

  update public.technician_goals
  set is_active = false, updated_at = now()
  where technician_id = v_technician_id and goal_type = p_goal_type and is_active;

  insert into public.technician_goals (technician_id, goal_type, target_amount, target_count, is_active)
  values (v_technician_id, p_goal_type, p_target_amount, p_target_count, true)
  returning * into v_goal;

  return v_goal;
end;
$$;

revoke all on function public.set_technician_goal(text, numeric, integer) from public, anon;
grant execute on function public.set_technician_goal(text, numeric, integer) to authenticated;
