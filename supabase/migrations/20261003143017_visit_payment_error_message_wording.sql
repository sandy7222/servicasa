-- Vocabulario (decisión de Sandy, 3/10/2026): la Visita de Presupuesto no es una seña.
-- Solo cambia el texto del primer mensaje de error; la lógica del trigger es idéntica.
create or replace function public.prevent_unpaid_execution_timer()
 returns trigger
 language plpgsql
 set search_path to ''
as $function$
begin
  if new.status = 'in_progress' and new.work_mode = 'diagnosis'
     and new.payment_status not in ('deposit_paid', 'paid_in_full') then
    raise exception 'La visita solo puede iniciarse tras confirmarse el pago de la Visita de Presupuesto';
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
$function$;
