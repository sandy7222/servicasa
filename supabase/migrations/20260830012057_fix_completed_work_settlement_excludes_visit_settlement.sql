-- El bruto de completed_work ya no puede ser total_paid_amount completo si
-- existe una liquidación 'visita' separada para la misma orden (ver
-- create_visit_settlement_on_started, migración siguiente): hay que restar
-- lo ya liquidado como visita (monto y fee de MP) antes de calcular
-- comisión y neto del trabajo completado, o el técnico cobra la seña dos
-- veces. Ver docs/adr-liquidacion-visita.md.
create or replace function public.create_settlement_on_order_completed_and_paid()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_commission_rate numeric;
  v_release_days integer;
  v_gross numeric;
  v_fee numeric;
  v_commission numeric;
  v_net numeric;
  v_visita_gross numeric;
  v_visita_fee numeric;
begin
  if new.status <> 'completed' or new.payment_status <> 'paid_in_full' then
    return new;
  end if;
  if new.assigned_technician_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.technician_settlements
    where order_id = new.id and settlement_type = 'completed_work'
  ) then
    return new;
  end if;
  select coalesce(sum(gross_amount), 0), coalesce(sum(payment_fee_amount), 0)
  into v_visita_gross, v_visita_fee
  from public.technician_settlements
  where order_id = new.id and settlement_type = 'visita';
  v_gross := coalesce(new.total_paid_amount, 0) - coalesce(v_visita_gross, 0);
  if v_gross <= 0 then
    return new;
  end if;
  select coalesce((value#>>'{}')::numeric, 0.17) into v_commission_rate
  from public.system_settings where key = 'platform_commission_rate';
  select coalesce((value#>>'{}')::int, 7) into v_release_days
  from public.system_settings where key = 'settlement_release_days';
  select coalesce(sum(mp_fee_amount), 0) into v_fee
  from public.payment_transactions
  where order_id = new.id and status = 'approved';
  v_fee := greatest(0, v_fee - coalesce(v_visita_fee, 0));
  v_commission := round(v_gross * coalesce(v_commission_rate, 0.17), 2);
  v_net := greatest(0, v_gross - v_commission - v_fee);
  insert into public.technician_settlements (
    order_id, technician_id, settlement_type,
    gross_amount, platform_commission_amount, payment_fee_amount, net_amount,
    status, release_date
  ) values (
    new.id, new.assigned_technician_id, 'completed_work',
    v_gross, v_commission, v_fee, v_net,
    'pending_release', now() + (coalesce(v_release_days, 7) * interval '1 day')
  )
  on conflict (order_id) where settlement_type = 'completed_work' do nothing;
  return new;
end;
$function$;
