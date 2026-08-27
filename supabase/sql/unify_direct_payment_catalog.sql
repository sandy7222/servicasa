-- ServiCasa — unifica el catálogo de "pago directo" (Sé qué trabajo necesito)
-- con el catálogo real de 233 servicios (`services`), en vez de la lista
-- chica hardcodeada de 6 ítems (FIXED_PRICE_SERVICES / fixed_price_services)
-- que solo tenía 1-2 opciones por rubro.
--
-- Motivo: Sandy probó el flujo de invitado eligiendo Soldadura y solo vio UNA
-- opción ("Soldadura puntual de reja") — el catálogo real de Soldadura tiene
-- 16 servicios reales con precio de mercado. La lista chica no tenía sentido
-- una vez que ya cargamos el tarifario completo de los 8 rubros.
--
-- Cambios:
--  1. `service_orders.fixed_price_service_id` era `text` (apuntaba a los IDs
--     de texto de fixed_price_services, ej. 'soldadura-reja') y pasa a `uuid`
--     apuntando a `services(id)` — services es una tabla real con id uuid,
--     así que hace falta convertir el tipo de columna, no solo la FK. Se
--     limpia primero cualquier valor viejo que no sea un uuid válido (si
--     hubiera alguna orden de prueba con el catálogo chico) para que el
--     cambio de tipo no falle.
--  2. Se borra `fixed_price_services` (ya no hace falta: `services` ya tiene
--     RLS de lectura pública y es la fuente de verdad en todos lados).
--  3. El trigger `enforce_service_order_pricing()` (creado en
--     enforce_direct_payment_pricing.sql) ahora recalcula el precio de una
--     orden 'direct' consultando `services` en vez de `fixed_price_services`.
--     Sigue ignorando cualquier total_quoted_amount que mande el cliente —
--     la protección contra manipulación de precio sigue intacta, solo cambia
--     de dónde saca el precio confiable.
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

-- Limpieza previa: cualquier fixed_price_service_id viejo que no sea un uuid
-- válido (los ids del catálogo chico eran texto, ej. 'soldadura-reja') se
-- pone en null para poder convertir la columna sin que falle el cast.
update public.service_orders
set fixed_price_service_id = null
where fixed_price_service_id is not null
  and fixed_price_service_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

alter table public.service_orders
  drop constraint if exists service_orders_fixed_price_service_id_fkey;

alter table public.service_orders
  alter column fixed_price_service_id type uuid using fixed_price_service_id::uuid;

drop table if exists public.fixed_price_services cascade;

alter table public.service_orders
  add constraint service_orders_fixed_price_service_id_fkey
  foreign key (fixed_price_service_id) references public.services(id);

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
    select price into catalog_price
      from public.services
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

commit;

-- Verificación: la función y el trigger siguen instalados, la tabla vieja ya
-- no existe, y la columna ahora es uuid.
select tgname from pg_trigger where tgname = 'service_orders_enforce_pricing';
select to_regclass('public.fixed_price_services') as tabla_vieja_deberia_ser_null;
select data_type from information_schema.columns
where table_schema = 'public' and table_name = 'service_orders' and column_name = 'fixed_price_service_id';
