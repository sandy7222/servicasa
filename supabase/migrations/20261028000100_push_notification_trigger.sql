-- Avisos push al celular (plan-notificaciones-push.md, Fase 2.1).
-- Cada fila nueva de `notifications` (asignación, mensaje, presupuesto, etc.) avisa al servidor
-- por pg_net para que mande el push. Reutiliza notify_admin_event y los secretos de Vault que ya
-- existen (admin_event_secret / admin_event_url). Solo dispara si el destinatario tiene algún
-- dispositivo suscripto, y NUNCA puede frenar la creación de una notificación.
-- Requiere 20261028000000_push_subscriptions.sql.

create or replace function public.trg_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if exists (select 1 from public.push_subscriptions where profile_id = new.recipient_profile_id) then
    perform public.notify_admin_event('push_notification', new.id);
  end if;
  return new;
exception when others then
  raise warning 'trg_push_notification: %', sqlerrm;
  return new;
end;
$function$;
revoke all on function public.trg_push_notification() from public, anon, authenticated;

drop trigger if exists push_notification on public.notifications;
create trigger push_notification after insert on public.notifications
  for each row execute function public.trg_push_notification();
