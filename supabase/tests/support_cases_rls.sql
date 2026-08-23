-- Reclamos y Garantías — pruebas negativas de RLS (Fase 2 de
-- ROADMAP-TERMINACION.md). Verifica en vivo, con dos clientes reales, que:
--
--   A1/A2 (positivo): un cliente ve y escribe en su PROPIO caso.
--   B1/B2 (negativo): otro cliente NO ve el caso ni los mensajes ajenos.
--   B3    (negativo): otro cliente no puede escribir un mensaje en caso ajeno.
--   B4    (negativo): otro cliente no puede abrir un caso suplantando el
--                      customer_id de otra persona.
--   B5    (negativo): un cliente no puede abrir un caso sin vincular una
--                      orden real (la orden es obligatoria para autoservicio).
--
-- Todo corre dentro de una transacción que termina en ROLLBACK — no
-- persiste ningún dato de prueba. Reemplazar los dos UUID de perfil por
-- cualquier par de clientes reales con cuenta si estos dejan de existir.
-- Correr en el SQL Editor o vía el MCP de Supabase.

begin;

create temp table test_results (test text, resultado text);
grant insert, select on test_results to authenticated;

insert into public.service_orders (
  id, title, description, service_type, priority, status, service_status,
  work_mode, quote_status, payment_status, scheduled_date, customer_id,
  client_name, client_phone, client_address, client_neighborhood
) values (
  '00000000-0000-0000-0000-00000000a001', 'Test RLS reclamos', 'desc', 'Plomería', 'media',
  'assigned', 'pending', 'diagnosis', 'none', 'pending', current_date,
  '98f00edc-f715-4db8-86ac-9b11df7e1363', 'Julian Test', '111', 'calle 1', 'barrio'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '39921296-0657-4aca-868d-45d7c63c46a7', true); -- Julián

insert into public.support_cases (id, customer_id, order_id, case_type, subject)
values ('00000000-0000-0000-0000-00000000c001', '98f00edc-f715-4db8-86ac-9b11df7e1363', '00000000-0000-0000-0000-00000000a001', 'complaint', 'Test caso Julian');

insert into test_results select 'A1: cliente ve su propio caso (esperado 1)', count(*)::text
from public.support_cases where id = '00000000-0000-0000-0000-00000000c001';

insert into public.support_case_messages (case_id, sender_type, message, is_internal)
values ('00000000-0000-0000-0000-00000000c001', 'client', 'mensaje de julian', false);

insert into test_results select 'A2: mensaje propio se guarda (esperado 1)', count(*)::text
from public.support_case_messages where case_id = '00000000-0000-0000-0000-00000000c001';

select set_config('request.jwt.claim.sub', '5750804b-f463-40b0-a103-6e02da91f188', true); -- Gonzalo

insert into test_results select 'B1 NEGATIVO: otro cliente ve caso ajeno (esperado 0)', count(*)::text
from public.support_cases where id = '00000000-0000-0000-0000-00000000c001';

insert into test_results select 'B2 NEGATIVO: otro cliente ve mensajes ajenos (esperado 0)', count(*)::text
from public.support_case_messages where case_id = '00000000-0000-0000-0000-00000000c001';

do $$
begin
  insert into public.support_case_messages (case_id, sender_type, message, is_internal)
  values ('00000000-0000-0000-0000-00000000c001', 'client', 'intento ajeno', false);
  insert into test_results values ('B3 NEGATIVO: pudo escribir mensaje ajeno', 'FALLO DE SEGURIDAD');
exception
  when others then
    insert into test_results values ('B3: bloqueado al escribir mensaje ajeno', 'OK: ' || sqlerrm);
end $$;

do $$
begin
  insert into public.support_cases (customer_id, order_id, case_type, subject)
  values ('98f00edc-f715-4db8-86ac-9b11df7e1363', '00000000-0000-0000-0000-00000000a001', 'complaint', 'intento de suplantacion');
  insert into test_results values ('B4 NEGATIVO: pudo suplantar customer_id ajeno', 'FALLO DE SEGURIDAD');
exception
  when others then
    insert into test_results values ('B4: bloqueado al suplantar customer_id', 'OK: ' || sqlerrm);
end $$;

do $$
begin
  insert into public.support_cases (customer_id, order_id, case_type, subject)
  values ('d197b88d-fbb2-4fa3-bbaf-eef6728a4004', null, 'complaint', 'caso propio sin orden');
  insert into test_results values ('B5: abrio caso propio sin orden vinculada', 'FALLO — deberia exigir orden');
exception
  when others then
    insert into test_results values ('B5: bloqueado sin orden vinculada (orden es obligatoria)', 'OK: ' || sqlerrm);
end $$;

select * from test_results order by test;

rollback;
