-- ServiCasa: validación formal y habilitación segura de técnicos.
-- Ejecutar una vez en Supabase SQL Editor, después de enable_technician_professional_profile.sql.
begin;

alter table public.technicians
  add column if not exists can_receive_orders boolean not null default false;

create table if not exists public.rubro_matricula_config (
  id uuid primary key default gen_random_uuid(),
  rubro_key text not null unique,
  display_name text not null,
  requires_matricula boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.rubro_matricula_config (rubro_key, display_name, requires_matricula) values
  ('electricidad', 'Electricidad', true),
  ('refrigeracion', 'Refrigeración', true),
  ('plomeria', 'Plomería', true),
  ('cerrajeria', 'Cerrajería', false),
  ('soldadura', 'Soldadura', false)
on conflict (rubro_key) do update set display_name = excluded.display_name, requires_matricula = excluded.requires_matricula;

create table if not exists public.technician_requirements (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  requirement_type text not null check (requirement_type in ('profile_complete', 'education_verified', 'matricula_validated', 'monotributo_approved', 'identity_verified', 'bank_account_valid')),
  is_required boolean not null default true,
  status text not null default 'pending' check (status in ('pending', 'approved', 'observed', 'not_required')),
  review_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (technician_id, requirement_type)
);

create table if not exists public.technician_review_history (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  requirement_type text,
  action text not null check (action in ('requirement_approved', 'requirement_observed', 'requirement_not_required', 'technician_approved', 'technician_observed', 'technician_suspended')),
  reason text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.technician_notifications (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  title text not null,
  message text not null,
  kind text not null default 'info' check (kind in ('success', 'warning', 'error', 'info')),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Crea los seis requisitos para técnicos existentes. La matrícula se vuelve
-- obligatoria sólo para especialidades reguladas conocidas.
insert into public.technician_requirements (technician_id, requirement_type, is_required, status)
select t.id, requirement_type, is_required,
  case when requirement_type = 'matricula_validated' and not is_required then 'not_required' else 'pending' end
from public.technicians t
cross join lateral (
  values
    ('profile_complete', true),
    ('education_verified', true),
    ('matricula_validated', lower(coalesce(t.specialty, '')) ~ '(electric|refriger|plomer)'),
    ('monotributo_approved', true),
    ('identity_verified', true),
    ('bank_account_valid', true)
) as req(requirement_type, is_required)
on conflict (technician_id, requirement_type) do nothing;

alter table public.rubro_matricula_config enable row level security;
alter table public.technician_requirements enable row level security;
alter table public.technician_review_history enable row level security;
alter table public.technician_notifications enable row level security;

revoke all on public.rubro_matricula_config, public.technician_requirements, public.technician_review_history, public.technician_notifications from anon, authenticated;
grant select on public.rubro_matricula_config to authenticated;
grant select, insert, update, delete on public.technician_requirements, public.technician_review_history, public.technician_notifications to authenticated;

drop policy if exists rubro_matricula_config_read on public.rubro_matricula_config;
drop policy if exists technician_requirements_owner_or_admin on public.technician_requirements;
drop policy if exists technician_requirements_admin_write on public.technician_requirements;
drop policy if exists technician_review_history_owner_or_admin on public.technician_review_history;
drop policy if exists technician_review_history_admin_write on public.technician_review_history;
drop policy if exists technician_notifications_owner_or_admin on public.technician_notifications;
drop policy if exists technician_notifications_owner_read_update on public.technician_notifications;
drop policy if exists technician_notifications_admin_write on public.technician_notifications;
create policy rubro_matricula_config_read on public.rubro_matricula_config for select to authenticated using (true);
create policy technician_requirements_owner_or_admin on public.technician_requirements for select to authenticated using ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
create policy technician_requirements_admin_write on public.technician_requirements for all to authenticated using ((select is_admin())) with check ((select is_admin()));
create policy technician_review_history_owner_or_admin on public.technician_review_history for select to authenticated using ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
create policy technician_review_history_admin_write on public.technician_review_history for insert to authenticated with check ((select is_admin()));
create policy technician_notifications_owner_or_admin on public.technician_notifications for select to authenticated using ((select is_admin()) or technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
create policy technician_notifications_owner_read_update on public.technician_notifications for update to authenticated using (technician_id in (select technician_id from public.profiles where id = (select auth.uid()))) with check (technician_id in (select technician_id from public.profiles where id = (select auth.uid())));
create policy technician_notifications_admin_write on public.technician_notifications for all to authenticated using ((select is_admin())) with check ((select is_admin()));

-- Defensa en profundidad: incluso si alguien intenta asignar por API, PostgreSQL
-- rechaza al técnico no habilitado.
create or replace function public.require_eligible_technician_assignment()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.assigned_technician_id is not null and new.assigned_technician_id is distinct from old.assigned_technician_id then
    if not exists (
      select 1 from public.technicians t
      where t.id = new.assigned_technician_id and t.validation_status = 'approved' and t.can_receive_orders = true
    ) then
      raise exception 'El técnico no está habilitado para recibir órdenes';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists require_eligible_technician_assignment on public.service_orders;
create trigger require_eligible_technician_assignment before update of assigned_technician_id on public.service_orders for each row execute function public.require_eligible_technician_assignment();

commit;

select t.name, t.validation_status, t.can_receive_orders, count(r.id) as requisitos
from public.technicians t left join public.technician_requirements r on r.technician_id = t.id
group by t.id, t.name, t.validation_status, t.can_receive_orders order by t.name;
