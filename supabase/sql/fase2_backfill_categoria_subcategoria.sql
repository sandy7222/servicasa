-- Plan categorías/subcategorías reales — Fase 2 (backfill).
-- Ver plan-categorias-subcategorias.md. Rellena services.category_id /
-- services.subcategory_id a partir del texto libre ya existente
-- (services.category / services.subcategoria), sin tocar ese texto.
--
-- Salvaguardas pedidas por Sandy:
--  1. Todo en una transacción; si algo no cierra, se aborta entera (nada
--     queda a medio migrar).
--  2. Matcheo case-insensitive + trim (lower(trim(...))), no igualdad
--     exacta, para no perder filas por un espacio o mayúscula suelta.
--  3. category_id y subcategory_id se resuelven en pasos independientes —
--     los 5 huérfanos (subcategoria null) igual reciben su category_id.
--
-- Riesgo real: bajo. Ninguna pantalla lee category_id/subcategory_id todavía
-- (eso arranca en la Fase 3) — si algo saliera mal ya confirmado y comiteado,
-- alcanza con `UPDATE services SET category_id = NULL, subcategory_id = NULL;`
-- y reintentar. El chequeo automático de abajo existe para no llegar a
-- necesitar eso: si los conteos finales no dan lo esperado, la transacción
-- se aborta sola y no llega a comitear nada.
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

-- "Otros" para los 3 rubros que tienen huérfanos con subcategoria = null
-- (Instalación de equipos y Mantenimiento general NO reciben "Otros": son
-- categorías de un solo ítem, se dejan con subcategory_id null a propósito).
insert into public.subcategories (category_id, name, slug, display_order)
select c.id, 'Otros', 'otros', 99
from public.categories c
where c.name in ('Electricidad', 'Plomería', 'Reparaciones del hogar')
on conflict (category_id, name) do nothing;

-- Paso 1 (independiente): category_id para las 233 filas, sin importar si
-- tienen subcategoria o no.
update public.services s
set category_id = c.id
from public.categories c
where lower(trim(s.category)) = lower(trim(c.name))
  and s.category_id is distinct from c.id;

-- Paso 2 (independiente): subcategory_id donde services.subcategoria no es
-- null, matcheado dentro de la MISMA categoría (hay nombres de subcategoria
-- repetidos entre rubros distintos, ej. "Personal Contratado" existe tanto
-- en Electricidad como en Soldadura — sin el join por categoría se podría
-- asignar la subcategoría equivocada).
update public.services s
set subcategory_id = sc.id
from public.subcategories sc
join public.categories c on c.id = sc.category_id
where s.subcategoria is not null
  and lower(trim(s.category)) = lower(trim(c.name))
  and lower(trim(s.subcategoria)) = lower(trim(sc.name))
  and s.subcategory_id is distinct from sc.id;

-- Paso 3: los huérfanos (subcategoria null) en Electricidad/Plomería/
-- Reparaciones del hogar van a "Otros" de su propia categoría.
update public.services s
set subcategory_id = sc.id
from public.subcategories sc
join public.categories c on c.id = sc.category_id
where s.subcategoria is null
  and sc.name = 'Otros'
  and lower(trim(s.category)) = lower(trim(c.name));

-- Chequeo automático: si algo no cierra, aborta toda la transacción (nada
-- se comitea) en vez de dejar datos a medio migrar.
do $$
declare
  sin_categoria int;
  sin_subcategoria int;
begin
  select count(*) into sin_categoria from public.services where category_id is null;
  select count(*) into sin_subcategoria from public.services where subcategory_id is null;

  if sin_categoria <> 0 then
    raise exception 'Fase 2 ABORTADA: % servicios quedaron sin category_id (debería ser 0). No se comiteó nada.', sin_categoria;
  end if;

  if sin_subcategoria <> 2 then
    raise exception 'Fase 2 ABORTADA: % servicios quedaron sin subcategory_id (debería ser exactamente 2: Instalación de equipos y Mantenimiento general). No se comiteó nada.', sin_subcategoria;
  end if;
end $$;

-- Si llegamos hasta acá, los dos chequeos pasaron. Este es el resultado que
-- vas a ver en la solapa "Results": sin_categoria debe ser 0, sin_subcategoria
-- debe ser exactamente 2.
select
  (select count(*) from public.services where category_id is null) as sin_categoria,
  (select count(*) from public.services where subcategory_id is null) as sin_subcategoria;

commit;
