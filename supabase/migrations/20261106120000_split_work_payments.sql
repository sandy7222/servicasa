-- Cobro repartido, Fase 2 (plan-cobro-repartido.md): cobrar el TRABAJO (presupuesto aceptado) con la tarjeta
-- RESERVADA (capture:false) en la cuenta de Mercado Pago del técnico, con la comisión de TecniUrbano
-- (application_fee). Validado en sandbox el 6/11/2026.
--
-- Esta migración es aditiva y NO cambia nada mientras `split_payments_enabled` siga en false (default):
-- el cobro sigue por Checkout Pro a la cuenta de Sandy como hasta hoy.

-- 1) Interruptor general (apagado). Solo admin lo ve/cambia (RLS system_settings_admin_all).
insert into public.system_settings (key, value, value_type, description, visibility)
values (
  'split_payments_enabled',
  'false'::jsonb,
  'boolean',
  'Cobro repartido del trabajo (Mercado Pago Split 1:1 con reserva). false = el trabajo se cobra como siempre (Checkout Pro a la cuenta de la plataforma). true = si el técnico asignado tiene Mercado Pago vinculado, el pago del presupuesto se reserva en SU cuenta con la comisión de platform_commission_rate. Ver plan-cobro-repartido.md.',
  'admin'
)
on conflict (key) do nothing;

-- 2) Datos del pago repartido en payment_transactions.
alter table public.payment_transactions
  add column if not exists split boolean not null default false,
  add column if not exists split_technician_id uuid references public.technicians(id) on delete set null,
  add column if not exists collector_mp_user_id text,
  add column if not exists application_fee numeric,
  add column if not exists authorized_at timestamptz,
  add column if not exists captured_at timestamptz;

alter table public.payment_transactions drop constraint if exists payment_transactions_application_fee_check;
alter table public.payment_transactions
  add constraint payment_transactions_application_fee_check check (application_fee is null or application_fee >= 0);

-- Un pago repartido siempre sabe de qué técnico es (su token es el único que puede consultarlo/capturarlo).
alter table public.payment_transactions drop constraint if exists payment_transactions_split_technician_check;
alter table public.payment_transactions
  add constraint payment_transactions_split_technician_check check (not split or split_technician_id is not null);

-- Estado nuevo: 'authorized' = la tarjeta quedó reservada (todavía no se cobró).
alter table public.payment_transactions drop constraint if exists payment_transactions_status_check;
alter table public.payment_transactions
  add constraint payment_transactions_status_check
  check (status = any (array['pending', 'authorized', 'approved', 'rejected', 'cancelled', 'refunded']));

create index if not exists payment_transactions_split_authorized_idx
  on public.payment_transactions (authorized_at)
  where split and status = 'authorized';

-- Candado contra doble cobro (doble clic, dos pestañas): un solo pago repartido vigente por presupuesto.
-- Si una segunda reserva llega a autorizarse, el registro falla y el servidor la cancela en Mercado Pago.
create unique index if not exists payment_transactions_one_split_per_quote
  on public.payment_transactions (quote_id)
  where split and status in ('authorized', 'approved');

-- 3) Riesgo 1 del plan (doble pago): con el cobro repartido el técnico YA recibe su parte en su cuenta de
-- Mercado Pago. La liquidación manual 'completed_work' (que Sandy transfiere a mano) tiene que excluir esos
-- montos y sus cargos. Sin pagos repartidos el resultado es idéntico al de antes.
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
  v_split_amount numeric;
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

  -- Lo cobrado por reparto (reservado o ya capturado) no pasa por la cuenta de la plataforma.
  select coalesce(sum(amount), 0) into v_split_amount
  from public.payment_transactions
  where order_id = new.id and split and status in ('authorized', 'approved');

  v_gross := coalesce(new.total_paid_amount, 0) - coalesce(v_visita_gross, 0) - coalesce(v_split_amount, 0);
  if v_gross <= 0 then
    return new;
  end if;

  select coalesce((value#>>'{}')::numeric, 0.17) into v_commission_rate
  from public.system_settings where key = 'platform_commission_rate';

  select coalesce((value#>>'{}')::int, 7) into v_release_days
  from public.system_settings where key = 'settlement_release_days';

  select coalesce(sum(mp_fee_amount), 0) into v_fee
  from public.payment_transactions
  where order_id = new.id and status = 'approved' and not split;
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
