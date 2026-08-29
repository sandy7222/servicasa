-- Reemplaza el DELETE real que un cliente podia hacer sobre sus propias
-- ordenes canceladas (policy service_orders_delete_customer_cancelled,
-- migracion 20260821020000) por un ocultamiento no destructivo. Esa policy
-- explica los 2 incidentes de "filas que desaparecen sin rastro" de hoy
-- (432efd32, fa84ca80) - eran ordenes canceladas de Julian, y el boton
-- "Eliminar orden cancelada" de su propio portal hacia justamente eso, un
-- DELETE real. Mismo principio que "cancelar nunca borra" aplicado ahora
-- tambien a lo que el cliente hace con sus propios pedidos.

alter table public.service_orders add column hidden_from_customer_at timestamptz;

-- SECURITY DEFINER en vez de una policy UPDATE amplia: evita darle al
-- cliente permiso de UPDATE general sobre service_orders (que podria
-- usarse para tocar otras columnas) - la funcion solo permite exactamente
-- esta escritura puntual, sobre su propia orden cancelada.
create or replace function public.hide_own_cancelled_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.service_orders
  set hidden_from_customer_at = now()
  where id = p_order_id
    and status = 'cancelled'
    and customer_id = (select customer_id from public.profiles where id = auth.uid());
end;
$$;

grant execute on function public.hide_own_cancelled_order(uuid) to authenticated;

drop policy if exists "service_orders_delete_customer_cancelled" on public.service_orders;
