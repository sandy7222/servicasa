-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Fase 2 (hallazgo de Fase 1): la notificación "Tu técnico está en camino"
-- hoy dispara con el cambio de status a 'in_progress' (que hasta ahora
-- coincidía con "Salí hacia el domicilio"). Con el plan de "Llegué al
-- domicilio", esa transición de status va a pasar recién cuando el técnico
-- LLEGA, así que hay que mover el disparador de esta notificación a la
-- columna nueva travel_started_at (que sí se setea en "Salí"), para no
-- invertir el orden real de los avisos al cliente.

drop trigger if exists trg_notify_technician_en_route on public.service_orders;

create or replace function public.notify_technician_en_route()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  perform public.create_notification(
    public.profile_id_for_customer(new.customer_id),
    'technician_en_route', 'Tu técnico está en camino', new.title,
    'order', new.id, 'high',
    'technician_en_route:' || new.id::text || ':' || coalesce(new.travel_started_at::text, '')
  );
  return new;
end;
$function$;

create trigger trg_notify_technician_en_route
  after update of travel_started_at on public.service_orders
  for each row
  when (old.travel_started_at is null and new.travel_started_at is not null)
  execute function public.notify_technician_en_route();
