-- Pruebas en vivo (rollback-safe) del centro de notificaciones (Fase 4).
-- Se ejecutan dentro de una transaccion que termina en `rollback;`, asi que
-- no dejan rastro en produccion. Usan cuentas reales ya sembradas.
--
-- Admin:    admin@tecniurbano.com.ar
-- Tecnico:  maria.rodriguez@tecniurbano.com.ar (profile 3ef7d581-b040-4669-88bf-d572ab4b4ac4, technician a1df8a0c-fa2b-45da-9d96-d6756c8074c0)
-- Cliente:  julian.albarracin@gmail.com     (profile 39921296-0657-4aca-868d-45d7c63c46a7, customer 98f00edc-f715-4db8-86ac-9b11df7e1363)
-- Cliente2: Gonzalo Benitez (tercero ajeno)  (profile 5750804b-f463-40b0-a103-6e02da91f188)

begin;

create temp table test_results (n int, name text, ok boolean, detail text);
grant insert, select on test_results to authenticated;

-- Se resuelve el id de admin ahora (bajo el rol por defecto, sin RLS) para
-- poder usarlo mas abajo aunque la sesion ya haya cambiado a `authenticated`.
create temp table test_config (admin_profile_id uuid);
grant select on test_config to authenticated;
insert into test_config select id from profiles where role = 'admin' limit 1;

-- ------------------------------------------------------------------
-- Setup: una orden real de Julian asignada a Maria, para colgar eventos.
-- ------------------------------------------------------------------
insert into service_orders (
  id, title, description, service_type, priority, status, scheduled_date,
  customer_id, client_name, assigned_technician_id, assigned_technician_name,
  work_mode, service_status, payment_status
) values (
  '00000000-0000-4000-8000-000000000401', 'TEST Fase4 - fuga de agua', 'desc', 'Plomería', 'media', 'assigned',
  current_date, '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Albarracin',
  'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Maria Rodriguez', 'diagnosis', 'pending', 'pending'
);

-- ============================================================
-- TEST 1: order_assigned crea aviso para el tecnico asignado.
-- ============================================================
update service_orders set assigned_technician_id = null where id = '00000000-0000-4000-8000-000000000401';
update service_orders set assigned_technician_id = 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0' where id = '00000000-0000-4000-8000-000000000401';

insert into test_results select 1, 'order_assigned notifica al tecnico',
  exists (select 1 from notifications where type = 'order_assigned' and recipient_profile_id = '3ef7d581-b040-4669-88bf-d572ab4b4ac4' and entity_id = '00000000-0000-4000-8000-000000000401'),
  'debe existir 1 fila para Maria';

-- ============================================================
-- TEST 2 (webhook duplicado): payment_transactions status=approved dos
-- veces sobre la MISMA fila (simulando reintento de webhook) -> 1 sola fila.
-- ============================================================
insert into payment_transactions (id, order_id, payment_type, provider, status, amount)
values ('00000000-0000-4000-8000-000000000402', '00000000-0000-4000-8000-000000000401', 'full_advance', 'mercadopago', 'pending', 15000);

-- Primera "llegada" del webhook: pending -> approved
update payment_transactions set status = 'approved' where id = '00000000-0000-4000-8000-000000000402';
-- Reintento del webhook: MP reenvia el mismo evento, el codigo vuelve a
-- ejecutar el mismo UPDATE (no-op de valor, pero forzamos re-evaluacion
-- escribiendo un campo no relevante para simular una segunda pasada real)
update payment_transactions set provider_payload = '{"retry":true}'::jsonb where id = '00000000-0000-4000-8000-000000000402';
update payment_transactions set status = 'approved' where id = '00000000-0000-4000-8000-000000000402';

insert into test_results select 2, 'webhook duplicado de pago -> 1 sola notificacion',
  (select count(*) from notifications where dedupe_key = 'payment_approved:00000000-0000-4000-8000-000000000402') = 1,
  (select count(*)::text from notifications where dedupe_key = 'payment_approved:00000000-0000-4000-8000-000000000402');

