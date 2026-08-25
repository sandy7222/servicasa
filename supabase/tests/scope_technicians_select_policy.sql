-- Pruebas en vivo (rollback-safe) del hallazgo de seguridad de Fase 8:
-- technicians_select_authenticated tenía USING (true). Reemplazada por
-- technicians_select_scoped (migración 20260825130000). Termina en
-- ROLLBACK — no persiste nada en producción.
--
-- Admin:    admin@tecniurbano.com.ar        (profile 9a499958-d5d6-40aa-bbb6-047a49a817ec)
-- Maria:    maria.rodriguez@tecniurbano.com.ar (profile 3ef7d581-b040-4669-88bf-d572ab4b4ac4, technician a1df8a0c-fa2b-45da-9d96-d6756c8074c0)
-- Carlos:   carlos.mendez@tecniurbano.com.ar   (profile 2bb43f99-f0da-428d-b8f2-2439e10db5ce, technician ea81fb7e-f758-49df-81a7-8060d9a5966b)
-- Julian:   julian.albarracin@gmail.com        (profile 39921296-0657-4aca-868d-45d7c63c46a7, customer 98f00edc-f715-4db8-86ac-9b11df7e1363)

begin;

create temp table test_results (n int, name text, ok boolean, detail text);
grant insert, select on test_results to authenticated;

-- Total real de técnicos, medido como superusuario, para comparar contra lo
-- que ve el admin autenticado más abajo.
do $$
declare v_total int;
begin
  select count(*) into v_total from public.technicians;
  perform set_config('test.total_technicians', v_total::text, false);
end $$;

-- Fixture: una orden real que liga a Julian (cliente) con Maria (técnica
-- asignada) — es la única forma en que un cliente debería poder ver la fila
-- de un técnico bajo la política nueva.
insert into public.service_orders (
  title, description, service_type, priority, status, service_status, work_mode,
  quote_status, payment_status, visit_deposit_amount, total_quoted_amount,
  total_paid_amount, extra_amount, scheduled_date, customer_id, client_name,
  client_phone, client_address, client_neighborhood, client_province,
  assigned_technician_id, assigned_technician_name
) values (
  'TEST RLS technicians - fixture', 'fixture de prueba, se revierte con rollback',
  'Mantenimiento general', 'media', 'assigned', 'pending', 'diagnosis',
  'none', 'paid_in_full', 0, 0,
  0, 0, current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian TEST',
  '000', 'Direccion TEST', 'Barrio TEST', 'Buenos Aires',
  'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria TEST'
);

-- ============================================================
-- TEST 1 (cliente): Julian ve la fila de Maria (su técnica asignada)...
-- ============================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '39921296-0657-4aca-868d-45d7c63c46a7', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 1, 'cliente ve la fila de su tecnico asignado (Maria)',
  exists (select 1 from public.technicians where id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0'),
  'ok';

-- ============================================================
-- TEST 2 (cliente, negativo): ...pero NO la de Carlos, con quien no tiene
-- ninguna orden.
-- ============================================================
insert into test_results select 2, 'cliente NO ve la fila de un tecnico sin relacion (Carlos)',
  not exists (select 1 from public.technicians where id = 'ea81fb7e-f758-49df-81a7-8060d9a5966b'),
  'ok';

insert into test_results select 3, 'cliente ve exactamente 1 fila de technicians en total',
  (select count(*) from public.technicians) = 1,
  'ok';

-- ============================================================
-- TEST 4 (tecnico, positivo): Maria ve su propia fila.
-- ============================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 4, 'tecnico ve su propia fila (Maria)',
  exists (select 1 from public.technicians where id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0'),
  'ok';

-- ============================================================
-- TEST 5 (tecnico, negativo — el punto que pidio Sandy): Maria NO ve la
-- fila de su colega Carlos, aunque ambos sean tecnicos.
-- ============================================================
insert into test_results select 5, 'tecnico NO ve la fila de un colega (Maria no ve a Carlos)',
  not exists (select 1 from public.technicians where id = 'ea81fb7e-f758-49df-81a7-8060d9a5966b'),
  'ok';

insert into test_results select 6, 'tecnico ve exactamente 1 fila de technicians en total (la propia)',
  (select count(*) from public.technicians) = 1,
  'ok';

-- ============================================================
-- TEST 7 (tecnico simetrico): Carlos, por su lado, tampoco ve a Maria.
-- ============================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '2bb43f99-f0da-428d-b8f2-2439e10db5ce', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 7, 'Carlos ve su propia fila pero no la de Maria',
  exists (select 1 from public.technicians where id = 'ea81fb7e-f758-49df-81a7-8060d9a5966b')
  and not exists (select 1 from public.technicians where id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0'),
  'ok';

-- ============================================================
-- TEST 8 (admin): sigue viendo todas las filas, sin excepcion.
-- ============================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '9a499958-d5d6-40aa-bbb6-047a49a817ec', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 8, 'admin ve todas las filas de technicians, sin excepcion',
  (select count(*) from public.technicians) = current_setting('test.total_technicians')::int,
  'ok';

reset role;

select * from test_results order by n;

do $$
declare v_failed int;
begin
  select count(*) into v_failed from test_results where not ok;
  if v_failed > 0 then
    raise exception '% prueba(s) fallaron', v_failed;
  end if;
end $$;

rollback;
