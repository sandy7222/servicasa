-- Función de trigger interna (paga la liquidación 'visita'), no debe ser
-- invocable directo vía /rest/v1/rpc/... — mismo criterio que
-- create_settlement_on_order_completed_and_paid, que ya tenía PUBLIC
-- revocado. Cerrado a partir del hallazgo del advisor de seguridad.
revoke execute on function public.create_visit_settlement_on_started() from public;
revoke execute on function public.create_visit_settlement_on_started() from anon;
revoke execute on function public.create_visit_settlement_on_started() from authenticated;
