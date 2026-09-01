-- Prueba rollback-safe de las dos barreras server-side contra manipulación
-- de importes. No usa IDs ni precios hardcodeados: toma un cliente y un
-- servicio activos reales, por lo que sigue siendo válida al cambiar el
-- catálogo. Si cualquier comprobación es falsa, la consulta falla antes del
-- ROLLBACK y el runner puede detectarlo.

begin;

create temp table test_results (test text, ok boolean, detail text);

with selected_customer as (
  select id, name, phone
  from public.customers
  order by id
  limit 1
), selected_service as (
  select id, price, category
  from public.services
  where active = true
    and category in (
      'Plomería', 'Electricidad', 'Reparaciones del hogar',
      'Mantenimiento general', 'Instalación de equipos', 'Cerrajería',
      'Refrigeración', 'Soldadura'
    )
  order by id
  limit 1
), inserted_order as (
  insert into public.service_orders (
    title, description, service_type, priority, status, service_status,
    work_mode, quote_status, payment_status, visit_deposit_amount,
    total_quoted_amount, fixed_price_service_id, fixed_price_quantity,
    total_paid_amount, extra_amount, scheduled_date, customer_id,
    client_name, client_phone, client_address, client_neighborhood
  )
  select
    'TEST precio fijo manipulado', 'La request intenta enviar importe 1',
    s.category::public.service_type, 'media', 'assigned', 'pending', 'direct', 'none', 'pending',
    999999, 1, s.id, 2, 0, 0, current_date, c.id, c.name, c.phone,
    'Domicilio de prueba', 'Barrio de prueba'
  from selected_customer c cross join selected_service s
  returning total_quoted_amount, visit_deposit_amount, fixed_price_service_id,
    fixed_price_quantity
)
insert into test_results
select
  'precio fijo se recalcula desde services y anula la seña enviada',
  o.total_quoted_amount = s.price * o.fixed_price_quantity
    and o.visit_deposit_amount = 0
    and o.fixed_price_service_id = s.id,
  'importe=' || o.total_quoted_amount || ', catálogo=' || (s.price * o.fixed_price_quantity)
from inserted_order o cross join selected_service s;

with selected_customer as (
  select id from public.customers order by id limit 1
), inserted_draft as (
  insert into public.customer_order_drafts (customer_id, payment_type, amount, payload)
  select id, 'visit_deposit', 1, jsonb_build_object('title', 'TEST seña manipulada')
  from selected_customer
  returning amount
), configured_deposit as (
  select (value #>> '{}')::numeric as amount
  from public.system_settings
  where key = 'visit_deposit_amount'
)
insert into test_results
select
  'seña del borrador se recalcula desde system_settings',
  d.amount = s.amount,
  'importe=' || d.amount || ', configuración=' || s.amount
from inserted_draft d cross join configured_deposit s;

do $$
begin
  if exists (select 1 from test_results where not ok) then
    raise exception 'Falló una prueba de protección de precios';
  end if;
end $$;

select * from test_results order by test;

rollback;
