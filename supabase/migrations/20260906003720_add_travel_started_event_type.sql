-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Fase 2: nuevo valor de evento para el historial de la orden, análogo a
-- 'started'/'paused'/etc. Aditivo, no reemplaza ni renombra nada existente.
alter type public.order_event_type add value 'travel_started';
