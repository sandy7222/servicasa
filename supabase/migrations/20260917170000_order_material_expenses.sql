-- Gastos de materiales de la orden ("Lista para la ferretería"): lo que el técnico compra/indica para el trabajo.
--
-- Esta tabla se creó directamente en producción (sin migración) y la migración siguiente
-- (20260917180000_realtime_replica_identity_and_notes.sql) ya la usa. Sin este archivo, reconstruir la base
-- desde cero falla con "relation public.order_material_expenses does not exist" (job
-- supabase-migrations-reproducible del CI).
--
-- Reconstruida el 8/11/2026 a partir del esquema real de producción (columnas, restricciones, índices, RLS y
-- políticas leídos en el SQL Editor). Es idempotente: en producción no cambia nada.

create table if not exists public.order_material_expenses (
  id uuid not null default gen_random_uuid(),
  order_id uuid not null,
  description text not null,
  unit text not null,
  quantity numeric not null,
  unit_price numeric not null default 0,
  notes text,
  added_by uuid,
  added_by_name text,
  added_at timestamp with time zone not null default now(),
  constraint order_material_expenses_pkey primary key (id),
  constraint order_material_expenses_order_id_fkey foreign key (order_id) references public.service_orders(id) on delete cascade,
  constraint order_material_expenses_added_by_fkey foreign key (added_by) references public.profiles(id),
  constraint order_material_expenses_quantity_check check (quantity > (0)::numeric),
  constraint order_material_expenses_unit_price_check check (unit_price >= (0)::numeric)
);

create index if not exists order_material_expenses_order_id_idx on public.order_material_expenses using btree (order_id);

alter table public.order_material_expenses enable row level security;

-- Ver: admin, el técnico asignado y el cliente de la orden.
drop policy if exists order_material_expenses_select on public.order_material_expenses;
create policy order_material_expenses_select on public.order_material_expenses
  for select to public
  using (exists (
    select 1 from public.service_orders o
    where o.id = order_material_expenses.order_id
      and (
        public.is_admin()
        or o.assigned_technician_id = (select p.technician_id from public.profiles p where p.id = auth.uid())
        or o.customer_id = (select p.customer_id from public.profiles p where p.id = auth.uid())
      )
  ));

-- Cargar/editar/borrar: admin y el técnico asignado (el cliente solo mira).
drop policy if exists order_material_expenses_write on public.order_material_expenses;
create policy order_material_expenses_write on public.order_material_expenses
  for all to public
  using (exists (
    select 1 from public.service_orders o
    where o.id = order_material_expenses.order_id
      and (
        public.is_admin()
        or o.assigned_technician_id = (select p.technician_id from public.profiles p where p.id = auth.uid())
      )
  ))
  with check (exists (
    select 1 from public.service_orders o
    where o.id = order_material_expenses.order_id
      and (
        public.is_admin()
        or o.assigned_technician_id = (select p.technician_id from public.profiles p where p.id = auth.uid())
      )
  ));
