-- Fase 7: Configuración central y auditoría.
--
-- Inventario de valores hardcodeados (ver ROADMAP-TERMINACION.md para el
-- detalle completo por parámetro). Resumen:
--   - visit_deposit_amount: ya vivía en system_settings (30000) y ya se lee
--     server-side en api/orders/guest-checkout.ts. Se formaliza con
--     metadata (tipo/descripción/visibilidad), no cambia el valor.
--   - warranty_days: hardcodeado como '30 days' dentro de la vista SQL
--     customer_summary (no tenía ningún consumidor en el frontend — vista
--     muerta). Se extrae a system_settings y la vista pasa a leerlo.
--   - platform_commission_rate, settlement_release_days,
--     urgent_surcharge_percent, message_max_length, enabled_provinces,
--     feature_flags: NINGUNO tenía un consumidor real hoy (ver hallazgos
--     abajo) — se crean como settings tipados con default seguro, listos
--     para que una función futura los lea, en vez de inventar lógica de
--     negocio nueva sin pedido explícito.
--
-- Hallazgos durante el inventario (no son bugs de esta fase, pero hay que
-- dejarlos anotados):
--   - `VISIT_DEPOSIT_AMOUNT = 6000` y `PLATFORM_COMMISSION_RATE = 0.17` en
--     src/lib/pricing.ts nunca se importan en ningún lado — están muertos y
--     además el primero está desactualizado (el valor real es 30000). Se
--     borran en este mismo cambio.
--   - No existe NINGÚN código (frontend, API o trigger SQL) que cree filas
--     en technician_settlements. Todo lo que se construyó en la Fase 5
--     (cron, cierre de lote, conciliación) es correcto y quedó probado,
--     pero hoy no tiene quién le dé de alta la primera fila 'pending_release'
--     cuando un técnico termina un trabajo. No se resuelve en esta fase
--     (no estaba pedido y necesita una decisión de producto sobre cuándo
--     se genera exactamente la liquidación) — queda anotado en el roadmap.

-- ============================================================
-- 1. system_settings: tipado, descripción, visibilidad y versión.
-- ============================================================
alter table public.system_settings
  add column if not exists value_type text not null default 'json',
  add column if not exists description text,
  add column if not exists visibility text not null default 'authenticated',
  add column if not exists version integer not null default 1;

alter table public.system_settings
  add constraint system_settings_value_type_check
    check (value_type in ('number', 'boolean', 'text', 'json'));
alter table public.system_settings
  add constraint system_settings_visibility_check
    check (visibility in ('public', 'authenticated', 'admin'));

