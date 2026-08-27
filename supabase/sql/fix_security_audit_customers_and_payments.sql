-- ServiCasa — audit de seguridad de PII (2026-08-22)
--
-- Hallazgo 1: customers_select_own_or_staff le daba a CUALQUIER técnico
-- logueado (current_user_role() = 'technician') acceso de lectura a TODA
-- la tabla customers, sin limitarlo a los clientes que tiene asignados.
-- Se reemplaza por un scope idéntico al de service_orders_select_scoped:
-- el técnico solo ve clientes con al menos una orden asignada a él.
--
-- Hallazgo 2: payment_transactions tiene RLS activado pero CERO políticas
-- (confirmado con pg_policies). El comentario en api/lib/supabaseAdmin.ts
-- ya documentaba la intención ("payment_transactions only grants SELECT to
-- authenticated") pero la política nunca se creó. Se agrega: admin ve todo,
-- el cliente dueño de la orden ve sus propios pagos. Los técnicos NO reciben
-- acceso (no lo necesitan: ya ven payment_status vía service_orders, y esta
-- tabla guarda el payload crudo de Mercado Pago). Los inserts/updates siguen
-- siendo server-only vía supabaseAdmin (service role, bypassea RLS).
--
-- Ejecutar UNA vez en el SQL Editor.

begin;

drop policy if exists customers_select_own_or_staff on public.customers;
create policy customers_select_own_or_staff on public.customers
for select
to authenticated
using (
  is_admin()
  or profile_id = auth.uid()
  or exists (
    select 1
    from public.service_orders so
    join public.profiles p on p.id = auth.uid()
    where so.customer_id = customers.id
      and so.assigned_technician_id = p.technician_id
  )
);

drop policy if exists payment_transactions_select_admin_or_owner on public.payment_transactions;
create policy payment_transactions_select_admin_or_owner on public.payment_transactions
for select
to authenticated
using (
  is_admin()
  or exists (
    select 1
    from public.service_orders so
    join public.profiles p on p.id = auth.uid()
    where so.id = payment_transactions.order_id
      and so.customer_id = p.customer_id
  )
);

commit;

-- Verificación: debería devolver 2 filas
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and policyname in ('customers_select_own_or_staff', 'payment_transactions_select_admin_or_owner');
