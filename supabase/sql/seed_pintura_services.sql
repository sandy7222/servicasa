-- ServiCasa — carga el tarifario real de Pintura (categoría "Reparaciones del
-- hogar") en public.services, mismo criterio que Electricidad, Refrigeración,
-- Plomería, Cerrajería y Soldadura:
--   price = precio del JSON (tarifario_pintura_seed.json, promediado entre
--   servidos.ar, ellaburante.com y clickie.com.ar donde coinciden) x 1.18 de
--   margen, redondeado a la centena.
-- Se descartaron los ítems de "paquete" (habitación/ambiente/depto/casa
-- completa): las fuentes discrepaban 2-3x entre sí para el mismo concepto,
-- así que se dejó solo precio por m²/unidad — el técnico carga la cantidad
-- real al armar el presupuesto, igual que con cualquier otro ítem del
-- catálogo. No toca ningún otro rubro.
--
-- Van al catálogo general de public.services (el que usa el técnico para
-- armar presupuestos de diagnóstico vía QuoteBuilder), NO al catálogo de
-- precio fijo (FIXED_PRICE_SERVICES / fixed_price_services) — son catálogos
-- distintos.
--
-- Idempotente: cada insert solo corre si no existe ya un `services` con la
-- misma category+name.
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

insert into public.services (name, description, price, category, subcategoria, active)
select v.name, v.description, v.price, 'Reparaciones del hogar', v.subcategoria, true
from (values
  ('Pintura Interior — Pintura interior simple, sin preparación', 'Pintura interior simple, sin preparación (látex, 2 manos)', 7500, 'Pintura Interior'),
  ('Pintura Interior — Pintura interior con enduido y preparación previa', 'Pintura interior con enduido y preparación previa', 13300, 'Pintura Interior'),
  ('Pintura Interior — Pintar cielorraso', 'Pintar cielorraso', 10000, 'Pintura Interior'),

  ('Pintura Exterior — Pintura de frente o fachada simple', 'Pintura de frente o fachada simple', 9700, 'Pintura Exterior'),
  ('Pintura Exterior — Fachada con reparación de revoques', 'Fachada con reparación de revoques', 21500, 'Pintura Exterior'),

  ('Preparación de Superficies — Enduido y lijado de pared', 'Enduido y lijado de pared antes de pintar', 5300, 'Preparación de Superficies'),
  ('Preparación de Superficies — Reparación de grietas', 'Reparación de grietas', 5400, 'Preparación de Superficies'),
  ('Preparación de Superficies — Aplicación de fijador', 'Aplicación de fijador', 1700, 'Preparación de Superficies'),
  ('Preparación de Superficies — Tratamiento de humedad o sellador', 'Tratamiento de humedad o sellador antes de pintar', 35400, 'Preparación de Superficies'),

  ('Esmalte y Carpintería — Esmalte sintético en puerta', 'Esmalte sintético en puerta (madera o metal)', 29500, 'Esmalte y Carpintería'),
  ('Esmalte y Carpintería — Esmalte sintético en ventana', 'Esmalte sintético en ventana (madera o metal)', 16500, 'Esmalte y Carpintería'),

  ('Otros Trabajos — Lijado y pintura de rejas o portón', 'Lijado y pintura de rejas o portón (antióxido y esmalte)', 70800, 'Otros Trabajos'),
  ('Otros Trabajos — Colocación de empapelado', 'Colocación de empapelado', 13000, 'Otros Trabajos')
) as v(name, description, price, subcategoria)
where not exists (
  select 1 from public.services s where s.category = 'Reparaciones del hogar' and s.name = v.name
);

commit;

select count(*) as items_pintura, count(distinct subcategoria) as subcategorias
from public.services where category = 'Reparaciones del hogar';
