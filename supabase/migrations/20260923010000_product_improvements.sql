-- Producto: leads B2B, preferencias de aviso, evidencia T&C de invitado
-- y registro de contratos impresos.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type = any (array[
    'order_assigned','quote_sent','quote_accepted','quote_rejected',
    'payment_approved','payment_rejected','payment_pending',
    'claim_opened','claim_message','claim_resolved',
    'message_new','settlement_scheduled','settlement_released','settlement_paid',
    'technician_validation','cron_failure','technician_en_route','business_lead'
  ]));

alter table public.notifications drop constraint if exists notifications_entity_type_check;
alter table public.notifications
  add constraint notifications_entity_type_check check (
    entity_type is null or entity_type = any (array[
      'order','quote','payment','claim','conversation','settlement',
      'technician_validation','business_lead'
    ])
  );

create table public.business_leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  service_type text,
  description text not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now()
);

alter table public.business_leads enable row level security;
revoke all on public.business_leads from anon, authenticated;
grant select, update on public.business_leads to authenticated;

create policy business_leads_admin_select
  on public.business_leads for select
  to authenticated
  using (public.is_admin());

create policy business_leads_admin_update
  on public.business_leads for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  email_assignment boolean not null default true,
  email_quote boolean not null default true,
  email_payment boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon;
grant select, insert, update on public.notification_preferences to authenticated;

create policy notification_preferences_own
  on public.notification_preferences for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy notification_preferences_own_insert
  on public.notification_preferences for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

create policy notification_preferences_own_update
  on public.notification_preferences for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create table public.guest_legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  document_slug text not null default 'terminos_cliente',
  document_version text not null,
  document_hash text not null check (document_hash ~ '^[0-9a-f]{64}$'),
  accepted_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  draft_id uuid references public.guest_checkout_drafts(id) on delete set null
);

alter table public.guest_legal_acceptances enable row level security;
revoke all on public.guest_legal_acceptances from anon, authenticated;

create table public.technician_contracts (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  generated_by uuid references public.profiles(id) on delete set null,
  document_hash text not null,
  document_version text not null default to_char(now(), 'YYYY-MM-DD'),
  printed_at timestamptz not null default now()
);

alter table public.technician_contracts enable row level security;
revoke all on public.technician_contracts from anon;
grant select, insert on public.technician_contracts to authenticated;

create policy technician_contracts_admin_all
  on public.technician_contracts for select
  to authenticated
  using (
    public.is_admin()
    or technician_id in (
      select id from public.technicians where profile_id = (select auth.uid())
    )
  );

create policy technician_contracts_admin_insert
  on public.technician_contracts for insert
  to authenticated
  with check (public.is_admin());
