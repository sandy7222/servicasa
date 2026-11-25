-- Avisos de los momentos importantes del proceso que hoy no generaban notificación
-- (plan-notificaciones-push.md, Fase 2B). Cada uno entra por la tabla `notifications`, así que
-- aparece en la campanita y, si el destinatario activó los avisos, también llega al celular.
--
--   technician_arrived  -> cliente: "Tu técnico llegó"
--   work_completed      -> cliente: "Tu trabajo terminó"
--   order_accepted      -> cliente: "Tu técnico aceptó la visita"
--   order_rejected      -> admin:   "Un técnico rechazó una orden"
--   payment_received    -> técnico: "El cliente pagó"
--
-- Aditiva: solo agrega tipos permitidos y triggers nuevos. Cada función atrapa sus errores, así que
-- un fallo al avisar NUNCA puede frenar la actualización de una orden ni un pago.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type = any (array[
  'order_assigned', 'quote_sent', 'quote_accepted', 'quote_rejected',
  'payment_approved', 'payment_rejected', 'payment_pending',
  'claim_opened', 'claim_message', 'claim_resolved', 'message_new',
  'settlement_scheduled', 'settlement_released', 'settlement_paid',
  'technician_validation', 'cron_failure', 'technician_en_route', 'business_lead', 'visit_paid',
  'technician_registered', 'technician_documents',
  'technician_arrived', 'work_completed', 'order_accepted', 'order_rejected', 'payment_received'
]::text[]));

-- El técnico llegó al domicilio
create or replace function public.notify_technician_arrived() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.create_notification(
    public.profile_id_for_customer(new.customer_id),
    'technician_arrived', 'Tu técnico llegó', new.title,
    'order', new.id, 'high',
    'technician_arrived:' || new.id::text || ':' || coalesce(new.arrived_at::text, '')
  );
  return new;
exception when others then
  raise warning 'notify_technician_arrived: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_technician_arrived on public.service_orders;
create trigger trg_notify_technician_arrived
  after update of arrived_at on public.service_orders
  for each row
  when (old.arrived_at is null and new.arrived_at is not null)
  execute function public.notify_technician_arrived();

-- El trabajo terminó
create or replace function public.notify_work_completed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.create_notification(
    public.profile_id_for_customer(new.customer_id),
    'work_completed', 'Tu trabajo terminó', new.title,
    'order', new.id, 'high',
    'work_completed:' || new.id::text
  );
  return new;
exception when others then
  raise warning 'notify_work_completed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_work_completed on public.service_orders;
create trigger trg_notify_work_completed
  after update of service_status on public.service_orders
  for each row
  when (new.service_status = 'completed' and new.service_status is distinct from old.service_status)
  execute function public.notify_work_completed();

-- El técnico aceptó (avisa al cliente) o rechazó (avisa al admin) la orden
create or replace function public.notify_order_response() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid;
begin
  if new.technician_response_status = 'accepted' then
    perform public.create_notification(
      public.profile_id_for_customer(new.customer_id),
      'order_accepted', 'Tu técnico aceptó la visita', new.title,
      'order', new.id, 'normal',
      'order_accepted:' || new.id::text || ':' || coalesce(new.assigned_technician_id::text, '')
    );
  elsif new.technician_response_status = 'rejected' then
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform public.create_notification(
        v_admin,
        'order_rejected', 'Un técnico rechazó una orden', new.title,
        'order', new.id, 'high',
        'order_rejected:' || new.id::text || ':' || coalesce(new.assigned_technician_id::text, '') || ':' || v_admin::text
      );
    end loop;
  end if;
  return new;
exception when others then
  raise warning 'notify_order_response: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_order_response on public.service_orders;
create trigger trg_notify_order_response
  after update of technician_response_status on public.service_orders
  for each row
  when (new.technician_response_status in ('accepted', 'rejected') and new.technician_response_status is distinct from old.technician_response_status)
  execute function public.notify_order_response();

-- El cliente pagó: avisa al técnico asignado (si ya hay uno)
create or replace function public.notify_payment_received() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_tech uuid;
  v_title text;
begin
  select assigned_technician_id, title into v_tech, v_title from public.service_orders where id = new.order_id;
  if v_tech is null then
    return new;
  end if;
  perform public.create_notification(
    public.profile_id_for_technician(v_tech),
    'payment_received', 'El cliente pagó', v_title,
    'order', new.order_id, 'high',
    'payment_received:' || new.id::text
  );
  return new;
exception when others then
  raise warning 'notify_payment_received: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists trg_notify_payment_received_insert on public.payment_transactions;
create trigger trg_notify_payment_received_insert
  after insert on public.payment_transactions
  for each row
  when (new.status = 'approved')
  execute function public.notify_payment_received();

drop trigger if exists trg_notify_payment_received_update on public.payment_transactions;
create trigger trg_notify_payment_received_update
  after update of status on public.payment_transactions
  for each row
  when (new.status = 'approved' and new.status is distinct from old.status)
  execute function public.notify_payment_received();
