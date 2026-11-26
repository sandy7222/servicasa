-- Fase 0 de plan-presupuesto-de-obra.md.
-- Antes: el cliente de una orden podía leer la fila ENTERA de su técnico (teléfono, correo, DNI, CUIT,
-- domicilio y zona de trabajo). Ahora la tabla solo la leen el propio técnico y el admin; el cliente
-- recibe únicamente los datos públicos por technician_public_rows().

create or replace function public.technician_public_rows()
returns table (
  id uuid, profile_id uuid, name text, specialty text, rating numeric, avatar_bg text,
  active_orders_count integer, completed_orders_count integer, zone text, province text,
  bio text, education_level text, degree_title text, institution_name text,
  public_avatar_path text, validation_status text, is_enabled boolean, can_receive_orders boolean,
  technician_number integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.profile_id, t.name, t.specialty, t.rating, t.avatar_bg,
         t.active_orders_count, t.completed_orders_count, t.zone, t.province,
         t.bio, t.education_level, t.degree_title, t.institution_name,
         t.public_avatar_path, t.validation_status, t.is_enabled, t.can_receive_orders,
         t.technician_number
  from public.technicians t
  where (select public.is_admin())
     or t.id in (select p.technician_id from public.profiles p where p.id = (select auth.uid()))
     or exists (
          select 1
          from public.service_orders o
          join public.profiles p on p.id = (select auth.uid())
          where o.assigned_technician_id = t.id and o.customer_id = p.customer_id
        )
$$;

revoke all on function public.technician_public_rows() from public, anon;
grant execute on function public.technician_public_rows() to authenticated, service_role;

-- La vista pública lee ahora de la función (mismas columnas y mismo alcance que antes).
create or replace view public.technician_public_view
with (security_invoker = true) as
select t.id,
       t.name,
       coalesce((select string_agg(c.name, ', ' order by c.name)
                   from public.technician_specialties ts
                   join public.categories c on c.id = ts.category_id
                  where ts.technician_id = t.id), t.specialty) as specialty,
       t.rating::numeric(3,2) as rating,
       t.completed_orders_count,
       t.public_avatar_path,
       t.bio,
       t.education_level,
       t.degree_title,
       t.institution_name,
       t.validation_status,
       coalesce((select jsonb_agg(jsonb_build_object('issuing_entity', m.issuing_entity, 'license_number', m.license_number, 'specialty', m.specialty) order by m.created_at desc)
                   from public.technician_matriculas m
                  where m.technician_id = t.id and m.validation_status = 'approved'), '[]'::jsonb) as validated_licenses,
       (select count(*) from public.order_ratings orr where orr.technician_id = t.id) as total_ratings_count
from public.technician_public_rows() t;

revoke all on public.technician_public_view from anon;
revoke insert, update, delete, truncate, references, trigger on public.technician_public_view from authenticated;

-- La tabla completa: solo el propio técnico y el admin.
drop policy if exists technicians_select_scoped on public.technicians;
create policy technicians_select_scoped on public.technicians
  for select to authenticated
  using (
    (select public.is_admin())
    or id in (select p.technician_id from public.profiles p where p.id = (select auth.uid()))
  );
