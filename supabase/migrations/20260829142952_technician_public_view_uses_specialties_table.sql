create or replace view public.technician_public_view as
select
  t.id,
  t.name,
  coalesce(
    (select string_agg(c.name, ', ' order by c.name)
     from public.technician_specialties ts
     join public.categories c on c.id = ts.category_id
     where ts.technician_id = t.id),
    t.specialty
  ) as specialty,
  t.rating,
  t.completed_orders_count,
  t.public_avatar_path,
  t.bio,
  t.education_level,
  t.degree_title,
  t.institution_name,
  t.validation_status,
  coalesce(( select jsonb_agg(jsonb_build_object('issuing_entity', m.issuing_entity, 'license_number', m.license_number, 'specialty', m.specialty) order by m.created_at desc)
             from public.technician_matriculas m
             where m.technician_id = t.id and m.validation_status = 'approved'::text), '[]'::jsonb) as validated_licenses
from public.technicians t
where ( select is_admin() as is_admin) or (id in ( select profiles.technician_id
         from public.profiles
        where profiles.id = (( select auth.uid() as uid)))) or (exists ( select 1
         from public.service_orders o
           join public.profiles p on p.id = (( select auth.uid() as uid))
        where o.assigned_technician_id = t.id and o.customer_id = p.customer_id));
