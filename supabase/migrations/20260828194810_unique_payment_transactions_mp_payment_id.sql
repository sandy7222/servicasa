-- Defensa adicional contra webhooks duplicados de Mercado Pago (ademas del
-- guard atomico en api/payments/webhook.ts) - Problema 3, caso real
-- mp_payment_id=176084558890 creo 2 filas en service_orders con 269ms de
-- diferencia porque el chequeo de estado del borrador no era atomico.
create unique index payment_transactions_mp_payment_id_unique
  on public.payment_transactions (mp_payment_id)
  where mp_payment_id is not null;
