-- Applied remotely via MCP (project ayszrtieplmqscqtabsu)
-- Name: guest_checkout_access_token
-- Purpose: supports guest checkout (api/orders/guest-checkout.ts,
--   api/orders/guest-status.ts). No new RLS policy needed — guest orders are
--   created and read exclusively through server endpoints using the
--   service-role key, which bypasses RLS entirely. This column is never
--   queried by an anon/authenticated client directly.

alter table public.service_orders
  add column guest_access_token text unique;

comment on column public.service_orders.guest_access_token is
  'Opaque token for unauthenticated guest checkout order tracking. Only set for orders created via api/orders/guest-checkout.ts. Looked up exclusively through server endpoints using the service-role key — never exposed via client-side RLS.';
