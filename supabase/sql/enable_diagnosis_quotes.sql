-- ServiCasa — permisos y congelamiento de diagnóstico/presupuesto.
-- Ejecutar DESPUÉS de servicasa_payments_and_quotes.sql.
-- No crea pagos ni liquidaciones: esas escrituras permanecen solo del lado servidor.

begin;

-- Recalcula los totales exclusivamente a partir de los ítems del presupuesto.
-- La función corre como invocador y respeta las políticas de la orden padre.
create or replace function public.sync_quote_totals_from_items()
returns trigger
language plpgsql
set search_path = ''
as $$
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
    remaining_amount = greatest(0, coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id
    ), 0) - q.visit_deposit_credit)
  where q.id = target_quote_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists order_quote_items_sync_totals on public.order_quote_items;
create trigger order_quote_items_sync_totals
after insert or update or delete on public.order_quote_items
for each row execute function public.sync_quote_totals_from_items();

-- A quote's items are immutable from the instant the quote leaves draft state.
create or replace function public.prevent_sent_quote_item_change()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_quote_id uuid;
  quote_state text;
begin
  target_quote_id := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
  select status into quote_state from public.order_quotes where id = target_quote_id;
  if quote_state is distinct from 'draft' then
    raise exception 'Los ítems de un presupuesto enviado no pueden modificarse';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists order_quote_items_prevent_sent_change on public.order_quote_items;
create trigger order_quote_items_prevent_sent_change
before insert or update or delete on public.order_quote_items
for each row execute function public.prevent_sent_quote_item_change();

-- Diagnosis photo storage. File paths use: <order-id>/<random-file-name>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diagnosis-photos',
  'diagnosis-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set public = false, file_size_limit = 5242880;

-- Helpers are written inline in the policies so no public SECURITY DEFINER
-- helper is exposed. All policies are scoped through the authenticated profile.
drop policy if exists "order_quotes_select_stakeholders" on public.order_quotes;
drop policy if exists "order_quotes_insert_assigned_technician" on public.order_quotes;
drop policy if exists "order_quotes_update_technician_draft" on public.order_quotes;
drop policy if exists "order_quotes_update_customer_decision" on public.order_quotes;
drop policy if exists "order_quotes_delete_technician_draft" on public.order_quotes;

create policy "order_quotes_select_stakeholders" on public.order_quotes
for select to authenticated
using (
  is_admin() or exists (
    select 1 from public.service_orders as o
    left join public.profiles as p on p.id = (select auth.uid())
    where o.id = order_quotes.order_id
      and (o.assigned_technician_id = p.technician_id or o.customer_id = p.customer_id)
  )
);

create policy "order_quotes_insert_assigned_technician" on public.order_quotes
for insert to authenticated
with check (
  status = 'draft'
  and exists (
    select 1 from public.service_orders as o
    join public.profiles as p on p.id = (select auth.uid())
    where o.id = order_quotes.order_id
      and o.assigned_technician_id = p.technician_id
      and o.work_mode = 'diagnosis'
      and o.payment_status = 'deposit_paid'
  )
);

create policy "order_quotes_update_technician_draft" on public.order_quotes
for update to authenticated
using (
  is_admin() or exists (
    select 1 from public.service_orders as o
    join public.profiles as p on p.id = (select auth.uid())
    where o.id = order_quotes.order_id
      and o.assigned_technician_id = p.technician_id
      and order_quotes.status = 'draft'
  )
)
with check (
  is_admin() or (
    status in ('draft', 'sent') and exists (
      select 1 from public.service_orders as o
      join public.profiles as p on p.id = (select auth.uid())
      where o.id = order_quotes.order_id
        and o.assigned_technician_id = p.technician_id
        and o.work_mode = 'diagnosis'
        and o.payment_status = 'deposit_paid'
    )
  )
);

