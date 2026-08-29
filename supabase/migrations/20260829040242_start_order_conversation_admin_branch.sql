-- start_order_conversation solo contemplaba cliente<->tecnico (el unico uso
-- de hoy). Decision 3 del ADR de mensajeria pide que el admin tambien pueda
-- escribirle al tecnico asignado desde la ficha de la orden - se agrega esa
-- rama sin tocar la logica cliente<->tecnico ya probada en el E2E de hoy.
create or replace function public.start_order_conversation(p_order_id uuid, p_subject text default null::text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_customer_id uuid;
  v_caller_technician_id uuid;
  v_order record;
  v_caller_role text;
  v_caller_name text;
  v_other_profile_id uuid;
  v_other_role text;
  v_other_name text;
  v_conversation_id uuid;
begin
  select customer_id, technician_id, full_name into v_caller_customer_id, v_caller_technician_id, v_caller_name
  from public.profiles where id = v_caller_id;

  select id, customer_id, assigned_technician_id, title into v_order
  from public.service_orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Orden no encontrada';
  end if;

  if v_caller_customer_id is not null and v_caller_customer_id = v_order.customer_id then
    v_caller_role := 'customer';
    select id, full_name into v_other_profile_id, v_other_name from public.profiles where technician_id = v_order.assigned_technician_id;
    v_other_role := 'technician';
  elsif v_caller_technician_id is not null and v_caller_technician_id = v_order.assigned_technician_id then
    v_caller_role := 'technician';
    select id, full_name into v_other_profile_id, v_other_name from public.profiles where customer_id = v_order.customer_id;
    v_other_role := 'customer';
  elsif public.is_admin() then
    v_caller_role := 'admin';
    select id, full_name into v_other_profile_id, v_other_name from public.profiles where technician_id = v_order.assigned_technician_id;
    v_other_role := 'technician';
  else
    raise exception 'No tenés permiso para iniciar una conversación sobre esta orden';
  end if;

  if v_other_profile_id is null then
    raise exception 'Todavía no hay alguien del otro lado para conversar en esta orden';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.order_id = p_order_id
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.profile_id = v_caller_id)
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.profile_id = v_other_profile_id)
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (order_id, subject, subject_order_title, created_by)
  values (p_order_id, p_subject, v_order.title, v_caller_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, profile_id, role, display_name)
  values
    (v_conversation_id, v_caller_id, v_caller_role, v_caller_name),
    (v_conversation_id, v_other_profile_id, v_other_role, v_other_name);

  return v_conversation_id;
end;
$$;
