-- Cuarta condición en require_eligible_technician_assignment (mismo
-- trigger que ya valida técnico habilitado, requisitos pendientes y
-- superposición de horario): si el cliente de la orden no tiene cuenta
-- vinculada (customers.profile_id IS NULL), no se puede asignar ningún
-- técnico. Un cliente sin cuenta puede pagar la seña y crear la orden sin
-- problema — esa parte no cambia — pero no se le asigna técnico hasta que
-- tenga una cuenta para poder seguir el servicio (mensajería, presupuesto,
-- notificaciones).
--
-- También se extiende el trigger para cubrir INSERT, no solo
-- UPDATE OF assigned_technician_id: el admin puede crear una orden nueva
-- y asignar técnico en el mismo paso (modal "Crear Nueva Orden de
-- Servicio"), lo que hace un INSERT con assigned_technician_id ya
-- poblado — sin este cambio, ese camino se saltaba las 4 condiciones por
-- completo.
create or replace function public.require_eligible_technician_assignment()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_is_new_assignment boolean;
begin
  v_is_new_assignment := new.assigned_technician_id is not null
    and (tg_op = 'INSERT' or new.assigned_technician_id is distinct from old.assigned_technician_id);

  if v_is_new_assignment then
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
    if exists (
      select 1 from public.customers c
      where c.id = new.customer_id and c.profile_id is null
    ) then
      raise exception 'El cliente todavía no tiene una cuenta vinculada. Generá y enviale el enlace de invitación antes de asignar un técnico.';
    end if;
  end if;

  if tg_op = 'UPDATE' and new.assigned_technician_id is distinct from old.assigned_technician_id then
    new.technician_response_status := 'pending';
    new.technician_response_due_at := case when new.assigned_technician_id is not null then now() + interval '15 minutes' else null end;
  end if;

  return new;
end;
$function$;

drop trigger require_eligible_technician_assignment on public.service_orders;
create trigger require_eligible_technician_assignment
before insert or update of assigned_technician_id on public.service_orders
for each row execute function require_eligible_technician_assignment();
