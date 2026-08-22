-- ServiCasa — carga el tarifario real de Albañilería (categoría "Reparaciones
-- del hogar") en public.services, mismo criterio que Pintura, Electricidad,
-- Refrigeración, Plomería, Cerrajería y Soldadura:
--   price = precio del JSON (tarifario_albanileria_seed.json, promediado
--   entre clickie.com.ar, servidos.ar y todoresuelto.com donde coinciden en
--   el mismo concepto) x 1.18 de margen, redondeado a la centena.
-- Se excluyeron a propósito las reformas/paquetes grandes (reforma de baño,
-- baño nuevo completo, ampliación de casa/cocina, pileta, quincho) y la
-- apertura de pared portante (requiere cálculo estructural caso por caso):
-- ver tarifario_albanileria_seed.json para el detalle de por qué.
-- No toca ningún otro rubro ni el ítem de Pintura ya cargado en esta misma
-- categoría (nombres distintos, sin colisión).
--
-- Idempotente: cada insert solo corre si no existe ya un `services` con la
-- misma category+name.
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

insert into public.services (name, description, price, category, subcategoria, active)
select v.name, v.description, v.price, 'Reparaciones del hogar', v.subcategoria, true
from (values
  ('Revoques y Tabiques — Revoque grueso', 'Revoque grueso', 16600, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Revoque fino', 'Revoque fino (enlucido)', 13900, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Revoque completo', 'Revoque completo (grueso + fino), listo para pintar', 28000, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Picado de revoque viejo', 'Picado de revoque viejo, sin retiro de escombro', 6100, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Pared de ladrillo hueco', 'Pared de ladrillo hueco', 30700, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Tabique de ladrillo común', 'Tabique de ladrillo común, incluye revoque grueso', 46000, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Tabique de durlock simple', 'Tabique de durlock simple, mano de obra sin placas', 37200, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Tabique de durlock doble', 'Tabique de durlock doble, mano de obra sin placas ni aislante', 51900, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Yeso aplicado', 'Yeso aplicado, terminación lista para pintar', 12600, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Encadenado de hormigón armado', 'Encadenado de hormigón armado', 20700, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Losa de hormigón armado', 'Losa de hormigón armado, incluye encofrado, hierro y hormigón', 135700, 'Revoques y Tabiques'),
  ('Revoques y Tabiques — Colocación de placa antihumedad', 'Colocación de placa antihumedad', 15900, 'Revoques y Tabiques'),

  ('Pisos y Revestimientos — Colocación de cerámica', 'Colocación de cerámica, sin el material (piso o pared)', 16600, 'Pisos y Revestimientos'),
  ('Pisos y Revestimientos — Colocación de porcellanato', 'Colocación de porcellanato, sin el material', 28000, 'Pisos y Revestimientos'),
  ('Pisos y Revestimientos — Colocación de baldosas', 'Colocación de baldosas, sin el material', 22100, 'Pisos y Revestimientos'),
  ('Pisos y Revestimientos — Colocación de venecitas o mosaicos', 'Colocación de venecitas o mosaicos', 18900, 'Pisos y Revestimientos'),
  ('Pisos y Revestimientos — Microcemento alisado', 'Microcemento alisado', 18600, 'Pisos y Revestimientos'),
  ('Pisos y Revestimientos — Piso flotante', 'Piso flotante, mano de obra sin el piso', 16100, 'Pisos y Revestimientos'),

  ('Contrapisos — Contrapiso de hormigón', 'Contrapiso de hormigón, espesor estándar', 21200, 'Contrapisos'),
  ('Contrapisos — Carpeta cementicia de nivelación', 'Carpeta cementicia de nivelación', 14200, 'Contrapisos'),

  ('Impermeabilización — Impermeabilización de azotea o terraza', 'Impermeabilización de azotea o terraza, incluye membrana', 37200, 'Impermeabilización'),
  ('Impermeabilización — Reparación de humedad', 'Reparación de humedad, según extensión y causa', 100300, 'Impermeabilización'),

  ('Demoliciones — Demolición de piso existente', 'Demolición de piso existente, sin retiro de escombro', 16900, 'Demoliciones'),
  ('Demoliciones — Demolición de tabique no estructural', 'Demolición de tabique no estructural, sin retiro de escombro', 67300, 'Demoliciones'),
  ('Demoliciones — Retiro de escombros por volquete', 'Retiro de escombros por volquete (4 m³)', 122100, 'Demoliciones'),

  ('Aberturas y Vanos — Apertura de vano no estructural', 'Apertura de vano no estructural para puerta o ventana, incluye dintel si es necesario', 154000, 'Aberturas y Vanos'),
  ('Aberturas y Vanos — Cierre de vano', 'Cierre de vano, mampostería y revoque', 94400, 'Aberturas y Vanos'),

  ('Veredas — Vereda de hormigón alisada', 'Vereda de hormigón alisada, incluye encofrado y terminación', 40100, 'Veredas'),
  ('Veredas — Vereda de baldosa cementicia', 'Vereda de baldosa cementicia, colocación sin las baldosas', 30700, 'Veredas'),
  ('Veredas — Bajada de cordón estándar', 'Bajada de cordón estándar', 26600, 'Veredas'),

  ('Trabajos Puntuales — Reparación de grietas (albañilería)', 'Reparación de grietas (albañilería)', 12700, 'Trabajos Puntuales'),
  ('Trabajos Puntuales — Reparación de rajadura estructural', 'Reparación de rajadura estructural, según tamaño y profundidad', 59000, 'Trabajos Puntuales'),
  ('Trabajos Puntuales — Cambio de mesada de cocina', 'Cambio de mesada de cocina, mano de obra sin la mesada', 215400, 'Trabajos Puntuales'),
  ('Trabajos Puntuales — Jornal de albañil', 'Jornal de albañil por reparaciones varias (día de 8 horas)', 34200, 'Trabajos Puntuales'),
  ('Trabajos Puntuales — Limpieza de cerámica post-pegado', 'Limpieza de cerámica o porcelanato post-pegado (retiro de pastina)', 3000, 'Trabajos Puntuales')
) as v(name, description, price, subcategoria)
where not exists (
  select 1 from public.services s where s.category = 'Reparaciones del hogar' and s.name = v.name
);

commit;

select count(*) as items_reparaciones_hogar, count(distinct subcategoria) as subcategorias
from public.services where category = 'Reparaciones del hogar';
