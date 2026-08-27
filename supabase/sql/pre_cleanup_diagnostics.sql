-- Diagnóstico antes de borrar las 19 órdenes de prueba. Solo lectura.

-- 1) Confirmar el caso "todo dice Electricidad": para cada orden de precio
-- fijo, comparamos el rubro guardado en la orden contra el rubro real del
-- servicio de catálogo que se contrató. Si coinciden, no es un bug — es que
-- el selector de Rubro se dejó en Electricidad (su valor por defecto) al
-- probar.
select so.id, so.title, so.service_type as rubro_guardado_en_la_orden, s.category as rubro_real_del_servicio, s.name as servicio_elegido
from public.service_orders so
left join public.services s on s.id = so.fixed_price_service_id
where so.work_mode = 'direct'
order by so.created_at desc;

-- 2) Todas las tablas que tienen una foreign key hacia service_orders y qué
-- hacen al borrar (CASCADE / RESTRICT / SET NULL) — para armar el script de
-- limpieza en el orden correcto sin que falle por una restricción.
select tc.table_name, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.referential_constraints rc on rc.constraint_name = tc.constraint_name and rc.constraint_schema = tc.table_schema
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY' and ccu.table_name = 'service_orders' and tc.table_schema = 'public';

-- 3) La lista completa de las 19 órdenes, para que confirmes que es
-- exactamente lo que querés borrar antes de que te pase el script de borrado.
select id, title, client_name, work_mode, payment_status, created_at
from public.service_orders
order by created_at desc;
