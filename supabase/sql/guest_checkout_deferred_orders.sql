-- ServiCasa — pedidos de invitado: no crear la orden hasta que el pago se
-- confirme de verdad.
--
-- Motivo (Sandy, 2026-08-22): probando pagos con tarjeta de prueba, varios
-- intentos fallaron/no se completaron y aun así quedaban clientes + órdenes
-- "huérfanas" en la base (con payment_status='pending' para siempre), porque
-- api/orders/guest-checkout.ts creaba la orden ANTES de mandar al cliente a
-- Mercado Pago. Como el invitado no tiene cuenta, tampoco puede volver a
-- buscar ni cancelar esa orden — no tiene sentido que exista si nunca se pagó.
--
-- Esta tabla guarda los datos del pedido (cliente + orden, sin crear nada
-- todavía) mientras el pago está en camino. api/payments/webhook.ts recién
-- crea el customer/service_order/payment_transaction reales cuando Mercado
-- Pago confirma el pago como 'approved'. Si el pago se rechaza, se cancela,
-- o el invitado nunca vuelve, no se crea nada — solo queda este borrador.
--
-- Nota: los pagos en efectivo (Pago Fácil/Rapipago) generan un código y
-- Mercado Pago recién confirma 'approved' días después, cuando el invitado
-- realmente paga en el local — este diseño lo soporta naturalmente: el
-- borrador queda en 'pending' hasta ese momento, sin crear una orden vacía
-- mientras tanto.
--
-- Ejecutar en el SQL Editor.

begin;

create table if not exists public.guest_checkout_drafts (
  id uuid primary key default gen_random_uuid(),
  guest_access_token text not null unique default gen_random_uuid()::text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  payment_type text not null check (payment_type in ('visit_deposit', 'full_advance')),
  amount numeric(12,2) not null check (amount > 0),
  payload jsonb not null,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists guest_checkout_drafts_created_at_idx
  on public.guest_checkout_drafts (created_at);

-- Solo el server (supabaseAdmin, service-role) toca esta tabla: contiene
-- datos personales de un pedido que todavía no fue pagado ni confirmado, y
-- no hay ningún flujo de cliente/admin autenticado que deba leerla.
alter table public.guest_checkout_drafts enable row level security;

commit;

select table_name, row_security
from information_schema.tables
where table_schema = 'public' and table_name = 'guest_checkout_drafts';
