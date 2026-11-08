-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Reemplaza el modelo de "almacén" (order_materials_used + register_material_usage,
-- que descontaba stock de un catálogo propio) por una declaración de gastos del
-- técnico: no implica que TecniUrbano provee materiales, solo que el técnico
-- compró algo por su cuenta y lo declara para que se sume al presupuesto/factura
-- del cliente. Funciona igual en modo diagnóstico y directo (no depende de
-- order_quotes). La tabla vieja y el catálogo materials quedan sin usar, no se
-- borran (por si hay historial que consultar).

create table public.order_material_expenses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete cascade,
  description text not null,
  unit text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  notes text,
  added_by uuid references public.profiles(id),
  added_by_name text,
  added_at timestamptz not null default now()
);

create index order_material_expenses_order_id_idx on public.order_material_expenses(order_id);

alter table public.order_material_expenses enable row level security;

-- Mismo patrón de acceso que order_materials_used: admin, técnico asignado o
-- cliente de la orden pueden ver; solo admin o técnico asignado pueden escribir.
create policy order_material_expenses_select on public.order_material_expenses
for select using (
  exists (
    select 1 from public.service_orders o
    where o.id = order_material_expenses.order_id
      and (
        is_admin()
        or o.assigned_technician_id = (select p.technician_id from public.profiles p where p.id = auth.uid())
        or o.customer_id = (select p.customer_id from public.profiles p where p.id = auth.uid())
      )
  )
);

create policy order_material_expenses_write on public.order_material_expenses
for all using (
  exists (
    select 1 from public.service_orders o
    where o.id = order_material_expenses.order_id
      and (
        is_admin()
        or o.assigned_technician_id = (select p.technician_id from public.profiles p where p.id = auth.uid())
      )
  )
) with check (
  exists (
    select 1 from public.service_orders o
    where o.id = order_material_expenses.order_id
      and (
        is_admin()
        or o.assigned_technician_id = (select p.technician_id from public.profiles p where p.id = auth.uid())
      )
  )
);

alter publication supabase_realtime add table public.order_material_expenses;
