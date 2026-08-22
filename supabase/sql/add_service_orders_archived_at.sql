-- ServiCasa — agrega service_orders.archived_at para la función "Archivar"
-- del Admin Hub (pestañas Activas/Archivadas). Una orden archivada nunca se
-- borra: solo deja de listarse en la vista operativa por defecto.
-- persistArchiveOrders() en src/lib/supabaseMutations.ts es el único lugar
-- que la escribe (UPDATE ... SET archived_at = now()). Las vistas de cliente
-- y técnico no filtran por esta columna, así que no afecta su propio
-- historial de órdenes.
--
-- NOTA: este archivo se reconstruyó el 22/8/2026 después de que un error mío
-- sobreescribiera el original (nunca había sido commiteado a git). La
-- columna ya existe y está en uso en la base real desde antes — este script
-- documenta esa migración para el repo, es idempotente así que correrlo de
-- nuevo no hace nada si la columna ya está.
--
-- Ejecutar en el SQL Editor.

begin;

alter table public.service_orders
  add column if not exists archived_at timestamptz;

create index if not exists service_orders_archived_at_idx
  on public.service_orders (archived_at);

commit;

select count(*) filter (where archived_at is null) as activas,
       count(*) filter (where archived_at is not null) as archivadas
from public.service_orders;
