-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

alter table public.service_orders
  add column arrived_at timestamptz null;

comment on column public.service_orders.arrived_at is
  'Momento en que el técnico llegó al domicilio. Para work_mode=diagnosis, marca el inicio del presupuesto (no del trabajo); el trabajo (in_progress) arranca recién cuando el cliente acepta y paga el presupuesto, vía el trigger start_diagnosis_execution_after_payment. Para work_mode=direct, informativo únicamente (la llegada ya dispara in_progress directamente).';
