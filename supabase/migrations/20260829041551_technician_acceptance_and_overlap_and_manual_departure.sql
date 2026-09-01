-- Fase 3, Tanda 2 (decisiones 1, 2, 4) - ver ADR de la sesion.

-- Decision 1: estado de respuesta del tecnico a la asignacion.
alter table public.service_orders
  add column technician_response_status text not null default 'pending'
    check (technician_response_status in ('pending', 'accepted', 'rejected')),
  add column technician_response_due_at timestamptz,
  add column declined_technician_ids uuid[] not null default '{}';

-- Se reemplaza require_eligible_technician_assignment para sumar, en el
-- mismo punto de entrada (BEFORE UPDATE OF assigned_technician_id):
--   - Decision 2: bloqueo de superposicion de horario (mismo dia agendado,
--     sin franja horaria persistida todavia - ver nota en el ADR).
--   - Decision 1: reset del estado de respuesta del tecnico cada vez que
--     cambia a quien esta ofrecida la orden.
create or replace function public.require_eligible_technician_assignment()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.assigned_technician_id is not null and new.assigned_technician_id is distinct from old.assigned_technician_id then
    if not exists (
      select 1 from public.technicians t
      where t.id = new.assigned_technician_id and t.validation_status = 'approved' and t.can_receive_orders = true
    ) then
      raise exception 'El técnico no está habilitado para recibir órdenes';
    end if;
    if exists (
      select 1 from public.technician_requirements r
      where r.technician_id = new.assigned_technician_id and r.is_required = true
        and r.status not in ('approved', 'not_required')
    ) then
      raise exception 'El técnico tiene requisitos obligatorios pendientes';
    end if;
    if exists (
      select 1 from public.service_orders so
      where so.id <> new.id
        and so.assigned_technician_id = new.assigned_technician_id
        and so.status not in ('completed', 'cancelled')
        and so.scheduled_date = new.scheduled_date
    ) then
      raise exception 'El técnico ya tiene otra visita asignada ese mismo día';
    end if;
  end if;

  if new.assigned_technician_id is distinct from old.assigned_technician_id then
    new.technician_response_status := 'pending';
    new.technician_response_due_at := case when new.assigned_technician_id is not null then now() + interval '15 minutes' else null end;
  end if;

  return new;
end;
$$;

-- Decision 1: el aviso al tecnico ahora incluye el dia agendado (no hay
-- franja horaria persistida - solo queda como texto libre en la descripcion
-- al pedir el turno, ver ADR).
create or replace function public.notify_order_assigned()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform public.create_notification(
    public.profile_id_for_technician(new.assigned_technician_id),
    'order_assigned', 'Nueva orden asignada',
    new.title || ' — visita el ' || to_char(new.scheduled_date, 'DD/MM/YYYY') || '. Tenés 15 minutos para aceptar o rechazar.',
    'order', new.id, 'high',
    'order_assigned:' || new.id::text || ':' || new.assigned_technician_id::text
  );
  return new;
end;
$$;

