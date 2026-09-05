-- Pruebas en vivo (rollback-safe) de Fase 1 del plan de calificaciones
-- (plan-calificaciones-tecnicos.md): RLS de order_ratings, ventanas de
-- 30 dias (alta) / 48 horas (edicion), inmutabilidad de campos clave, y
-- el fix de lock_technician_admin_fields para que el recalculo de
-- technicians.rating no se revierta. Termina en ROLLBACK — no persiste
-- nada en producción.
--
-- Corrida el 5/9/2026 contra el proyecto dev: 15/15 OK.
--
-- Admin:     admin@tecniurbano.com.ar (profile 9a499958-d5d6-40aa-bbb6-047a49a817ec)
-- Tecnico:   maria.rodriguez@servicasa.com.ar (profile 3ef7d581-b040-4669-88bf-d572ab4b4ac4, technician a1df8a0c-fa2b-45da-9d96-d6756c8074c0)
-- Tecnico:   carlos.mendez@servicasa.com.ar   (profile 2bb43f99-f0da-428d-b8f2-2439e10db5ce, technician ea81fb7e-f758-49df-81a7-8060d9a5966b)
-- Cliente:   marcos@yahoo.com.ar (profile f4f82018-bfc9-4d69-9aa2-40446a19684a, customer bdca3efe-9d20-47ef-9989-8bae352d1378)
-- Cliente:   julian.albarracin@gmail.com (profile 39921296-0657-4aca-868d-45d7c63c46a7, customer 98f00edc-f715-4db8-86ac-9b11df7e1363)

begin;

create temp table test_results (n numeric, name text, ok boolean, detail text);
grant insert, select on test_results to authenticated;

create temp table test_config (admin_profile_id uuid);
grant select on test_config to authenticated;
insert into test_config select id from profiles where role = 'admin' limit 1;

