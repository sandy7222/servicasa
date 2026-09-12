-- Tabla de geocoding local: dataset de localidades argentinas (INDEC/georef API,
-- deduplicado a 3866 filas) usado como fuente primaria de lat/lon en
-- api/_lib/geocoding.ts, con fallback a Nominatim solo cuando no hay match local.
--
-- RLS habilitado sin policies: la tabla solo es legible por código server-side
-- que use el cliente service-role (supabaseAdmin), siguiendo el mismo patrón
-- que public.payment_transactions. Nunca debe leerse desde src/ con el cliente
-- anon/browser.

create table public.ar_localidades (
  id text primary key,
  nombre text not null,
  nombre_normalizado text not null,
  categoria text not null,
  provincia_id text,
  provincia_nombre text not null,
  provincia_normalizada text not null,
  departamento_id text,
  departamento_nombre text,
  lat numeric not null check (lat between -90 and 90),
  lng numeric not null check (lng between -180 and 180),
  created_at timestamptz not null default now()
);

create index ar_localidades_lookup_idx
  on public.ar_localidades (provincia_normalizada, nombre_normalizado);

alter table public.ar_localidades enable row level security;
