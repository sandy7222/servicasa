-- Monedero de técnico, monedero de administrador y cola diaria de retiros.
-- Saldo en vivo (nunca un número guardado). Ningún retiro se completa sin
-- referencia real de transferencia cargada por un humano.

-- ============================================================
-- 1. Horario diario configurable + umbral de lotes vencidos
-- ============================================================
insert into public.system_settings (key, value, value_type, visibility, description)
values
  (
    'payout_daily_process_time',
    '"20:00"'::jsonb,
    'text',
    'authenticated',
    'Hora local (America/Argentina/Buenos_Aires, HH:MM) en la que administración procesa la cola diaria de retiros. No dispara transferencias automáticas.'
  ),
  (
    'payout_stale_scheduled_days',
    '1'::jsonb,
    'number',
    'admin',
    'Días desde created_at de un lote scheduled sin cerrar para mostrar alerta en Liquidaciones.'
  )
on conflict (key) do nothing;

-- ============================================================
-- 2. Pedidos de retiro del técnico
-- ============================================================
create table public.technician_payout_requests (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete restrict,
  requested_amount numeric(12,2) not null check (requested_amount > 0),
  paid_amount numeric(12,2) check (paid_amount is null or paid_amount >= requested_amount),
  status text not null default 'pending'
    check (status = any (array['pending'::text, 'processing'::text, 'completed'::text, 'cancelled'::text])),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  transfer_reference text,
  payout_batch_id uuid references public.technician_payout_batches(id) on delete set null,
  settlement_count integer,
  cancelled_by uuid references public.profiles(id) on delete set null,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint technician_payout_requests_completed_needs_reference check (
    status <> 'completed' or (transfer_reference is not null and length(trim(transfer_reference)) > 0)
  )
);

create table public.technician_payout_request_items (
  request_id uuid not null references public.technician_payout_requests(id) on delete cascade,
  settlement_id uuid not null references public.technician_settlements(id) on delete restrict,
  net_amount numeric(12,2) not null check (net_amount >= 0),
  created_at timestamptz not null default now(),
  primary key (request_id, settlement_id)
);

-- Una liquidación no puede estar reservada/pagada en dos pedidos a la vez.
create unique index technician_payout_request_items_settlement_uidx
  on public.technician_payout_request_items (settlement_id);

create index technician_payout_requests_tech_status_idx
  on public.technician_payout_requests (technician_id, status, requested_at desc);

create table public.admin_earnings_withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount numeric(12,2) not null check (amount > 0),
  transfer_reference text not null check (length(trim(transfer_reference)) > 0),
  withdrawn_at timestamptz not null default now(),
  withdrawn_by uuid not null references public.profiles(id) on delete restrict,
  notes text,
  created_at timestamptz not null default now()
);

create index admin_earnings_withdrawals_withdrawn_at_idx
  on public.admin_earnings_withdrawals (withdrawn_at desc);

alter table public.technician_payout_requests enable row level security;
alter table public.technician_payout_request_items enable row level security;
alter table public.admin_earnings_withdrawals enable row level security;

revoke all on public.technician_payout_requests from anon, public;
revoke all on public.technician_payout_request_items from anon, public;
revoke all on public.admin_earnings_withdrawals from anon, public;

grant select on public.technician_payout_requests to authenticated;
grant select on public.technician_payout_request_items to authenticated;
grant select on public.admin_earnings_withdrawals to authenticated;

create policy technician_payout_requests_select on public.technician_payout_requests
  for select to authenticated
  using (
    (select public.is_admin())
    or technician_id in (select profiles.technician_id from public.profiles where profiles.id = (select auth.uid()))
  );

create policy technician_payout_request_items_select on public.technician_payout_request_items
  for select to authenticated
  using (
    (select public.is_admin())
    or request_id in (
      select r.id from public.technician_payout_requests r
      where r.technician_id in (select profiles.technician_id from public.profiles where profiles.id = (select auth.uid()))
    )
  );

create policy admin_earnings_withdrawals_admin_select on public.admin_earnings_withdrawals
  for select to authenticated
  using ((select public.is_admin()));

