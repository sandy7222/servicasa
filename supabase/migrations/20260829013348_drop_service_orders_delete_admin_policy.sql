-- Decision de producto: ningun DELETE real debe quedar posible sobre
-- service_orders, ni siquiera para admin. La funcion deleteOrder/
-- persistDeleteOrder (lado app) ya se elimino del codigo - esta policy era
-- lo unico que la habilitaba a nivel de base.
drop policy if exists "service_orders_delete_admin" on public.service_orders;
