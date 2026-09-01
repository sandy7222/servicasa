-- Pruebas en vivo (rollback-safe) de Fase 7: settings tipados y auditables.
-- Termina en ROLLBACK — no persiste nada en producción.
--
-- Admin:    admin@tecniurbano.com.ar
-- Tecnico:  maria.rodriguez@tecniurbano.com.ar (profile 3ef7d581-b040-4669-88bf-d572ab4b4ac4)
-- Cliente:  julian.albarracin@gmail.com        (profile 39921296-0657-4aca-868d-45d7c63c46a7, customer 98f00edc-f715-4db8-86ac-9b11df7e1363)

begin;

create temp table test_results (n int, name text, ok boolean, detail text);
grant insert, select on test_results to authenticated;

create temp table test_config (admin_profile_id uuid);
grant select on test_config to authenticated;
insert into test_config select id from profiles where role = 'admin' limit 1;

create temp table test_setting_before (value jsonb, version integer);
grant select on test_setting_before to authenticated;
insert into test_setting_before
select value, version from system_settings where key = 'visit_deposit_amount';

-- ============================================================
-- TEST 1: el trigger de tipo rechaza un value que no coincide con
-- value_type (server-side, no solo documentación).
-- ============================================================
do $$
begin
  begin
    insert into system_settings (key, value, value_type, visibility)
    values ('test_bad_type', '"no es un numero"', 'number', 'admin');
    insert into test_results values (1, 'trigger rechaza value_type=number con string (debe fallar)', false, 'no lanzó excepción');
  exception when others then
    insert into test_results values (1, 'trigger rechaza value_type=number con string (debe fallar)', true, sqlerrm);
  end;
end $$;

-- ============================================================
-- TEST 2: update real registra quién, cuándo, valor anterior y nuevo.
-- ============================================================
update system_settings set value = '35000' where key = 'visit_deposit_amount';

insert into test_results select 2, 'la fila queda con el valor nuevo y version incrementada',
  (select value::text = '35000'
     and version = (select version + 1 from test_setting_before)
   from system_settings where key = 'visit_deposit_amount'),
  (select 'value=' || value::text || ' version=' || version from system_settings where key = 'visit_deposit_amount');

insert into test_results select 3, 'quedó un registro de historial con el valor anterior y el nuevo (35000)',
  exists (
    select 1 from system_settings_history
    where key = 'visit_deposit_amount'
      and old_value = (select value from test_setting_before)
      and new_value::text = '35000'
  ),
  'ok';

-- ============================================================
-- TEST 4: la vista customer_summary lee warranty_days dinámicamente
-- (no un 30 hardcodeado) — se prueba bajando el valor a 1 día y viendo
-- que una orden completada hace 5 días deje de contar como en garantía.
-- ============================================================
insert into customers (id, name, email, phone) values
  ('00000000-0000-4000-8000-000000000701', 'TEST Cliente Fase7', 'test-fase7@example.com', '111')
on conflict (id) do nothing;

insert into service_orders (
  id, title, description, service_type, priority, status, scheduled_date,
  customer_id, client_name, work_mode, service_status, payment_status, completed_at
) values (
  '00000000-0000-4000-8000-000000000711', 'TEST orden vieja', 'desc', 'Plomería', 'media', 'completed',
  current_date - 10, '00000000-0000-4000-8000-000000000701', 'TEST Cliente Fase7',
  'diagnosis', 'completed', 'paid_in_full', now() - interval '5 days'
);

update system_settings set value = '1' where key = 'warranty_days';

insert into test_results select 4, 'con warranty_days=1, una orden completada hace 5 días ya no cuenta como en garantía',
  (select active_warranties from customer_summary where id = '00000000-0000-4000-8000-000000000701') = 0,
  (select active_warranties::text from customer_summary where id = '00000000-0000-4000-8000-000000000701');

update system_settings set value = '30' where key = 'warranty_days';

insert into test_results select 5, 'con warranty_days=30, la misma orden (hace 5 días) sí cuenta como en garantía',
  (select active_warranties from customer_summary where id = '00000000-0000-4000-8000-000000000701') = 1,
  (select active_warranties::text from customer_summary where id = '00000000-0000-4000-8000-000000000701');

-- ============================================================
-- TEST 6: message_max_length se hace cumplir en servidor (no solo en el
-- cliente) — se prueba bajando el límite a 10 caracteres.
-- ============================================================
update system_settings set value = '10' where key = 'message_max_length';

