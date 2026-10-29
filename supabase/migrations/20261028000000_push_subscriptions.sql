-- Avisos push al celular (plan-notificaciones-push.md, Fase 1.1).
-- Una fila por dispositivo suscripto. La tabla NO es accesible desde el navegador:
-- RLS sin políticas y todo pasa por dos funciones que atan la fila al usuario logueado
-- (auth.uid()). El servidor (service_role) lee las suscripciones para enviar.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://'),
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists push_subscriptions_profile_idx on public.push_subscriptions (profile_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;

-- Registra (o mueve) un dispositivo al usuario actual. Si el mismo celular cambia de cuenta,
-- la suscripción pasa a la cuenta nueva: los avisos nunca llegan a la cuenta anterior.
create or replace function public.register_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Tenés que estar autenticado.';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://' or length(p_endpoint) > 2000 then
    raise exception 'Suscripción inválida.';
  end if;
  if coalesce(btrim(p_p256dh), '') = '' or coalesce(btrim(p_auth), '') = '' then
    raise exception 'Suscripción inválida.';
  end if;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  values (v_uid, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent
  returning id into v_id;
  return v_id;
end;
$function$;

-- Da de baja un dispositivo del usuario actual (al desactivar los avisos).
create or replace function public.remove_push_subscription(p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Tenés que estar autenticado.';
  end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and profile_id = auth.uid();
end;
$function$;

revoke all on function public.register_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.remove_push_subscription(text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.remove_push_subscription(text) to authenticated;
