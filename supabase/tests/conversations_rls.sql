-- Conversaciones (Fase 3, ADR 0001) — pruebas negativas de RLS con cuentas
-- reales. Corre dentro de una transacción que termina en ROLLBACK — no
-- persiste ningún dato de prueba.
--
--   A1-A3 (positivo): un cliente crea una conversación sobre su propia
--                      orden (vía start_order_conversation) y escribe.
--   B1-B4 (negativo):  otro cliente sin relación con la orden no ve la
--                      conversación, no ve los mensajes, no puede crear
--                      una conversación sobre esa orden, y no puede
--                      escribir en ella.
--   B5    (negativo):  otro técnico (no el asignado a la orden) no ve la
--                      conversación.
--   C1-C2 (positivo):  el técnico REAL asignado a la orden sí ve la
--                      conversación y puede responder.
--   D1    (positivo):  admin ve la conversación sin ser un participante
--                       listado (acceso de backend, no de UI — ver ADR 0001).
--
-- Reemplazar los UUID de perfil si estas cuentas de prueba dejan de existir.

begin;

create temp table test_results (test text, resultado text);
grant insert, select on test_results to authenticated;

insert into public.service_orders (
  id, title, description, service_type, priority, status, service_status,
  work_mode, quote_status, payment_status, scheduled_date, customer_id,
  assigned_technician_id, client_name, client_phone, client_address, client_neighborhood,
  work_started_at
) values (
  '00000000-0000-0000-0000-00000000b001', 'Test conversaciones', 'desc', 'Plomería', 'media',
  'assigned', 'pending', 'diagnosis', 'none', 'pending', current_date,
  '98f00edc-f715-4db8-86ac-9b11df7e1363', 'ea81fb7e-f758-49df-81a7-8060d9a5966b', -- Julián / Carlos
  'Julian Test', '111', 'calle 1', 'barrio', now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '39921296-0657-4aca-868d-45d7c63c46a7', true); -- Julián

do $$
declare v_conv uuid;
begin
  v_conv := public.start_order_conversation('00000000-0000-0000-0000-00000000b001', 'Coordinar visita');
  insert into test_results values ('A1: cliente crea conversación sobre su orden', 'OK: ' || v_conv::text);
  perform set_config('app.test_conv_id', v_conv::text, false);
exception when others then
  insert into test_results values ('A1: cliente crea conversación sobre su orden', 'FALLO: ' || sqlerrm);
end $$;

insert into test_results select 'A2: cliente ve su conversación recién creada (esperado 1)', count(*)::text
from public.conversations where id = current_setting('app.test_conv_id')::uuid;

insert into public.messages (conversation_id, sender_id, sender_role, body)
values (current_setting('app.test_conv_id')::uuid, '39921296-0657-4aca-868d-45d7c63c46a7', 'customer', 'Hola, a que hora llegas?');

insert into test_results select 'A3: mensaje propio se guarda (esperado 1)', count(*)::text
from public.messages where conversation_id = current_setting('app.test_conv_id')::uuid;

select set_config('request.jwt.claim.sub', '5750804b-f463-40b0-a103-6e02da91f188', true); -- Gonzalo (sin relación)

insert into test_results select 'B1 NEGATIVO: otro cliente ve conversación ajena (esperado 0)', count(*)::text
from public.conversations where id = current_setting('app.test_conv_id')::uuid;

insert into test_results select 'B2 NEGATIVO: otro cliente ve mensajes ajenos (esperado 0)', count(*)::text
from public.messages where conversation_id = current_setting('app.test_conv_id')::uuid;

do $$
begin
  perform public.start_order_conversation('00000000-0000-0000-0000-00000000b001', 'intento ajeno');
  insert into test_results values ('B3 NEGATIVO: pudo crear conversación sobre orden ajena', 'FALLO DE SEGURIDAD');
exception when others then
  insert into test_results values ('B3: bloqueado al crear conversación sobre orden ajena', 'OK: ' || sqlerrm);
end $$;

do $$
begin
  insert into public.messages (conversation_id, sender_id, sender_role, body)
  values (current_setting('app.test_conv_id')::uuid, '5750804b-f463-40b0-a103-6e02da91f188', 'customer', 'intento ajeno');
  insert into test_results values ('B4 NEGATIVO: pudo escribir en conversación ajena', 'FALLO DE SEGURIDAD');
exception when others then
  insert into test_results values ('B4: bloqueado al escribir en conversación ajena', 'OK: ' || sqlerrm);
end $$;

select set_config('request.jwt.claim.sub', '3ef7d581-b040-4669-88bf-d572ab4b4ac4', true); -- María (otra técnica)

insert into test_results select 'B5 NEGATIVO: otro técnico (no asignado) ve conversación ajena (esperado 0)', count(*)::text
from public.conversations where id = current_setting('app.test_conv_id')::uuid;

select set_config('request.jwt.claim.sub', '2bb43f99-f0da-428d-b8f2-2439e10db5ce', true); -- Carlos (técnico real de la orden)

insert into test_results select 'C1: técnico asignado ve la conversación (esperado 1)', count(*)::text
from public.conversations where id = current_setting('app.test_conv_id')::uuid;

insert into public.messages (conversation_id, sender_id, sender_role, body)
values (current_setting('app.test_conv_id')::uuid, '2bb43f99-f0da-428d-b8f2-2439e10db5ce', 'technician', 'Llego en 10 minutos');

insert into test_results select 'C2: mensajes totales tras responder (esperado 2)', count(*)::text
from public.messages where conversation_id = current_setting('app.test_conv_id')::uuid;

reset role;
insert into test_results select 'D1: admin ve la conversación sin ser participante listado (esperado 1)', count(*)::text
from public.conversations where id = current_setting('app.test_conv_id')::uuid;

select * from test_results order by test;

rollback;
