-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.


alter table public.service_promotions
  add column image_url text,
  add column highlights text;

comment on column public.service_promotions.image_url is 'Foto de la promo (ruta estatica en /images/promos/... o URL externa ya hosteada). Opcional: sin imagen, el banner cae al estilo solo-texto.';
comment on column public.service_promotions.highlights is 'Bullets cortos separados por "|" (ej. "Mas seguridad|Monitoreo 24/7|Tecnicos certificados"). Opcional.';
