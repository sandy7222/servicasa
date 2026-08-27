-- ServiCasa — el técnico nunca se enteraba de un presupuesto rechazado.
-- Causa: QuoteViewer.tsx (rechazo) y QuoteBuilder.tsx (envío) solo
-- actualizan order_quotes.status; nadie sincronizaba ese estado hacia
-- service_orders.quote_status, que es el campo que lee el panel del técnico
-- (y canExecutePaidWork). Solo el webhook de pago sincronizaba el caso
-- "aceptado" — "enviado" y "rechazado" nunca se reflejaban en la orden.
--
-- Fix: un trigger que espeja order_quotes.status -> service_orders.quote_status
-- en cada insert/update, sin importar qué pantalla lo haya escrito. Cubre
-- todos los casos futuros (no solo QuoteViewer), no solo este.
--
-- Ejecutar UNA sola vez en el SQL Editor.

begin;

create or replace function public.sync_service_order_quote_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.service_orders set quote_status = new.status where id = new.order_id;
  return new;
end;
$$;

drop trigger if exists order_quotes_sync_order_status on public.order_quotes;
create trigger order_quotes_sync_order_status
after insert or update of status on public.order_quotes
for each row execute function public.sync_service_order_quote_status();

-- Backfill: corrige las órdenes que ya quedaron desincronizadas (como
-- fab0d3ec-1497-43e3-afd6-eb0b0829a62c) para que el técnico las vea bien
-- sin esperar un nuevo cambio de estado.
update public.service_orders as o
set quote_status = q.status
from public.order_quotes as q
where q.order_id = o.id
  and o.quote_status is distinct from q.status;

commit;

select id, quote_status from public.service_orders where quote_status = 'rejected';
