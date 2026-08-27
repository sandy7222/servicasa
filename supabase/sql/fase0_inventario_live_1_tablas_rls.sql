-- Fase 0 — Inventario 1/4: tablas públicas + estado de RLS.
-- Solo lectura, no modifica nada.

select
  c.relname as tabla,
  c.relrowsecurity as rls_activado,
  c.relforcerowsecurity as rls_forzado,
  (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname) as cantidad_policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
