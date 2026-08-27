-- Plan categorías/subcategorías reales — Fase 1 (ver plan-categorias-subcategorias.md).
-- Crea las tablas relacionales `categories`/`subcategories`, agrega las
-- columnas FK (nullables) a `services`, y carga las 8 categorías + las
-- subcategorías YA EXISTENTES en la base real (confirmadas con el SELECT
-- DISTINCT de la Fase 0, no inventadas).
--
-- Esta fase NO toca ningún componente de React, NO hace backfill de
-- services.category_id/subcategory_id (eso es la Fase 2, pendiente de tu
-- confirmación), y NO modifica ni `services.category`/`subcategoria` (texto)
-- ni el enum `service_type` (que resultó ser una cosa aparte: es el tipo de
-- la columna service_orders.service_type, el "Rubro" que el cliente elige al
-- crear una orden — independiente del catálogo de servicios. Se mantiene
-- como está; decidir si deprecarlo junto con `category` queda para más
-- adelante, no es parte de esta fase).
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  name text not null,
  slug text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

alter table public.services add column category_id uuid references public.categories(id);
alter table public.services add column subcategory_id uuid references public.subcategories(id);

alter table public.categories enable row level security;
alter table public.subcategories enable row level security;

-- Mismo criterio que services_select_authenticated / services_write_admin
-- (ver 20260820120000_services_catalog_and_price_adjustments.sql).
create policy categories_select_authenticated
  on public.categories for select
  to authenticated
  using (true);

create policy categories_write_admin
  on public.categories for all
  to authenticated
  using (is_admin())
  with check (is_admin());

create policy subcategories_select_authenticated
  on public.subcategories for select
  to authenticated
  using (true);

create policy subcategories_write_admin
  on public.subcategories for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Sección 4 del plan: las 8 categorías reales confirmadas en la Fase 0.
insert into public.categories (name, slug, icon, description, display_order) values
  ('Plomería', 'plomeria', 'Wrench', 'Reparación y mantenimiento de sistemas de agua y desagüe', 1),
  ('Electricidad', 'electricidad', 'Zap', 'Instalaciones eléctricas seguras y reparaciones', 2),
  ('Reparaciones del hogar', 'reparaciones-del-hogar', 'Hammer', 'Pintura, albañilería y arreglos generales del hogar', 3),
  ('Cerrajería', 'cerrajeria', 'Sparkles', 'Apertura, cambio y reparación de cerraduras y sistemas de seguridad', 4),
  ('Refrigeración', 'refrigeracion', 'Droplets', 'Instalación, mantenimiento y reparación de heladeras, freezers y aires acondicionados', 5),
  ('Soldadura', 'soldadura', 'Flame', 'Trabajos de soldadura y estructuras metálicas', 6),
  ('Mantenimiento general', 'mantenimiento-general', 'Settings', 'Revisiones preventivas e inspecciones técnicas', 7),
  ('Instalación de equipos', 'instalacion-de-equipos', 'ShieldCheck', 'Montaje y instalación de electrodomésticos', 8);

-- Subcategorías ya existentes hoy en `services.subcategoria` para cada rubro
-- (confirmadas con el SELECT DISTINCT category, subcategoria de la Fase 0,
-- ejecutado contra la base real el 22/8). Instalación de equipos y
-- Mantenimiento general no tienen ninguna: sus únicos ítems están sin
-- subcategoria hoy (se resuelve en la Fase 2, no acá).

