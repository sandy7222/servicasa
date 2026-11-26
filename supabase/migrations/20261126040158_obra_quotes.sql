-- Fase 1 de plan-presupuesto-de-obra.md: presupuesto de obra dentro de la plataforma.
-- Se crea solo con create_obra_quote() y por ahora queda en borrador: enviarlo y cobrarlo llegan en las fases 2 y 3.

alter table public.order_quotes
  add column if not exists quote_kind text not null default 'standard',
  add column if not exists advance_amount numeric,
  add column if not exists commission_base numeric,
  add column if not exists obra_detail jsonb;

alter table public.order_quotes
  add constraint order_quotes_kind_check check (quote_kind in ('standard', 'obra')),
  add constraint order_quotes_obra_fields_check check (
    case when quote_kind = 'obra' then
      advance_amount is not null and commission_base is not null and obra_detail is not null
      and advance_amount >= 0 and commission_base > 0
      -- El saldo (lo que queda retenido) siempre tiene que contener toda la mano de obra.
      and remaining_amount - advance_amount >= commission_base
    else advance_amount is null and commission_base is null and obra_detail is null end
  );

-- Nadie escribe un presupuesto de obra a mano: solo la función (y el servidor). El cliente puede rechazarlo.
create or replace function public.guard_obra_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_keys text[] := array['status', 'rejected_at', 'updated_at'];
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.quote_kind = 'obra' then
      raise exception 'El presupuesto de obra se crea solo desde la herramienta';
    end if;
  elsif old.quote_kind = 'obra' or new.quote_kind = 'obra' then
    if not (old.status = 'sent' and new.status = 'rejected' and (to_jsonb(new) - v_keys) = (to_jsonb(old) - v_keys)) then
      raise exception 'El presupuesto de obra no se puede modificar';
    end if;
  end if;
  return new;
end;
$$;

create trigger order_quotes_guard_obra before insert or update on public.order_quotes
  for each row execute function public.guard_obra_quote();

-- La obra no lleva ítems: si los tuviera, el recálculo de totales pisaría sus montos.
create or replace function public.forbid_items_on_obra_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.order_quotes q where q.id = new.quote_id and q.quote_kind = 'obra') then
    raise exception 'El presupuesto de obra no admite ítems sueltos';
  end if;
  return new;
end;
$$;

create trigger order_quote_items_forbid_on_obra before insert or update on public.order_quote_items
  for each row execute function public.forbid_items_on_obra_quote();

