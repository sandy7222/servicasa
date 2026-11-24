-- Proyecto de instalación, Fase 2C (plan-proyecto-instalacion.md): guardar los proyectos del técnico en su cuenta.
-- Cada técnico ve y maneja SOLO los suyos (los proyectos son de trabajo, no se comparten ni los ve el admin).
-- El contenido del proyecto (ambientes, circuitos, Icc, etc.) va en `data` (jsonb): el motor de cálculo lo recalcula
-- al abrirlo, así que no se guardan resultados. Esta migración no toca pagos, órdenes ni presupuestos.

create table if not exists public.installation_projects (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  name text not null default '' check (char_length(name) <= 200),
  data jsonb not null default '{}'::jsonb check (pg_column_size(data) <= 262144),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists installation_projects_technician_idx
  on public.installation_projects (technician_id, updated_at desc);

alter table public.installation_projects enable row level security;

drop policy if exists installation_projects_owner on public.installation_projects;
create policy installation_projects_owner on public.installation_projects
  for all to authenticated
  using (
    technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  );

revoke all on public.installation_projects from anon;
grant select, insert, update, delete on public.installation_projects to authenticated;
