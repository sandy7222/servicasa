-- Problema 8 (Sandy), continuación: el fix de isOrderPaymentSettled del lado
-- del cliente no alcanzaba solo -- este trigger de service_orders (defensa
-- en profundidad server-side, independiente del gate de React) todavía
-- exigía quote_status='accepted' AND payment_status='paid_in_full' para
-- diagnóstico, exactamente la regla vieja que se acababa de relajar del
-- lado del cliente. Encontrado en vivo: el click de "Salí hacia el
-- domicilio" en el navegador seguía devolviendo 400
-- ("El trabajo presupuestado solo puede iniciarse tras aceptación y pago
-- confirmado") pese al cambio de canExecutePaidWork -> isOrderPaymentSettled,
-- porque la base rechazaba el UPDATE antes de que ese cambio pudiera importar.
-- Ahora espeja isOrderPaymentSettled exactamente: diagnóstico alcanza con la
-- seña, sin mirar quote_status. work_mode='direct' y el chequeo de
-- technician_response_status quedan sin cambios.
create or replace function public.prevent_unpaid_execution_timer()
returns trigger
language plpgsql
set search_path to ''
as $function$
begin
  if new.status = 'in_progress' and new.work_mode = 'diagnosis'
     and new.payment_status not in ('deposit_paid', 'paid_in_full') then
    raise exception 'El trabajo presupuestado solo puede iniciarse tras confirmarse el pago de la seña';
  end if;

  if new.status = 'in_progress' and new.work_mode = 'direct'
     and new.payment_status <> 'paid_in_full' then
    raise exception 'El trabajo directo solo puede iniciarse tras el pago completo confirmado';
  end if;

  if new.status = 'in_progress' and new.technician_response_status <> 'accepted' then
    raise exception 'El técnico todavía no aceptó esta asignación';
  end if;

  return new;
end;
$function$;
