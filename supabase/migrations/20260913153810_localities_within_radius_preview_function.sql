-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Live preview: which localities fall within a given point+radius, without persisting anything.
-- Used by the frontend while the technician is still dragging the map/slider, before saving —
-- the persisted recalc below reuses this same definition so both paths can never disagree.
create or replace function public.localities_within_radius(p_lat numeric, p_lng numeric, p_radius_km numeric)
returns table (
  localidad_id text,
  nombre text,
  provincia_nombre text,
  categoria text,
  distance_km numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.nombre,
    l.provincia_nombre,
    l.categoria,
    round(public.ar_haversine_km(p_lat, p_lng, l.lat, l.lng), 2)
  from public.ar_localidades l
  where l.categoria in ('Localidad simple', 'Componente de localidad compuesta')
    and public.ar_haversine_km(p_lat, p_lng, l.lat, l.lng) <= p_radius_km
  order by 5;
$$;

comment on function public.localities_within_radius(numeric, numeric, numeric) is
  'Devuelve las localidades (ar_localidades) cuyo punto cae dentro de un radio dado, ordenadas por distancia. security definer porque ar_localidades tiene RLS sin policies (uso exclusivo server-side hasta ahora); se expone acotada a esta funcion de solo lectura para que el frontend pueda previsualizar en vivo la cobertura mientras el tecnico arrastra el mapa, antes de guardar. Ver plan-zona-trabajo-agenda.md.';

revoke all on function public.localities_within_radius(numeric, numeric, numeric) from public;
grant execute on function public.localities_within_radius(numeric, numeric, numeric) to authenticated;

-- recalc_technician_coverage ahora reusa la misma funcion en vez de duplicar el filtro
-- de categoria y el calculo de distancia.
create or replace function public.recalc_technician_coverage(p_technician_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lat numeric;
  v_lng numeric;
  v_radius numeric;
begin
  select work_zone_lat, work_zone_lng, work_zone_radius_km
    into v_lat, v_lng, v_radius
  from public.technicians
  where id = p_technician_id;

  delete from public.technician_coverage_areas where technician_id = p_technician_id;

  if v_lat is null or v_lng is null or v_radius is null then
    return;
  end if;

  insert into public.technician_coverage_areas
    (technician_id, province, city, localidad_id, categoria, distance_km, updated_at)
  select p_technician_id, l.provincia_nombre, l.nombre, l.localidad_id, l.categoria, l.distance_km, now()
  from public.localities_within_radius(v_lat, v_lng, v_radius) l;
end;
$$;

-- Sanity check: reprocesar todos los tecnicos con zona ya declarada usando la version
-- refactorizada, tiene que dar exactamente el mismo resultado que antes.
select public.recalc_technician_coverage(id)
from public.technicians
where work_zone_lat is not null and work_zone_lng is not null and work_zone_radius_km is not null;