insert into public.subcategories (category_id, name, slug, display_order)
select c.id, v.name, v.slug, v.display_order
from public.categories c
join (values
  ('Cerrajería', 'Aperturas', 'aperturas', 1),
  ('Cerrajería', 'Cerraduras', 'cerraduras', 2),
  ('Cerrajería', 'Llaves', 'llaves', 3),
  ('Cerrajería', 'Herrajes de Seguridad', 'herrajes-de-seguridad', 4),

  ('Electricidad', 'Acometidas', 'acometidas', 1),
  ('Electricidad', 'Cableado y Re-Cableado', 'cableado-y-re-cableado', 2),
  ('Electricidad', 'Canalización', 'canalizacion', 3),
  ('Electricidad', 'CCTV', 'cctv', 4),
  ('Electricidad', 'Colocación de Artefactos', 'colocacion-de-artefactos', 5),
  ('Electricidad', 'Colocación de Luminarias', 'colocacion-de-luminarias', 6),
  ('Electricidad', 'Corrección de Potencia', 'correccion-de-potencia', 7),
  ('Electricidad', 'Mantenimiento', 'mantenimiento', 8),
  ('Electricidad', 'Personal Contratado', 'personal-contratado', 9),
  ('Electricidad', 'Proyecto Eléctrico', 'proyecto-electrico', 10),
  ('Electricidad', 'Puesta a Tierra', 'puesta-a-tierra', 11),
  ('Electricidad', 'Tablero Domiciliario', 'tablero-domiciliario', 12),

  ('Plomería', 'Reparaciones y Grifería', 'reparaciones-y-griferia', 1),
  ('Plomería', 'Destapaciones', 'destapaciones', 2),
  ('Plomería', 'Instalaciones', 'instalaciones', 3),
  ('Plomería', 'Limpieza de Tanques', 'limpieza-de-tanques', 4),
  ('Plomería', 'Reformas', 'reformas', 5),

  ('Refrigeración', 'Visita Técnica', 'visita-tecnica', 1),
  ('Refrigeración', 'Instalación Estándar', 'instalacion-estandar', 2),
  ('Refrigeración', 'Pre-instalación y Desinstalación', 'pre-instalacion-y-desinstalacion', 3),
  ('Refrigeración', 'Limpieza y Mantenimiento', 'limpieza-y-mantenimiento', 4),
  ('Refrigeración', 'Detección y Reparación de Fugas', 'deteccion-y-reparacion-de-fugas', 5),
  ('Refrigeración', 'Recambios', 'recambios', 6),

  ('Reparaciones del hogar', 'Pintura Interior', 'pintura-interior', 1),
  ('Reparaciones del hogar', 'Pintura Exterior', 'pintura-exterior', 2),
  ('Reparaciones del hogar', 'Preparación de Superficies', 'preparacion-de-superficies', 3),
  ('Reparaciones del hogar', 'Esmalte y Carpintería', 'esmalte-y-carpinteria', 4),
  ('Reparaciones del hogar', 'Otros Trabajos', 'otros-trabajos', 5),
  ('Reparaciones del hogar', 'Revoques y Tabiques', 'revoques-y-tabiques', 6),
  ('Reparaciones del hogar', 'Pisos y Revestimientos', 'pisos-y-revestimientos', 7),
  ('Reparaciones del hogar', 'Contrapisos', 'contrapisos', 8),
  ('Reparaciones del hogar', 'Impermeabilización', 'impermeabilizacion', 9),
  ('Reparaciones del hogar', 'Demoliciones', 'demoliciones', 10),
  ('Reparaciones del hogar', 'Aberturas y Vanos', 'aberturas-y-vanos', 11),
  ('Reparaciones del hogar', 'Veredas', 'veredas', 12),
  ('Reparaciones del hogar', 'Trabajos Puntuales', 'trabajos-puntuales', 13),

  ('Soldadura', 'Personal Contratado', 'personal-contratado', 1),
  ('Soldadura', 'Trabajos Comunes', 'trabajos-comunes', 2),
  ('Soldadura', 'Estructuras Metálicas', 'estructuras-metalicas', 3)
) as v(category_name, name, slug, display_order) on c.name = v.category_name;

commit;

-- Verificación: 8 categorías, 43 subcategorías repartidas, 0 servicios
-- tocados todavía (category_id/subcategory_id deben salir todos NULL: eso
-- es correcto para esta fase, el backfill es la Fase 2).
select
  (select count(*) from public.categories) as categorias,
  (select count(*) from public.subcategories) as subcategorias,
  (select count(*) from public.services where category_id is not null) as services_ya_migrados;

select c.name as categoria, count(s.id) as subcategorias
from public.categories c
left join public.subcategories s on s.category_id = c.id
group by c.name, c.display_order
order by c.display_order;
