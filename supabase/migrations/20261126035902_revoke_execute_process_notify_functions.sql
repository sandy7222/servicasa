-- Son funciones de trigger: nadie necesita llamarlas a mano. El trigger se sigue disparando igual.
revoke all on function public.notify_technician_arrived() from public, anon, authenticated;
revoke all on function public.notify_work_completed() from public, anon, authenticated;
revoke all on function public.notify_order_response() from public, anon, authenticated;
revoke all on function public.notify_payment_received() from public, anon, authenticated;
