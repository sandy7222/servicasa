-- Best-effort backfill: match each existing technician's free-text specialty
-- against real category names as substrings (covers compound values like
-- "Plomería y Mantenimiento general" -> both Plomería and Mantenimiento
-- general). One technician (Sergio Perez, "Pintor") doesn't literally
-- contain any category name and is patched by hand right after, into the
-- closest real category ("Reparaciones del hogar", whose own description
-- is "Pintura, albañilería y arreglos generales del hogar").
insert into public.technician_specialties (technician_id, category_id)
select t.id, c.id
from public.technicians t
join public.categories c on t.specialty ilike '%' || c.name || '%'
on conflict do nothing;

insert into public.technician_specialties (technician_id, category_id)
select t.id, c.id
from public.technicians t, public.categories c
where t.specialty = 'Pintor' and c.name = 'Reparaciones del hogar'
on conflict do nothing;
