-- Pruebas en vivo (rollback-safe) de Fase 6: metas y elegibilidad técnica.
-- Termina en ROLLBACK — no persiste nada en producción.
--
-- Tecnico: maria.rodriguez@tecniurbano.com.ar (profile 3ef7d581-b040-4669-88bf-d572ab4b4ac4, technician a1df8a0c-fa2b-45da-9d96-d6756c8074c0)
-- Tecnico2: carlos.mendez@tecniurbano.com.ar   (profile 2bb43f99-f0da-428d-b8f2-2439e10db5ce, technician ea81fb7e-f758-49df-81a7-8060d9a5966b)

begin;

create temp table test_results (n int, name text, ok boolean, detail text);
grant insert, select on test_results to authenticated;

-- ============================================================
-- TEST 1: elegibilidad consolidada — ya probado en la migración anterior
-- (tighten_technician_assignment_eligibility); acá solo se reconfirma que
-- el trigger sigue activo tras la migración de metas.
-- ============================================================
insert into test_results select 1, 'trigger de elegibilidad sigue activo',
  exists (select 1 from pg_trigger where tgname = 'require_eligible_technician_assignment' or tgname ilike '%eligible%'),
  'ok';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- ============================================================
-- TEST 2: set_technician_goal() crea una meta activa.
-- ============================================================
select public.set_technician_goal('weekly_jobs', null, 3);

insert into test_results select 2, 'se creó una meta activa weekly_jobs con target_count=3',
  exists (select 1 from technician_goals where technician_id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0' and goal_type = 'weekly_jobs' and is_active and target_count = 3),
  'ok';

-- ============================================================
-- TEST 3: llamar de nuevo con el mismo tipo reemplaza atómicamente (la
-- vieja pasa a inactiva, la nueva es la única activa) — nunca dos activas.
-- ============================================================
select public.set_technician_goal('weekly_jobs', null, 5);

insert into test_results select 3, 'reemplazo atómico: solo 1 meta activa de weekly_jobs, con el valor nuevo',
  (select count(*) from technician_goals where technician_id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0' and goal_type = 'weekly_jobs' and is_active) = 1
  and (select target_count from technician_goals where technician_id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0' and goal_type = 'weekly_jobs' and is_active) = 5,
  'ok';

insert into test_results select 4, 'la meta vieja (target=3) quedó inactiva, no borrada (historial)',
  exists (select 1 from technician_goals where technician_id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0' and goal_type = 'weekly_jobs' and not is_active and target_count = 3),
  'ok';

-- ============================================================
-- TEST 5 (negativo): monthly_earnings sin target_amount debe fallar.
-- ============================================================
do $$
begin
  begin
    perform public.set_technician_goal('monthly_earnings', null, null);
    insert into test_results values (5, 'monthly_earnings sin target_amount falla (debe fallar)', false, 'no lanzó excepción');
  exception when others then
    insert into test_results values (5, 'monthly_earnings sin target_amount falla (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 6 (negativo): tipo de meta inválido debe fallar.
-- ============================================================
do $$
begin
  begin
    perform public.set_technician_goal('yearly_earnings', 1000, null);
    insert into test_results values (6, 'tipo de meta inválido falla (debe fallar)', false, 'no lanzó excepción');
  exception when others then
    insert into test_results values (6, 'tipo de meta inválido falla (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 7 (defensa en profundidad): el índice único parcial bloquea 2
-- activas del mismo tipo aunque alguien intente insertar directo (sin
-- pasar por la RPC).
-- ============================================================
do $$
begin
  begin
    insert into technician_goals (technician_id, goal_type, target_count, is_active)
    values ('a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'weekly_jobs', 10, true);
    insert into test_results values (7, 'insert directo de una 2da meta activa del mismo tipo falla (debe fallar)', false, 'no lanzó excepción');
  exception when others then
    insert into test_results values (7, 'insert directo de una 2da meta activa del mismo tipo falla (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 8 (RLS negativo): un técnico no puede crear una meta para otro
-- técnico manipulando el technician_id directamente en un insert (RPC
-- resuelve por auth.uid(), pero se prueba también el insert directo).
-- ============================================================
do $$
begin
  begin
    insert into technician_goals (technician_id, goal_type, target_count, is_active)
    values ('ea81fb7e-f758-49df-81a7-8060d9a5966b', 'monthly_jobs', 20, true);
    insert into test_results values (8, 'técnico NO puede crear una meta para otro técnico (debe fallar)', false, 'no lanzó excepción');
  exception when others then
    insert into test_results values (8, 'técnico NO puede crear una meta para otro técnico (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 9 (RLS negativo): un técnico no ve las metas de otro.
-- ============================================================
select set_config('request.jwt.claim.sub', '2bb43f99-f0da-428d-b8f2-2439e10db5ce', true);

insert into test_results select 9, 'Carlos no ve las metas de María',
  not exists (select 1 from technician_goals where technician_id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0'),
  'ok';

reset role;

select * from test_results order by n;

rollback;
