-- Alertas de seguridad de Supabase (4/11/2026): funciones SECURITY DEFINER que cualquiera podia ejecutar como RPC.
-- Se cierran las que nadie llama desde la app:
--  * disparadores (los ejecuta la base al disparar el trigger; no necesitan permiso de usuario)
--  * funciones internas llamadas solo por otras funciones SECURITY DEFINER o por pg_cron (corre como postgres)
-- NO se toca technician_assigned_to_customer: la usa una politica RLS de customers.
revoke execute on function public.lock_technician_review_fields() from public, anon, authenticated;
revoke execute on function public.notify_technician_en_route() from public, anon, authenticated;
revoke execute on function public.start_diagnosis_execution_after_payment() from public, anon, authenticated;
revoke execute on function public.trg_recalc_technician_coverage() from public, anon, authenticated;
revoke execute on function public.expire_stale_technician_offers() from public, anon, authenticated;
revoke execute on function public.offer_to_next_eligible_technician(uuid) from public, anon, authenticated;
revoke execute on function public.recalc_technician_coverage(uuid) from public, anon, authenticated;

-- Funcion de calculo puro: ruta de busqueda fija.
alter function public.ar_haversine_km(numeric, numeric, numeric, numeric) set search_path = '';
