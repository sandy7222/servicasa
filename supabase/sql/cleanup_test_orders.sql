-- Limpieza de las órdenes de prueba generadas hoy probando el flujo de pago.
-- Borra TODAS las service_orders actuales (y lo que cuelga de ellas) para
-- arrancar de cero y seguir probando sin el ruido acumulado.
--
-- Orden de borrado (según las foreign keys reales de esta base):
--   1) technician_settlements y payment_transactions referencian a
--      service_orders con ON DELETE RESTRICT — hay que borrarlas primero o
--      el borrado de las órdenes falla.
--   2) order_checklist_items, order_time_logs, order_notes,
--      order_materials_used, order_events, order_signatures, order_quotes,
--      order_diagnosis_photos son ON DELETE CASCADE — se borran solas al
--      borrar la orden, no hace falta tocarlas a mano.
--   3) guest_checkout_drafts no tiene foreign key a service_orders (por
--      diseño — existe antes de que la orden exista), así que se limpia
--      aparte.
--
-- Esto NO borra: customers, technicians, services/categorías, ni cuentas de
-- usuario. Es solo el historial operativo de órdenes/pagos de prueba.

begin;

delete from public.technician_settlements;
delete from public.payment_transactions;
delete from public.service_orders;
delete from public.guest_checkout_drafts;

commit;

-- Verificación: todo en cero.
select
  (select count(*) from public.service_orders) as ordenes,
  (select count(*) from public.payment_transactions) as pagos,
  (select count(*) from public.technician_settlements) as liquidaciones,
  (select count(*) from public.guest_checkout_drafts) as borradores_invitado;