create policy "order_quotes_update_customer_decision" on public.order_quotes
for update to authenticated
using (
  status = 'sent' and exists (
    select 1 from public.service_orders as o
    join public.profiles as p on p.id = (select auth.uid())
    where o.id = order_quotes.order_id and o.customer_id = p.customer_id
  )
)
with check (
  status in ('accepted', 'rejected') and exists (
    select 1 from public.service_orders as o
    join public.profiles as p on p.id = (select auth.uid())
    where o.id = order_quotes.order_id and o.customer_id = p.customer_id
  )
);

create policy "order_quotes_delete_technician_draft" on public.order_quotes
for delete to authenticated
using (
  status = 'draft' and exists (
    select 1 from public.service_orders as o
    join public.profiles as p on p.id = (select auth.uid())
    where o.id = order_quotes.order_id and o.assigned_technician_id = p.technician_id
  )
);

drop policy if exists "order_quote_items_select_stakeholders" on public.order_quote_items;
drop policy if exists "order_quote_items_write_assigned_technician_draft" on public.order_quote_items;

create policy "order_quote_items_select_stakeholders" on public.order_quote_items
for select to authenticated
using (exists (select 1 from public.order_quotes as q where q.id = order_quote_items.quote_id));

create policy "order_quote_items_write_assigned_technician_draft" on public.order_quote_items
for all to authenticated
using (exists (
  select 1 from public.order_quotes as q
  join public.service_orders as o on o.id = q.order_id
  join public.profiles as p on p.id = (select auth.uid())
  where q.id = order_quote_items.quote_id
    and q.status = 'draft'
    and o.assigned_technician_id = p.technician_id
))
with check (exists (
  select 1 from public.order_quotes as q
  join public.service_orders as o on o.id = q.order_id
  join public.profiles as p on p.id = (select auth.uid())
  where q.id = order_quote_items.quote_id
    and q.status = 'draft'
    and o.assigned_technician_id = p.technician_id
));

drop policy if exists "order_diagnosis_photos_select_stakeholders" on public.order_diagnosis_photos;
drop policy if exists "order_diagnosis_photos_insert_assigned_technician" on public.order_diagnosis_photos;

create policy "order_diagnosis_photos_select_stakeholders" on public.order_diagnosis_photos
for select to authenticated
using (exists (
  select 1 from public.service_orders as o
  left join public.profiles as p on p.id = (select auth.uid())
  where o.id = order_diagnosis_photos.order_id
    and (is_admin() or o.assigned_technician_id = p.technician_id or o.customer_id = p.customer_id)
));

create policy "order_diagnosis_photos_insert_assigned_technician" on public.order_diagnosis_photos
for insert to authenticated
with check (exists (
  select 1 from public.service_orders as o
  join public.profiles as p on p.id = (select auth.uid())
  where o.id = order_diagnosis_photos.order_id
    and o.assigned_technician_id = p.technician_id
    and o.work_mode = 'diagnosis'
    and o.payment_status = 'deposit_paid'
));

drop policy if exists "diagnosis_photos_select_stakeholders" on storage.objects;
drop policy if exists "diagnosis_photos_insert_assigned_technician" on storage.objects;

create policy "diagnosis_photos_select_stakeholders" on storage.objects
for select to authenticated
using (
  bucket_id = 'diagnosis-photos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.service_orders as o
    left join public.profiles as p on p.id = (select auth.uid())
    where o.id::text = (storage.foldername(name))[1]
      and (is_admin() or o.assigned_technician_id = p.technician_id or o.customer_id = p.customer_id)
  )
);

create policy "diagnosis_photos_insert_assigned_technician" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'diagnosis-photos'
  and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and exists (
    select 1 from public.service_orders as o
    join public.profiles as p on p.id = (select auth.uid())
    where o.id::text = (storage.foldername(name))[1]
      and o.assigned_technician_id = p.technician_id
      and o.work_mode = 'diagnosis'
      and o.payment_status = 'deposit_paid'
  )
);

commit;

-- Expected result: 1 row per policy below.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('order_quotes', 'order_quote_items', 'order_diagnosis_photos')
order by tablename, policyname;
