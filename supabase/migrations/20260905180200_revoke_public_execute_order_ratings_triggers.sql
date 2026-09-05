-- Las funciones de trigger de order_ratings no estan pensadas para
-- invocarse como RPC directo (RETURNS TRIGGER ya lo impide en la
-- practica, pero el advisor de seguridad las marca igual porque anon/
-- authenticated tienen EXECUTE por default privileges). Mismo criterio
-- que revoke_public_execute_create_visit_settlement_on_started.
revoke execute on function public.recalc_technician_rating() from public, anon, authenticated;
revoke execute on function public.order_ratings_protect_immutable() from public, anon, authenticated;