-- ------------------------------------------------------------------
-- Setup (como owner, RLS no aplica): 4 ordenes sinteticas de Marcos,
-- todas con Maria asignada salvo donde se indica.
-- ------------------------------------------------------------------
-- scheduled_date distinto en cada una: require_eligible_technician_assignment()
-- no deja asignar al mismo tecnico dos "visitas" el mismo dia.
insert into service_orders (
  id, title, description, service_type, priority, status, scheduled_date,
  customer_id, client_name, assigned_technician_id, assigned_technician_name,
  work_mode, service_status, payment_status, completed_at
) values
  ('00000000-0000-4000-8000-000000000701', 'TEST calificaciones - orden completed hace 10 dias', 'desc', 'Plomería', 'media', 'completed',
   current_date - 110, 'bdca3efe-9d20-47ef-9989-8bae352d1378', 'Marcos Abate',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full', now() - interval '10 days'),
  ('00000000-0000-4000-8000-000000000702', 'TEST calificaciones - orden todavia no completed', 'desc', 'Plomería', 'media', 'assigned',
   current_date - 111, 'bdca3efe-9d20-47ef-9989-8bae352d1378', 'Marcos Abate',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'pending', 'pending', null),
  ('00000000-0000-4000-8000-000000000703', 'TEST calificaciones - orden completed hace 40 dias (fuera de ventana)', 'desc', 'Plomería', 'media', 'completed',
   current_date - 112, 'bdca3efe-9d20-47ef-9989-8bae352d1378', 'Marcos Abate',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full', now() - interval '40 days'),
  ('00000000-0000-4000-8000-000000000705', 'TEST calificaciones - orden para probar edicion vencida (>48h)', 'desc', 'Plomería', 'media', 'completed',
   current_date - 113, 'bdca3efe-9d20-47ef-9989-8bae352d1378', 'Marcos Abate',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full', now() - interval '20 days');

-- Calificacion ya vieja (creada "hace 3 dias") sobre la orden 705, insertada
-- directamente para no depender de que el reloj real avance 48hs en el test.
insert into order_ratings (id, order_id, technician_id, customer_id, stars, comment, created_at)
values ('00000000-0000-4000-8000-000000000802', '00000000-0000-4000-8000-000000000705',
        'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'bdca3efe-9d20-47ef-9989-8bae352d1378', 3, 'calificacion vieja',
        now() - interval '3 days');

reset role;

-- ============================================================
-- TEST 1 (positivo): Marcos califica su orden 701 (completed hace 10
-- dias, dentro de los 30 dias) con el tecnico realmente asignado.
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f4f82018-bfc9-4d69-9aa2-40446a19684a', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into order_ratings (id, order_id, technician_id, customer_id, stars, comment)
values ('00000000-0000-4000-8000-000000000801', '00000000-0000-4000-8000-000000000701',
        'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'bdca3efe-9d20-47ef-9989-8bae352d1378', 4, 'buen trabajo');

insert into test_results select 1, 'cliente puede calificar su orden completed dentro de 30 dias',
  exists (select 1 from order_ratings where id = '00000000-0000-4000-8000-000000000801'), 'ok';

-- ============================================================
-- TEST 2 (negativo): no se puede calificar una orden que no esta completed.
-- ============================================================
do $$
begin
  begin
    insert into order_ratings (order_id, technician_id, customer_id, stars)
    values ('00000000-0000-4000-8000-000000000702', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0',
            'bdca3efe-9d20-47ef-9989-8bae352d1378', 5);
    insert into test_results values (2, 'NO se puede calificar una orden no completed (debe fallar)', false, 'no lanzo excepcion');
  exception when others then
    insert into test_results values (2, 'NO se puede calificar una orden no completed (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 3 (negativo): fuera de la ventana de 30 dias desde completed_at.
-- ============================================================
do $$
begin
  begin
    insert into order_ratings (order_id, technician_id, customer_id, stars)
    values ('00000000-0000-4000-8000-000000000703', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0',
            'bdca3efe-9d20-47ef-9989-8bae352d1378', 5);
    insert into test_results values (3, 'NO se puede calificar pasados los 30 dias de completed_at (debe fallar)', false, 'no lanzo excepcion');
  exception when others then
    insert into test_results values (3, 'NO se puede calificar pasados los 30 dias de completed_at (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 4 (negativo): technician_id debe coincidir con el asignado real
-- (Marcos intenta calificar a Carlos por un trabajo que hizo Maria).
-- ============================================================
do $$
begin
  begin
    insert into order_ratings (order_id, technician_id, customer_id, stars)
    values ('00000000-0000-4000-8000-000000000701', 'ea81fb7e-f758-49df-81a7-8060d9a5966b',
            'bdca3efe-9d20-47ef-9989-8bae352d1378', 1);
    insert into test_results values (4, 'NO se puede calificar a un tecnico que no es el asignado (debe fallar)', false, 'no lanzo excepcion');
  exception when others then
    insert into test_results values (4, 'NO se puede calificar a un tecnico que no es el asignado (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 5 (negativo): un cliente no puede calificar la orden de otro.
-- ============================================================
select set_config('request.jwt.claim.sub', '39921296-0657-4aca-868d-45d7c63c46a7', true); -- Julian

do $$
begin
  begin
    insert into order_ratings (order_id, technician_id, customer_id, stars)
    values ('00000000-0000-4000-8000-000000000703', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0',
            '98f00edc-f715-4db8-86ac-9b11df7e1363', 5);
    insert into test_results values (5, 'un cliente NO puede calificar la orden de otro cliente (debe fallar)', false, 'no lanzo excepcion');
  exception when others then
    insert into test_results values (5, 'un cliente NO puede calificar la orden de otro cliente (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 6 (positivo): Marcos edita su propia calificacion (creada hace
-- instantes, dentro de las 48hs) y el rating de Maria se recalcula.
-- ============================================================
select set_config('request.jwt.claim.sub', 'f4f82018-bfc9-4d69-9aa2-40446a19684a', true); -- Marcos

update order_ratings set stars = 2, comment = 'lo pienso mejor' where id = '00000000-0000-4000-8000-000000000801';

insert into test_results select 6, 'cliente puede editar su calificacion dentro de las 48hs',
  (select stars from order_ratings where id = '00000000-0000-4000-8000-000000000801') = 2, 'ok';

-- ============================================================
-- TEST 7 (negativo): NO puede editar una calificacion de mas de 48hs
-- (la 802, insertada con created_at de "hace 3 dias"). RLS filtra la fila:
-- 0 filas afectadas, sin excepcion.
-- ============================================================
update order_ratings set stars = 1 where id = '00000000-0000-4000-8000-000000000802';

insert into test_results select 7, 'NO puede editar una calificacion de mas de 48hs (0 filas afectadas)',
  (select stars from order_ratings where id = '00000000-0000-4000-8000-000000000802') = 3, 'ok';

-- ============================================================
-- TEST 8 (inmutabilidad): Marcos intenta, dentro de la ventana de 48hs,
-- correr su calificacion a otra orden. El trigger lo revierte en
-- silencio (RLS permite el UPDATE porque sigue siendo su fila, pero
-- order_id no cambia).
-- ============================================================
update order_ratings set order_id = '00000000-0000-4000-8000-000000000703' where id = '00000000-0000-4000-8000-000000000801';

insert into test_results select 8, 'order_id es inmutable aunque el cliente lo intente cambiar',
  (select order_id from order_ratings where id = '00000000-0000-4000-8000-000000000801') = '00000000-0000-4000-8000-000000000701',
  'ok';

-- ============================================================
-- TEST 9 (negativo, DELETE): nadie puede borrar una calificacion (v1).
-- ============================================================
delete from order_ratings where id = '00000000-0000-4000-8000-000000000801';

insert into test_results select 9, 'NO se puede borrar una calificacion (0 filas afectadas)',
  exists (select 1 from order_ratings where id = '00000000-0000-4000-8000-000000000801'), 'ok';

-- ============================================================
-- TEST 10 (negativo): el tecnico NO puede calificarse a si mismo
-- (su perfil no tiene customer_id, asi que nunca matchea).
-- ============================================================
select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true); -- Maria (tecnico)

do $$
begin
  begin
    insert into order_ratings (order_id, technician_id, customer_id, stars)
    values ('00000000-0000-4000-8000-000000000701', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0',
            'bdca3efe-9d20-47ef-9989-8bae352d1378', 5);
    insert into test_results values (10, 'el tecnico NO puede insertar una calificacion (debe fallar)', false, 'no lanzo excepcion');
  exception when others then
    insert into test_results values (10, 'el tecnico NO puede insertar una calificacion (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 11 (RLS select positivo): Maria (tecnico asignado) ve la
-- calificacion de su propia orden.
-- ============================================================
insert into test_results select 11, 'el tecnico asignado ve la calificacion de su orden',
  exists (select 1 from order_ratings where order_id = '00000000-0000-4000-8000-000000000705'), 'ok';

-- ============================================================
-- TEST 12 (RLS select negativo): Carlos (otro tecnico, no asignado) NO
-- ve la calificacion de la orden de Maria.
-- ============================================================
select set_config('request.jwt.claim.sub', '2bb43f99-f0da-428d-b8f2-2439e10db5ce', true); -- Carlos

insert into test_results select 12, 'otro tecnico NO ve la calificacion ajena',
  not exists (select 1 from order_ratings where order_id = '00000000-0000-4000-8000-000000000705'), 'ok';

-- ============================================================
-- TEST 13 (RLS select positivo, admin): el admin ve todo.
-- ============================================================
select set_config('request.jwt.claim.sub', (select admin_profile_id::text from test_config), true);

insert into test_results select 13, 'el admin ve todas las calificaciones',
  (select count(*) from order_ratings) >= 2, 'ok';

-- ============================================================
-- TEST 14 (la trampa real de Fase 1): el recalculo de technicians.rating
-- disparado por el INSERT del cliente en el TEST 1 realmente se aplico
-- -- es decir, lock_technician_admin_fields no lo revirtio. En este punto
-- Maria tiene 2 calificaciones reales: la 801 (editada a 2 en TEST 6) y
-- la 802 (3, la vieja). Esperado: (4*5 + 2 + 3) / (4+2) = 25/6 = 4.17.
-- ============================================================
insert into test_results select 14, 'technicians.rating se recalculo solo via el trigger (no quedo en 5.00 fijo)',
  (select rating from technicians where id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0') = 4.17,
  'rating=' || (select rating::text from technicians where id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0');

-- ============================================================
-- TEST 15: total_ratings_count en technician_public_view refleja las
-- calificaciones reales de Maria (2 en este punto).
-- ============================================================
insert into test_results select 15, 'technician_public_view.total_ratings_count = 2 para Maria',
  (select total_ratings_count from technician_public_view where id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0') = 2,
  'ok';

-- ============================================================
-- TEST 16: unique(order_id) — un segundo INSERT del dueño real sobre la
-- misma orden (701, ya calificada con id 801 en el TEST 1) debe fallar
-- por unique_violation (23505), no por RLS: el WITH CHECK lo deja pasar,
-- es la constraint de la tabla la que lo frena.
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', 'f4f82018-bfc9-4d69-9aa2-40446a19684a', true); -- Marcos
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    insert into order_ratings (order_id, technician_id, customer_id, stars)
    values ('00000000-0000-4000-8000-000000000701', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0',
            'bdca3efe-9d20-47ef-9989-8bae352d1378', 4);
    insert into test_results select 16, 'unique(order_id): 2do insert sobre 701 debio fallar', false, 'no lanzo error';
  exception when unique_violation then
    insert into test_results select 16, 'unique(order_id): 2do insert sobre 701 debio fallar', true, 'ok (23505)';
  when others then
    insert into test_results select 16, 'unique(order_id): 2do insert sobre 701 debio fallar', false, 'error inesperado: ' || sqlstate;
  end;
end $$;

reset role;


select * from test_results order by n;

rollback;
