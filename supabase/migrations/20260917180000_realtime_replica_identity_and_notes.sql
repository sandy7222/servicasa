-- Realtime + RLS: sin REPLICA IDENTITY FULL el payload de UPDATE/DELETE
-- no trae order_id, así que la policy (join a service_orders) no autoriza
-- el evento y el cliente no ve checklist/materiales hasta un F5.
-- order_notes nunca estuvo en la publication ni en el canal del front.

alter table public.service_orders replica identity full;
alter table public.order_checklist_items replica identity full;
alter table public.order_material_expenses replica identity full;
alter table public.order_materials_used replica identity full;
alter table public.order_time_logs replica identity full;
alter table public.order_notes replica identity full;
alter table public.order_events replica identity full;
alter table public.order_signatures replica identity full;
alter table public.order_quotes replica identity full;
alter table public.order_quote_items replica identity full;
alter table public.order_diagnosis_photos replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'order_notes'
  ) then
    execute 'alter publication supabase_realtime add table public.order_notes';
  end if;
end $$;