-- ============================================================
-- 3. Cierre de lote: referencia real obligatoria
-- ============================================================
create or replace function public.close_payout_batch(
  p_batch_id uuid,
  p_transfer_reference text default null,
  p_receipt_url text default null,
  p_destination_last4 text default null
) returns table(closed boolean, settlement_count integer, total_amount numeric, batch_recorded_total numeric)
language plpgsql security definer set search_path = '' as $$
declare
  v_batch public.technician_payout_batches;
  v_count integer;
  v_actual_total numeric;
begin
  if not (select public.is_admin()) then
    raise exception 'Solo administración puede cerrar un lote de pago';
  end if;

  if p_transfer_reference is null or length(trim(p_transfer_reference)) = 0 then
    raise exception 'La referencia real de la transferencia es obligatoria';
  end if;

  update public.technician_payout_batches
  set status = 'completed',
      completed_at = now(),
      completed_by = (select auth.uid()),
      transfer_reference = trim(p_transfer_reference),
      receipt_url = coalesce(p_receipt_url, receipt_url),
      receipt_uploaded_at = case when p_receipt_url is not null then now() else receipt_uploaded_at end,
      destination_last4 = coalesce(p_destination_last4, destination_last4),
      updated_at = now()
  where id = p_batch_id and status = 'scheduled'
  returning * into v_batch;

  if v_batch.id is null then
    return query select false, 0, 0::numeric, 0::numeric;
    return;
  end if;

  with paid_rows as (
    update public.technician_settlements
    set status = 'paid', paid_at = now()
    where payout_batch_id = p_batch_id and status = 'scheduled'
    returning net_amount
  )
  select count(*), coalesce(sum(net_amount), 0) into v_count, v_actual_total from paid_rows;

  insert into public.technician_payout_batch_audit (batch_id, action, performed_by, detail)
  values (
    p_batch_id, 'closed', (select auth.uid()),
    jsonb_build_object(
      'settlement_count', v_count, 'actual_total', v_actual_total,
      'batch_recorded_total', v_batch.total_amount, 'transfer_reference', trim(p_transfer_reference)
    )
  );

  return query select true, v_count, v_actual_total, v_batch.total_amount;
end;
$$;

revoke all on function public.close_payout_batch(uuid, text, text, text) from public, anon;
grant execute on function public.close_payout_batch(uuid, text, text, text) to authenticated;

-- ============================================================
-- 4. Saldos en vivo
-- ============================================================
create or replace function public.technician_wallet_available(p_technician_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(s.net_amount), 0)
  from public.technician_settlements s
  where s.technician_id = p_technician_id
    and s.status = 'released'
    and not exists (
      select 1
      from public.technician_payout_request_items i
      join public.technician_payout_requests r on r.id = i.request_id
      where i.settlement_id = s.id
        and r.status in ('pending', 'processing')
    );
$$;

create or replace function public.admin_platform_wallet_available()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce((
      select sum(s.platform_commission_amount)
      from public.technician_settlements s
      where s.status in ('released', 'scheduled', 'in_transit', 'paid')
    ), 0)
    - coalesce((select sum(w.amount) from public.admin_earnings_withdrawals w), 0);
$$;

revoke all on function public.technician_wallet_available(uuid) from public, anon, authenticated;
revoke all on function public.admin_platform_wallet_available() from public, anon, authenticated;

