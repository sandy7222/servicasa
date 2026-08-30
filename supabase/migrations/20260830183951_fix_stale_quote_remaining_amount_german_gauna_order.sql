-- Corrección puntual de un único presupuesto (order_quotes.id
-- a40e483a-a7eb-45d4-8efa-420f8f452e07, orden 00e57e92-e889-421c-b658-55b18542faed,
-- cliente German Gauna) creado y enviado el 2026-08-30 00:06-00:08 UTC —
-- ANTES de la migración 20260830013220_fix_quote_remaining_amount_no_deposit_discount
-- (01:32 UTC) que corrigió sync_quote_totals_from_items() para que
-- remaining_amount ya no reste visit_deposit_credit. Al estar 'sent', el
-- trigger order_quotes_prevent_content_change lo dejó congelado con el
-- cálculo viejo (remaining_amount = 64300 - 50000 = 14300) para siempre,
-- ya que solo se recalcula en 'draft'. Pedido explícito de Sandy: este
-- presupuesto todavía no cobró el saldo, así que se corrige antes de
-- cerrarlo -- el saldo real a cobrar es el total completo ($64.300), sin
-- descuento de seña. No aplica a ningún otro presupuesto: es la única fila
-- con esta condición (creada antes del fix y todavía sin pagar).
alter table public.order_quotes disable trigger order_quotes_prevent_content_change;

update public.order_quotes
set remaining_amount = total_amount,
    visit_deposit_credit = 0
where id = 'a40e483a-a7eb-45d4-8efa-420f8f452e07';

alter table public.order_quotes enable trigger order_quotes_prevent_content_change;
