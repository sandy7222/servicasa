-- ServiCasa — carga el tarifario real de Refrigeración en public.services,
-- mismo criterio que se usó para los 104 ítems de Electricidad:
--   price = precio del JSON (tarifario_refrigeracion_seed.json) x 1.18 de margen,
--   ya viene redondeado a la centena (los precios base son todos múltiplos de
--   $10.000, así que el x1.18 cae exacto, sin necesidad de redondear).
-- "M.O. Recambio de motocompresor" no tenía precio publicado ("Igual al
-- valor de materiales"). A pedido del usuario se carga con un precio de
-- REFERENCIA ESTIMADO (no sacado de la fuente): base $150.000 -> x1.18 =
-- $177.000. Es un piso razonable frente al resto de la lista (más que una
-- reparación de fuga a $90.000/$106.200, menos que instalar un equipo
-- mediano) porque cambiar un motocompresor implica más mano de obra que
-- ambos. Ajustar manualmente si no es el número correcto.
-- No toca Electricidad, Cerrajería ni Soldadura.
--
-- Idempotente: cada insert solo corre si no existe ya un `services` con la
-- misma category+name (no hay constraint unique nueva, solo un `where not
-- exists` por fila, para no tocar el schema).
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

insert into public.services (name, description, price, category, subcategoria, active)
select v.name, v.description, v.price, 'Refrigeración', v.subcategoria, true
from (values
  ('Instalación Estándar — De 0 a 3.499 Fg', 'De 0 a 3.499 Fg', 141600, 'Instalación Estándar'),
  ('Instalación Estándar — De 3.500 a 5.499 Fg', 'De 3.500 a 5.499 Fg', 165200, 'Instalación Estándar'),
  ('Instalación Estándar — De 5.500 a 6.299 Fg', 'De 5.500 a 6.299 Fg', 212400, 'Instalación Estándar'),
  ('Instalación Estándar — De 6.300 a 7.999 Fg', 'De 6.300 a 7.999 Fg', 236000, 'Instalación Estándar'),
  ('Instalación Estándar — De 8.000 a 8.999 Fg', 'De 8.000 a 8.999 Fg', 295000, 'Instalación Estándar'),
  ('Instalación Estándar — Roof-Top de 9.000 a 14.999 Fg', 'Roof-Top de 9.000 a 14.999 Fg', 424800, 'Instalación Estándar'),
  ('Instalación Estándar — De 15.000 a 18.000 Fg', 'De 15.000 a 18.000 Fg', 495600, 'Instalación Estándar'),

  ('Pre-instalación y Desinstalación — Pre-instalación estándar (cañerías aisladas, cable y caja embutidas)', 'Pre-instalación estándar (cañerías aisladas, cable y caja embutidas)', 141600, 'Pre-instalación y Desinstalación'),
  ('Pre-instalación y Desinstalación — Montaje split sobre pre-instalación', 'Montaje split sobre pre-instalación', 141600, 'Pre-instalación y Desinstalación'),
  ('Pre-instalación y Desinstalación — Desinstalación de A.A. hasta 6000 Fg', 'Desinstalación de A.A. hasta 6000 Fg', 106200, 'Pre-instalación y Desinstalación'),

  ('Visita Técnica — Visita técnica (diagnóstico/presupuesto)', 'Visita técnica (diagnóstico/presupuesto)', 35400, 'Visita Técnica'),

  ('Limpieza y Mantenimiento — Hasta 6000 Fg (sin desinstalación)', 'Hasta 6000 Fg (sin desinstalación)', 70800, 'Limpieza y Mantenimiento'),
  ('Limpieza y Mantenimiento — Hasta 6000 Fg (con desinstalación)', 'Hasta 6000 Fg (con desinstalación)', 106200, 'Limpieza y Mantenimiento'),

  ('Detección y Reparación de Fugas — R410a', 'R410a', 106200, 'Detección y Reparación de Fugas'),
  ('Detección y Reparación de Fugas — R22', 'R22', 106200, 'Detección y Reparación de Fugas'),

  ('Recambios — Recambio de capacitor', 'Recambio de capacitor', 70800, 'Recambios'),
  ('Recambios — Recambio de Placa lógica', 'Recambio de Placa lógica', 106200, 'Recambios'),
  ('Recambios — M.O. Recambio de motocompresor', 'Mano de obra de recambio de motocompresor (repuesto no incluido). Precio de referencia estimado, no publicado por la fuente — ajustar si corresponde.', 177000, 'Recambios')
) as v(name, description, price, subcategoria)
where not exists (
  select 1 from public.services s where s.category = 'Refrigeración' and s.name = v.name
);

commit;

select count(*) as items_refrigeracion, count(distinct subcategoria) as subcategorias
from public.services where category = 'Refrigeración';
