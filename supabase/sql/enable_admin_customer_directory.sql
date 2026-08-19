-- ============================================================
-- MÓDULO ADMINISTRATIVO DE CLIENTES
-- Planilla, domicilios adicionales y notas privadas del equipo.
-- Ejecutar una vez desde el SQL Editor de Supabase.
-- ============================================================

begin;

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text,
  address_line text not null,
  neighborhood text,
  city text not null default 'CABA',
  postal_code text,
  lat numeric(10,7),
  lng numeric(10,7),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_customer_idx
  on public.customer_addresses(customer_id);

create unique index if not exists customer_addresses_one_default_per_customer_idx
  on public.customer_addresses(customer_id)
  where is_default;

create table if not exists public.customer_admin_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  note text not null check (length(trim(note)) between 1 and 4000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists customer_admin_notes_customer_idx
  on public.customer_admin_notes(customer_id, created_at desc);

alter table public.customer_addresses enable row level security;
alter table public.customer_admin_notes enable row level security;

-- Reejecutable: evita duplicar políticas si se vuelve a correr.
drop policy if exists customer_addresses_owner_or_admin on public.customer_addresses;
drop policy if exists customer_addresses_owner_write_or_admin on public.customer_addresses;
drop policy if exists customer_admin_notes_admin_only on public.customer_admin_notes;

create policy customer_addresses_owner_or_admin
  on public.customer_addresses for select to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.customers c
      where c.id = customer_addresses.customer_id
        and c.profile_id = (select auth.uid())
    )
  );

create policy customer_addresses_owner_write_or_admin
  on public.customer_addresses for all to authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1 from public.customers c
      where c.id = customer_addresses.customer_id
        and c.profile_id = (select auth.uid())
    )
  )
  with check (
    (select public.is_admin())
    or exists (
      select 1 from public.customers c
      where c.id = customer_addresses.customer_id
        and c.profile_id = (select auth.uid())
    )
  );

create policy customer_admin_notes_admin_only
  on public.customer_admin_notes for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

grant select, insert, update, delete on public.customer_addresses to authenticated;
grant select, insert, update, delete on public.customer_admin_notes to authenticated;

-- La vista no se apoya en profiles ni payer_id. Los pagos se vinculan mediante
-- payment_transactions.order_id -> service_orders.id -> customer_id.
drop view if exists public.customer_summary;
create view public.customer_summary
with (security_invoker = true)
as
select
  c.id,
  c.profile_id,
  c.name as full_name,
  c.email,
  c.phone,
  count(so.id) filter (where so.status = 'completed') as completed_orders,
  count(so.id) as total_orders,
  coalesce(sum(so.total_paid_amount) filter (where so.status = 'completed'), 0) as total_spent,
  count(so.id) filter (
    where so.status = 'completed'
      and so.completed_at is not null
      and so.completed_at + interval '30 days' > now()
  ) as active_warranties,
  max(so.created_at) as last_order_date
from public.customers c
left join public.service_orders so on so.customer_id = c.id
group by c.id, c.profile_id, c.name, c.email, c.phone;

grant select on public.customer_summary to authenticated;

commit;

-- Verificación esperada: una fila por cliente.
select * from public.customer_summary order by full_name;
