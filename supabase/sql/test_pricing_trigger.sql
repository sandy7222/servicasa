-- Prueba del trigger anti-manipulación de precios. Simula un cliente que
-- pide "Cambio de tomacorriente" (precio real $8.000) pero manda
-- total_quoted_amount = 1 en el insert, como si hubiera editado la request
-- a mano. Todo corre dentro de una transacción que se revierte al final
-- (rollback), así no queda ninguna orden de prueba en la base real.

begin;

insert into public.service_orders (
  title, description, service_type, priority, status, service_status,
  work_mode, quote_status, payment_status,
  visit_deposit_amount, total_quoted_amount,
  fixed_price_service_id, fixed_price_quantity,
  total_paid_amount, extra_amount, scheduled_date,
  customer_id, client_name, client_phone, client_address, client_neighborhood
)
select
  'Cambio de tomacorriente (PRUEBA)', 'Prueba de manipulación de precio', 'Electricidad', 'media', 'assigned', 'pending',
  'direct', 'none', 'pending',
  0, 1, -- <- el cliente "malicioso" manda total_quoted_amount = 1
  'electricidad-tomacorriente', 1,
  0, 0, current_date,
  id, name, phone, 'Domicilio de prueba', 'Barrio de prueba'
from public.customers limit 1
returning id, title, total_quoted_amount, fixed_price_service_id, fixed_price_quantity;

rollback;
