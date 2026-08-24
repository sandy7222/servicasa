-- Pruebas en vivo (rollback-safe) de Fase 5: liberación por Cron, cierre de
-- lote atómico/idempotente, integración con reclamos y notificaciones, y
-- permisos. Termina en ROLLBACK — no persiste nada en producción.
--
-- Admin:    admin@tecniurbano.com.ar
-- Tecnico:  maria.rodriguez@tecniurbano.com.ar (profile 3ef7d581-b040-4669-88bf-d572ab4b4ac4, technician a1df8a0c-fa2b-45da-9d96-d6756c8074c0)
-- Cliente:  julian.albarracin@gmail.com        (customer 98f00edc-f715-4db8-86ac-9b11df7e1363)

begin;

create temp table test_results (n int, name text, ok boolean, detail text);
grant insert, select on test_results to authenticated;

create temp table test_config (admin_profile_id uuid);
grant select on test_config to authenticated;
insert into test_config select id from profiles where role = 'admin' limit 1;

-- ------------------------------------------------------------------
-- Setup: dos órdenes reales de Julián, terminadas, con liquidaciones de
-- prueba en distintos estados.
-- ------------------------------------------------------------------
insert into service_orders (
  id, title, description, service_type, priority, status, scheduled_date,
  customer_id, client_name, assigned_technician_id, assigned_technician_name,
  work_mode, service_status, payment_status
) values
  ('00000000-0000-4000-8000-000000000501', 'TEST Fase5 - orden A', 'desc', 'Plomería', 'media', 'completed',
   current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Albarracin',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full'),
  ('00000000-0000-4000-8000-000000000502', 'TEST Fase5 - orden B', 'desc', 'Plomería', 'media', 'completed',
   current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Albarracin',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full');

insert into technician_settlements (id, order_id, technician_id, settlement_type, gross_amount, platform_commission_amount, payment_fee_amount, net_amount, status, release_date)
values
  ('00000000-0000-4000-8000-000000000511', '00000000-0000-4000-8000-000000000501', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'completed_work', 10000, 1500, 300, 8200, 'pending_release', now() - interval '1 day'), -- vencida, sin disputa: debe liberarse
  ('00000000-0000-4000-8000-000000000512', '00000000-0000-4000-8000-000000000502', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'completed_work', 5000, 750, 150, 4100, 'pending_release', now() + interval '5 day'); -- todavía no vence: NO debe liberarse

-- ============================================================
-- TEST 1-2: release_due_technician_settlements() libera solo lo vencido.
-- ============================================================
create temp table release_run (n int, released int);
insert into release_run select 1, public.release_due_technician_settlements();

insert into test_results select 1, 'primera corrida libera exactamente 1 (la vencida)',
  (select released from release_run where n = 1) = 1,
  'released=' || (select released::text from release_run where n = 1);

insert into test_results select 2, 'la vencida quedó released, la futura sigue pending_release',
  (select status from technician_settlements where id = '00000000-0000-4000-8000-000000000511') = 'released'
  and (select status from technician_settlements where id = '00000000-0000-4000-8000-000000000512') = 'pending_release',
  'ok';

-- ============================================================
-- TEST 3: doble ejecución del cron produce el mismo resultado (segunda
-- corrida no libera nada más, porque ya no hay pending_release vencida).
-- ============================================================
insert into release_run select 2, public.release_due_technician_settlements();

insert into test_results select 3, 'segunda corrida no libera nada más (idempotente)',
  (select released from release_run where n = 2) = 0,
  'released=' || (select released::text from release_run where n = 2);

insert into test_results select 4, 'liberar generó notificación settlement_released para la técnica',
  exists (select 1 from notifications where dedupe_key = 'settlement_released:00000000-0000-4000-8000-000000000511' and recipient_profile_id = '3ef7d581-b040-4669-88bf-d572ab4b4ac4'),
  'ok';

-- ============================================================
-- TEST 5: reclamos — pausar una liquidación 'scheduled' (ya en un lote) la
-- saca del lote automáticamente (trigger de Fase 5, punto 2).
-- ============================================================
insert into technician_payout_batches (id, technician_id, status, total_amount, settlement_count, scheduled_date)
values ('00000000-0000-4000-8000-000000000521', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'scheduled', 8200, 1, now());

update technician_settlements
set status = 'scheduled', payout_batch_id = '00000000-0000-4000-8000-000000000521', scheduled_date = now()
where id = '00000000-0000-4000-8000-000000000511';

update technician_settlements set status = 'in_review', dispute_reason = 'reclamo de prueba'
where id = '00000000-0000-4000-8000-000000000511';

insert into test_results select 5, 'pausar una liquidación scheduled la saca del lote (payout_batch_id/scheduled_date en null)',
  (select payout_batch_id is null and scheduled_date is null from technician_settlements where id = '00000000-0000-4000-8000-000000000511'),
  'ok';

-- Se resuelve la disputa (liberar) para poder re-programarla y probar el
-- cierre de lote.
update technician_settlements set status = 'released', dispute_reason = null
where id = '00000000-0000-4000-8000-000000000511';

update technician_settlements
set status = 'scheduled', payout_batch_id = '00000000-0000-4000-8000-000000000521', scheduled_date = now()
where id = '00000000-0000-4000-8000-000000000511';
update technician_payout_batches set status = 'scheduled', total_amount = 8200, settlement_count = 1
where id = '00000000-0000-4000-8000-000000000521';

reset role;

