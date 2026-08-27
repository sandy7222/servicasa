-- Fase 0 — Inventario 3/4: buckets de Storage, extensiones instaladas, y si
-- pg_cron está disponible (para saber si hace falta habilitarlo en la Fase 5).
-- Solo lectura, no modifica nada.

select 'bucket' as tipo, id as nombre, public::text as detalle from storage.buckets
union all
select 'extension', extname, extversion from pg_extension
order by tipo, nombre;
