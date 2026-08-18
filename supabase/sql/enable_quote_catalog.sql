-- ServiCasa — catálogo controlado para presupuestos de diagnóstico.
-- Ejecutar UNA sola vez en el SQL Editor, después de los scripts de pagos y presupuestos.
-- Este script no crea pagos ni facturas. Los precios se validan contra catálogo.

begin;

create table if not exists public.service_rubros (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  icon text,
  visit_deposit numeric(12,2) not null default 0 check (visit_deposit >= 0),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  rubro_id uuid not null references public.service_rubros(id) on delete restrict,
  name text not null check (char_length(trim(name)) > 0),
  slug text not null,
  description text,
  base_price numeric(12,2) not null check (base_price >= 0),
  unit text not null default 'servicio',
  unit_type text not null default 'servicio' check (unit_type in ('servicio', 'por_hora', 'por_metro', 'por_unidad', 'por_circuito', 'estimado')),
  estimated_duration_minutes integer check (estimated_duration_minutes is null or estimated_duration_minutes > 0),
  materials_included boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rubro_id, slug)
);

create index if not exists service_categories_rubro_active_idx on public.service_categories(rubro_id, is_active, sort_order);

alter table public.order_quote_items
  add column if not exists category_id uuid references public.service_categories(id) on delete restrict,
  add column if not exists notes text;

-- Quantity and notes may change in a draft. Description, unit, type and price
-- are overwritten from the active category on every item write.
create or replace function public.apply_catalog_price_to_quote_item()
returns trigger language plpgsql set search_path = '' as $$
declare catalog_item public.service_categories%rowtype;
begin
  if new.category_id is null then
    raise exception 'Cada ítem del presupuesto debe provenir del catálogo publicado';
  end if;
  select * into catalog_item from public.service_categories where id = new.category_id and is_active = true;
  if not found then raise exception 'La categoría seleccionada no está activa'; end if;
  new.description := catalog_item.name;
  new.unit := catalog_item.unit;
  new.unit_price := catalog_item.base_price;
  new.item_type := 'labor';
  return new;
end;
$$;

drop trigger if exists order_quote_items_apply_catalog_price on public.order_quote_items;
create trigger order_quote_items_apply_catalog_price before insert or update on public.order_quote_items
for each row execute function public.apply_catalog_price_to_quote_item();

insert into public.service_rubros (name, slug, icon, visit_deposit, description) values
  ('Refrigeración', 'refrigeracion', '❄️', 35000, 'Instalación, mantenimiento y reparación de climatización.'),
  ('Electricidad', 'electricidad', '⚡', 30000, 'Instalaciones y reparaciones eléctricas domiciliarias.'),
  ('Cerrajería', 'cerrajeria', '🔑', 30000, 'Aperturas, cambios de cerradura y seguridad.'),
  ('Soldadura', 'soldadura', '🔥', 30000, 'Reparación de rejas, portones y estructuras metálicas.')
on conflict (slug) do update set name = excluded.name, icon = excluded.icon, visit_deposit = excluded.visit_deposit, description = excluded.description, updated_at = now();

insert into public.service_categories (rubro_id, name, slug, description, base_price, unit, unit_type, estimated_duration_minutes, materials_included, sort_order) values
  ((select id from public.service_rubros where slug = 'refrigeracion'), 'Instalación de aire acondicionado split', 'instalacion-split', 'Instalación estándar de un equipo split.', 80000, 'servicio', 'servicio', 180, true, 10),
  ((select id from public.service_rubros where slug = 'refrigeracion'), 'Carga de gas refrigerante', 'carga-gas', 'Carga y verificación de presión.', 35000, 'servicio', 'servicio', 60, true, 20),
  ((select id from public.service_rubros where slug = 'refrigeracion'), 'Prueba de fuga', 'prueba-fuga', 'Detección de fuga e informe.', 25000, 'servicio', 'servicio', 45, true, 30),
  ((select id from public.service_rubros where slug = 'refrigeracion'), 'Limpieza y mantenimiento de split', 'limpieza-split', 'Limpieza preventiva de una unidad.', 20000, 'unidad', 'por_unidad', 60, true, 40),
  ((select id from public.service_rubros where slug = 'electricidad'), 'Cambio de tomacorriente', 'cambio-tomacorriente', 'Reemplazo de un tomacorriente estándar.', 8000, 'unidad', 'por_unidad', 20, true, 10),
  ((select id from public.service_rubros where slug = 'electricidad'), 'Cambio de llave térmica', 'cambio-llave-termica', 'Reemplazo de llave térmica estándar.', 12000, 'unidad', 'por_unidad', 30, true, 20),
  ((select id from public.service_rubros where slug = 'electricidad'), 'Instalación de luminaria', 'instalacion-luminaria', 'Instalación de artefacto de iluminación.', 10000, 'unidad', 'por_unidad', 30, false, 30),
  ((select id from public.service_rubros where slug = 'electricidad'), 'Recableado de circuito', 'recableado-circuito', 'Reemplazo de cableado de un circuito completo.', 25000, 'circuito', 'por_circuito', 120, false, 40),
  ((select id from public.service_rubros where slug = 'cerrajeria'), 'Apertura de puerta', 'apertura-puerta', 'Apertura no destructiva cuando sea posible.', 12000, 'servicio', 'servicio', 45, true, 10),
  ((select id from public.service_rubros where slug = 'cerrajeria'), 'Cambio de cerradura', 'cambio-cerradura', 'Cambio de cerradura estándar.', 15000, 'unidad', 'por_unidad', 45, true, 20),
  ((select id from public.service_rubros where slug = 'soldadura'), 'Soldadura puntual de reja', 'soldadura-reja', 'Reparación puntual de una reja.', 20000, 'servicio', 'servicio', 90, true, 10)
on conflict (rubro_id, slug) do update set name = excluded.name, description = excluded.description, base_price = excluded.base_price, unit = excluded.unit, unit_type = excluded.unit_type, estimated_duration_minutes = excluded.estimated_duration_minutes, materials_included = excluded.materials_included, sort_order = excluded.sort_order, is_active = true, updated_at = now();

revoke all on public.service_rubros, public.service_categories from anon, authenticated;
grant select on public.service_rubros, public.service_categories to authenticated;
grant insert, update, delete on public.service_rubros, public.service_categories to authenticated;
alter table public.service_rubros enable row level security;
alter table public.service_categories enable row level security;

drop policy if exists "service_rubros_read_authenticated" on public.service_rubros;
drop policy if exists "service_rubros_admin_write" on public.service_rubros;
drop policy if exists "service_categories_read_authenticated" on public.service_categories;
drop policy if exists "service_categories_admin_write" on public.service_categories;
create policy "service_rubros_read_authenticated" on public.service_rubros for select to authenticated using (is_active or is_admin());
create policy "service_rubros_admin_write" on public.service_rubros for all to authenticated using (is_admin()) with check (is_admin());
create policy "service_categories_read_authenticated" on public.service_categories for select to authenticated using ((is_active and exists (select 1 from public.service_rubros r where r.id = service_categories.rubro_id and r.is_active)) or is_admin());
create policy "service_categories_admin_write" on public.service_categories for all to authenticated using (is_admin()) with check (is_admin());

commit;

select (select count(*) from public.service_rubros) as rubros, (select count(*) from public.service_categories) as categories;
