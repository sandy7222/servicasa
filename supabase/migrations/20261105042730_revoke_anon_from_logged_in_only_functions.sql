-- Funciones que la app solo llama con sesion iniciada (y que ya rechazan a anon por dentro).
-- Se les quita el permiso a PUBLIC y anon; authenticated y service_role lo conservan.
-- NO se tocan get_account_invite (la usa la pagina de invitacion antes del registro)
-- ni technician_assigned_to_customer (la usa una politica RLS de customers).
revoke execute on function public.redeem_account_invite(text) from public, anon;
revoke execute on function public.self_register_technician(text, text, text, uuid[]) from public, anon;
revoke execute on function public.self_register_technician(text, text, text, uuid[], text) from public, anon;
revoke execute on function public.hide_own_cancelled_order(uuid) from public, anon;
revoke execute on function public.register_material_usage(uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.respond_to_technician_assignment(uuid, text) from public, anon;
revoke execute on function public.localities_within_radius(numeric, numeric, numeric) from public, anon;

grant execute on function public.redeem_account_invite(text) to authenticated, service_role;
grant execute on function public.self_register_technician(text, text, text, uuid[]) to authenticated, service_role;
grant execute on function public.self_register_technician(text, text, text, uuid[], text) to authenticated, service_role;
grant execute on function public.hide_own_cancelled_order(uuid) to authenticated, service_role;
grant execute on function public.register_material_usage(uuid, uuid, numeric, text) to authenticated, service_role;
grant execute on function public.respond_to_technician_assignment(uuid, text) to authenticated, service_role;
grant execute on function public.localities_within_radius(numeric, numeric, numeric) to authenticated, service_role;
