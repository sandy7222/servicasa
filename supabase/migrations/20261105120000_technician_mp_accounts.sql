-- Cobro repartido, Fase 1 (plan-cobro-repartido.md): vincular la cuenta de Mercado Pago del técnico por OAuth.
-- Los tokens (access/refresh) son dinero ajeno: se guardan CIFRADOS en Vault y la tabla solo guarda el id del
-- secreto. Nada es accesible desde el navegador: RLS sin políticas y funciones de token solo para service_role.
-- Camino: /api/gateway?action=mp-oauth-start|mp-oauth-callback|mp-oauth-unlink + cron diario de renovación.
-- Esta migración NO mueve dinero ni toca el flujo de pagos existente.

create table if not exists public.technician_mp_accounts (
  technician_id uuid primary key references public.technicians(id) on delete cascade,
  mp_user_id text not null,
  public_key text,
  scope text,
  access_secret_id uuid,
  refresh_secret_id uuid,
  expires_at timestamptz,
  linked_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.technician_mp_accounts enable row level security;
revoke all on public.technician_mp_accounts from anon, authenticated;

-- Estados del OAuth: atan el "state" al técnico logueado. Vencen a los 10 minutos y se usan una sola vez.
create table if not exists public.mp_oauth_states (
  state text primary key,
  technician_id uuid not null references public.technicians(id) on delete cascade,
  created_at timestamptz not null default now(),
  used_at timestamptz
);
create index if not exists mp_oauth_states_created_at_idx on public.mp_oauth_states (created_at);
alter table public.mp_oauth_states enable row level security;
revoke all on public.mp_oauth_states from anon, authenticated;

-- Al borrar una cuenta (por la función de desvincular, por un borrado en cascada del técnico o a mano)
-- se borran también sus secretos de Vault: nunca quedan tokens huérfanos.
create or replace function public.technician_mp_accounts_purge_secrets()
returns trigger
language plpgsql
security definer
set search_path = public, vault
as $function$
begin
  delete from vault.secrets where id in (old.access_secret_id, old.refresh_secret_id);
  return old;
end;
$function$;

drop trigger if exists technician_mp_accounts_purge_secrets on public.technician_mp_accounts;
create trigger technician_mp_accounts_purge_secrets
  after delete on public.technician_mp_accounts
  for each row execute function public.technician_mp_accounts_purge_secrets();

-- Crea o actualiza la vinculación (y sus secretos en Vault). Reemplaza una vinculación anterior del mismo técnico.
create or replace function public.mp_account_save(
  p_technician_id uuid,
  p_mp_user_id text,
  p_public_key text,
  p_scope text,
  p_access_token text,
  p_refresh_token text,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public, vault
as $function$
declare
  v_access uuid;
  v_refresh uuid;
begin
  if p_access_token is null or btrim(p_access_token) = '' or p_refresh_token is null or btrim(p_refresh_token) = '' then
    raise exception 'Faltan los tokens.';
  end if;
  if p_mp_user_id is null or btrim(p_mp_user_id) = '' then
    raise exception 'Falta el usuario de Mercado Pago.';
  end if;

  select t.access_secret_id, t.refresh_secret_id into v_access, v_refresh
    from public.technician_mp_accounts t where t.technician_id = p_technician_id;

  if v_access is not null then
    perform vault.update_secret(v_access, p_access_token);
  else
    delete from vault.secrets where name = 'mp_access_' || p_technician_id::text;
    v_access := vault.create_secret(p_access_token, 'mp_access_' || p_technician_id::text, 'Access token de Mercado Pago del tecnico');
  end if;
  if v_refresh is not null then
    perform vault.update_secret(v_refresh, p_refresh_token);
  else
    delete from vault.secrets where name = 'mp_refresh_' || p_technician_id::text;
    v_refresh := vault.create_secret(p_refresh_token, 'mp_refresh_' || p_technician_id::text, 'Refresh token de Mercado Pago del tecnico');
  end if;

  insert into public.technician_mp_accounts (technician_id, mp_user_id, public_key, scope, access_secret_id, refresh_secret_id, expires_at, linked_at, revoked_at)
  values (p_technician_id, btrim(p_mp_user_id), p_public_key, p_scope, v_access, v_refresh, p_expires_at, now(), null)
  on conflict (technician_id) do update
    set mp_user_id = excluded.mp_user_id,
        public_key = excluded.public_key,
        scope = excluded.scope,
        access_secret_id = excluded.access_secret_id,
        refresh_secret_id = excluded.refresh_secret_id,
        expires_at = excluded.expires_at,
        revoked_at = null;
end;
$function$;

-- Lee los tokens descifrados (solo servidor). Devuelve 0 filas si no está vinculada o fue revocada.
create or replace function public.mp_account_token(p_technician_id uuid)
returns table (access_token text, refresh_token text, mp_user_id text, public_key text, expires_at timestamptz)
language sql
security definer
set search_path = public, vault
as $function$
  select a.decrypted_secret, r.decrypted_secret, t.mp_user_id, t.public_key, t.expires_at
  from public.technician_mp_accounts t
  join vault.decrypted_secrets a on a.id = t.access_secret_id
  join vault.decrypted_secrets r on r.id = t.refresh_secret_id
  where t.technician_id = p_technician_id and t.revoked_at is null;
$function$;

-- Desvincula: borra la fila (el trigger borra los secretos de Vault).
create or replace function public.mp_account_delete(p_technician_id uuid)
returns void
language sql
security definer
set search_path = public, vault
as $function$
  delete from public.technician_mp_accounts where technician_id = p_technician_id;
$function$;

-- Cuentas vinculadas cuyo token vence en menos de p_days días (para la renovación del cron).
create or replace function public.mp_accounts_expiring(p_days integer default 30)
returns table (technician_id uuid, expires_at timestamptz)
language sql
security definer
set search_path = public
as $function$
  select t.technician_id, t.expires_at
  from public.technician_mp_accounts t
  where t.revoked_at is null
    and t.expires_at is not null
    and t.expires_at < now() + make_interval(days => greatest(coalesce(p_days, 30), 0))
  order by t.expires_at asc;
$function$;

-- Estado de la vinculación del técnico logueado: SOLO el suyo y sin tokens.
create or replace function public.my_mp_account_status()
returns table (linked boolean, mp_user_id text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tech uuid;
begin
  select p.technician_id into v_tech from public.profiles p where p.id = auth.uid();
  return query
    select true, t.mp_user_id, t.expires_at
    from public.technician_mp_accounts t
    where t.technician_id = v_tech and t.revoked_at is null;
  if not found then
    return query select false, null::text, null::timestamptz;
  end if;
end;
$function$;

-- Estado de cualquier técnico, solo para administradores. Sin tokens.
create or replace function public.mp_account_status_admin(p_technician_id uuid)
returns table (linked boolean, mp_user_id text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then
    raise exception 'Solo administración.';
  end if;
  return query
    select true, t.mp_user_id, t.expires_at
    from public.technician_mp_accounts t
    where t.technician_id = p_technician_id and t.revoked_at is null;
  if not found then
    return query select false, null::text, null::timestamptz;
  end if;
end;
$function$;

revoke all on function public.technician_mp_accounts_purge_secrets() from public, anon, authenticated;
revoke all on function public.mp_account_save(uuid, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.mp_account_token(uuid) from public, anon, authenticated;
revoke all on function public.mp_account_delete(uuid) from public, anon, authenticated;
revoke all on function public.mp_accounts_expiring(integer) from public, anon, authenticated;
revoke all on function public.my_mp_account_status() from public, anon;
revoke all on function public.mp_account_status_admin(uuid) from public, anon;
grant execute on function public.mp_account_save(uuid, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.mp_account_token(uuid) to service_role;
grant execute on function public.mp_account_delete(uuid) to service_role;
grant execute on function public.mp_accounts_expiring(integer) to service_role;
grant execute on function public.my_mp_account_status() to authenticated;
grant execute on function public.mp_account_status_admin(uuid) to authenticated;

-- La casilla de autorización de cobro se registra en legal_acceptances con un slug nuevo.
-- Incluye los cuatro valores (ya existentes: terminos_cliente, terminos_tecnico, politica_privacidad).
alter table public.legal_acceptances drop constraint if exists legal_acceptances_document_slug_check;
alter table public.legal_acceptances
  add constraint legal_acceptances_document_slug_check
  check (document_slug in ('terminos_cliente', 'terminos_tecnico', 'politica_privacidad', 'autorizacion_cobro_mp'));
