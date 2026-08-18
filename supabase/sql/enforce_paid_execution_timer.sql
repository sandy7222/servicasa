-- ServiCasa — el cronómetro operativo se habilita solo con trabajo autorizado.
-- Ejecutar una vez. No modifica órdenes históricas ya iniciadas.
-- El webhook seguro de Mercado Pago debe actualizar payment_status a
-- 'paid_in_full' y, para diagnóstico, quote_status a 'accepted'.

begin;

create or replace function public.prevent_unpaid_execution_timer()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'in_progress' and new.work_mode = 'diagnosis'
     and (new.payment_status <> 'paid_in_full' or new.quote_status <> 'accepted') then
    raise exception 'El trabajo presupuestado solo puede iniciarse tras aceptación y pago confirmado';
  end if;

  if new.status = 'in_progress' and new.work_mode = 'direct'
     and new.payment_status <> 'paid_in_full' then
    raise exception 'El trabajo directo solo puede iniciarse tras el pago completo confirmado';
  end if;
  return new;
end;
$$;

drop trigger if exists service_orders_prevent_unpaid_execution_timer on public.service_orders;
create trigger service_orders_prevent_unpaid_execution_timer
before insert or update of status, work_started_at on public.service_orders
for each row execute function public.prevent_unpaid_execution_timer();

-- Starts the persisted work clock when the server confirms that execution is
-- authorized. It only starts an assigned, not-yet-started order.
create or replace function public.start_execution_after_payment_confirmation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_technician_id is not null
     and new.status = 'assigned'
     and new.work_started_at is null
     and (
       (new.work_mode = 'diagnosis' and new.quote_status = 'accepted' and new.payment_status = 'paid_in_full')
       or (new.work_mode = 'direct' and new.payment_status = 'paid_in_full')
     ) then
    update public.service_orders
    set status = 'in_progress', service_status = 'in_progress', work_started_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists service_orders_start_execution_after_payment on public.service_orders;
create trigger service_orders_start_execution_after_payment
after update of payment_status, quote_status, assigned_technician_id on public.service_orders
for each row execute function public.start_execution_after_payment_confirmation();

-- The payment webhook accepts a quote only after it verifies the paid balance.
-- Keep the order-level read model synchronized so the timer trigger above can
-- make its decision without trusting the browser.
create or replace function public.sync_accepted_quote_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.service_orders set quote_status = 'accepted' where id = new.order_id;
  end if;
  return new;
end;
$$;

drop trigger if exists order_quotes_sync_accepted_status on public.order_quotes;
create trigger order_quotes_sync_accepted_status
after update of status on public.order_quotes
for each row execute function public.sync_accepted_quote_status();

revoke all on function public.prevent_unpaid_execution_timer() from public, anon, authenticated;
revoke all on function public.start_execution_after_payment_confirmation() from public, anon, authenticated;
revoke all on function public.sync_accepted_quote_status() from public, anon, authenticated;

commit;

-- Verification: no diagnosis/direct order in progress should lack its required payment authorization.
select id, title, work_mode, status, quote_status, payment_status, work_started_at
from public.service_orders
where status = 'in_progress'
  and (
    (work_mode = 'diagnosis' and (quote_status <> 'accepted' or payment_status <> 'paid_in_full'))
    or (work_mode = 'direct' and payment_status <> 'paid_in_full')
  );
