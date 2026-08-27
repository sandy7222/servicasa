-- Plan categorías/subcategorías reales — corrección para la Fase 3 paso 1.
-- `services` tiene, además de la política para `authenticated`, una policy
-- de SELECT para `anon` (aplicada directo a la base en su momento, no está
-- en ningún migration committeado — ver el comentario en
-- fetchPublicServices() en src/lib/supabaseData.ts). Los visitantes no
-- logueados de ServicesCategoryView.tsx la necesitan para ver el catálogo
-- sin iniciar sesión. `categories`/`subcategories` (Fase 1) solo tenían
-- policy para `authenticated` — sin esto, un visitante sin cuenta vería los
-- servicios pero no los nombres/íconos de categoría y subcategoría.
--
-- Solo lectura, y solo de filas activas (is_active = true) — igual que el
-- filtro .eq('active', true) que ya usa fetchPublicServices() para anon.
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

create policy categories_select_anon
  on public.categories for select
  to anon
  using (is_active = true);

create policy subcategories_select_anon
  on public.subcategories for select
  to anon
  using (is_active = true);

commit;

select tablename, policyname, roles
from pg_policies
where schemaname = 'public' and tablename in ('categories', 'subcategories')
order by tablename, policyname;
