-- Gestor de proveedores de IA del chat de ayuda (panel admin → "Asistente IA").
-- Las API keys se guardan CIFRADAS en Vault; la tabla solo guarda el id del secreto.
-- Nada de esto es accesible desde el navegador: RLS sin políticas y funciones solo
-- para service_role. El único camino es /api/gateway?action=ai-admin (valida admin).

create table if not exists public.ai_providers (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(btrim(label)) between 1 and 60),
  preset text not null default 'custom',
  base_url text not null check (base_url ~ '^https://'),
  model text not null check (char_length(btrim(model)) between 1 and 120),
  reasoning_effort text check (reasoning_effort is null or char_length(reasoning_effort) <= 20),
  enabled boolean not null default true,
  priority integer not null default 100,
  secret_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_providers enable row level security;
revoke all on public.ai_providers from anon, authenticated;

-- Crea o edita un proveedor. Si p_api_key viene vacío en una edición, conserva la clave actual.
create or replace function public.ai_provider_save(
  p_id uuid,
  p_label text,
  p_preset text,
  p_base_url text,
  p_model text,
  p_reasoning_effort text,
  p_enabled boolean,
  p_priority integer,
  p_api_key text
) returns uuid
language plpgsql
security definer
set search_path = public, vault
as $function$
declare
  v_id uuid := coalesce(p_id, gen_random_uuid());
  v_secret uuid;
begin
  if p_id is null then
    if p_api_key is null or btrim(p_api_key) = '' then
      raise exception 'Falta la API key.';
    end if;
    v_secret := vault.create_secret(btrim(p_api_key), 'ai_provider_' || v_id::text, 'API key de proveedor de IA');
    insert into public.ai_providers (id, label, preset, base_url, model, reasoning_effort, enabled, priority, secret_id)
    values (v_id, btrim(p_label), coalesce(p_preset, 'custom'), btrim(p_base_url), btrim(p_model), nullif(btrim(coalesce(p_reasoning_effort, '')), ''), coalesce(p_enabled, true), coalesce(p_priority, 100), v_secret);
  else
    select secret_id into v_secret from public.ai_providers where id = p_id;
    if not found then
      raise exception 'Proveedor inexistente.';
    end if;
    if p_api_key is not null and btrim(p_api_key) <> '' then
      if v_secret is null then
        v_secret := vault.create_secret(btrim(p_api_key), 'ai_provider_' || p_id::text, 'API key de proveedor de IA');
      else
        perform vault.update_secret(v_secret, btrim(p_api_key));
      end if;
    end if;
    update public.ai_providers
       set label = btrim(p_label),
           preset = coalesce(p_preset, preset),
           base_url = btrim(p_base_url),
           model = btrim(p_model),
           reasoning_effort = nullif(btrim(coalesce(p_reasoning_effort, '')), ''),
           enabled = coalesce(p_enabled, enabled),
           priority = coalesce(p_priority, priority),
           secret_id = v_secret,
           updated_at = now()
     where id = p_id;
  end if;
  return v_id;
end;
$function$;

create or replace function public.ai_provider_key(p_id uuid)
returns text
language sql
security definer
set search_path = public, vault
as $function$
  select s.decrypted_secret
  from public.ai_providers p
  join vault.decrypted_secrets s on s.id = p.secret_id
  where p.id = p_id;
$function$;

create or replace function public.ai_provider_delete(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, vault
as $function$
declare
  v_secret uuid;
begin
  select secret_id into v_secret from public.ai_providers where id = p_id;
  delete from public.ai_providers where id = p_id;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
end;
$function$;

-- Proveedores activos con su clave descifrada, en orden de prioridad (para el chat).
create or replace function public.ai_providers_active()
returns table (id uuid, label text, base_url text, model text, reasoning_effort text, api_key text)
language sql
security definer
set search_path = public, vault
as $function$
  select p.id, p.label, p.base_url, p.model, p.reasoning_effort, s.decrypted_secret
  from public.ai_providers p
  join vault.decrypted_secrets s on s.id = p.secret_id
  where p.enabled
  order by p.priority asc, p.created_at asc;
$function$;

revoke all on function public.ai_provider_save(uuid, text, text, text, text, text, boolean, integer, text) from public, anon, authenticated;
revoke all on function public.ai_provider_key(uuid) from public, anon, authenticated;
revoke all on function public.ai_provider_delete(uuid) from public, anon, authenticated;
revoke all on function public.ai_providers_active() from public, anon, authenticated;
grant execute on function public.ai_provider_save(uuid, text, text, text, text, text, boolean, integer, text) to service_role;
grant execute on function public.ai_provider_key(uuid) to service_role;
grant execute on function public.ai_provider_delete(uuid) to service_role;
grant execute on function public.ai_providers_active() to service_role;
