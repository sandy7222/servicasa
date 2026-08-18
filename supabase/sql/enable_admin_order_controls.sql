-- Controles administrativos de órdenes: cancelaciones, incidencias y cierre excepcional.
-- Ejecutar una vez en el SQL Editor de Supabase.
begin;

alter table public.service_orders
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists admin_incident_status text not null default 'none',
  add column if not exists admin_incident_reason text,
  add column if not exists admin_incident_opened_at timestamptz,
  add column if not exists admin_incident_opened_by uuid references public.profiles(id) on delete set null,
  add column if not exists admin_incident_resolved_at timestamptz,
  add column if not exists admin_incident_resolved_by uuid references public.profiles(id) on delete set null,
  add column if not exists admin_exception_reason text,
  add column if not exists admin_exception_closed_at timestamptz,
  add column if not exists admin_exception_closed_by uuid references public.profiles(id) on delete set null;

alter table public.service_orders
  drop constraint if exists service_orders_admin_incident_status_check;
alter table public.service_orders
  add constraint service_orders_admin_incident_status_check
  check (admin_incident_status in ('none', 'open', 'resolved'));

create index if not exists idx_service_orders_admin_incident_status
  on public.service_orders (admin_incident_status)
  where admin_incident_status = 'open';

-- Impide que una cuenta técnica o de cliente altere por API los campos reservados
-- al administrador. La política UPDATE existente sigue determinando quién puede editar.
create or replace function public.protect_admin_order_control_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.cancellation_reason := old.cancellation_reason;
  new.cancelled_at := old.cancelled_at;
  new.cancelled_by := old.cancelled_by;
  new.admin_incident_status := old.admin_incident_status;
  new.admin_incident_reason := old.admin_incident_reason;
  new.admin_incident_opened_at := old.admin_incident_opened_at;
  new.admin_incident_opened_by := old.admin_incident_opened_by;
  new.admin_incident_resolved_at := old.admin_incident_resolved_at;
  new.admin_incident_resolved_by := old.admin_incident_resolved_by;
  new.admin_exception_reason := old.admin_exception_reason;
  new.admin_exception_closed_at := old.admin_exception_closed_at;
  new.admin_exception_closed_by := old.admin_exception_closed_by;
  return new;
end;
$$;

drop trigger if exists protect_admin_order_control_fields on public.service_orders;
create trigger protect_admin_order_control_fields
before update on public.service_orders
for each row execute function public.protect_admin_order_control_fields();

commit;

-- Verificación esperada: una fila con las columnas de control creadas.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'service_orders'
  and column_name in ('cancellation_reason', 'admin_incident_status', 'admin_exception_reason')
order by column_name;
