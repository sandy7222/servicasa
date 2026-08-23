-- Fase 0 — Inventario 2/4: funciones (triggers y RPC) definidas en public.
-- Solo lectura, no modifica nada.

select
  p.proname as funcion,
  pg_get_function_identity_arguments(p.oid) as argumentos,
  case p.prosecdef when true then 'SECURITY DEFINER' else 'security invoker' end as seguridad,
  l.lanname as lenguaje
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
join pg_language l on l.oid = p.prolang
where n.nspname = 'public'
order by p.proname;
