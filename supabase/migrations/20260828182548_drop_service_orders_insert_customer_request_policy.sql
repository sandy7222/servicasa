-- El frontend ya no inserta directo en service_orders para un cliente
-- logueado (ver customer_order_drafts + api/orders/request-service.ts):
-- toda creacion real pasa por el webhook via supabaseAdmin (service role,
-- no depende de RLS). Dejar esta politica viva permitia que un cliente
-- recreara el bug de fondo llamando directo a la API REST de Supabase con
-- su propio JWT (sin pasar por la app), insertando una orden con
-- payment_status='pending' con apariencia operativa sin haber pagado nada
-- -- exactamente lo que este cambio busca impedir.
drop policy if exists "service_orders_insert_customer_request" on public.service_orders;
