-- ServiCasa — permite que order_quote_items acepte ítems del catálogo de
-- servicios (services / service_id, el tarifario de 104 ítems de Electricidad)
-- y repuestos/materiales (item_type = 'material'), no solo categorías de
-- service_categories como hasta ahora.
--
-- Por qué hace falta: el trigger apply_catalog_price_to_quote_item (creado en
-- enable_quote_catalog.sql) exige category_id no nulo en TODO insert/update, y
-- fuerza item_type := 'labor' siempre — así que hoy es imposible guardar un
-- ítem que venga de `services` (via service_id) o un repuesto (item_type =
-- 'material'): el insert falla o el trigger le pisa el tipo/precio real.
--
-- Ejecutar UNA sola vez en el SQL Editor, después de
-- link_quote_items_to_services_catalog.sql (ya corrido: agrega
-- order_quote_items.service_id).

begin;

create or replace function public.apply_catalog_price_to_quote_item()
returns trigger language plpgsql set search_path = '' as $$
declare
  catalog_item public.service_categories%rowtype;
  service_item public.services%rowtype;
begin
  if new.category_id is not null then
    -- Camino existente: ítem de mano de obra tomado de service_categories
    -- (Refrigeración, Cerrajería, Soldadura y el genérico de Electricidad).
    select * into catalog_item from public.service_categories where id = new.category_id and is_active = true;
    if not found then raise exception 'La categoría seleccionada no está activa'; end if;
    new.description := catalog_item.name;
    new.unit := catalog_item.unit;
    new.unit_price := catalog_item.base_price;
    new.item_type := 'labor';
  elsif new.service_id is not null then
    -- Camino nuevo: ítem de mano de obra tomado del tarifario real en
    -- `services` (los 104 ítems de Electricidad con subcategoria).
    select * into service_item from public.services where id = new.service_id and active = true;
    if not found then raise exception 'El servicio seleccionado no está activo'; end if;
    new.description := service_item.name;
    new.unit := coalesce(nullif(trim(new.unit), ''), 'unidad');
    new.unit_price := service_item.price;
    new.item_type := 'labor';
  elsif new.item_type = 'material' then
    -- Repuesto/material: no hay catálogo publicado que validar acá. El
    -- técnico carga descripción, unidad y precio directamente (tomados del
    -- costEstimate de public.materials en el frontend). Las columnas
    -- description/unit_price ya tienen sus propios check constraints en la
    -- tabla (descripción no vacía, precio >= 0).
    null;
  else
    -- Ni categoría, ni servicio, ni material: no se acepta un ítem de mano de
    -- obra "suelto" sin origen de catálogo.
    raise exception 'Cada ítem de mano de obra debe provenir del catálogo publicado (categoría o servicio)';
  end if;
  return new;
end;
$$;

drop trigger if exists order_quote_items_apply_catalog_price on public.order_quote_items;
create trigger order_quote_items_apply_catalog_price before insert or update on public.order_quote_items
for each row execute function public.apply_catalog_price_to_quote_item();

commit;
