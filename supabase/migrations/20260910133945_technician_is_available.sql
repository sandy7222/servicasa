-- Falta encontrada probando la Fase 3 en el navegador (ver
-- plan-zona-trabajo-agenda.md): el toggle "Disponible/No disponible" de
-- src/components/technician/AvailabilityView.tsx escribe
-- technicians.is_available/availability_updated_at, pero ninguna de las dos
-- columnas existía en la tabla real — el propio código ya tenía un
-- comentario de un desarrollador anterior confirmándolo
-- ("is_available NO se incluye porque esa columna no existe en la tabla
-- real"). Mismo patrón que ya estaba escrito, sin aplicar, en
-- supabase/sql/enable_technician_availability.sql. De paso esto también
-- arregla en silencio la insignia "Disponible/No disponible" del admin en
-- AdminHubView.tsx, que hasta ahora siempre mostraba "No disponible" porque
-- is_available nunca llegaba a completarse en el select.
alter table public.technicians
  add column is_available boolean not null default false,
  add column availability_updated_at timestamptz;