-- ============================================================
-- TEST 3: la notificacion de pago aprobado es para el CLIENTE (Julian).
-- ============================================================
insert into test_results select 3, 'payment_approved es para el cliente correcto',
  exists (select 1 from notifications where dedupe_key = 'payment_approved:00000000-0000-4000-8000-000000000402' and recipient_profile_id = '39921296-0657-4aca-868d-45d7c63c46a7'),
  'debe apuntar al profile de Julian';

-- ============================================================
-- TEST 4: llamar directo a create_notification() vuelve a insertar la
-- MISMA clave -> sigue sin duplicar (no solo el trigger; el helper mismo
-- es idempotente ante cualquier llamador interno).
-- ============================================================
select create_notification(
  '39921296-0657-4aca-868d-45d7c63c46a7', 'payment_approved', 'Pago aprobado', 'reintento manual',
  'payment', '00000000-0000-4000-8000-000000000402', 'high', 'payment_approved:00000000-0000-4000-8000-000000000402'
);

insert into test_results select 4, 'create_notification() es idempotente por dedupe_key',
  (select count(*) from notifications where dedupe_key = 'payment_approved:00000000-0000-4000-8000-000000000402') = 1,
  (select count(*)::text from notifications where dedupe_key = 'payment_approved:00000000-0000-4000-8000-000000000402');

-- ============================================================
-- TEST 5: claim_opened notifica a admin + tecnico, pero NO al que lo abrio.
-- ============================================================
insert into support_cases (id, case_number, customer_id, order_id, technician_id, customer_name, technician_name, case_type, subject, description, opened_by)
values ('00000000-0000-4000-8000-000000000403', 'TEST-401', '98f00edc-f715-4db8-86ac-9b11df7e1363', '00000000-0000-4000-8000-000000000401', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'Julian Albarracin', 'Maria Rodriguez', 'complaint', 'Reclamo de prueba Fase 4', 'desc', '39921296-0657-4aca-868d-45d7c63c46a7');

insert into test_results select 5, 'claim_opened notifica a tecnico y admin, no al cliente que abrio',
  exists (select 1 from notifications where type = 'claim_opened' and recipient_profile_id = '3ef7d581-b040-4669-88bf-d572ab4b4ac4' and entity_id = '00000000-0000-4000-8000-000000000403')
  and exists (select 1 from notifications where type = 'claim_opened' and recipient_profile_id in (select id from profiles where role = 'admin') and entity_id = '00000000-0000-4000-8000-000000000403')
  and not exists (select 1 from notifications where type = 'claim_opened' and recipient_profile_id = '39921296-0657-4aca-868d-45d7c63c46a7' and entity_id = '00000000-0000-4000-8000-000000000403'),
  'tecnico+admin si, cliente-opener no';

-- ============================================================
-- TEST 6: claim_message del cliente notifica al tecnico (no al remitente).
-- ============================================================
insert into support_case_messages (case_id, sender_type, channel, message, is_internal, created_by)
values ('00000000-0000-4000-8000-000000000403', 'client', 'in_app', 'Sigue goteando', false, '39921296-0657-4aca-868d-45d7c63c46a7');

insert into test_results select 6, 'claim_message notifica al tecnico y no al remitente',
  exists (select 1 from notifications where type = 'claim_message' and recipient_profile_id = '3ef7d581-b040-4669-88bf-d572ab4b4ac4')
  and not exists (select 1 from notifications where type = 'claim_message' and recipient_profile_id = '39921296-0657-4aca-868d-45d7c63c46a7'),
  'ok';

-- ============================================================
-- TEST 7: mensaje interno de reclamo NO genera notificacion (privacidad).
-- ============================================================
insert into support_case_messages (case_id, sender_type, channel, message, is_internal, created_by)
values ('00000000-0000-4000-8000-000000000403', 'admin', 'internal_note', 'nota interna secreta', true, (select id from profiles where role = 'admin' limit 1));

insert into test_results select 7, 'nota interna de reclamo no genera notificacion',
  not exists (select 1 from notifications where body = 'nota interna secreta'),
  'ok';

reset role;

