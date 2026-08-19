-- ============================================================
-- ServiCasa: módulo de Reclamos y Garantías
-- Ejecutar una única vez en Supabase SQL Editor.
--
-- Crea la entidad real de casos (support_cases), el hilo de
-- comunicaciones (support_case_messages) y la auditoría de cambios
-- (support_case_history). El flag service_orders.admin_incident_status
-- se mantiene como espejo sincronizado para no romper los lectores
-- existentes (persistResolveAdminIncident, UI de órdenes, etc.).
--
-- La pausa de liquidación se apoya en technician_settlements.status =
-- 'in_review' + dispute_reason (ya existente). Este módulo NO crea
-- liquidaciones: solo las pausa/libera/cancela según la resolución.
-- ============================================================

begin;

create table if not exists public.support_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text unique,

  -- Vinculaciones (opcionales: un caso puede existir sin orden)
  customer_id uuid references public.customers(id) on delete set null,
  order_id uuid references public.service_orders(id) on delete set null,
  technician_id uuid references public.technicians(id) on delete set null,

  -- Nombres desnormalizados (consistentes con service_orders.client_name)
  customer_name text,
  technician_name text,

  case_type text not null check (case_type in (
    'warranty', 'complaint', 'dispute', 'no_show', 'damage', 'other'
  )),

  status text not null default 'open' check (status in (
    'open', 'in_progress', 'waiting_client', 'waiting_technician',
    'resolved', 'closed', 'escalated'
  )),

  priority text not null default 'medium' check (priority in (
    'low', 'medium', 'high', 'urgent'
  )),

  subject text not null check (char_length(trim(subject)) > 0),
  description text,

  -- Resolución
  resolution_type text check (resolution_type in (
    'full_refund', 'partial_refund', 'redo_work',
    'send_another_technician', 'credit_note', 'no_action', 'other'
  )),
  resolution_amount numeric(12,2) check (resolution_amount is null or resolution_amount >= 0),
  resolution_notes text,

  -- Pausa de liquidación (flag forward-compatible + vínculo opcional)
  settlement_paused boolean not null default false,
  settlement_id uuid,

  -- Trazabilidad
  opened_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists support_cases_status_idx on public.support_cases(status);
create index if not exists support_cases_customer_idx on public.support_cases(customer_id);
create index if not exists support_cases_order_idx on public.support_cases(order_id);
create index if not exists support_cases_technician_idx on public.support_cases(technician_id);
create index if not exists support_cases_opened_idx on public.support_cases(opened_at desc);

-- ============================================
-- COMUNICACIONES DEL CASO
-- ============================================
create table if not exists public.support_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  sender_type text not null default 'admin' check (sender_type in ('admin', 'client', 'technician', 'system')),
  channel text not null default 'in_app' check (channel in ('in_app', 'phone', 'email', 'whatsapp', 'internal_note')),
  message text not null check (char_length(trim(message)) > 0),
  is_internal boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists support_case_messages_case_idx on public.support_case_messages(case_id, created_at);

-- ============================================
-- HISTORIAL DE CAMBIOS (auditoría)
-- ============================================
create table if not exists public.support_case_history (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.support_cases(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  change_type text not null check (change_type in (
    'created', 'status_change', 'priority_change', 'message_added',
    'settlement_paused', 'settlement_released', 'settlement_cancelled',
    'settlement_retained', 'resolution_added', 'closed'
  )),
  previous_value text,
  new_value text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists support_case_history_case_idx on public.support_case_history(case_id, created_at desc);

-- ============================================
-- case_number autogenerado: REC-YYYY-NNNN
-- ============================================
create sequence if not exists public.support_case_number_seq;

create or replace function public.set_support_case_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.case_number is null or new.case_number = '' then
    new.case_number := 'REC-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.support_case_number_seq')::text, 4, '0');
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_cases_set_number on public.support_cases;
create trigger support_cases_set_number
before insert on public.support_cases
for each row execute function public.set_support_case_number();

-- ============================================
-- VISTA: resumen de casos (solo columnas propias, sin JOINs riesgosos)
-- ============================================
drop view if exists public.support_cases_summary;

create view public.support_cases_summary
with (security_invoker = true)
as
select
  sc.id,
  sc.case_number,
  sc.case_type,
  sc.status,
  sc.priority,
  sc.subject,
  sc.customer_name,
  sc.technician_name,
  sc.order_id,
  sc.settlement_paused,
  sc.opened_at,
  sc.resolved_at,
  sc.closed_at,
  (select count(*) from public.support_case_messages m where m.case_id = sc.id) as message_count
from public.support_cases sc;

-- ============================================
-- RLS: solo administración gestiona los casos
-- ============================================
alter table public.support_cases enable row level security;
alter table public.support_case_messages enable row level security;
alter table public.support_case_history enable row level security;

drop policy if exists support_cases_admin_all on public.support_cases;
create policy support_cases_admin_all on public.support_cases for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists support_case_messages_admin_all on public.support_case_messages;
create policy support_case_messages_admin_all on public.support_case_messages for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

drop policy if exists support_case_history_admin_all on public.support_case_history;
create policy support_case_history_admin_all on public.support_case_history for all to authenticated
  using ((select is_admin())) with check ((select is_admin()));

grant select, insert, update, delete on public.support_cases, public.support_case_messages, public.support_case_history to authenticated;
grant usage, select on sequence public.support_case_number_seq to authenticated;

commit;
