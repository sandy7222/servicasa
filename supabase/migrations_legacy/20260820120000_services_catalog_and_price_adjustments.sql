-- Applied remotely via MCP (project ayszrtieplmqscqtabsu)
-- Name: services_catalog_and_price_adjustments
-- Tables: services, price_adjustments_log
-- Purpose: give the Admin Hub "Servicios" catalog real persistence (it lived
--          only in mockData.ts/localStorage before this), and back the
--          "Ajuste Global de Precios" feature with an audit trail.

-- Public "Servicios" catalog (Admin Hub) — previously mockData.ts/localStorage only.
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  description text not null default '',
  price numeric not null default 0 check (price >= 0),
  category text not null default 'General',
  estimated_duration_minutes integer not null default 60 check (estimated_duration_minutes > 0),
  features text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.services enable row level security;

create policy services_select_authenticated
  on public.services for select
  to authenticated
  using (true);

create policy services_write_admin
  on public.services for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Audit log for the "Ajuste Global de Precios" feature.
create table public.price_adjustments_log (
  id uuid primary key default gen_random_uuid(),
  category_filter text,
  percentage numeric not null,
  rounding_mode text not null,
  services_affected integer not null default 0,
  applied_at timestamptz not null default now(),
  applied_by uuid references public.profiles(id)
);

alter table public.price_adjustments_log enable row level security;

create policy price_adjustments_log_admin_all
  on public.price_adjustments_log for all
  to authenticated
  using (is_admin())
  with check (is_admin());
