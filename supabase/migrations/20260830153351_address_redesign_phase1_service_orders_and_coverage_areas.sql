-- Fase 1 del rediseño de dirección (docs/adr-address-redesign.md): agrega a
-- service_orders las columnas de localidad/CP/lat-lng/dirección-guardada que
-- hoy no existen, y crea technician_coverage_areas para reemplazar el
-- filtrado 100% manual por zona al asignar técnico. No cambia ningún
-- formulario ni pantalla todavía -- eso es fase 2 en adelante.
--
-- client_neighborhood se mantiene tal cual (pasa a ser explícitamente
-- OPCIONAL, "barrio dentro de la ciudad" -- ya no hace las veces de
-- localidad). No se toca ninguna fila existente.
alter table public.service_orders
  add column client_city text,
  add column client_postal_code text,
  add column client_lat numeric,
  add column client_lng numeric,
  add column client_address_id uuid references public.customer_addresses(id) on delete set null;

-- El campo technicians.zone (texto libre, ya cableado en el modal de alta y
-- edición de técnico) queda como está -- sigue siendo un label descriptivo.
-- Esta tabla nueva es la fuente real para filtrar por localidad al asignar.
create table public.technician_coverage_areas (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  province text not null,
  city text not null,
  created_at timestamptz not null default now(),
  unique (technician_id, province, city)
);

alter table public.technician_coverage_areas enable row level security;

-- Mismo patrón que technician_requirements: admin control total, el técnico
-- solo puede ver (no editar) sus propias filas.
create policy technician_coverage_areas_admin_write
  on public.technician_coverage_areas for all to authenticated
  using ((select is_admin()))
  with check ((select is_admin()));

create policy technician_coverage_areas_owner_or_admin
  on public.technician_coverage_areas for select to authenticated
  using (
    (select is_admin())
    or technician_id in (select profiles.technician_id from public.profiles where profiles.id = (select auth.uid()))
  );
