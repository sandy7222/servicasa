-- Chat con IA (plan Fase B): contadores diarios para limitar el uso gratuito.
-- Solo el servidor (service role) accede: RLS activa sin políticas y función sin EXECUTE público.
create table if not exists public.ai_chat_usage (
  day date not null,
  scope text not null,
  key text not null,
  used integer not null default 0,
  primary key (day, scope, key)
);
alter table public.ai_chat_usage enable row level security;

create or replace function public.ai_chat_bump(p_scope text, p_key text, p_limit integer)
 returns boolean
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v integer;
begin
  insert into public.ai_chat_usage (day, scope, key, used)
  values ((now() at time zone 'America/Argentina/Buenos_Aires')::date, p_scope, p_key, 1)
  on conflict (day, scope, key) do update set used = public.ai_chat_usage.used + 1
    where public.ai_chat_usage.used < p_limit
  returning used into v;
  return v is not null;
end;
$function$;

revoke all on function public.ai_chat_bump(text, text, integer) from public, anon, authenticated;
grant execute on function public.ai_chat_bump(text, text, integer) to service_role;
