-- ServiCasa — carga el tarifario real de Plomería en public.services,
-- mismo criterio que Electricidad y Refrigeración:
--   price = precio del JSON (tarifario_plomeria_seed.json, ya promediado
--   entre las 3 fuentes cruzadas: Solvit, Clarín, Roomix) x 1.18 de margen,
--   redondeado a la centena.
-- No incluye "visita" (ya está fijada por la plataforma, independiente del
-- rubro) ni los recargos por urgencia/nocturnidad (son porcentajes, no
-- ítems de catálogo). No toca Electricidad, Refrigeración, Cerrajería ni
-- Soldadura.
--
-- Idempotente: cada insert solo corre si no existe ya un `services` con la
-- misma category+name (mismo patrón que seed_refrigeracion_services.sql).
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

insert into public.services (name, description, price, category, subcategoria, active)
select v.name, v.description, v.price, 'Plomería', v.subcategoria, true
from (values
  ('Reparaciones y Grifería — Cambio de canilla simple', 'Cambio de canilla simple', 24800, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Cambio de canilla con monocomando / cambio de grifería', 'Cambio de canilla con monocomando / cambio de grifería', 45100, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Cambio de canilla de lavatorio (mano de obra)', 'Cambio de canilla de lavatorio (mano de obra)', 35400, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Cambio de canilla de cocina (mano de obra)', 'Cambio de canilla de cocina (mano de obra)', 44300, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Cambio de mezcladora de ducha (mano de obra)', 'Cambio de mezcladora de ducha (mano de obra)', 53100, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Reparación de canilla (cambio de goma)', 'Reparación de canilla (cambio de goma)', 26600, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Cambio de llave de paso', 'Cambio de llave de paso', 42500, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Reparación de mochila de inodoro', 'Reparación de mochila de inodoro', 40100, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Cambio de inodoro o bidet (mano de obra)', 'Cambio de inodoro o bidet (mano de obra)', 74900, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Cambio de sifón bajo mesada', 'Cambio de sifón bajo mesada', 29500, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Reparación de pérdida visible (unión, goma o teflón)', 'Reparación de pérdida visible (unión, goma o teflón)', 45100, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Reparación de pérdida en caño empotrado en pared (con rotura y reparación)', 'Reparación de pérdida en caño empotrado en pared (con rotura y reparación)', 194700, 'Reparaciones y Grifería'),
  ('Reparaciones y Grifería — Búsqueda de pérdida oculta con detector', 'Búsqueda de pérdida oculta con detector', 73800, 'Reparaciones y Grifería'),

  ('Destapaciones — Destapación de pileta de cocina / bacha', 'Destapación de pileta de cocina / bacha', 41300, 'Destapaciones'),
  ('Destapaciones — Destapación de inodoro (a mano)', 'Destapación de inodoro (a mano)', 47200, 'Destapaciones'),
  ('Destapaciones — Destapación de desagüe con máquina destapadora', 'Destapación de desagüe con máquina destapadora', 82600, 'Destapaciones'),
  ('Destapaciones — Destapación de cloaca con cámara', 'Destapación de cloaca con cámara', 165200, 'Destapaciones'),

  ('Instalaciones — Instalación de calefón a gas (mano de obra completa)', 'Instalación de calefón a gas (mano de obra completa)', 158100, 'Instalaciones'),
  ('Instalaciones — Instalación de calefón (solo conexión de agua)', 'Instalación de calefón (solo conexión de agua)', 70800, 'Instalaciones'),
  ('Instalaciones — Instalación completa de calefón (gas + agua, sin equipo)', 'Instalación completa de calefón (gas + agua, sin equipo)', 129800, 'Instalaciones'),
  ('Instalaciones — Cambio de calefón existente por uno nuevo (mismo lugar)', 'Cambio de calefón existente por uno nuevo (mismo lugar)', 76700, 'Instalaciones'),
  ('Instalaciones — Instalación de termotanque eléctrico', 'Instalación de termotanque eléctrico', 86700, 'Instalaciones'),
  ('Instalaciones — Instalación de termotanque solar', 'Instalación de termotanque solar', 368800, 'Instalaciones'),
  ('Instalaciones — Conexión de lavarropas (entrada de agua y desagüe)', 'Conexión de lavarropas (entrada de agua y desagüe)', 58600, 'Instalaciones'),
  ('Instalaciones — Instalación completa de lavarropas con cañerías nuevas', 'Instalación completa de lavarropas con cañerías nuevas', 100300, 'Instalaciones'),
  ('Instalaciones — Instalación o cambio de bomba presurizadora', 'Instalación o cambio de bomba presurizadora', 134500, 'Instalaciones'),

  ('Limpieza de Tanques — Limpieza de tanque de agua chico (hasta 1.000 litros)', 'Limpieza de tanque de agua chico (hasta 1.000 litros)', 59000, 'Limpieza de Tanques'),
  ('Limpieza de Tanques — Limpieza de tanque de agua grande (2.000 a 5.000 litros)', 'Limpieza de tanque de agua grande (2.000 a 5.000 litros)', 123900, 'Limpieza de Tanques'),
  ('Limpieza de Tanques — Limpieza de tanque con certificado (GCBA)', 'Limpieza de tanque con certificado (GCBA)', 165200, 'Limpieza de Tanques'),

  ('Reformas — Reforma completa de baño básica (materiales estándar)', 'Reforma completa de baño básica (materiales estándar)', 1410100, 'Reformas'),
  ('Reformas — Reforma de baño premium (cerámicos y sanitarios de marca)', 'Reforma de baño premium (cerámicos y sanitarios de marca)', 2454400, 'Reformas'),
  ('Reformas — Reforma de cocina (parte plomería)', 'Reforma de cocina (parte plomería)', 796500, 'Reformas'),
  ('Reformas — Cambio integral de cañerías por ambiente', 'Cambio integral de cañerías por ambiente', 613600, 'Reformas')
) as v(name, description, price, subcategoria)
where not exists (
  select 1 from public.services s where s.category = 'Plomería' and s.name = v.name
);

commit;

select count(*) as items_plomeria, count(distinct subcategoria) as subcategorias
from public.services where category = 'Plomería';
