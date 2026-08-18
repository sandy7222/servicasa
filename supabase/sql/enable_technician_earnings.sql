-- ============================================================
-- ServiCasa: liquidaciones, transferencias y ganancias técnicas
-- Ejecutar una única vez en Supabase SQL Editor.
-- No crea pagos ni calcula comisiones: usa importes reales que
-- debe escribir el webhook seguro de Mercado Pago.
-- ============================================================

begin;

alter table public.technician_settlements
  add column if not exists release_date timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists scheduled_date timestamptz,
  add column if not exists transfer_reference text,
  add column if not exists receipt_url text,
  add column if not exists admin_notes text,
  add column if not exists dispute_reason text,
  add column if not exists resolved_at timestamptz;

-- Conserva la fecha utilizada por el esquema inicial.
update public.technician_settlements
set release_date = coalesce(release_date, release_at)
where release_date is null and release_at is not null;

alter table public.technician_settlements
  drop constraint if exists technician_settlements_status_check;

-- Traducir los estados previos sin cambiar el importe de ninguna liquidación.
update public.technician_settlements
set status = case status
  when 'pending' then 'pending_release'
  when 'available' then 'released'
  when 'held' then 'in_review'
  else status
end
where status in ('pending', 'available', 'held');

alter table public.technician_settlements
  add constraint technician_settlements_status_check check (status in (
    'pending_release', 'released', 'scheduled', 'in_transit', 'paid', 'in_review', 'cancelled'
  ));

create table if not exists public.technician_payout_batches (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete restrict,
  scheduled_date timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'failed', 'cancelled')),
  total_amount numeric(12,2) not null check (total_amount >= 0),
  settlement_count integer not null check (settlement_count > 0),
  transfer_method text check (transfer_method in ('bank_transfer', 'mercadopago', 'cash')),
  destination_last4 text,
  transfer_reference text,
  receipt_url text,
  receipt_uploaded_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  completed_by uuid references public.profiles(id) on delete set null,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.technician_settlements
  add column if not exists payout_batch_id uuid references public.technician_payout_batches(id) on delete set null;

create table if not exists public.technician_goals (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  goal_type text not null check (goal_type in ('monthly_earnings', 'monthly_jobs', 'weekly_jobs')),
  target_amount numeric(12,2) check (target_amount is null or target_amount > 0),
  target_count integer check (target_count is null or target_count > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technician_settlements_status_release_idx on public.technician_settlements(status, release_date);
create index if not exists technician_settlements_technician_created_idx on public.technician_settlements(technician_id, created_at desc);
create index if not exists technician_payout_batches_technician_status_idx on public.technician_payout_batches(technician_id, status, scheduled_date desc);
create index if not exists technician_goals_technician_active_idx on public.technician_goals(technician_id, is_active);

alter table public.technician_payout_batches enable row level security;
alter table public.technician_goals enable row level security;

-- Settlements were created earlier with RLS but no browser write permissions.
-- The technician only reads their own records; admin can manage all of them.
drop policy if exists technician_settlements_own_read on public.technician_settlements;
create policy technician_settlements_own_read on public.technician_settlements for select to authenticated
  using (technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
drop policy if exists technician_settlements_admin_all on public.technician_settlements;
create policy technician_settlements_admin_all on public.technician_settlements for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists payout_batches_technician_read on public.technician_payout_batches;
create policy payout_batches_technician_read on public.technician_payout_batches for select to authenticated
  using (technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
drop policy if exists payout_batches_admin_all on public.technician_payout_batches;
create policy payout_batches_admin_all on public.technician_payout_batches for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists technician_goals_owner on public.technician_goals;
create policy technician_goals_owner on public.technician_goals for all to authenticated
  using (technician_id in (select technician_id from public.profiles where id = (select auth.uid())))
  with check (technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
drop policy if exists technician_goals_admin_read on public.technician_goals;
create policy technician_goals_admin_read on public.technician_goals for select to authenticated using ((select is_admin()));

grant select on public.technician_settlements, public.technician_payout_batches to authenticated;
grant select, insert, update, delete on public.technician_goals to authenticated;
grant insert, update, delete on public.technician_payout_batches, public.technician_settlements to authenticated;

-- This function is intentionally NOT callable from the browser. Configure
-- Supabase Cron in the Dashboard to run it periodically after activating
-- pg_cron, or invoke it from a trusted server job.
create or replace function public.release_due_technician_settlements()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare updated_count integer;
begin
  update public.technician_settlements
  set status = 'released', released_at = now()
  where status = 'pending_release'
    and coalesce(release_date, release_at) <= now()
    and dispute_reason is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;
revoke all on function public.release_due_technician_settlements() from public, anon, authenticated;

commit;

-- Verification: expected columns and no old statuses.
select status, count(*) as settlements
from public.technician_settlements
group by status
order by status;