-- ============================================================
-- 2. system_settings_history: auditoría (quién, cuándo, valor anterior y
-- nuevo). Se llena sola por trigger — no depende de que el código de la
-- app se acuerde de loguearlo.
-- ============================================================
create table public.system_settings_history (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  old_value jsonb,
  new_value jsonb,
  version integer not null,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

alter table public.system_settings_history enable row level security;
revoke all on public.system_settings_history from anon, authenticated;
grant select on public.system_settings_history to authenticated;

create policy system_settings_history_admin_read on public.system_settings_history
  for select to authenticated
  using ((select public.is_admin()));

-- Trigger BEFORE: valida el tipo declarado, fija updated_at/updated_by/
-- version, y deja constancia en el historial — todo en un solo lugar para
-- que valga sin importar qué código escriba la fila.
create or replace function public.system_settings_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.value_type = 'number' and jsonb_typeof(new.value) <> 'number' then
    raise exception 'system_settings.%: value_type=number pero el value no es un número', new.key;
  elsif new.value_type = 'boolean' and jsonb_typeof(new.value) <> 'boolean' then
    raise exception 'system_settings.%: value_type=boolean pero el value no es un booleano', new.key;
  elsif new.value_type = 'text' and jsonb_typeof(new.value) <> 'string' then
    raise exception 'system_settings.%: value_type=text pero el value no es un string', new.key;
  end if;

  if tg_op = 'INSERT' then
    new.version := coalesce(new.version, 1);
    new.updated_by := coalesce(new.updated_by, (select auth.uid()));
    new.updated_at := now();
    insert into public.system_settings_history (key, old_value, new_value, version, changed_by)
    values (new.key, null, new.value, new.version, new.updated_by);
  elsif tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_by := (select auth.uid());
    new.updated_at := now();
    if new.value is distinct from old.value then
      insert into public.system_settings_history (key, old_value, new_value, version, changed_by)
      values (new.key, old.value, new.value, new.version, new.updated_by);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_system_settings_audit on public.system_settings;
create trigger trg_system_settings_audit
  before insert or update on public.system_settings
  for each row execute function public.system_settings_audit();

revoke execute on function public.system_settings_audit() from public, anon, authenticated;

-- ============================================================
-- 3. RLS: escritura admin-only (ya estaba); lectura segmentada por
-- visibilidad en vez de "cualquier autenticado ve todo".
-- ============================================================
drop policy if exists system_settings_select_authenticated on public.system_settings;
drop policy if exists system_settings_write_admin on public.system_settings;

create policy system_settings_admin_all on public.system_settings
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy system_settings_select_public on public.system_settings
  for select to anon, authenticated
  using (visibility = 'public');

create policy system_settings_select_authenticated on public.system_settings
  for select to authenticated
  using (visibility in ('public', 'authenticated'));

-- ============================================================
-- 4. Backfill del parámetro que ya existía (visit_deposit_amount) +
-- carga de los 7 parámetros restantes de la lista inicial del roadmap.
-- ============================================================
update public.system_settings
set value_type = 'number', visibility = 'authenticated',
    description = 'Monto único de seña para la visita de diagnóstico (ARS). Se descuenta del presupuesto si el cliente acepta.'
where key = 'visit_deposit_amount';

insert into public.system_settings (key, value, value_type, visibility, description) values
  ('platform_commission_rate', '0.17', 'number', 'admin',
   'Porcentaje que retiene la plataforma sobre cada liquidación (0.17 = 17%). Reservado: hoy ningún código crea filas en technician_settlements, así que este valor todavía no tiene consumidor real.'),
  ('warranty_days', '30', 'number', 'authenticated',
   'Días de garantía desde que se completa una orden. Usado por la vista customer_summary (antes hardcodeado como 30 days).'),
  ('settlement_release_days', '7', 'number', 'admin',
   'Días desde que una liquidación queda pending_release hasta que se libera automáticamente. Reservado: sin consumidor real todavía (ver nota sobre technician_settlements).'),
  ('urgent_surcharge_percent', '0', 'number', 'authenticated',
   'Recargo porcentual para órdenes con prioridad urgente. Reservado en 0 (sin recargo, igual al comportamiento actual) — hoy ningún cálculo de precio lo aplica.'),
  ('message_max_length', '2000', 'number', 'authenticated',
   'Largo máximo (caracteres) de un mensaje en conversaciones y reclamos. Validado en servidor por trigger.'),
  ('enabled_provinces', '["CABA","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]', 'json', 'public',
   'Provincias donde se aceptan pedidos. Reservado: hoy se listan todas (igual al comportamiento actual, que acepta pedidos de cualquier provincia) — todavía no hay validación que filtre por esta lista.'),
  ('feature_flags', '{}', 'json', 'admin',
   'Banderas de funciones sensibles, a futuro. Contenedor reservado, vacío por ahora.')
on conflict (key) do nothing;

-- ============================================================
-- 5. warranty_days pasa a leerse dinámicamente en la vista (antes 30 days
-- hardcodeado). La vista sigue sin consumidor en el frontend hoy, pero si
-- se usa a futuro ya queda conectada al setting real.
-- ============================================================
create or replace view public.customer_summary
with (security_invoker = true) as
select
  c.id,
  c.profile_id,
  c.name as full_name,
  c.email,
  c.phone,
  count(so.id) filter (where so.status = 'completed') as completed_orders,
  count(so.id) as total_orders,
  coalesce(sum(so.total_paid_amount) filter (where so.status = 'completed'), 0::numeric) as total_spent,
  count(so.id) filter (
    where so.status = 'completed'
      and so.completed_at is not null
      and so.completed_at + (
        (select (value#>>'{}')::int from public.system_settings where key = 'warranty_days') * interval '1 day'
      ) > now()
  ) as active_warranties,
  max(so.created_at) as last_order_date
from public.customers c
left join public.service_orders so on so.customer_id = c.id
group by c.id, c.profile_id, c.name, c.email, c.phone;

-- ============================================================
-- 6. message_max_length: validación real en servidor (no solo en config).
-- Trigger dinámico — lee el setting en cada insert, así que un cambio
-- desde el panel de admin aplica al instante sin migrar nada.
-- ============================================================
create or replace function public.enforce_max_length(p_text text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
begin
  select (value#>>'{}')::int into v_max from public.system_settings where key = 'message_max_length';
  v_max := coalesce(v_max, 2000);
  if length(p_text) > v_max then
    raise exception 'El mensaje supera el largo máximo permitido (% caracteres)', v_max;
  end if;
end;
$$;

create or replace function public.enforce_message_max_length() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.enforce_max_length(new.body);
  return new;
end;
$$;

create or replace function public.enforce_support_message_max_length() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.enforce_max_length(new.message);
  return new;
end;
$$;

drop trigger if exists trg_enforce_message_max_length on public.messages;
create trigger trg_enforce_message_max_length
  before insert or update of body on public.messages
  for each row execute function public.enforce_message_max_length();

drop trigger if exists trg_enforce_support_message_max_length on public.support_case_messages;
create trigger trg_enforce_support_message_max_length
  before insert or update of message on public.support_case_messages
  for each row execute function public.enforce_support_message_max_length();

revoke execute on function public.enforce_max_length(text) from public, anon, authenticated;
revoke execute on function public.enforce_message_max_length() from public, anon, authenticated;
revoke execute on function public.enforce_support_message_max_length() from public, anon, authenticated;
