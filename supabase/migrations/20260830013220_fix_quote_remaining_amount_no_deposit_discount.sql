-- La seña de visita deja de descontarse del presupuesto: remaining_amount
-- pasa a ser el total del presupuesto sin resta de visit_deposit_credit.
-- Solo afecta presupuestos en draft (un presupuesto sent/accepted está
-- protegido por prevent_sent_quote_content_change y nunca se recalcula),
-- así que no toca presupuestos ya cerrados. Ver docs/adr-liquidacion-visita.md.
create or replace function public.sync_quote_totals_from_items()
returns trigger
language plpgsql
set search_path to ''
as $function$
declare
  target_quote_id uuid;
begin
  target_quote_id := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;

  update public.order_quotes as q
  set
    subtotal_labor = coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id and i.item_type = 'labor'
    ), 0),
    subtotal_materials = coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id and i.item_type = 'material'
    ), 0),
    total_amount = coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id
    ), 0),
    remaining_amount = coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id
    ), 0)
  where q.id = target_quote_id;

  return coalesce(new, old);
end;
$function$;
