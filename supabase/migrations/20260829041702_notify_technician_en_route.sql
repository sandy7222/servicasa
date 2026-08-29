-- Decision 4: aviso automatico al cliente cuando el tecnico marca salida
-- (transicion assigned -> in_progress), mismo patron que
-- trg_notify_order_assigned / notify_quote_status.
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'order_assigned', 'quote_sent', 'quote_accepted', 'quote_rejected',
    'payment_approved', 'payment_rejected', 'payment_pending',
    'claim_opened', 'claim_message', 'claim_resolved', 'message_new',
    'settlement_scheduled', 'settlement_released', 'settlement_paid',
    'technician_validation', 'cron_failure', 'technician_en_route'
  ]));

create or replace function public.notify_technician_en_route()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.status = 'in_progress' and old.status = 'assigned' then
    perform public.create_notification(
      public.profile_id_for_customer(new.customer_id),
      'technician_en_route', 'Tu técnico está en camino', new.title,
      'order', new.id, 'high',
      'technician_en_route:' || new.id::text || ':' || coalesce(new.work_started_at::text, '')
    );
  end if;
  return new;
end;
$$;

create trigger trg_notify_technician_en_route
  after update of status on public.service_orders
  for each row
  when (new.status = 'in_progress' and old.status = 'assigned')
  execute function public.notify_technician_en_route();