-- Decision 1: reoferecimiento automatico al siguiente tecnico elegible,
-- reusando exactamente el mismo criterio de elegibilidad del trigger de
-- arriba (aprobado, puede recibir ordenes, sin requisitos obligatorios
-- pendientes) + que no haya rechazado/vencido antes en esta misma orden +
-- que su especialidad coincida con el rubro pedido.
create or replace function public.offer_to_next_eligible_technician(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order record;
  v_next record;
begin
  select id, service_type, scheduled_date, assigned_technician_id, declined_technician_ids
  into v_order
  from public.service_orders where id = p_order_id;

  if v_order.id is null then
    return;
  end if;

  select t.id, t.name into v_next
  from public.technicians t
  where t.validation_status = 'approved'
    and t.can_receive_orders = true
    and t.specialty ilike '%' || v_order.service_type || '%'
    and not (t.id = any(coalesce(v_order.declined_technician_ids, '{}')))
    and (v_order.assigned_technician_id is null or t.id <> v_order.assigned_technician_id)
    and not exists (
      select 1 from public.technician_requirements r
      where r.technician_id = t.id and r.is_required = true
        and r.status not in ('approved', 'not_required')
    )
    and not exists (
      select 1 from public.service_orders so2
      where so2.id <> p_order_id
        and so2.assigned_technician_id = t.id
        and so2.status not in ('completed', 'cancelled')
        and so2.scheduled_date = v_order.scheduled_date
    )
  order by t.id
  limit 1;

  if v_next.id is not null then
    update public.service_orders
    set assigned_technician_id = v_next.id, assigned_technician_name = v_next.name
    where id = p_order_id;
  else
    -- Nadie mas disponible: vuelve a la bandeja del admin, sin tecnico.
    update public.service_orders
    set assigned_technician_id = null, assigned_technician_name = null,
        technician_response_status = 'pending', technician_response_due_at = null
    where id = p_order_id;
  end if;
end;
$$;

-- Decision 1: el tecnico acepta o rechaza su propia oferta pendiente.
create or replace function public.respond_to_technician_assignment(p_order_id uuid, p_response text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_caller_technician_id uuid;
  v_order record;
begin
  if p_response not in ('accepted', 'rejected') then
    raise exception 'Respuesta inválida';
  end if;

  select technician_id into v_caller_technician_id from public.profiles where id = auth.uid();

  select id, assigned_technician_id, technician_response_status, declined_technician_ids
  into v_order
  from public.service_orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Orden no encontrada';
  end if;
  if v_caller_technician_id is null or v_order.assigned_technician_id <> v_caller_technician_id then
    raise exception 'Esta orden no está ofrecida a tu cuenta';
  end if;
  if v_order.technician_response_status <> 'pending' then
    raise exception 'Esta orden ya fue respondida';
  end if;

  if p_response = 'accepted' then
    update public.service_orders set technician_response_status = 'accepted' where id = p_order_id;
  else
    update public.service_orders
    set declined_technician_ids = array_append(coalesce(v_order.declined_technician_ids, '{}'), v_caller_technician_id)
    where id = p_order_id;
    perform public.offer_to_next_eligible_technician(p_order_id);
  end if;
end;
$$;
grant execute on function public.respond_to_technician_assignment(uuid, text) to authenticated;

-- Decision 1: vencimiento automatico de ofertas sin respuesta - mismo
-- patron que run_scheduled_settlement_release (cron cada 15 min).
-- El proyecto live ya tenía pg_cron habilitado, pero una reconstrucción
-- local parte de una base vacía. Declararlo hace que la migración sea
-- autocontenida también en CI; no altera el cron existente en producción.
create extension if not exists pg_cron;

create or replace function public.expire_stale_technician_offers()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order record;
begin
  for v_order in
    select id, assigned_technician_id, declined_technician_ids
    from public.service_orders
    where technician_response_status = 'pending'
      and technician_response_due_at is not null
      and technician_response_due_at < now()
      and assigned_technician_id is not null
  loop
    update public.service_orders
    set declined_technician_ids = array_append(coalesce(v_order.declined_technician_ids, '{}'), v_order.assigned_technician_id)
    where id = v_order.id;
    perform public.offer_to_next_eligible_technician(v_order.id);
  end loop;
end;
$$;

select cron.schedule('expire-stale-technician-offers', '*/15 * * * *', 'select public.expire_stale_technician_offers();');

-- Decision 4: se elimina el arranque automatico del cronometro apenas se
-- confirma el pago - de aca en mas, "Sali hacia el domicilio" (manual, del
-- lado del tecnico) es el unico gatillo. Se agrega ademas la aceptacion del
-- tecnico como condicion extra, en el mismo trigger que ya exigia pago
-- confirmado.
drop trigger if exists service_orders_start_execution_after_payment on public.service_orders;

create or replace function public.prevent_unpaid_execution_timer()
returns trigger
language plpgsql
set search_path to ''
as $$
begin
  if new.status = 'in_progress' and new.work_mode = 'diagnosis'
     and (new.payment_status <> 'paid_in_full' or new.quote_status <> 'accepted') then
    raise exception 'El trabajo presupuestado solo puede iniciarse tras aceptación y pago confirmado';
  end if;

  if new.status = 'in_progress' and new.work_mode = 'direct'
     and new.payment_status <> 'paid_in_full' then
    raise exception 'El trabajo directo solo puede iniciarse tras el pago completo confirmado';
  end if;

  if new.status = 'in_progress' and new.technician_response_status <> 'accepted' then
    raise exception 'El técnico todavía no aceptó esta asignación';
  end if;

  return new;
end;
$$;
