-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- 1. Extend technician_coverage_areas to reference the canonical locality and track match distance
alter table public.technician_coverage_areas
  add column if not exists localidad_id text references public.ar_localidades(id) on delete cascade,
  add column if not exists categoria text,
  add column if not exists distance_km numeric(6,2),
  add column if not exists updated_at timestamptz not null default now();

comment on table public.technician_coverage_areas is
  'Localidades cubiertas por cada tecnico, recalculadas automaticamente a partir de work_zone_lat/lng/radius_km en technicians. No editar a mano: se recalcula via trigger en cada cambio de zona de trabajo.';

-- Replace the old name-based uniqueness with identity-based uniqueness (a locality is identified by
-- ar_localidades.id, not by name+province text, which can collide across the country)
alter table public.technician_coverage_areas
  drop constraint if exists technician_coverage_areas_technician_id_province_city_key;

alter table public.technician_coverage_areas
  add constraint technician_coverage_areas_technician_localidad_key unique (technician_id, localidad_id);

-- 2. Haversine distance helper (km) - no PostGIS/earthdistance extension installed on this project
create or replace function public.ar_haversine_km(lat1 numeric, lng1 numeric, lat2 numeric, lng2 numeric)
returns numeric
language sql
immutable
parallel safe
as $$
  select 6371 * 2 * asin(
    sqrt(
      sin(radians(lat2 - lat1) / 2) ^ 2 +
      cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2
    )
  );
$$;

comment on function public.ar_haversine_km(numeric, numeric, numeric, numeric) is
  'Distancia en linea recta (km) entre dos puntos lat/lng usando la formula de haversine. Usada para calcular que localidades caen dentro del radio de cobertura de un tecnico.';

-- 3. Recompute the set of localities a technician's coverage circle touches.
-- Full delete + reinsert each time: if the technician shrinks the radius, localities that no
-- longer fall inside it are removed automatically; if they grow it, newly-touched ones appear.
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
  select
    p_technician_id,
    l.provincia_nombre,
    l.nombre,
    l.id,
    l.categoria,
    round(public.ar_haversine_km(v_lat, v_lng, l.lat, l.lng), 2),
    now()
  from public.ar_localidades l
  where l.categoria in ('Localidad simple', 'Componente de localidad compuesta')
    and public.ar_haversine_km(v_lat, v_lng, l.lat, l.lng) <= v_radius;
end;
$$;

comment on function public.recalc_technician_coverage(uuid) is
  'Recalcula technician_coverage_areas para un tecnico puntual: borra su cobertura previa y reinserta las localidades cuyo punto cae dentro del radio actual. Se dispara automaticamente via trg_recalc_technician_coverage en cada UPDATE/INSERT de work_zone_* en technicians; tambien puede invocarse a mano para reprocesar un caso puntual.';

-- 4. Trigger: any change to the work zone (lat, lng or radius) recalculates coverage for that technician
create or replace function public.trg_recalc_technician_coverage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalc_technician_coverage(new.id);
  return new;
end;
$$;

drop trigger if exists technicians_recalc_coverage_area on public.technicians;

create trigger technicians_recalc_coverage_area
after insert or update of work_zone_lat, work_zone_lng, work_zone_radius_km
on public.technicians
for each row
execute function public.trg_recalc_technician_coverage();

-- 5. Backfill technicians that already had a work zone saved before this migration existed
select public.recalc_technician_coverage(id)
from public.technicians
where work_zone_lat is not null and work_zone_lng is not null and work_zone_radius_km is not null;