-- ============================================================
-- TEST 6 (permiso negativo): un técnico NO puede cerrar un lote.
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  begin
    perform public.close_payout_batch('00000000-0000-4000-8000-000000000521', 'REF-TEST', null, null);
    insert into test_results values (6, 'técnico NO puede cerrar un lote (debe fallar)', false, 'no lanzó excepción');
  exception when others then
    insert into test_results values (6, 'técnico NO puede cerrar un lote (debe fallar)', true, sqlerrm);
  end;
end $$;

insert into test_results select 6.5, 'el lote sigue scheduled tras el intento fallido del técnico (nada cambió)',
  (select status from technician_payout_batches where id = '00000000-0000-4000-8000-000000000521') = 'scheduled',
  'ok';

-- ============================================================
-- TEST 7 (positivo, atómico): admin cierra el lote correctamente.
-- ============================================================
select set_config('request.jwt.claim.sub', (select admin_profile_id::text from test_config), true);

create temp table close_run (n int, closed boolean, settlement_count int, total_amount numeric, batch_recorded_total numeric);
insert into close_run select 1, closed, settlement_count, total_amount, batch_recorded_total
from public.close_payout_batch('00000000-0000-4000-8000-000000000521', 'REF-TEST-123', null, '4321');

insert into test_results select 7, 'primer cierre: closed=true, 1 liquidación por $8200',
  (select closed and settlement_count = 1 and total_amount = 8200 from close_run where n = 1),
  (select 'closed=' || closed || ' count=' || settlement_count || ' total=' || total_amount from close_run where n = 1);

insert into test_results select 8, 'cierre de lote marca settlement pagado y el lote completado',
  (select status from technician_settlements where id = '00000000-0000-4000-8000-000000000511') = 'paid'
  and (select status from technician_payout_batches where id = '00000000-0000-4000-8000-000000000521') = 'completed'
  and (select transfer_reference from technician_payout_batches where id = '00000000-0000-4000-8000-000000000521') = 'REF-TEST-123',
  'ok';

insert into test_results select 9, 'cierre de lote generó notificación settlement_paid',
  exists (select 1 from notifications where dedupe_key = 'settlement_paid:00000000-0000-4000-8000-000000000511' and recipient_profile_id = '3ef7d581-b040-4669-88bf-d572ab4b4ac4'),
  'ok';

insert into test_results select 10, 'quedó registro de auditoría del cierre',
  (select count(*) from technician_payout_batch_audit where batch_id = '00000000-0000-4000-8000-000000000521' and action = 'closed') = 1,
  'ok';

-- ============================================================
-- TEST 11 (doble cierre = idempotente): repetir el cierre sobre el mismo
-- lote no vuelve a pagar nada, no duplica notificación ni auditoría.
-- ============================================================
insert into close_run select 2, closed, settlement_count, total_amount, batch_recorded_total
from public.close_payout_batch('00000000-0000-4000-8000-000000000521', 'REF-TEST-123', null, '4321');

insert into test_results select 11, 'segundo cierre: closed=false, no toca nada (idempotente)',
  (select not closed and settlement_count = 0 from close_run where n = 2),
  (select 'closed=' || closed || ' count=' || settlement_count from close_run where n = 2);

insert into test_results select 12, 'la notificación settlement_paid sigue siendo una sola tras el doble cierre',
  (select count(*) from notifications where dedupe_key = 'settlement_paid:00000000-0000-4000-8000-000000000511') = 1,
  'ok';

insert into test_results select 13, 'la auditoría sigue teniendo un solo registro de cierre (el segundo intento no insertó nada)',
  (select count(*) from technician_payout_batch_audit where batch_id = '00000000-0000-4000-8000-000000000521' and action = 'closed') = 1,
  'ok';

-- ============================================================
-- TEST 14 (RLS): la técnica ve su propia liquidación pagada y su lote.
-- ============================================================
select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true);

insert into test_results select 14, 'técnica ve su propia liquidación pagada',
  exists (select 1 from technician_settlements where id = '00000000-0000-4000-8000-000000000511' and status = 'paid'),
  'ok';

-- ============================================================
-- TEST 15 (RLS negativo): un técnico no puede modificar el importe de su
-- propia liquidación — no hay policy de UPDATE para authenticated no-admin,
-- así que RLS filtra la fila silenciosamente (0 filas afectadas, sin error).
-- ============================================================
update technician_settlements set net_amount = 999999 where id = '00000000-0000-4000-8000-000000000511';

insert into test_results select 15, 'técnico NO puede modificar importes (RLS filtra la fila, 0 afectadas)',
  (select net_amount from technician_settlements where id = '00000000-0000-4000-8000-000000000511') = 8200,
  'ok';

-- ============================================================
-- TEST 17 (RLS negativo): Carlos (otro técnico) no ve la liquidación de
-- Maria ni en la tabla base ni en la vista de conciliación.
-- ============================================================
select set_config('request.jwt.claim.sub', '2bb43f99-f0da-428d-b8f2-2439e10db5ce', true);

insert into test_results select 17, 'otro técnico no ve la liquidación ajena',
  not exists (select 1 from technician_settlements where id = '00000000-0000-4000-8000-000000000511'),
  'ok';

insert into test_results select 18, 'otro técnico no ve la fila ajena en la vista de conciliación',
  not exists (select 1 from admin_settlement_reconciliation where settlement_id = '00000000-0000-4000-8000-000000000511'),
  'ok';

-- ============================================================
-- TEST 19 (RLS): admin ve todo en la conciliación.
-- ============================================================
select set_config('request.jwt.claim.sub', (select admin_profile_id::text from test_config), true);

insert into test_results select 19, 'admin ve la fila en la vista de conciliación con estado paid',
  exists (select 1 from admin_settlement_reconciliation where settlement_id = '00000000-0000-4000-8000-000000000511' and status = 'paid'),
  'ok';

reset role;

select * from test_results order by n;

rollback;
