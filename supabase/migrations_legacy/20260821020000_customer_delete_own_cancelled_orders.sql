-- Applied remotely via MCP (project ayszrtieplmqscqtabsu)
-- Name: customer_delete_own_cancelled_orders
-- Purpose: lets a customer permanently delete their OWN cancelled orders,
--   so cancelled requests don't pile up forever in "Mis Servicios a
--   Domicilio". Restricted to status = 'cancelled' — customers cannot
--   delete active/in-progress orders this way, only admin can
--   (service_orders_delete_admin already covers that).
--
-- Known tradeoff (confirmed with the project owner before applying): this
-- is a real DELETE, not a soft-hide. Any payment_transactions rows tied to
-- the deleted order_id become orphaned and stop showing up in the admin's
-- ClientFicha payment history (that view filters by the customer's current
-- order ids). Accepted as fine for this project's scale.

create policy service_orders_delete_customer_cancelled
  on public.service_orders for delete
  to authenticated
  using (
    status = 'cancelled'
    and customer_id = (select profiles.customer_id from profiles where profiles.id = auth.uid())
  );
