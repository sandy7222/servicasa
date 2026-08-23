-- Fase 0 — Inventario 4/4: jobs de pg_cron (si el schema existe) y qué
-- migraciones registra Supabase como aplicadas. Solo lectura.
--
-- Si el primer select da error "relation cron.job does not exist", es un
-- resultado válido: confirma que pg_cron no está habilitado todavía (coincide
-- con el hallazgo del roadmap de que release_due_technician_settlements()
-- nunca se programó). Copiame el error tal cual si pasa eso.

select jobid, schedule, command, active from cron.job order by jobid;

select version, name
from supabase_migrations.schema_migrations
order by version desc
limit 30;
