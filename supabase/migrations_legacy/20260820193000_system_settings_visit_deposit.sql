-- Applied remotely via MCP (project ayszrtieplmqscqtabsu)
-- Name: system_settings_visit_deposit
-- Tables: system_settings
-- Purpose: single source of truth for simple system config (key/value).
--          First use: visit_deposit_amount, replacing the 30000 hardcoded
--          independently in ServiceRequestForm.tsx, AppContext.tsx and
--          supabaseMutations.ts.

create table public.system_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.system_settings enable row level security;

create policy system_settings_select_authenticated
  on public.system_settings for select
  to authenticated
  using (true);

create policy system_settings_write_admin
  on public.system_settings for all
  to authenticated
  using (is_admin())
  with check (is_admin());

insert into public.system_settings (key, value) values ('visit_deposit_amount', '30000'::jsonb);