-- El técnico solo consulta su propio saldo; el admin consulta cualquiera.
create or replace function public.technician_wallet_available_guarded(p_technician_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_own uuid;
begin
  if (select public.is_admin()) then
    return public.technician_wallet_available(p_technician_id);
  end if;
  select technician_id into v_own from public.profiles where id = (select auth.uid());
  if v_own is null or v_own is distinct from p_technician_id then
    raise exception 'No podés consultar el monedero de otro técnico';
  end if;
  return public.technician_wallet_available(p_technician_id);
end;
$$;

create or replace function public.admin_platform_wallet_available_guarded()
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'Solo administración puede ver el monedero de la plataforma';
  end if;
  return public.admin_platform_wallet_available();
end;
$$;

revoke all on function public.technician_wallet_available_guarded(uuid) from public, anon;
revoke all on function public.admin_platform_wallet_available_guarded() from public, anon;
grant execute on function public.technician_wallet_available_guarded(uuid) to authenticated;
grant execute on function public.admin_platform_wallet_available_guarded() to authenticated;

-- ============================================================
-- 5. Pedir retiro (técnico) — reserva liquidaciones de más vieja a más nueva
-- ============================================================
create or replace function public.request_technician_payout(p_amount numeric)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tech uuid;
  v_request_id uuid;
  v_cover numeric;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del retiro tiene que ser mayor a 0';
  end if;

  select technician_id into v_tech from public.profiles where id = (select auth.uid());
  if v_tech is null then
    raise exception 'Solo un técnico puede pedir un retiro';
  end if;

  if not exists (
    select 1 from public.technician_payment_accounts a
    where a.technician_id = v_tech and length(trim(a.cbu_cvu)) = 22
  ) then
    raise exception 'Cargá tu CBU/CVU antes de pedir un retiro';
  end if;

  if public.technician_wallet_available(v_tech) < p_amount then
    raise exception 'El monto supera el saldo disponible';
  end if;

  insert into public.technician_payout_requests (technician_id, requested_amount, status)
  values (v_tech, p_amount, 'pending')
  returning id into v_request_id;

  insert into public.technician_payout_request_items (request_id, settlement_id, net_amount)
  select v_request_id, x.id, x.net_amount
  from (
    select s.id, s.net_amount, s.created_at,
           sum(s.net_amount) over (order by s.created_at, s.id) as running
    from public.technician_settlements s
    where s.technician_id = v_tech
      and s.status = 'released'
      and not exists (
        select 1
        from public.technician_payout_request_items i
        join public.technician_payout_requests r on r.id = i.request_id
        where i.settlement_id = s.id
          and r.status in ('pending', 'processing')
          and r.id is distinct from v_request_id
      )
  ) x
  where (x.running - x.net_amount) < p_amount;

  select coalesce(sum(net_amount), 0) into v_cover
  from public.technician_payout_request_items
  where request_id = v_request_id;

  if v_cover < p_amount then
    raise exception 'No hay liquidaciones liberadas suficientes para cubrir ese monto';
  end if;

  return v_request_id;
end;
$$;

revoke all on function public.request_technician_payout(numeric) from public, anon;
grant execute on function public.request_technician_payout(numeric) to authenticated;

create or replace function public.cancel_technician_payout_request(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.technician_payout_requests;
  v_own uuid;
begin
  select * into v_row from public.technician_payout_requests where id = p_request_id for update;
  if v_row.id is null then
    raise exception 'No existe ese pedido de retiro';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'Sólo se puede cancelar un pedido pendiente';
  end if;

  select technician_id into v_own from public.profiles where id = (select auth.uid());
  if not (select public.is_admin()) and (v_own is null or v_own is distinct from v_row.technician_id) then
    raise exception 'No podés cancelar el pedido de otro técnico';
  end if;

  delete from public.technician_payout_request_items where request_id = p_request_id;

  update public.technician_payout_requests
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = (select auth.uid()),
      cancel_reason = nullif(trim(coalesce(p_reason, '')), ''),
      updated_at = now()
  where id = p_request_id;
end;
$$;

revoke all on function public.cancel_technician_payout_request(uuid, text) from public, anon;
grant execute on function public.cancel_technician_payout_request(uuid, text) to authenticated;

-- ============================================================
-- 6. Cumplir pedido: lote + close_payout_batch con referencia real
-- ============================================================
create or replace function public.fulfill_technician_payout_request(
  p_request_id uuid,
  p_transfer_reference text,
  p_receipt_url text default null,
  p_destination_last4 text default null,
  p_transfer_method text default 'bank_transfer'
) returns table(
  request_id uuid,
  batch_id uuid,
  paid_amount numeric,
  settlement_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.technician_payout_requests;
  v_batch_id uuid;
  v_cover numeric;
  v_count integer;
  v_method text;
  v_close_closed boolean;
  v_close_count integer;
  v_close_total numeric;
begin
  if not (select public.is_admin()) then
    raise exception 'Solo administración puede cumplir un pedido de retiro';
  end if;

  if p_transfer_reference is null or length(trim(p_transfer_reference)) = 0 then
    raise exception 'La referencia real de la transferencia es obligatoria';
  end if;

  v_method := coalesce(nullif(trim(p_transfer_method), ''), 'bank_transfer');
  if v_method not in ('bank_transfer', 'mercadopago', 'cash') then
    raise exception 'Método de transferencia inválido';
  end if;

  update public.technician_payout_requests
  set status = 'processing', processed_at = now(), updated_at = now()
  where id = p_request_id and status = 'pending'
  returning * into v_req;

  if v_req.id is null then
    raise exception 'Ese pedido no está pendiente';
  end if;

  select coalesce(sum(i.net_amount), 0), count(*)
    into v_cover, v_count
  from public.technician_payout_request_items i
  where i.request_id = p_request_id;

    if v_count = 0 or v_cover < v_req.requested_amount then
      raise exception 'El pedido no tiene liquidaciones suficientes para cubrirse';
    end if;

    if exists (
      select 1
      from public.technician_payout_request_items i
      join public.technician_settlements s on s.id = i.settlement_id
      where i.request_id = p_request_id
        and s.status is distinct from 'released'
    ) then
      raise exception 'Alguna liquidación de este pedido ya no está liberada';
    end if;

    insert into public.technician_payout_batches (
      technician_id, scheduled_date, status, total_amount, settlement_count,
      transfer_method, created_by, admin_notes
    ) values (
      v_req.technician_id, now(), 'scheduled', v_cover, v_count,
      v_method, (select auth.uid()),
      'Retiro de monedero ' || p_request_id::text
    )
    returning id into v_batch_id;

    update public.technician_settlements s
    set status = 'scheduled',
        scheduled_date = now(),
        payout_batch_id = v_batch_id
    where s.id in (
      select i.settlement_id from public.technician_payout_request_items i where i.request_id = p_request_id
    )
    and s.status = 'released';

    if not found then
      raise exception 'No se pudieron programar las liquidaciones del pedido';
    end if;

    select c.closed, c.settlement_count, c.total_amount
      into v_close_closed, v_close_count, v_close_total
    from public.close_payout_batch(
      v_batch_id,
      trim(p_transfer_reference),
      p_receipt_url,
      nullif(trim(coalesce(p_destination_last4, '')), '')
    ) c;

    if not coalesce(v_close_closed, false) then
      raise exception 'No se pudo cerrar el lote del retiro';
    end if;

    update public.technician_payout_requests
    set status = 'completed',
        completed_at = now(),
        transfer_reference = trim(p_transfer_reference),
        payout_batch_id = v_batch_id,
        paid_amount = v_close_total,
        settlement_count = v_close_count,
        updated_at = now()
    where id = p_request_id;

  return query select p_request_id, v_batch_id, v_close_total, v_close_count;
end;
$$;

revoke all on function public.fulfill_technician_payout_request(uuid, text, text, text, text) from public, anon;
grant execute on function public.fulfill_technician_payout_request(uuid, text, text, text, text) to authenticated;

-- ============================================================
-- 7. Retiro del administrador (inmediato, con referencia real)
-- ============================================================
create or replace function public.withdraw_admin_earnings(
  p_amount numeric,
  p_transfer_reference text,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_available numeric;
begin
  if not (select public.is_admin()) then
    raise exception 'Solo administración puede retirar comisiones de la plataforma';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'El monto del retiro tiene que ser mayor a 0';
  end if;
  if p_transfer_reference is null or length(trim(p_transfer_reference)) = 0 then
    raise exception 'La referencia real de la transferencia es obligatoria';
  end if;

  v_available := public.admin_platform_wallet_available();
  if p_amount > v_available then
    raise exception 'El monto supera el saldo disponible de la plataforma';
  end if;

  insert into public.admin_earnings_withdrawals (amount, transfer_reference, withdrawn_by, notes)
  values (
    p_amount,
    trim(p_transfer_reference),
    (select auth.uid()),
    nullif(trim(coalesce(p_notes, '')), '')
  )
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.withdraw_admin_earnings(numeric, text, text) from public, anon;
grant execute on function public.withdraw_admin_earnings(numeric, text, text) to authenticated;

-- ============================================================
-- 8. Vistas de monitoreo (security_invoker: RLS de las tablas base)
-- ============================================================
create or replace view public.technician_reserved_settlements
with (security_invoker = true) as
select i.settlement_id, r.technician_id, r.id as request_id
from public.technician_payout_request_items i
join public.technician_payout_requests r on r.id = i.request_id
where r.status in ('pending', 'processing');

grant select on public.technician_reserved_settlements to authenticated;
