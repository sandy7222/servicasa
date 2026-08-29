-- El aviso de presupuesto (quote_sent/accepted/rejected) guardaba
-- entity_id = order_quotes.id, pero getNotificationLink (src/lib/notifications.ts)
-- trata entity_type='quote' igual que 'order' y arma /customer/orders/${entityId}
-- - rompia con "No encontramos ese servicio" porque ese id nunca es una orden.
-- Mismo patron que ya usan los avisos de orden/pago: entity_id = la orden.
-- Verificado en vivo: aviso real id=7524ef69-..., destinatario Julian, con
-- entity_id de un presupuesto que no existe en service_orders.
create or replace function public.notify_quote_status()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_order record;
  v_recipient uuid;
  v_type text;
  v_title text;
begin
  select customer_id, assigned_technician_id, title into v_order
  from public.service_orders where id = new.order_id;
  if v_order is null then
    return new;
  end if;
  if new.status = 'sent' then
    v_type := 'quote_sent'; v_title := 'Presupuesto enviado';
    v_recipient := public.profile_id_for_customer(v_order.customer_id);
  elsif new.status = 'accepted' then
    v_type := 'quote_accepted'; v_title := 'Presupuesto aceptado';
    v_recipient := public.profile_id_for_technician(v_order.assigned_technician_id);
  elsif new.status = 'rejected' then
    v_type := 'quote_rejected'; v_title := 'Presupuesto rechazado';
    v_recipient := public.profile_id_for_technician(v_order.assigned_technician_id);
  else
    return new;
  end if;
  perform public.create_notification(
    v_recipient, v_type, v_title, v_order.title, 'quote', new.order_id, 'normal',
    'quote_' || new.status || ':' || new.id::text
  );
  return new;
end;
$$;
