-- Prueba del trigger anti-manipulación de precios en customer_order_drafts
-- (enforce_customer_order_draft_pricing). Simula un visitante que arma un
-- borrador de "seña de visita" pero manda amount = 1, como si hubiera
-- interceptado y editado el pedido antes de que llegue al servidor. Todo
-- corre dentro de una transacción que se revierte al final (rollback), así
-- no queda ningún borrador de prueba en la base real. Mismo criterio que
-- test_pricing_trigger.sql (service_orders / enforce_service_order_pricing).
--
-- Requiere al menos un cliente real en la tabla customers (usa el primero
-- que encuentre) — reemplazar el `limit 1` por un id puntual si hace falta
-- un cliente específico.

begin;

-- Caso 1 (el que reportó Sandy): seña de visita manipulada -> debe
-- corregirse al valor real de system_settings.visit_deposit_amount, sin
-- importar qué mande el cliente.
insert into public.customer_order_drafts (customer_id, payment_type, amount, payload)
select id, 'visit_deposit', 1, jsonb_build_object('title', 'PRUEBA seña manipulada')
from public.customers limit 1
returning id, payment_type, amount;

-- Caso 2 (control): un borrador de precio fijo (full_advance) no lo toca
-- este trigger — ese camino ya se recalcula server-side contra el catálogo
-- real en request-service.ts/guest-checkout.ts, y no es parte de este bug.
insert into public.customer_order_drafts (customer_id, payment_type, amount, payload)
select id, 'full_advance', 8000, jsonb_build_object('title', 'PRUEBA precio fijo sin tocar')
from public.customers limit 1
returning id, payment_type, amount;

rollback;
