-- Applied remotely via MCP (project ayszrtieplmqscqtabsu)
-- Name: customer_self_registration_and_technician_applications
-- Tables: technician_applications (new); customers gets a new INSERT policy
-- Purpose: fixes the "no hay forma de registrarse" gap.
--   - Customer: real self-registration (signUp + this policy lets them
--     create their own linked customers row).
--   - Technician: deliberately NOT self-registration — a public application
--     form that creates a review-only record, no auth account, no role.
--     Admin approves manually and onboards via the existing invite flow.

create policy customers_insert_self
  on public.customers for insert
  to authenticated
  with check (profile_id = auth.uid());

create table public.technician_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) > 0),
  email text not null check (char_length(trim(email)) > 0),
  phone text not null check (char_length(trim(phone)) > 0),
  specialty text not null check (char_length(trim(specialty)) > 0),
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id)
);

alter table public.technician_applications enable row level security;

create policy technician_applications_insert_public
  on public.technician_applications for insert
  to anon, authenticated
  with check (status = 'pending' and reviewed_at is null and reviewed_by is null);

create policy technician_applications_admin_manage
  on public.technician_applications for all
  to authenticated
  using (is_admin())
  with check (is_admin());
