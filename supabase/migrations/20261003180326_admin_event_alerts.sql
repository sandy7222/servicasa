-- Avisos al admin (Telegram + campanita): se anotó un técnico, subió documentación,
-- se registró un cliente. Ver plan-avisos-telegram-y-chat.md.
--
-- Los triggers solo "tocan el timbre": llaman por pg_net (asíncrono, después del commit)
-- a /api/gateway?action=admin-event con un secreto compartido. Lo que se manda, el tope
-- diario y la deduplicación se resuelven en el servidor. Un fallo de red NUNCA frena un
-- alta: la función atrapa todo error.
--
-- Los secretos (admin_event_secret, admin_event_url) viven en Vault y NO se versionan acá.
-- Sin ellos la función no hace nada.

create extension if not exists pg_net with schema extensions;

-- Registro de avisos enviados: deduplica y cuenta (tope diario de clientes).
create table if not exists public.admin_event_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('technician_registered', 'technician_documents', 'customer_registered')),
  entity_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists admin_event_log_kind_created_idx on public.admin_event_log (kind, created_at desc);
create index if not exists admin_event_log_kind_entity_idx on public.admin_event_log (kind, entity_id, created_at);
alter table public.admin_event_log enable row level security;
revoke all on public.admin_event_log from anon, authenticated;

-- Tipos nuevos de notificación (aditivo: mantiene los 19 existentes).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type = any (array[
    'order_assigned','quote_sent','quote_accepted','quote_rejected',
    'payment_approved','payment_rejected','payment_pending',
    'claim_opened','claim_message','claim_resolved',
    'message_new','settlement_scheduled','settlement_released','settlement_paid',
    'technician_validation','cron_failure','technician_en_route','business_lead',
    'visit_paid','technician_registered','technician_documents'
  ]));

-- entity_type también tiene su propia restricción: se suma 'technician'.
alter table public.notifications drop constraint if exists notifications_entity_type_check;
alter table public.notifications
  add constraint notifications_entity_type_check check (entity_type is null or entity_type = any (array[
    'order','quote','payment','claim','conversation','settlement',
    'technician_validation','business_lead','technician'
  ]));

create or replace function public.notify_admin_event(p_kind text, p_entity uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $function$
declare
  v_secret text;
  v_url text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'admin_event_secret' limit 1;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'admin_event_url' limit 1;
  if v_secret is null or v_url is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-admin-event-secret', v_secret),
    body := jsonb_build_object('kind', p_kind, 'entityId', p_entity),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'notify_admin_event(%): %', p_kind, sqlerrm;
end;
$function$;
revoke all on function public.notify_admin_event(text, uuid) from public, anon, authenticated;

-- Técnico que se anota: la ficha la crea self_register_technician. Si la crea un
-- admin a mano no se avisa (el admin ya sabe).
create or replace function public.trg_notify_technician_registered()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if not public.is_admin() then
    perform public.notify_admin_event('technician_registered', new.id);
  end if;
  return new;
end;
$function$;
revoke all on function public.trg_notify_technician_registered() from public, anon, authenticated;
drop trigger if exists notify_technician_registered on public.technicians;
create trigger notify_technician_registered after insert on public.technicians
  for each row execute function public.trg_notify_technician_registered();

-- Documentación subida (el servidor agrupa varios archivos en un solo aviso).
create or replace function public.trg_notify_technician_documents()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if not public.is_admin() then
    perform public.notify_admin_event('technician_documents', new.technician_id);
  end if;
  return new;
end;
$function$;
revoke all on function public.trg_notify_technician_documents() from public, anon, authenticated;
drop trigger if exists notify_technician_documents on public.technician_documents;
create trigger notify_technician_documents after insert on public.technician_documents
  for each row execute function public.trg_notify_technician_documents();

-- Cliente que se registra (profiles se crea desde auth.users con handle_new_user).
create or replace function public.trg_notify_customer_registered()
returns trigger language plpgsql security definer set search_path = public as $function$
begin
  if new.role = 'customer' then
    perform public.notify_admin_event('customer_registered', new.id);
  end if;
  return new;
end;
$function$;
revoke all on function public.trg_notify_customer_registered() from public, anon, authenticated;
drop trigger if exists notify_customer_registered on public.profiles;
create trigger notify_customer_registered after insert on public.profiles
  for each row execute function public.trg_notify_customer_registered();
