-- Prueba de que la liquidación 'visita' (create_visit_settlement_on_started,
-- disparada al pasar a in_progress) y la liquidación 'completed_work'
-- (create_settlement_on_order_completed_and_paid, corregida para excluir lo
-- ya liquidado como visita) no se pisan ni duplican el pago al técnico:
-- la suma de las dos, tanto en bruto como reconstruida (neto + comisión +
-- fee de MP), debe coincidir exactamente con total_paid_amount. Ver
-- docs/adr-liquidacion-visita.md, punto 2 del pedido de Sandy.
--
-- Corre dentro de una transacción que se revierte al final (rollback), así
-- no queda ninguna orden ni liquidación de prueba en la base real. Mismo
-- criterio que test_pricing_trigger.sql / test_customer_order_draft_pricing_trigger.sql.
--
-- Requiere al menos un cliente y un técnico reales (usa el primero de cada
-- tabla).
--
-- Escenario: seña de $50.000 (fee MP $875) pagada y visita iniciada
-- (in_progress) -> se liquida 'visita'. Después se acepta y paga el saldo
-- de $68.800 (fee MP $1.204) y se completa la orden -> se liquida
-- 'completed_work'. total_paid_amount = 50000 + 68800 = 118800.

begin;

do $$
declare
  v_customer_id uuid;
  v_technician_id uuid;
  v_order_id uuid;
  v_total_paid numeric := 118800;
  v_settlement_count int;
  v_sum_gross numeric;
  v_sum_reconstructed numeric;
  v_visita_gross numeric; v_visita_fee numeric; v_visita_comm numeric; v_visita_net numeric;
  v_cw_gross numeric; v_cw_fee numeric; v_cw_comm numeric; v_cw_net numeric;
begin
  select id into v_customer_id from public.customers limit 1;
  select id into v_technician_id from public.technicians limit 1;

  insert into public.service_orders (
    title, service_type, scheduled_date, customer_id, client_name, service_status,
    work_mode, status, assigned_technician_id, visit_deposit_amount,
    payment_status, technician_response_status
  ) values (
    'TEST doble liquidacion visita+completed_work', 'Electricidad', now(), v_customer_id, 'TEST CLIENT', 'pending',
    'diagnosis', 'assigned', v_technician_id, 50000,
    'deposit_paid', 'accepted'
  ) returning id into v_order_id;

  -- Seña pagada -> visita iniciada -> debe disparar la liquidación 'visita'.
  insert into public.payment_transactions (order_id, payment_type, status, amount, mp_fee_amount)
  values (v_order_id, 'visit_deposit', 'approved', 50000, 875);

  update public.service_orders set status = 'in_progress' where id = v_order_id;

  -- Presupuesto aceptado y saldo pagado -> orden completada -> debe
  -- disparar la liquidación 'completed_work', SIN volver a contar la seña.
  insert into public.payment_transactions (order_id, payment_type, status, amount, mp_fee_amount)
  values (v_order_id, 'balance_payment', 'approved', 68800, 1204);

  update public.service_orders
  set total_paid_amount = v_total_paid, status = 'completed', payment_status = 'paid_in_full'
  where id = v_order_id;

  select count(*) into v_settlement_count from public.technician_settlements where order_id = v_order_id;
  if v_settlement_count <> 2 then
    raise exception 'FALLO: esperaba exactamente 2 liquidaciones (visita + completed_work), hay %', v_settlement_count;
  end if;

  select gross_amount, payment_fee_amount, platform_commission_amount, net_amount
  into v_visita_gross, v_visita_fee, v_visita_comm, v_visita_net
  from public.technician_settlements where order_id = v_order_id and settlement_type = 'visita';

  select gross_amount, payment_fee_amount, platform_commission_amount, net_amount
  into v_cw_gross, v_cw_fee, v_cw_comm, v_cw_net
  from public.technician_settlements where order_id = v_order_id and settlement_type = 'completed_work';

  select sum(gross_amount) into v_sum_gross
  from public.technician_settlements where order_id = v_order_id;

  select sum(net_amount + platform_commission_amount + payment_fee_amount) into v_sum_reconstructed
  from public.technician_settlements where order_id = v_order_id;

  if v_sum_gross <> v_total_paid then
    raise exception 'FALLO: suma de gross_amount (%) != total pagado por el cliente (%)', v_sum_gross, v_total_paid;
  end if;

  if v_sum_reconstructed <> v_total_paid then
    raise exception 'FALLO: suma reconstruida neto+comision+fee (%) != total pagado (%)', v_sum_reconstructed, v_total_paid;
  end if;

  raise notice 'OK visita: gross=% fee=% comision=% neto=%', v_visita_gross, v_visita_fee, v_visita_comm, v_visita_net;
  raise notice 'OK completed_work: gross=% fee=% comision=% neto=%', v_cw_gross, v_cw_fee, v_cw_comm, v_cw_net;
  raise notice 'OK: suma de las 2 liquidaciones = % (= total pagado por el cliente, sin faltantes ni duplicados)', v_sum_gross;
end $$;

rollback;
