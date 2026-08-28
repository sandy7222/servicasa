-- Same architectural fix already applied to guest checkout (ver
-- guest_checkout_drafts / commits 21d1ff3, d185b2b): "Solicitar diagnostico"
-- para cliente logueado insertaba en service_orders con
-- payment_status='pending' antes de que Mercado Pago confirmara nada, asi
-- que cualquier fallo post-insert (sesion vencida, MP caido, el cliente se
-- va) dejaba una orden con apariencia operativa real y cero pago. Casos
-- reales: 432efd32-405a-4232-b608-654c3f0f1347, bb802ded-5e59-44cc-9769-b3cf9d755856.
--
-- Mismo patron que guest_checkout_drafts: nada se crea en service_orders
-- hasta que el webhook confirma 'approved'. Sin politicas RLS a proposito
-- (igual que guest_checkout_drafts) - todo el acceso pasa por endpoints
-- server-side autenticados (api/orders/request-service.ts,
-- api/orders/pending-draft.ts, api/payments/retry-draft.ts), nunca
-- directo desde el cliente.
create table public.customer_order_drafts (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  payment_type text not null,
  amount numeric not null,
  payload jsonb not null,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customer_order_drafts enable row level security;

create index customer_order_drafts_customer_id_idx on public.customer_order_drafts(customer_id);