insert into conversations (id, subject, created_by) values
  ('00000000-0000-4000-8000-000000000721', 'TEST conversacion fase7', '39921296-0657-4aca-868d-45d7c63c46a7');
insert into conversation_participants (conversation_id, profile_id, role) values
  ('00000000-0000-4000-8000-000000000721', '39921296-0657-4aca-868d-45d7c63c46a7', 'customer');

do $$
begin
  begin
    insert into messages (conversation_id, sender_id, sender_role, body)
    values ('00000000-0000-4000-8000-000000000721', '39921296-0657-4aca-868d-45d7c63c46a7', 'customer', 'este mensaje tiene mas de diez caracteres');
    insert into test_results values (6, 'mensaje que excede message_max_length se rechaza (debe fallar)', false, 'no lanzó excepción');
  exception when others then
    insert into test_results values (6, 'mensaje que excede message_max_length se rechaza (debe fallar)', true, sqlerrm);
  end;
end $$;

insert into messages (conversation_id, sender_id, sender_role, body)
values ('00000000-0000-4000-8000-000000000721', '39921296-0657-4aca-868d-45d7c63c46a7', 'customer', 'corto');

insert into test_results select 7, 'un mensaje dentro del límite se acepta normalmente',
  exists (select 1 from messages where conversation_id = '00000000-0000-4000-8000-000000000721' and body = 'corto'),
  'ok';

update system_settings set value = '2000' where key = 'message_max_length';

-- ============================================================
-- TEST 8: el mismo límite aplica a support_case_messages.
-- ============================================================
update system_settings set value = '10' where key = 'message_max_length';

insert into support_cases (id, customer_id, case_type, subject, description)
values ('00000000-0000-4000-8000-000000000731', '00000000-0000-4000-8000-000000000701', 'complaint', 'TEST reclamo fase7', 'desc');

do $$
begin
  begin
    insert into support_case_messages (case_id, sender_type, channel, message)
    values ('00000000-0000-4000-8000-000000000731', 'client', 'in_app', 'este mensaje tiene mas de diez caracteres');
    insert into test_results values (8, 'mensaje de reclamo que excede el límite se rechaza (debe fallar)', false, 'no lanzó excepción');
  exception when others then
    insert into test_results values (8, 'mensaje de reclamo que excede el límite se rechaza (debe fallar)', true, sqlerrm);
  end;
end $$;

update system_settings set value = '2000' where key = 'message_max_length';

reset role;

-- ============================================================
-- TEST 9 (RLS/visibilidad): un técnico ve visit_deposit_amount
-- (visibility=authenticated) pero NO platform_commission_rate
-- (visibility=admin).
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into test_results select 9, 'técnico ve visit_deposit_amount (visibility=authenticated)',
  exists (select 1 from system_settings where key = 'visit_deposit_amount'),
  'ok';

insert into test_results select 10, 'técnico NO ve platform_commission_rate (visibility=admin)',
  not exists (select 1 from system_settings where key = 'platform_commission_rate'),
  'ok';

-- ============================================================
-- TEST 11 (RLS negativo): un técnico no puede escribir configuración.
-- ============================================================
update system_settings set value = '999999' where key = 'visit_deposit_amount';

insert into test_results select 11, 'técnico NO puede modificar la seña (RLS filtra la fila, 0 afectadas)',
  (select value::text from system_settings where key = 'visit_deposit_amount') <> '999999',
  (select value::text from system_settings where key = 'visit_deposit_amount');

-- ============================================================
-- TEST 12 (RLS negativo): no puede leer el historial de auditoría.
-- ============================================================
insert into test_results select 12, 'técnico no puede leer system_settings_history',
  not exists (select 1 from system_settings_history),
  'ok';

reset role;

-- ============================================================
-- TEST 13: admin sí ve y puede leer todo, incluido el historial.
-- ============================================================
set local role authenticated;
select set_config('request.jwt.claim.sub', (select admin_profile_id::text from test_config), true);

insert into test_results select 13, 'admin ve platform_commission_rate y el historial',
  exists (select 1 from system_settings where key = 'platform_commission_rate')
  and exists (select 1 from system_settings_history where key = 'visit_deposit_amount'),
  'ok';

reset role;

select * from test_results order by n;

rollback;
