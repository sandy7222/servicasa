-- The technician/admin app subscribes to postgres_changes on order_quotes,
-- order_quote_items and order_diagnosis_photos (see AppContext.tsx's
-- 'tecniurbano-operational-live' channel) expecting them to trigger a live
-- refetch, but these three tables were never added to the supabase_realtime
-- publication, so those subscriptions silently never fire. service_orders
-- changes (payment_status, quote_status) DO fire, but the client can still
-- render stale quote data until something else touches service_orders.
-- This was very likely part of the "el técnico ve 'Esperando la seña' pese a
-- que el pago ya fue confirmado" bug: even where service_orders eventually
-- refires, a dropped/idle websocket meant the technician's tab never
-- recovered without a manual refresh.
alter publication supabase_realtime add table public.order_quotes;
alter publication supabase_realtime add table public.order_quote_items;
alter publication supabase_realtime add table public.order_diagnosis_photos;
