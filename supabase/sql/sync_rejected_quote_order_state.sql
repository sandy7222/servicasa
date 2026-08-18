-- ServiCasa — al rechazar un presupuesto, la orden deja de estar operativa.
-- Ejecutar UNA vez después de los scripts de presupuestos.
-- La liquidación de la seña sigue siendo un proceso aparte y sujeto al período
-- de revisión; este script solo evita que la orden aparezca como trabajo activo.

begin;

create or replace function public.sync_rejected_quote_order_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.service_orders
    set
      status = 'cancelled',
      service_status = 'cancelled',
      quote_status = 'rejected'
    where id = new.order_id
      and status <> 'completed';
  end if;
  return new;
end;
$$;

drop trigger if exists order_quotes_sync_rejected_order_state on public.order_quotes;
create trigger order_quotes_sync_rejected_order_state
after update of status on public.order_quotes
for each row execute function public.sync_rejected_quote_order_state();

-- Align the test/legacy quotes that had already been rejected before this trigger.
update public.service_orders as o
set
  status = 'cancelled',
  service_status = 'cancelled',
  quote_status = 'rejected'
where o.status <> 'completed'
  and exists (
    select 1 from public.order_quotes q
    where q.order_id = o.id and q.status = 'rejected'
  );

commit;

select o.id, o.title, o.status, o.service_status, o.quote_status
from public.service_orders o
where o.quote_status = 'rejected'
order by o.created_at desc;
