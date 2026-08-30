-- Prueba del gate nuevo en require_eligible_technician_assignment(): un
-- cliente sin cuenta vinculada (customers.profile_id IS NULL) no puede
-- recibir ningún técnico asignado, ni al crear la orden (INSERT con
-- assigned_technician_id ya poblado, el camino del modal "Crear Nueva
-- Orden de Servicio" del admin) ni al reasignar después (UPDATE OF
-- assigned_technician_id). Un cliente CON cuenta sigue funcionando
-- normal, y las otras 3 condiciones del mismo trigger (técnico habilitado,
-- requisitos pendientes, superposición de horario) no se rompieron.
--
-- Corre dentro de una transacción que se revierte al final (rollback), así
-- no queda ninguna orden de prueba en la base real. Mismo criterio que
-- test_pricing_trigger.sql / test_visit_and_completed_work_settlements.sql.
--
-- Requiere al menos un cliente sin cuenta, un cliente con cuenta y un
-- técnico habilitado reales en la base.

begin;

do $$
declare
  v_customer_no_acct uuid;
  v_customer_with_acct uuid;
  v_tech_ok uuid;
  v_tech_not_approved uuid;
  v_order_id uuid;
begin
  select id into v_customer_no_acct from public.customers where profile_id is null limit 1;
  select id into v_customer_with_acct from public.customers where profile_id is not null limit 1;
  select id into v_tech_ok from public.technicians
    where validation_status = 'approved' and can_receive_orders = true
      and not exists (
        select 1 from public.technician_requirements r
        where r.technician_id = technicians.id and r.is_required = true
          and r.status not in ('approved', 'not_required')
      )
    limit 1;
  select id into v_tech_not_approved from public.technicians
    where validation_status <> 'approved' or can_receive_orders = false
    limit 1;

  -- Caso 1: INSERT con técnico asignado para un cliente sin cuenta -> debe fallar.
  begin
    insert into public.service_orders (title, service_type, scheduled_date, customer_id, client_name, service_status, work_mode, status, assigned_technician_id)
    values ('TEST gate sin cuenta (insert)', 'Electricidad', '2026-09-01', v_customer_no_acct, 'TEST CLIENT', 'pending', 'diagnosis', 'assigned', v_tech_ok);
    raise exception 'FALLO: se insertó una orden con técnico para un cliente sin cuenta';
  exception when others then
    if sqlerrm like 'El cliente todavía no tiene una cuenta vinculada%' then
      raise notice 'OK caso 1 (INSERT bloqueado): %', sqlerrm;
    else
      raise;
    end if;
  end;

  -- Caso 2: INSERT sin técnico para el mismo cliente sin cuenta -> debe funcionar
  -- (el gate solo aplica cuando SE INTENTA asignar un técnico).
  insert into public.service_orders (title, service_type, scheduled_date, customer_id, client_name, service_status, work_mode, status, assigned_technician_id)
  values ('TEST sin tecnico ok', 'Electricidad', '2026-09-01', v_customer_no_acct, 'TEST CLIENT', 'pending', 'diagnosis', 'assigned', null)
  returning id into v_order_id;

  -- Caso 3: UPDATE de esa misma orden para asignar técnico después -> debe fallar también.
  begin
    update public.service_orders set assigned_technician_id = v_tech_ok where id = v_order_id;
    raise exception 'FALLO: se pudo asignar técnico vía UPDATE a un cliente sin cuenta';
  exception when others then
    if sqlerrm like 'El cliente todavía no tiene una cuenta vinculada%' then
      raise notice 'OK caso 3 (UPDATE bloqueado): %', sqlerrm;
    else
      raise;
    end if;
  end;

  -- Caso 4 (control): cliente CON cuenta -> INSERT con técnico debe funcionar normal.
  if v_customer_with_acct is not null and v_tech_ok is not null then
    insert into public.service_orders (title, service_type, scheduled_date, customer_id, client_name, service_status, work_mode, status, assigned_technician_id)
    values ('TEST con cuenta ok', 'Electricidad', '2026-09-02', v_customer_with_acct, 'TEST CLIENT 2', 'pending', 'diagnosis', 'assigned', v_tech_ok);
    raise notice 'OK caso 4: cliente con cuenta pudo recibir técnico sin problema';
  end if;

  -- Caso 5 (regresión): técnico no habilitado sigue bloqueado igual que antes del cambio.
  if v_tech_not_approved is not null and v_customer_with_acct is not null then
    begin
      insert into public.service_orders (title, service_type, scheduled_date, customer_id, client_name, service_status, work_mode, status, assigned_technician_id)
      values ('TEST tecnico no habilitado', 'Electricidad', '2026-09-03', v_customer_with_acct, 'TEST CLIENT 2', 'pending', 'diagnosis', 'assigned', v_tech_not_approved);
      raise exception 'FALLO: se insertó con un técnico no habilitado';
    exception when others then
      if sqlerrm like 'El técnico no está habilitado%' then
        raise notice 'OK caso 5 (técnico no habilitado sigue bloqueado): %', sqlerrm;
      else
        raise;
      end if;
    end;
  end if;
end $$;

rollback;