create or replace function public.create_obra_quote(
  p_order_id uuid,
  p_materials numeric,
  p_supplies numeric,
  p_depreciation numeric,
  p_labor numeric,
  p_visit numeric,
  p_overhead numeric,
  p_profit numeric,
  p_detail jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_technician uuid;
  v_order record;
  v_total numeric;
  v_advance_gross numeric;
  v_visit_paid numeric;
  v_credit numeric;
  v_version integer;
  v_id uuid;
begin
  select p.technician_id into v_technician from public.profiles p where p.id = auth.uid() and p.role = 'technician';
  if v_technician is null then
    raise exception 'Solo un técnico puede crear un presupuesto de obra';
  end if;

  -- Bloquea la orden para que dos pedidos a la vez no creen dos presupuestos.
  select o.id, o.assigned_technician_id, o.work_mode, o.payment_status into v_order
  from public.service_orders o where o.id = p_order_id for update;
  if not found or v_order.assigned_technician_id is distinct from v_technician then
    raise exception 'Esa orden no está asignada a tu cuenta';
  end if;
  if v_order.work_mode is distinct from 'diagnosis' or v_order.payment_status is distinct from 'deposit_paid' then
    raise exception 'La orden todavía no admite un presupuesto: tiene que ser una visita ya pagada';
  end if;

  if p_materials is null or p_supplies is null or p_depreciation is null or p_labor is null
     or p_visit is null or p_overhead is null or p_profit is null
     or least(p_materials, p_supplies, p_depreciation, p_visit, p_overhead, p_profit) < 0
     or p_labor <= 0
     or greatest(p_materials, p_supplies, p_depreciation, p_labor, p_visit, p_overhead, p_profit) > 1000000000 then
    raise exception 'Los montos del presupuesto no son válidos';
  end if;
  if p_detail is null or jsonb_typeof(p_detail) <> 'object' or length(p_detail::text) > 60000 then
    raise exception 'El detalle del presupuesto no es válido';
  end if;

  if exists (
    select 1 from public.order_quotes q
    where q.order_id = p_order_id
      and (q.status in ('sent', 'accepted') or (q.status = 'draft' and q.quote_kind <> 'obra'))
  ) then
    raise exception 'La orden ya tiene un presupuesto en curso';
  end if;
  -- Un borrador de obra anterior se reemplaza.
  delete from public.order_quotes q where q.order_id = p_order_id and q.status = 'draft' and q.quote_kind = 'obra';

  p_materials := round(p_materials, 2); p_supplies := round(p_supplies, 2); p_depreciation := round(p_depreciation, 2);
  p_labor := round(p_labor, 2); p_visit := round(p_visit, 2); p_overhead := round(p_overhead, 2); p_profit := round(p_profit, 2);
  v_total := p_materials + p_supplies + p_depreciation + p_labor + p_visit + p_overhead + p_profit;
  -- Misma cuenta que la herramienta: visita + 50 % de materiales e insumos + depreciación.
  v_advance_gross := round(p_visit + (p_materials + p_supplies) * 0.5 + p_depreciation, 2);

  -- La visita que el cliente ya pagó por la plataforma no se le cobra otra vez.
  select coalesce(sum(t.amount), 0) into v_visit_paid
  from public.payment_transactions t
  where t.order_id = p_order_id and t.payment_type = 'visit_deposit' and t.status = 'approved';
  v_credit := least(p_visit, v_visit_paid);

  select coalesce(max(q.version), 0) + 1 into v_version from public.order_quotes q where q.order_id = p_order_id;

  insert into public.order_quotes (
    order_id, version, status, quote_kind, subtotal_labor, subtotal_materials, total_amount,
    visit_deposit_credit, remaining_amount, advance_amount, commission_base, obra_detail, created_by
  ) values (
    p_order_id, v_version, 'draft', 'obra', p_labor, p_materials + p_supplies, v_total,
    v_credit, v_total - v_credit, v_advance_gross - v_credit, p_labor,
    p_detail || jsonb_build_object('amounts', jsonb_build_object(
      'materials', p_materials, 'supplies', p_supplies, 'depreciation', p_depreciation, 'labor', p_labor,
      'visit', p_visit, 'overhead', p_overhead, 'profit', p_profit, 'total', v_total,
      'visitCredit', v_credit, 'advance', v_advance_gross - v_credit, 'balance', v_total - v_advance_gross)),
    auth.uid()
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.create_obra_quote(uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) from public, anon;
grant execute on function public.create_obra_quote(uuid, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb) to authenticated;
revoke all on function public.guard_obra_quote() from public, anon, authenticated;
revoke all on function public.forbid_items_on_obra_quote() from public, anon, authenticated;

-- Los campos nuevos tampoco cambian una vez que el presupuesto dejó de ser borrador (vale también para el servidor).
create or replace function public.prevent_sent_quote_content_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
    new.order_id is distinct from old.order_id or
    new.version is distinct from old.version or
    new.notes is distinct from old.notes or
    new.subtotal_labor is distinct from old.subtotal_labor or
    new.subtotal_materials is distinct from old.subtotal_materials or
    new.total_amount is distinct from old.total_amount or
    new.visit_deposit_credit is distinct from old.visit_deposit_credit or
    new.remaining_amount is distinct from old.remaining_amount or
    new.currency is distinct from old.currency or
    new.valid_until is distinct from old.valid_until or
    new.created_by is distinct from old.created_by or
    new.quote_kind is distinct from old.quote_kind or
    new.advance_amount is distinct from old.advance_amount or
    new.commission_base is distinct from old.commission_base or
    new.obra_detail is distinct from old.obra_detail
  ) then
    raise exception 'El presupuesto enviado es inmutable';
  end if;
  new.updated_at = now();
  return new;
end;
$$;
