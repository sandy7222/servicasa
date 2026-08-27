-- ServiCasa — el guest-checkout en producción falló con:
-- "Could not find the 'province' column of 'customers' in the schema cache"
-- Esto pasa si add_client_province.sql nunca corrió, o corrió pero
-- PostgREST (la API que usa Supabase) no refrescó su caché de esquema.
-- Este script cubre los dos casos: reintenta agregar las columnas
-- (idempotente, no rompe nada si ya existen) y fuerza el refresco del caché.
--
-- Ejecutar en el SQL Editor.

begin;

alter table public.customers
  add column if not exists province text;

alter table public.service_orders
  add column if not exists client_province text;

commit;

notify pgrst, 'reload schema';

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'customers' and column_name = 'province')
    or (table_name = 'service_orders' and column_name = 'client_province'));
