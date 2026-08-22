-- ServiCasa — carga el tarifario real de Cerrajería en public.services,
-- mismo criterio que Electricidad, Refrigeración y Plomería:
--   price = precio del JSON (tarifario_cerrajeria_seed.json, promediado
--   entre Muovi y Roomix donde ambas fuentes coinciden) x 1.18 de margen,
--   redondeado a la centena.
-- No incluye "visita técnica" (ya está fijada por la plataforma), recargos
-- por urgencia/nocturnidad (porcentajes o tarifas de llamado, no ítems de
-- catálogo), llaves con chip para autos (fuera del rubro hogar), ni el costo
-- de la cerradura/herraje en sí (mano de obra únicamente). No toca
-- Electricidad, Refrigeración, Plomería ni Soldadura.
--
-- Idempotente: cada insert solo corre si no existe ya un `services` con la
-- misma category+name.
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

insert into public.services (name, description, price, category, subcategoria, active)
select v.name, v.description, v.price, 'Cerrajería', v.subcategoria, true
from (values
  ('Aperturas — Apertura de puerta sin dañar la cerradura', 'Apertura de puerta sin dañar la cerradura', 50200, 'Aperturas'),
  ('Aperturas — Apertura de caja fuerte', 'Apertura de caja fuerte', 147500, 'Aperturas'),

  ('Cerraduras — Cambio de cerradura (mano de obra, cerradura aparte)', 'Cambio de cerradura (mano de obra, cerradura aparte)', 45700, 'Cerraduras'),
  ('Cerraduras — Instalación de cerradura nueva (mano de obra, cerradura aparte)', 'Instalación de cerradura nueva (mano de obra, cerradura aparte)', 76700, 'Cerraduras'),
  ('Cerraduras — Instalación de cerradura inteligente / electrónica (mano de obra, equipo aparte)', 'Instalación de cerradura inteligente / electrónica (mano de obra, equipo aparte)', 118000, 'Cerraduras'),
  ('Cerraduras — Reparación de cerradura (ajuste sin cambio)', 'Reparación de cerradura (ajuste sin cambio)', 41300, 'Cerraduras'),

  ('Llaves — Copia de llave estándar', 'Copia de llave estándar', 6800, 'Llaves'),
  ('Llaves — Copia de llave de alta seguridad (ISEO, Mul-T-Lock)', 'Copia de llave de alta seguridad (ISEO, Mul-T-Lock)', 32500, 'Llaves'),

  ('Herrajes de Seguridad — Instalación de cerrojo o pasador adicional (mano de obra, herraje aparte)', 'Instalación de cerrojo o pasador adicional (mano de obra, herraje aparte)', 29500, 'Herrajes de Seguridad')
) as v(name, description, price, subcategoria)
where not exists (
  select 1 from public.services s where s.category = 'Cerrajería' and s.name = v.name
);

commit;

select count(*) as items_cerrajeria, count(distinct subcategoria) as subcategorias
from public.services where category = 'Cerrajería';
