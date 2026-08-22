-- Fase 0 del plan de migración a categorías/subcategorías relacionales.
-- Pegar y correr en el SQL Editor de Supabase — solo lectura, no modifica nada.

select category, subcategoria, count(*) as items
from public.services
group by 1, 2
order by 1, 2;
