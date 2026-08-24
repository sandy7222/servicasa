-- Fase 5: Cerrar liquidaciones y pagos a técnicos
-- Cron real (no timer del navegador) + cierre de lote atómico e idempotente
-- + integración con reclamos y notificaciones + bucket de comprobantes.

-- ============================================================
-- 1. Supabase Cron: liberación automática de liquidaciones vencidas
-- ============================================================
create extension if not exists pg_cron;

-- Idempotente: si ya existía el job (re-aplicar esta migración), lo reemplaza
-- en vez de fallar por nombre duplicado.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'release-technician-settlements') then
    perform cron.unschedule('release-technician-settlements');
  end if;
end $$;

select cron.schedule(
  'release-technician-settlements',
  '*/15 * * * *',
  $$select public.release_due_technician_settlements();$$
);

-- release_due_technician_settlements() ya existía (creada en el esquema base)
-- y ya es correcta: solo toca pending_release vencidas y sin disputa. Al
-- pasar a 'released' dispara el trigger de notificaciones de Fase 4
-- (notify_settlement_status) sin cambios adicionales. Se re-confirma aquí
-- que solo service_role puede ejecutarla (pg_cron en Supabase corre como
-- postgres, que sortea RLS igual).
revoke all on function public.release_due_technician_settlements() from public, anon, authenticated;
grant execute on function public.release_due_technician_settlements() to service_role;

-- ============================================================
-- 2. Corrige acoplamiento con Reclamos: al pausar una liquidación que ya
-- estaba 'scheduled' (dentro de un lote), hay que sacarla del lote — si no,
-- el lote queda con un total/cantidad que ya no coincide con lo que
-- realmente se va a pagar. Se corrige a nivel trigger para que valga sin
-- importar qué código dispare la transición (pauseCaseSettlement hoy, o
-- cualquier otro futuro).
-- ============================================================
create or replace function public.technician_settlements_clear_batch_on_pull() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'scheduled' and new.status not in ('scheduled', 'paid') then
    new.payout_batch_id := null;
    new.scheduled_date := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_settlements_clear_batch_on_pull on public.technician_settlements;
create trigger trg_settlements_clear_batch_on_pull
  before update of status on public.technician_settlements
  for each row
  when (old.status = 'scheduled' and new.status is distinct from old.status)
  execute function public.technician_settlements_clear_batch_on_pull();

-- ============================================================
-- 3. Auditoría de cierre de lote
-- ============================================================
create table public.technician_payout_batch_audit (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.technician_payout_batches(id) on delete cascade,
  action text not null,
  performed_by uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table public.technician_payout_batch_audit enable row level security;
revoke all on public.technician_payout_batch_audit from anon, authenticated;
grant select on public.technician_payout_batch_audit to authenticated;

create policy payout_batch_audit_admin_read on public.technician_payout_batch_audit
  for select to authenticated
  using ((select public.is_admin()));

-- ============================================================
-- 4. Cierre de lote: operación atómica e idempotente
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

  -- Transición atómica y con guarda: solo cierra si el lote sigue
  -- 'scheduled'. Un segundo llamado (doble click, doble ejecución, cron
  -- reintentando) encuentra 0 filas y no hace nada — closed=false.
  update public.technician_payout_batches
  set status = 'completed',
      completed_at = now(),
      completed_by = (select auth.uid()),
      transfer_reference = coalesce(p_transfer_reference, transfer_reference),
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

  -- Solo se marcan 'paid' las liquidaciones que siguen 'scheduled' en este
  -- lote — si alguna fue pausada por un reclamo mientras tanto (ver punto 2),
  -- ya no está 'scheduled' y queda afuera del pago, honestamente.
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
      'batch_recorded_total', v_batch.total_amount, 'transfer_reference', p_transfer_reference
    )
  );

  return query select true, v_count, v_actual_total, v_batch.total_amount;
end;
$$;

revoke all on function public.close_payout_batch(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.close_payout_batch(uuid, text, text, text) to authenticated;

-- ============================================================
-- 5. Bucket privado de comprobantes de pago
-- ============================================================
insert into storage.buckets (id, name, public)
values ('payout-receipts', 'payout-receipts', false)
on conflict (id) do nothing;

drop policy if exists payout_receipts_admin_all on storage.objects;
create policy payout_receipts_admin_all on storage.objects
  for all to authenticated
  using (bucket_id = 'payout-receipts' and (select public.is_admin()))
  with check (bucket_id = 'payout-receipts' and (select public.is_admin()));

-- El técnico solo lee comprobantes de sus propios lotes. Convención de ruta:
-- {technician_id}/{batch_id}/archivo — mismo patrón que technician-documents.
drop policy if exists payout_receipts_owner_read on storage.objects;
create policy payout_receipts_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payout-receipts'
    and (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  );

-- ============================================================
-- 6. Endurecer permisos de tabla (RLS ya bloqueaba anon; se limpia el
-- privilegio de tabla excesivo para que quede consistente con el resto de
-- tablas de dinero endurecidas en Fase 1).
-- ============================================================
revoke all on public.technician_settlements from anon;
revoke all on public.technician_payout_batches from anon;

-- ============================================================
-- 7. Conciliación administrativa (estado, fecha, técnico, importe)
-- ============================================================
create or replace view public.admin_settlement_reconciliation
with (security_invoker = true) as
select
  s.id as settlement_id,
  s.order_id,
  s.technician_id,
  t.name as technician_name,
  s.settlement_type,
  s.status,
  s.gross_amount,
  s.platform_commission_amount,
  s.payment_fee_amount,
  s.net_amount,
  s.release_date,
  s.release_at,
  s.released_at,
  s.scheduled_date,
  s.paid_at,
  s.dispute_reason,
  s.payout_batch_id,
  b.status as batch_status,
  b.transfer_reference as batch_transfer_reference,
  b.completed_at as batch_completed_at,
  s.created_at
from public.technician_settlements s
join public.technicians t on t.id = s.technician_id
left join public.technician_payout_batches b on b.id = s.payout_batch_id;

revoke all on public.admin_settlement_reconciliation from anon, authenticated;
grant select on public.admin_settlement_reconciliation to authenticated;
