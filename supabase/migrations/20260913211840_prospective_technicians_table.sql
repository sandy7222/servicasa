-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

create table public.prospective_technicians (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  specialty text,
  status text not null default 'pendiente' check (status in ('pendiente', 'contactado', 'convertido', 'descartado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.prospective_technicians is 'Agenda interna de "futuros tecnicos": contactos (ej. estudiantes) que el admin carga a mano para hacer seguimiento antes de que se registren como tecnicos reales. No tiene alta publica.';

alter table public.prospective_technicians enable row level security;

create policy prospective_technicians_admin_manage
  on public.prospective_technicians
  for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create trigger prospective_technicians_set_updated_at
  before update on public.prospective_technicians
  for each row execute function set_updated_at();

create index prospective_technicians_status_idx on public.prospective_technicians (status, created_at desc);

alter publication supabase_realtime add table public.prospective_technicians;
