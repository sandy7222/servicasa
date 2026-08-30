-- Bug de prioridad alta (Sandy), parte 2: customer_order_drafts (la tabla
-- que arma el borrador y dispara el cobro de Mercado Pago ANTES de que
-- exista la orden) no tenía ningún trigger que validara su columna amount
-- contra system_settings -- a diferencia de service_orders, que ya está
-- protegido por enforce_service_order_pricing. Hoy la tabla tiene RLS
-- habilitado con CERO políticas (confirmado: default-deny total para
-- anon/authenticated, ya señalado como INFO en los advisors de Fase 10),
-- así que solo el service role (los dos endpoints de Vercel) puede escribir
-- acá -- ninguno de los dos confía en un monto que mande el cliente para
-- work_mode='diagnosis' (ya lo recalculan ellos mismos). Este trigger es
-- defensa en profundidad real, mismo criterio que enforce_service_order_pricing:
-- protege contra cualquier futuro camino de escritura (una policy que se
-- agregue después, un dashboard de admin, un bug de migración) sin
-- necesitar que el que escribe se acuerde de recalcular bien. Alcance:
-- solo payment_type='visit_deposit' (lo que pidió Sandy) -- full_advance
-- (precio fijo) queda igual que estaba, ya se recalcula server-side contra
-- el catálogo real en request-service.ts/guest-checkout.ts, mismo nivel de
-- confianza que antes; no es parte de este bug.
create or replace function public.enforce_customer_order_draft_pricing()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  deposit_setting numeric(12,2);
begin
  if new.payment_type = 'visit_deposit' then
    select (value #>> '{}')::numeric into deposit_setting
      from public.system_settings
      where key = 'visit_deposit_amount';
    new.amount := coalesce(deposit_setting, 0);
  end if;
  return new;
end;
$function$;

create trigger customer_order_drafts_enforce_pricing
before insert on public.customer_order_drafts
for each row execute function enforce_customer_order_draft_pricing();
