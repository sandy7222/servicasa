-- Run this script once in Supabase SQL Editor before testing customer-side requests.
-- It grants a customer the narrowest possible INSERT capability: only an initial
-- request that belongs to their own profile, with no technician or paid state.

grant insert on table public.service_orders to authenticated;

drop policy if exists "service_orders_insert_customer_request" on public.service_orders;

create policy "service_orders_insert_customer_request"
on public.service_orders
for insert
to authenticated
with check (
  customer_id in (
    select c.id
    from public.customers as c
    where c.profile_id = (select auth.uid())
  )
  and assigned_technician_id is null
  and assigned_technician_name is null
  and status::text = 'assigned'
  and service_status = 'pending'
  and quote_status = 'none'
  and payment_status = 'pending'
  and work_mode in ('diagnosis', 'direct')
  and coalesce(total_paid_amount, 0) = 0
  and coalesce(extra_amount, 0) = 0
);

-- Verification: it should return the policy name once it was created.
select policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'service_orders'
  and policyname = 'service_orders_insert_customer_request';
