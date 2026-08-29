create table if not exists public.technician_specialties (
  technician_id uuid not null references public.technicians(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (technician_id, category_id)
);

alter table public.technician_specialties enable row level security;

-- Mirrors technicians_select_scoped exactly: admin, the technician's own
-- profile, or a customer with an order assigned to that technician.
create policy technician_specialties_select_scoped on public.technician_specialties
for select
using (
  is_admin()
  or (technician_id in (select profiles.technician_id from profiles where profiles.id = auth.uid()))
  or (exists (
    select 1 from service_orders o
    join profiles p on p.id = auth.uid()
    where o.assigned_technician_id = technician_specialties.technician_id
      and o.customer_id = p.customer_id
  ))
);

create policy technician_specialties_write_admin on public.technician_specialties
for all
using (is_admin())
with check (is_admin());
