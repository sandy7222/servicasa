-- Problema 8 (Sandy): el toast decía "Inventario descontado" pero
-- materials.stock nunca se movía. Causa: materials_write_admin exige
-- is_admin() para CUALQUIER escritura en materials -- un técnico no tiene
-- permiso para actualizar el stock directamente, y como el UPDATE del
-- cliente no usaba .select(), RLS lo bloqueaba en silencio (0 filas, sin
-- error) mientras el estado optimista de React ya mostraba el descuento.
--
-- En vez de abrir materials a escritura de cualquier técnico autenticado
-- (dejaría que cualquiera pise el stock de cualquier material sin relación
-- con su orden), se valida acá adentro que el llamador sea el técnico
-- asignado a la orden (o admin) y se hace todo en un solo paso atómico:
-- mismo patrón que self_register_technician / respond_to_technician_assignment.
create or replace function public.register_material_usage(
  p_order_id uuid,
  p_material_id uuid,
  p_quantity numeric,
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid;
  v_order record;
  v_material record;
  v_used_id uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Tenés que estar autenticado.';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  select id, status, assigned_technician_id into v_order
  from service_orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'Orden no encontrada.';
  end if;

  if not (
    (select is_admin())
    or v_order.assigned_technician_id = (select technician_id from profiles where id = v_uid)
  ) then
    raise exception 'No tenés permiso para registrar materiales en esta orden.';
  end if;

  if v_order.status = 'completed' then
    raise exception 'La orden está cerrada; no se pueden sumar materiales.';
  end if;

  select id, name, unit, stock into v_material
  from materials where id = p_material_id;
  if v_material.id is null then
    raise exception 'Material no encontrado en inventario.';
  end if;

  insert into order_materials_used (order_id, material_id, material_name, quantity, unit, note)
  values (p_order_id, v_material.id, v_material.name, p_quantity, v_material.unit, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_used_id;

  update materials
  set stock = greatest(0, stock - p_quantity)
  where id = v_material.id;

  return v_used_id;
end;
$function$;
