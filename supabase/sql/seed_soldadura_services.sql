-- ServiCasa — carga el tarifario real de Soldadura en public.services,
-- mismo criterio que Electricidad, Refrigeración, Plomería y Cerrajería:
--   price = precio del JSON (tarifario_soldadura_seed.json) x 1.18 de
--   margen, redondeado a la centena. Fuente única (ellaburante.com), mismo
--   caso que Refrigeración.
-- No incluye el recargo por técnica de soldadura (MIG/TIG/aluminio/acero
-- inoxidable son porcentajes sobre el precio base, no ítems de catálogo).
-- No toca Electricidad, Refrigeración, Plomería ni Cerrajería.
--
-- Idempotente: cada insert solo corre si no existe ya un `services` con la
-- misma category+name.
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

insert into public.services (name, description, price, category, subcategoria, active)
select v.name, v.description, v.price, 'Soldadura', v.subcategoria, true
from (values
  ('Personal Contratado — Soldador básico', 'Soldador básico', 11800, 'Personal Contratado'),
  ('Personal Contratado — Soldador especializado', 'Soldador especializado', 17700, 'Personal Contratado'),
  ('Personal Contratado — Soldador TIG / aluminio', 'Soldador TIG / aluminio', 23600, 'Personal Contratado'),
  ('Personal Contratado — Jornada completa (8 horas)', 'Jornada completa (8 horas)', 85600, 'Personal Contratado'),
  ('Personal Contratado — Jornada completa especializada (8 horas)', 'Jornada completa especializada (8 horas)', 135700, 'Personal Contratado'),

  ('Trabajos Comunes — Soldadura de reja suelta', 'Soldadura de reja suelta', 29500, 'Trabajos Comunes'),
  ('Trabajos Comunes — Reparación de portón', 'Reparación de portón', 50200, 'Trabajos Comunes'),
  ('Trabajos Comunes — Soldadura de caño de escape', 'Soldadura de caño de escape', 38400, 'Trabajos Comunes'),
  ('Trabajos Comunes — Soldadura de chasis de auto', 'Soldadura de chasis de auto', 82600, 'Trabajos Comunes'),
  ('Trabajos Comunes — Reparación de tanque', 'Reparación de tanque', 64900, 'Trabajos Comunes'),

  ('Estructuras Metálicas — Reja simple (por metro lineal)', 'Reja simple (por metro lineal)', 56100, 'Estructuras Metálicas'),
  ('Estructuras Metálicas — Reja de diseño (por metro lineal)', 'Reja de diseño (por metro lineal)', 106200, 'Estructuras Metálicas'),
  ('Estructuras Metálicas — Portón corredizo (2 metros)', 'Portón corredizo (2 metros)', 413000, 'Estructuras Metálicas'),
  ('Estructuras Metálicas — Portón de garaje (3 metros)', 'Portón de garaje (3 metros)', 560500, 'Estructuras Metálicas'),
  ('Estructuras Metálicas — Escalera metálica (por escalón)', 'Escalera metálica (por escalón)', 44300, 'Estructuras Metálicas'),
  ('Estructuras Metálicas — Baranda / pasamanos (por metro lineal)', 'Baranda / pasamanos (por metro lineal)', 70800, 'Estructuras Metálicas')
) as v(name, description, price, subcategoria)
where not exists (
  select 1 from public.services s where s.category = 'Soldadura' and s.name = v.name
);

commit;

select count(*) as items_soldadura, count(distinct subcategoria) as subcategorias
from public.services where category = 'Soldadura';
