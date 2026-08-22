-- ServiCasa — audit de seguridad de pagos: el monto de una orden de precio
-- fijo (work_mode = 'direct') lo calculaba y enviaba el navegador del cliente
-- (unitPrice x cantidad, tomado de src/lib/pricing.ts), y nada del lado del
-- servidor lo volvía a validar antes de generar la preferencia de pago en
-- Mercado Pago. Un cliente que edite la request (devtools o pegándole
-- directo a la API/REST de Supabase con su propio JWT) podía pedir cualquier
-- trabajo pero fijar total_quoted_amount en $1, pagar eso, y el webhook
-- igual marca payment_status = 'paid_in_full' sin comparar montos — lo que
-- habilita asignar técnico y ejecutar el trabajo completo.
--
-- El mismo problema existe para work_mode = 'diagnosis' con
-- visit_deposit_amount (también viaja tal cual desde el cliente en el alta
-- autenticada, aunque el endpoint de invitados sí lo recalculaba bien).
--
-- Fix: un catálogo de precio fijo EN LA BASE (fixed_price_services, espejo
-- de FIXED_PRICE_SERVICES en src/lib/pricing.ts) + un trigger BEFORE INSERT
-- en service_orders que recalcula total_quoted_amount/visit_deposit_amount
-- desde fuentes confiables (este catálogo y system_settings), sin importar
-- qué haya mandado el cliente. Como los clientes no tienen policy de UPDATE
-- sobre service_orders (solo INSERT y un DELETE acotado a canceladas), el
-- trigger en INSERT alcanza para blindar toda la tabla.
--
-- No afecta las órdenes que crea el admin (work_mode queda NULL en ese
-- flujo, y el trigger solo actúa sobre 'direct'/'diagnosis').
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

create table if not exists public.fixed_price_services (
  id text primary key,
  category text not null,
  name text not null,
  unit_price numeric(12,2) not null check (unit_price > 0),
  active boolean not null default true
);

alter table public.fixed_price_services enable row level security;

drop policy if exists fixed_price_services_select_all on public.fixed_price_services;
create policy fixed_price_services_select_all on public.fixed_price_services
  for select to authenticated, anon using (true);

drop policy if exists fixed_price_services_write_admin on public.fixed_price_services;
create policy fixed_price_services_write_admin on public.fixed_price_services
  for all to authenticated using (is_admin()) with check (is_admin());

insert into public.fixed_price_services (id, category, name, unit_price) values
  ('electricidad-tomacorriente', 'Electricidad', 'Cambio de tomacorriente', 8000),
  ('electricidad-termica', 'Electricidad', 'Cambio de llave térmica', 12000),
  ('refrigeracion-limpieza-split', 'Refrigeración', 'Limpieza de split', 20000),
  ('cerrajeria-apertura', 'Cerrajería', 'Apertura de puerta', 12000),
  ('cerrajeria-cerradura', 'Cerrajería', 'Cambio de cerradura', 15000),
  ('soldadura-reja', 'Soldadura', 'Soldadura puntual de reja', 20000)
on conflict (id) do nothing;

alter table public.service_orders
  add column if not exists fixed_price_service_id text references public.fixed_price_services(id),
  add column if not exists fixed_price_quantity integer check (fixed_price_quantity is null or fixed_price_quantity between 1 and 20);

create or replace function public.enforce_service_order_pricing()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  catalog_price numeric(12,2);
  deposit_setting numeric(12,2);
begin
  if new.work_mode = 'direct' then
    if new.fixed_price_service_id is null or new.fixed_price_quantity is null then
      raise exception 'Un pedido de precio fijo necesita un servicio de catálogo y una cantidad válidos.';
    end if;
    select unit_price into catalog_price
      from public.fixed_price_services
      where id = new.fixed_price_service_id and active = true;
    if catalog_price is null then
      raise exception 'Servicio de precio fijo inválido o inactivo.';
    end if;
    new.total_quoted_amount := catalog_price * new.fixed_price_quantity;
    new.visit_deposit_amount := 0;
  elsif new.work_mode = 'diagnosis' then
    select (value #>> '{}')::numeric into deposit_setting
      from public.system_settings
      where key = 'visit_deposit_amount';
    new.visit_deposit_amount := coalesce(deposit_setting, 0);
    new.total_quoted_amount := 0;
  end if;
  return new;
end;
$$;

drop trigger if exists service_orders_enforce_pricing on public.service_orders;
create trigger service_orders_enforce_pricing
before insert on public.service_orders
for each row execute function public.enforce_service_order_pricing();

commit;

-- Verificación rápida: 6 servicios de catálogo, y el trigger instalado.
select count(*) as fixed_price_services_count from public.fixed_price_services;
select tgname from pg_trigger where tgname = 'service_orders_enforce_pricing';
