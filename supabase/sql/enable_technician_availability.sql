-- ============================================================
-- ServiCasa: disponibilidad, horario y cobertura de técnicos
-- No almacena ubicación GPS ni ubicación en tiempo real.
-- ============================================================
begin;

alter table public.technicians
  add column if not exists is_available boolean not null default false,
  add column if not exists availability_updated_at timestamptz;

create table if not exists public.technician_working_hours (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  unique (technician_id, weekday, start_time, end_time)
);

create table if not exists public.technician_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  exception_date date not null,
  is_available boolean not null default false,
  start_time time,
  end_time time,
  reason text,
  created_at timestamptz not null default now(),
  check ((start_time is null and end_time is null) or (start_time < end_time)),
  unique (technician_id, exception_date)
);

create table if not exists public.technician_coverage_areas (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  area_name text not null check (char_length(trim(area_name)) between 2 and 100),
  city text not null default 'CABA',
  is_base_area boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (technician_id, area_name, city)
);

-- One base area at most for each technician.
create unique index if not exists technician_coverage_one_base_idx
  on public.technician_coverage_areas(technician_id) where is_base_area;
create index if not exists technician_hours_technician_idx on public.technician_working_hours(technician_id, weekday);
create index if not exists technician_exceptions_technician_date_idx on public.technician_availability_exceptions(technician_id, exception_date);
create index if not exists technician_coverage_technician_idx on public.technician_coverage_areas(technician_id, is_active);

alter table public.technician_working_hours enable row level security;
alter table public.technician_availability_exceptions enable row level security;
alter table public.technician_coverage_areas enable row level security;

-- The owner may manage their own operational availability. Admin can inspect all
-- and override only when business operation requires it.
drop policy if exists technician_hours_owner_or_admin on public.technician_working_hours;
create policy technician_hours_owner_or_admin on public.technician_working_hours for all to authenticated
  using ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())))
  with check ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
drop policy if exists technician_exceptions_owner_or_admin on public.technician_availability_exceptions;
create policy technician_exceptions_owner_or_admin on public.technician_availability_exceptions for all to authenticated
  using ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())))
  with check ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
drop policy if exists technician_coverage_owner_or_admin on public.technician_coverage_areas;
create policy technician_coverage_owner_or_admin on public.technician_coverage_areas for all to authenticated
  using ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())))
  with check ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())));

grant select, insert, update, delete on public.technician_working_hours, public.technician_availability_exceptions, public.technician_coverage_areas to authenticated;

commit;

select
  (select count(*) from public.technician_working_hours) as horarios,
  (select count(*) from public.technician_availability_exceptions) as excepciones,
  (select count(*) from public.technician_coverage_areas) as zonas;
