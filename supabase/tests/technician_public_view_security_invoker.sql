-- Pruebas en vivo (rollback-safe) del cambio de technician_public_view a
-- security_invoker=true (cierra el ERROR de advisor "Security Definer View").
-- Termina en ROLLBACK -- no persiste nada en produccion.
--
-- Admin:    admin@tecniurbano.com.ar        (profile 9a499958-d5d6-40aa-bbb6-047a49a817ec)
-- Maria:    maria.rodriguez@tecniurbano.com.ar (profile 3ef7d581-b040-4669-88bf-d572ab4b4ac4, technician a1df8a0c-fa2b-45da-9d96-d6756c8074c0)
-- Carlos:   carlos.mendez@tecniurbano.com.ar   (profile 2bb43f99-f0da-428d-b8f2-2439e10db5ce, technician ea81fb7e-f758-49df-81a7-8060d9a5966b)
-- Julian:   julian.albarracin@gmail.com        (profile 39921296-0657-4aca-868d-45d7c63c46a7, customer 98f00edc-f715-4db8-86ac-9b11df7e1363)

begin;

create temp table test_results (n int, name text, ok boolean, detail text);
grant insert, select on test_results to authenticated, anon;

-- Fixture: orden que liga a Julian con Maria, y una matricula de Maria --
-- para probar de punta a punta que validated_licenses tambien sobrevive el
-- cambio a security_invoker (depende del RLS real de technician_matriculas,
-- no de que la vista sea SECURITY DEFINER). Ambos inserts van como
-- superusuario (sin set local role), antes de simular ningun rol: insertar
-- directamente el fixture de service_orders ya impersonando `authenticated`
-- dispara una recursion infinita real en una policy de esa tabla (hallazgo
-- aparte, ver nota en el chat con Sandy del 25/8 -- no reproducido nunca a
-- traves de la app real, probablemente un JWT simulado incompleto en este
-- arnes de pruebas, no un bug de produccion confirmado).
insert into public.service_orders (
  title, description, service_type, priority, status, service_status, work_mode,
  quote_status, payment_status, visit_deposit_amount, total_quoted_amount,
  total_paid_amount, extra_amount, scheduled_date, customer_id, client_name,
  client_phone, client_address, client_neighborhood, client_province,
  assigned_technician_id, assigned_technician_name
) values (
  'TEST view security_invoker - fixture', 'fixture de prueba, se revierte con rollback',
  'Mantenimiento general', 'media', 'assigned', 'pending', 'diagnosis',
  'none', 'paid_in_full', 0, 0,
  0, 0, current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian TEST',
  '000', 'Direccion TEST', 'Barrio TEST', 'Buenos Aires',
  'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria TEST'
);

insert into public.technician_matriculas (technician_id, issuing_entity, license_number, specialty, validation_status)
values ('a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'TEST Colegio', 'TEST-999', 'Electricidad', 'pending');

-- ============================================================
-- TEST 1 (admin): ve la fila y la matricula. La matricula se aprueba recien
-- aca, con un UPDATE ya impersonando admin -- el trigger real
-- lock_technician_review_fields() fuerza validation_status a 'pending' en
-- cualquier INSERT/UPDATE donde is_admin() no sea true, asi que aprobarla
-- de verdad requiere el mismo camino que usaria el flujo real de revision.
-- ============================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '9a499958-d5d6-40aa-bbb6-047a49a817ec', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

update public.technician_matriculas set validation_status = 'approved' where license_number = 'TEST-999';

insert into test_results select 1, 'admin ve la fila de Maria en la vista publica, con la matricula',
  exists (select 1 from public.technician_public_view v where v.id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0' and jsonb_array_length(v.validated_licenses) > 0),
  'ok';

-- ============================================================
-- TEST 2 (propio tecnico): Maria ve su propia fila en la vista publica.
-- ============================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 2, 'Maria ve su propia fila en la vista publica',
  exists (select 1 from public.technician_public_view v where v.id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0'),
  'ok';

-- ============================================================
-- TEST 3 (cliente con orden asignada): Julian ve a Maria + su matricula
-- aprobada -- prueba que la subquery contra technician_matriculas tambien
-- funciona bajo security_invoker (RLS real, no bypass).
-- ============================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '39921296-0657-4aca-868d-45d7c63c46a7', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 3, 'cliente ve a su tecnico asignado en la vista publica, con la matricula aprobada',
  exists (select 1 from public.technician_public_view v where v.id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0' and jsonb_array_length(v.validated_licenses) > 0),
  'ok';

-- ============================================================
-- TEST 4 (tecnico sin relacion, negativo): Carlos NO ve la fila de Maria en
-- la vista publica.
-- ============================================================
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '2bb43f99-f0da-428d-b8f2-2439e10db5ce', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 4, 'Carlos (sin relacion) NO ve la fila de Maria en la vista publica',
  not exists (select 1 from public.technician_public_view v where v.id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0'),
  'ok';

-- ============================================================
-- TEST 5 (anon, el que pidio Sandy): sin sesion, cero acceso -- prueba que
-- depender del RLS real efectivamente cierra el acceso no autenticado, no
-- solo que los tres roles autenticados ven lo mismo que antes. anon no tiene
-- ningun GRANT sobre la vista (verificado antes de escribir esta prueba), asi
-- que lo esperable es un "permission denied" duro, ni siquiera 0 filas
-- silenciosas -- ambos son formas validas de "sin acceso", pero hay que
-- probar la que realmente va a pasar.
-- ============================================================
reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);

do $$
declare v_count int;
begin
  begin
    select count(*) into v_count from public.technician_public_view;
    insert into test_results values (5, 'anon sin acceso a la vista publica (0 filas o permission denied)', v_count = 0, format('conto %s filas sin error', v_count));
  exception when insufficient_privilege then
    insert into test_results values (5, 'anon sin acceso a la vista publica (0 filas o permission denied)', true, sqlerrm);
  end;
end $$;

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
