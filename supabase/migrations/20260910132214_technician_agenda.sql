-- Agenda del técnico (ver plan-zona-trabajo-agenda.md, Fase 3): patrón
-- semanal recurrente (technician_working_hours) + excepciones puntuales por
-- fecha — franco, vacaciones, trámite (technician_availability_exceptions).
--
-- El diseño de estas dos tablas ya estaba escrito en
-- supabase/sql/enable_technician_availability.sql, pero ese script nunca se
-- aplicó como migración real — por eso el componente que las consulta
-- (src/components/technician/AvailabilityView.tsx) quedó huérfano, sin
-- rutear y apuntando a tablas inexistentes (hallazgo documentado en la
-- sección 2 del plan). Se retoma ese mismo diseño acá, sin cambios de
-- esquema. La tercera tabla de ese script, technician_coverage_areas, NO se
-- toca: ya existe con su propia migración
-- (address_redesign_phase1_service_orders_and_coverage_areas) y su propia
-- RLS (escritura solo-admin, distinta a la de este script viejo), y de
-- todos modos queda reemplazada por el radio de "Zona de trabajo" (Fase 2)
-- — por eso esa sección se saca de AvailabilityView.tsx en este mismo commit.
create table public.technician_working_hours (
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

create table public.technician_availability_exceptions (
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

create index technician_working_hours_technician_idx
  on public.technician_working_hours(technician_id, weekday);
create index technician_availability_exceptions_technician_date_idx
  on public.technician_availability_exceptions(technician_id, exception_date);

alter table public.technician_working_hours enable row level security;
alter table public.technician_availability_exceptions enable row level security;

-- Mismo patrón que technician_payment_accounts_owner_or_admin (ver
-- pg_policies en vivo): el técnico maneja libremente sus propias filas, el
-- admin puede ver y editar todo (por ejemplo para resolver un conflicto de
-- horario a pedido del técnico, o para el chequeo de disponibilidad de la
-- Fase 5).
create policy technician_working_hours_owner_or_admin on public.technician_working_hours
  for all to authenticated
  using (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  );

create policy technician_availability_exceptions_owner_or_admin on public.technician_availability_exceptions
  for all to authenticated
  using (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  );

grant select, insert, update, delete on public.technician_working_hours to authenticated;
grant select, insert, update, delete on public.technician_availability_exceptions to authenticated;
