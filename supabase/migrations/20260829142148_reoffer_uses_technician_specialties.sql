create or replace function public.offer_to_next_eligible_technician(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_order record;
  v_next record;
begin
  select id, service_type, scheduled_date, assigned_technician_id, declined_technician_ids
  into v_order
  from public.service_orders where id = p_order_id;

  if v_order.id is null then
    return;
  end if;

  select t.id, t.name into v_next
  from public.technicians t
  where t.validation_status = 'approved'
    and t.can_receive_orders = true
    and exists (
      select 1 from public.technician_specialties ts
      join public.categories c on c.id = ts.category_id
      where ts.technician_id = t.id and c.name ilike '%' || v_order.service_type || '%'
    )
    and not (t.id = any(coalesce(v_order.declined_technician_ids, '{}')))
    and (v_order.assigned_technician_id is null or t.id <> v_order.assigned_technician_id)
    and not exists (
      select 1 from public.technician_requirements r
      where r.technician_id = t.id and r.is_required = true
        and r.status not in ('approved', 'not_required')
    )
    and not exists (
      select 1 from public.service_orders so2
      where so2.id <> p_order_id
        and so2.assigned_technician_id = t.id
        and so2.status not in ('completed', 'cancelled')
        and so2.scheduled_date = v_order.scheduled_date
    )
  order by t.id
  limit 1;

  if v_next.id is not null then
    update public.service_orders
    set assigned_technician_id = v_next.id, assigned_technician_name = v_next.name
    where id = p_order_id;
  else
    -- Nadie mas disponible: vuelve a la bandeja del admin, sin tecnico.
    update public.service_orders
    set assigned_technician_id = null, assigned_technician_name = null,
        technician_response_status = 'pending', technician_response_due_at = null
    where id = p_order_id;
  end if;
end;
$function$;
