-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Fase 1 del plan "Llegué al domicilio": columna aditiva, nullable, sin
-- default. No toca el enum order_status, no toca RLS, no toca triggers
-- existentes (ninguno filtra ni escucha esta columna todavía).
alter table public.service_orders
  add column travel_started_at timestamptz null;

comment on column public.service_orders.travel_started_at is
  'Momento en que el técnico presionó "Salí hacia el domicilio" (viaje iniciado). No dispara el cronómetro de trabajo ni ninguna regla de negocio por sí solo; distinto de work_started_at, que marca la llegada/inicio real del trabajo en sitio.';
