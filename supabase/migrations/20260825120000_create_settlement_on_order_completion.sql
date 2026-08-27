-- Crea la liquidación (technician_settlements) del técnico cuando se
-- cumplen las dos condiciones: la orden queda 'completed' Y el pago final
-- queda 'paid_in_full' — lo que pase último de las dos. Antes de esta
-- migración no existía ningún código (frontend, API o SQL) que diera de
-- alta la primera fila de una liquidación (hallazgo de la Fase 7).
--
-- Decisión de producto confirmada por Sandy: si un cierre excepcional deja
-- la orden 'completed' sin que el pago se confirme nunca (el admin
-- exceptuó el cobro a propósito), el técnico no cobra ese trabajo — no
-- hay mecanismo manual de creación de liquidación. Solo automático.
--
-- Idempotencia: status y payment_status son columnas independientes que
-- pueden actualizarse en momentos distintos, así que el trigger se
-- dispara en cada UPDATE de esas columnas — se revisa el estado COMPLETO
-- en cada disparo (no lo que cambió puntualmente), y se verifica que no
-- exista ya una liquidación para esa orden antes de insertar, con un
-- índice único parcial + ON CONFLICT DO NOTHING como defensa adicional.
--
-- Montos: todos de datos reales, nada hardcodeado.
--   - gross_amount      = service_orders.total_paid_amount (lo efectivamente cobrado)
--   - payment_fee_amount = suma real de payment_transactions.mp_fee_amount (costo real de Mercado Pago)
--   - platform_commission_amount = gross * platform_commission_rate (system_settings, Fase 7)
--   - release_date es ahora + settlement_release_days (system_settings) — conecta con el cron de la Fase 5.
--
-- Fuera de alcance: settlement_type='rejected_visit' (cliente rechaza el
-- presupuesto pero el técnico ya hizo la visita) no se cubre acá — es un
-- evento distinto a "orden completada", no fue pedido.

create unique index technician_settlements_one_completed_work_per_order
  on public.technician_settlements (order_id)
  where settlement_type = 'completed_work';

create or replace function public.create_settlement_on_order_completed_and_paid()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_commission_rate numeric;
  v_release_days integer;
  v_gross numeric;
  v_fee numeric;
  v_commission numeric;
  v_net numeric;
begin
  -- Las dos condiciones, evaluadas AHORA (no lo que cambió en este UPDATE
  -- puntual) — así es idempotente sin importar en qué orden se toquen
  -- status y payment_status.
  if new.status <> 'completed' or new.payment_status <> 'paid_in_full' then
    return new;
  end if;
  if new.assigned_technician_id is null then
    return new;
  end if;

  -- Defensa en profundidad además del índice único: si ya existe, no hacer nada.
  if exists (
    select 1 from public.technician_settlements
    where order_id = new.id and settlement_type = 'completed_work'
  ) then
    return new;
  end if;

  v_gross := coalesce(new.total_paid_amount, 0);
  if v_gross <= 0 then
    return new; -- nada cobrado realmente, nada que liquidar
  end if;

  select coalesce((value#>>'{}')::numeric, 0.17) into v_commission_rate
  from public.system_settings where key = 'platform_commission_rate';

  select coalesce((value#>>'{}')::int, 7) into v_release_days
  from public.system_settings where key = 'settlement_release_days';

  select coalesce(sum(mp_fee_amount), 0) into v_fee
  from public.payment_transactions
  where order_id = new.id and status = 'approved';

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
$$;

drop trigger if exists trg_create_settlement_on_completion on public.service_orders;
create trigger trg_create_settlement_on_completion
  after update of status, payment_status on public.service_orders
  for each row
  when (new.status = 'completed' and new.payment_status = 'paid_in_full')
  execute function public.create_settlement_on_order_completed_and_paid();

revoke execute on function public.create_settlement_on_order_completed_and_paid() from public, anon, authenticated;