-- ============================================================
-- TEST 8 (RLS): Julian ve sus propias notificaciones.
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', '39921296-0657-4aca-868d-45d7c63c46a7', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 8, 'cliente ve sus propias notificaciones',
  exists (select 1 from notifications where recipient_profile_id = '39921296-0657-4aca-868d-45d7c63c46a7' and entity_id = '00000000-0000-4000-8000-000000000402'),
  'ok';

-- ============================================================
-- TEST 9 (RLS negativo): Julian NO ve las notificaciones de Maria.
-- ============================================================
insert into test_results select 9, 'cliente NO ve notificaciones de otro usuario (tecnico)',
  not exists (select 1 from notifications where recipient_profile_id = '3ef7d581-b040-4669-88bf-d572ab4b4ac4'),
  'ok';

-- ============================================================
-- TEST 10: Julian puede marcar su propia notificacion como leida.
-- ============================================================
update notifications set read_at = now()
where recipient_profile_id = '39921296-0657-4aca-868d-45d7c63c46a7' and entity_id = '00000000-0000-4000-8000-000000000402';

insert into test_results select 10, 'cliente puede marcar su propia notificacion como leida',
  exists (select 1 from notifications where recipient_profile_id = '39921296-0657-4aca-868d-45d7c63c46a7' and entity_id = '00000000-0000-4000-8000-000000000402' and read_at is not null),
  'ok';

-- ============================================================
-- TEST 11 (negativo): Julian NO puede reescribir el titulo de su propia
-- notificacion (solo read_at es editable desde el cliente).
-- ============================================================
do $$
begin
  begin
    update notifications set title = 'hackeado'
    where recipient_profile_id = '39921296-0657-4aca-868d-45d7c63c46a7' and entity_id = '00000000-0000-4000-8000-000000000402';
    insert into test_results values (11, 'cliente NO puede reescribir el titulo (debe fallar)', false, 'no lanzo excepcion');
  exception when others then
    insert into test_results values (11, 'cliente NO puede reescribir el titulo (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 12 (negativo, defensa en profundidad): un usuario autenticado
-- cualquiera no puede forjar una notificacion llamando create_notification()
-- directo via RPC (revoke de EXECUTE aplicado tras el advisor).
-- ============================================================
do $$
begin
  begin
    perform create_notification('5750804b-f463-40b0-a103-6e02da91f188', 'message_new', 'forjado', 'x', null, null, 'high', null);
    insert into test_results values (12, 'usuario NO puede llamar create_notification() por RPC (debe fallar)', false, 'no lanzo excepcion');
  exception when others then
    insert into test_results values (12, 'usuario NO puede llamar create_notification() por RPC (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 13 (RLS): admin ve todas las notificaciones (via policy _admin_all).
-- ============================================================
select set_config('request.jwt.claim.sub', (select admin_profile_id::text from test_config), true);

insert into test_results select 13, 'admin ve notificaciones de cualquier usuario',
  exists (select 1 from notifications where recipient_profile_id = '3ef7d581-b040-4669-88bf-d572ab4b4ac4')
  and exists (select 1 from notifications where recipient_profile_id = '39921296-0657-4aca-868d-45d7c63c46a7'),
  'ok';

reset role;

-- ============================================================
-- TEST 14: technician_notifications (validacion tecnica existente) se
-- espeja en notifications sin duplicar el sistema.
-- ============================================================
insert into technician_notifications (id, technician_id, title, message, kind)
values ('00000000-0000-4000-8000-000000000901', 'a1df8a0c-fa2b-45da-9d96-d6756c8074c0', 'TEST validacion', 'mensaje de prueba', 'warning');

insert into test_results select 14, 'technician_notifications se espeja en notifications',
  (select count(*) from notifications where dedupe_key = 'technician_validation:00000000-0000-4000-8000-000000000901') = 1
  and exists (select 1 from notifications where dedupe_key = 'technician_validation:00000000-0000-4000-8000-000000000901' and recipient_profile_id = '3ef7d581-b040-4669-88bf-d572ab4b4ac4'),
  'ok';

select * from test_results order by n;

rollback;
