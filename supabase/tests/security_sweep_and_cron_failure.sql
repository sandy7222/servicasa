-- Pruebas en vivo (rollback-safe) de los 3 pedidos de Sandy tras la Fase 5:
--  1) el barrido de GRANT/EXECUTE no tiene prueba SQL propia — se verificó
--     con consultas directas a information_schema/pg_policies/pg_proc
--     (ver security_sweep_and_settlement_fixes.sql para el detalle).
--  2) el cron avisa a admin si falla, y la notificación sobrevive aunque la
--     transacción del job aborte.
--  3) pausar una liquidación programada recalcula el total/cantidad del
--     lote (no solo desvincula la fila).
--
-- Termina en ROLLBACK — no persiste nada en producción.

-- ============================================================
-- PARTE A: recálculo del lote al pausar una liquidación (pedido #3)
-- ============================================================
begin;

create temp table test_results (n int, name text, ok boolean, detail text);

insert into service_orders (
  id, title, description, service_type, priority, status, scheduled_date,
  customer_id, client_name, assigned_technician_id, assigned_technician_name,
  work_mode, service_status, payment_status
) values
  ('00000000-0000-4000-8000-000000000601', 'TEST recalculo A', 'desc', 'Plomería', 'media', 'completed',
   current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Albarracin',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full'),
  ('00000000-0000-4000-8000-000000000602', 'TEST recalculo B', 'desc', 'Plomería', 'media', 'completed',
   current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Albarracin',
   'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'completed', 'paid_in_full');

insert into technician_payout_batches (id, technician_id, status, total_amount, settlement_count, scheduled_date)
values ('00000000-0000-4000-8000-000000000621', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'scheduled', 15000, 2, now());

insert into technician_settlements (id, order_id, technician_id, settlement_type, gross_amount, platform_commission_amount, payment_fee_amount, net_amount, status, payout_batch_id, scheduled_date)
values
  ('00000000-0000-4000-8000-000000000611', '00000000-0000-4000-8000-000000000601', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'completed_work', 10000, 1500, 300, 9000, 'scheduled', '00000000-0000-4000-8000-000000000621', now()),
  ('00000000-0000-4000-8000-000000000612', '00000000-0000-4000-8000-000000000602', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'completed_work', 7000, 1000, 200, 6000, 'scheduled', '00000000-0000-4000-8000-000000000621', now());

-- Pausar UNA de las dos: el lote debe recalcular a lo que queda (no a 0).
update technician_settlements set status = 'in_review', dispute_reason = 'reclamo parcial'
where id = '00000000-0000-4000-8000-000000000611';

insert into test_results select 1, 'recalculo parcial: total y count reflejan solo lo que sigue scheduled',
  (select total_amount from technician_payout_batches where id = '00000000-0000-4000-8000-000000000621') = 6000
  and (select settlement_count from technician_payout_batches where id = '00000000-0000-4000-8000-000000000621') = 1
  and (select status from technician_payout_batches where id = '00000000-0000-4000-8000-000000000621') = 'scheduled',
  (select 'total=' || total_amount || ' count=' || settlement_count || ' status=' || status from technician_payout_batches where id = '00000000-0000-4000-8000-000000000621');

-- Pausar la segunda (la única que quedaba): el lote queda vacío. No puede
-- guardar settlement_count=0 (constraint > 0), así que se cancela.
update technician_settlements set status = 'in_review', dispute_reason = 'reclamo total'
where id = '00000000-0000-4000-8000-000000000612';

insert into test_results select 2, 'lote vacío se cancela en vez de violar el constraint de count>0',
  (select status from technician_payout_batches where id = '00000000-0000-4000-8000-000000000621') = 'cancelled',
  (select status from technician_payout_batches where id = '00000000-0000-4000-8000-000000000621');

select * from test_results order by n;

rollback;

-- ============================================================
-- PARTE B: el cron notifica a admin si falla, y la notificación sobrevive
-- (pedido #2). Se simula la falla reemplazando temporalmente
-- release_due_technician_settlements() DENTRO de esta misma transacción de
-- prueba — se revierte todo al final, la función real nunca se toca.
-- ============================================================
begin;

create temp table test_results (n int, name text, ok boolean, detail text);

create or replace function public.release_due_technician_settlements() returns integer
language plpgsql set search_path to 'public' as $$
begin
  raise exception 'fallo simulado para probar el aviso de cron';
end;
$$;

-- Llamado top-level, sin exception-catch propio — así corre realmente
-- pg_cron (un solo statement, sin bloque exterior que lo atrape).
select public.run_scheduled_settlement_release();

insert into test_results select 1, 'el wrapper no relanza la excepción (así el commit persiste)', true, 'ok';

insert into test_results select 2, 'se creó una notificación cron_failure para el admin y sobrevive',
  exists (select 1 from notifications where type = 'cron_failure' and recipient_profile_id in (select id from profiles where role = 'admin')),
  'ok';

select public.run_scheduled_settlement_release();

insert into test_results select 3, 'una segunda falla el mismo día no duplica la notificación (dedupe_key por fecha)',
  (select count(*) from notifications where type = 'cron_failure') = 1,
  (select count(*)::text from notifications where type = 'cron_failure');

select * from test_results order by n;

rollback;
