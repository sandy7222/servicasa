-- Breaks the RLS cycle: service_orders_insert_customer_request queries customers,
-- and customers_select_own_or_staff queried service_orders back, causing
-- "infinite recursion detected in policy for relation service_orders" on customer order creation.
-- Same pattern already used for is_conversation_participant(): a SECURITY DEFINER function
-- bypasses RLS internally, so the cross-table check no longer re-triggers service_orders' own policies.

create or replace function public.technician_assigned_to_customer(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select exists (
    select 1
    from public.service_orders so
    join public.profiles p on p.id = auth.uid()
    where so.customer_id = p_customer_id
      and so.assigned_technician_id = p.technician_id
  );
$$;

drop policy if exists "customers_select_own_or_staff" on public.customers;

create policy "customers_select_own_or_staff"
on public.customers
for select
to authenticated
using (
  is_admin()
  or profile_id = auth.uid()
  or technician_assigned_to_customer(customers.id)
);
