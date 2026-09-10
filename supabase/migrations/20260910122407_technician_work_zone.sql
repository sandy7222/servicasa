-- "Zona de trabajo" del técnico (ver plan-zona-trabajo-agenda.md, Fase 2):
-- centro (lat/lng) + radio de cobertura que declara el propio técnico desde
-- src/components/technician/WorkZone.tsx, para que el admin pueda ordenar
-- técnicos por distancia al asignar un trabajo (Fase 5, todavía no
-- implementada). Radio acotado a 5-60km: a diferencia de coberturas de
-- decenas/cientos de km de otros proyectos, acá es un técnico viajando en
-- auto/moto dentro del conurbano/CABA — referencia real: Glew a Capital son
-- 34km, y pasado 60km ya no tiene sentido económico viajar para un service
-- hogareño. lat/lng también acotados a su rango físico válido, no al área de
-- Argentina, para no rechazar de más si algún día se usa fuera del país.
-- No hace falta tocar RLS: technicians_update_own_professional_profile ya
-- permite que el técnico actualice cualquier columna de su propia fila (es
-- una policy por fila, no por columna), y lock_technician_admin_fields() solo
-- protege columnas administradas por el admin (validation_status, is_enabled,
-- rating, counts) — estas 5 columnas nuevas no están en esa lista.
alter table public.technicians
  add column work_zone_lat numeric,
  add column work_zone_lng numeric,
  add column work_zone_radius_km numeric,
  add column work_zone_city text,
  add column work_zone_province text,
  add constraint technicians_work_zone_radius_km_check
    check (work_zone_radius_km is null or (work_zone_radius_km between 5 and 60)),
  add constraint technicians_work_zone_lat_check
    check (work_zone_lat is null or (work_zone_lat between -90 and 90)),
  add constraint technicians_work_zone_lng_check
    check (work_zone_lng is null or (work_zone_lng between -180 and 180));
