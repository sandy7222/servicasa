-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Sin esto, el .on('postgres_changes', ..., table: 'technician_coverage_areas') que se
-- agrega en AppContext.tsx nunca dispara: postgres_changes solo entrega eventos de tablas
-- incluidas en esta publicacion (mismo patron que las demas tablas operativas, ver el
-- comentario en AppContext.tsx).
alter publication supabase_realtime add table public.technician_coverage_areas;
