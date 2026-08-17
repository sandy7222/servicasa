-- ServiCasa — pagos, presupuestos y liquidaciones
--
-- Ejecutar en el SQL Editor del proyecto ServiCasa. Este archivo se conserva
-- como script de despliegue porque este equipo no tiene el Supabase CLI ni
-- acceso MCP a la base remota para generar/aplicar una migración vinculada.
-- No incluye claves de Mercado Pago.

begin;

-- La columna status existente continúa siendo el estado operativo legado.
-- Los nuevos campos separan modalidad, presupuesto y pago para no mezclar
-- estados que representan conceptos diferentes.
alter table public.service_orders
  add column if not exists work_mode text not null default 'diagnosis',
  add column if not exists service_status text,
  add column if not exists quote_status text not null default 'none',
  add column if not exists payment_status text not null default 'pending',
  add column if not exists visit_deposit_amount numeric(12,2) not null default 0,
  add column if not exists total_quoted_amount numeric(12,2) not null default 0,
  add column if not exists total_paid_amount numeric(12,2) not null default 0,
  add column if not exists extra_amount numeric(12,2) not null default 0;

update public.service_orders
set service_status = coalesce(service_status, status::text)
where service_status is null;

alter table public.service_orders
  alter column service_status set not null;

alter table public.service_orders
  drop constraint if exists service_orders_work_mode_check,
  drop constraint if exists service_orders_service_status_check,
  drop constraint if exists service_orders_quote_status_check,
  drop constraint if exists service_orders_payment_status_check,
  drop constraint if exists service_orders_non_negative_money_check;

alter table public.service_orders
  add constraint service_orders_work_mode_check
    check (work_mode in ('diagnosis', 'direct')),
  add constraint service_orders_service_status_check
    check (service_status in ('pending', 'assigned', 'en_route', 'in_progress', 'paused', 'completed', 'cancelled')),
  add constraint service_orders_quote_status_check
    check (quote_status in ('none', 'draft', 'sent', 'accepted', 'rejected')),
  add constraint service_orders_payment_status_check
    check (payment_status in ('pending', 'deposit_paid', 'balance_pending', 'paid_in_full', 'refunded')),
  add constraint service_orders_non_negative_money_check
    check (visit_deposit_amount >= 0 and total_quoted_amount >= 0 and total_paid_amount >= 0 and extra_amount >= 0);

create table if not exists public.order_quotes (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete cascade,
  version integer not null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  notes text,
  subtotal_labor numeric(12,2) not null default 0 check (subtotal_labor >= 0),
  subtotal_materials numeric(12,2) not null default 0 check (subtotal_materials >= 0),
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  visit_deposit_credit numeric(12,2) not null default 0 check (visit_deposit_credit >= 0),
  remaining_amount numeric(12,2) not null default 0 check (remaining_amount >= 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  valid_until timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, version)
);

create table if not exists public.order_quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.order_quotes(id) on delete cascade,
  item_type text not null check (item_type in ('labor', 'material')),
  description text not null check (char_length(trim(description)) > 0),
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'unidad',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  subtotal numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.order_diagnosis_photos (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete cascade,
  quote_id uuid references public.order_quotes(id) on delete set null,
  storage_path text not null,
  caption text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete restrict,
  quote_id uuid references public.order_quotes(id) on delete set null,
  payment_type text not null check (payment_type in ('visit_deposit', 'balance_payment', 'full_advance', 'extra_payment')),
  provider text not null default 'mercadopago',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'ARS' check (currency = 'ARS'),
  mp_preference_id text unique,
  mp_payment_id text unique,
  mp_payment_method text,
  mp_installments integer,
  mp_fee_amount numeric(12,2) not null default 0 check (mp_fee_amount >= 0),
  provider_payload jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.technician_settlements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.service_orders(id) on delete restrict,
  technician_id uuid not null references public.technicians(id) on delete restrict,
  payment_transaction_id uuid references public.payment_transactions(id) on delete set null,
  settlement_type text not null check (settlement_type in ('completed_work', 'rejected_visit')),
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  platform_commission_amount numeric(12,2) not null check (platform_commission_amount >= 0),
  payment_fee_amount numeric(12,2) not null check (payment_fee_amount >= 0),
  net_amount numeric(12,2) not null check (net_amount >= 0),
  status text not null default 'pending' check (status in ('pending', 'available', 'paid', 'held', 'cancelled')),
  release_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (payment_transaction_id, settlement_type)
);

create index if not exists order_quotes_order_version_idx on public.order_quotes(order_id, version desc);
create index if not exists order_quote_items_quote_sort_idx on public.order_quote_items(quote_id, sort_order);
create index if not exists order_diagnosis_photos_order_idx on public.order_diagnosis_photos(order_id, created_at desc);
create index if not exists payment_transactions_order_idx on public.payment_transactions(order_id, created_at desc);
create index if not exists technician_settlements_technician_status_idx on public.technician_settlements(technician_id, status, release_at);

-- Prevent changing quote contents once they have been sent. The server may
-- still change only the decision fields (accepted/rejected timestamps).
create or replace function public.prevent_sent_quote_content_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' and (
    new.order_id is distinct from old.order_id or
    new.version is distinct from old.version or
    new.notes is distinct from old.notes or
    new.subtotal_labor is distinct from old.subtotal_labor or
    new.subtotal_materials is distinct from old.subtotal_materials or
    new.total_amount is distinct from old.total_amount or
    new.visit_deposit_credit is distinct from old.visit_deposit_credit or
    new.remaining_amount is distinct from old.remaining_amount or
    new.currency is distinct from old.currency or
    new.valid_until is distinct from old.valid_until or
    new.created_by is distinct from old.created_by
  ) then
    raise exception 'El presupuesto enviado es inmutable';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists order_quotes_prevent_content_change on public.order_quotes;
create trigger order_quotes_prevent_content_change
before update on public.order_quotes
for each row execute function public.prevent_sent_quote_content_change();

-- Enable RLS. Payment and settlement writes are intentionally server-only:
-- the server validates Mercado Pago webhooks using its private access token.
alter table public.order_quotes enable row level security;
alter table public.order_quote_items enable row level security;
alter table public.order_diagnosis_photos enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.technician_settlements enable row level security;

-- Grant Data API access; RLS policies below restrict rows. No browser write
-- permissions are granted to payments or settlements.
grant select, insert, update, delete on public.order_quotes, public.order_quote_items, public.order_diagnosis_photos to authenticated;
grant select on public.payment_transactions, public.technician_settlements to authenticated;

commit;

-- IMPORTANT: add the project-specific RLS policies after reviewing existing
-- service_orders / profiles policies. They depend on the exact admin-profile
-- model already present in this project and must not be replaced blindly.
