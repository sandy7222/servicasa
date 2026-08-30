-- La liquidación de la visita de diagnóstico se dispara cuando
-- service_orders.status pasa a 'in_progress' por primera vez: es más
-- temprano y cubre más casos reales que "quote sent" (incluye el caso de
-- una orden cancelada después de iniciada la visita, admin emergency
-- override incluido). Ver docs/adr-liquidacion-visita.md.
create unique index technician_settlements_one_visita_per_order
on public.technician_settlements (order_id) where settlement_type = 'visita';

create or replace function public.create_visit_settlement_on_started()
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
  v_payment_transaction_id uuid;
begin
  if new.work_mode <> 'diagnosis' then
    return new;
  end if;
  if new.assigned_technician_id is null then
    return new;
  end if;
  if exists (
    select 1 from public.technician_settlements
    where order_id = new.id and settlement_type = 'visita'
  ) then
    return new;
  end if;
  v_gross := coalesce(new.visit_deposit_amount, 0);
  if v_gross <= 0 then
    return new;
  end if;
  select id, coalesce(mp_fee_amount, 0)
  into v_payment_transaction_id, v_fee
  from public.payment_transactions
  where order_id = new.id and payment_type = 'visit_deposit' and status = 'approved'
  order by created_at desc
  limit 1;
  select coalesce((value#>>'{}')::numeric, 0.15) into v_commission_rate
  from public.system_settings where key = 'visit_settlement_commission_rate';
  select coalesce((value#>>'{}')::int, 7) into v_release_days
  from public.system_settings where key = 'settlement_release_days';
  v_commission := round(v_gross * coalesce(v_commission_rate, 0.15), 2);
  v_net := greatest(0, v_gross - v_commission - coalesce(v_fee, 0));
  insert into public.technician_settlements (
    order_id, technician_id, payment_transaction_id, settlement_type,
    gross_amount, platform_commission_amount, payment_fee_amount, net_amount,
    status, release_date
  ) values (
    new.id, new.assigned_technician_id, v_payment_transaction_id, 'visita',
    v_gross, v_commission, coalesce(v_fee, 0), v_net,
    'pending_release', now() + (coalesce(v_release_days, 7) * interval '1 day')
  )
  on conflict (order_id) where settlement_type = 'visita' do nothing;
  return new;
end;
$function$;

create trigger trg_create_visit_settlement_on_started
after update of status on public.service_orders
for each row
when (new.status = 'in_progress')
execute function create_visit_settlement_on_started();
