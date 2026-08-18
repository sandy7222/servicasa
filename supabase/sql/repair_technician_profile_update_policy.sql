-- ServiCasa: permitir que cada técnico guarde únicamente su propia ficha.
-- Ejecutar una vez en el SQL Editor de Supabase.
-- Los datos bancarios y documentos permanecen en sus tablas privadas.

begin;

alter table public.technicians enable row level security;
grant update on public.technicians to authenticated;

drop policy if exists technicians_update_own_professional_profile on public.technicians;
create policy technicians_update_own_professional_profile
  on public.technicians
  for update
  to authenticated
  using (
    (select is_admin())
    or id in (
      select technician_id
      from public.profiles
      where id = (select auth.uid())
    )
  )
  with check (
    (select is_admin())
    or id in (
      select technician_id
      from public.profiles
      where id = (select auth.uid())
    )
  );

-- A technician can edit the public professional fields, but never approve or
-- enable their own account. Those fields remain administration-only.
create or replace function public.lock_technician_admin_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select is_admin()) then
    return new;
  end if;

  new.validation_status := old.validation_status;
  new.validation_notes := old.validation_notes;
  new.validated_at := old.validated_at;
  new.validated_by := old.validated_by;
  new.is_enabled := old.is_enabled;
  new.rating := old.rating;
  new.active_orders_count := old.active_orders_count;
  new.completed_orders_count := old.completed_orders_count;
  return new;
end;
$$;

drop trigger if exists lock_technician_admin_fields_before_update on public.technicians;
create trigger lock_technician_admin_fields_before_update
  before update on public.technicians
  for each row execute function public.lock_technician_admin_fields();

commit;

-- Verification: the current signed-in technician should see their own id.
select id, name, public_avatar_path, validation_status, is_enabled
from public.technicians
where id in (
  select technician_id from public.profiles where id = (select auth.uid())
);
