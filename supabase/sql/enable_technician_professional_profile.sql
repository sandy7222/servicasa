-- ============================================================
-- ServiCasa: perfil profesional de técnicos y documentación
-- Ejecutar una única vez en Supabase SQL Editor.
-- Los datos bancarios y PDFs se guardan FUERA de technicians,
-- para que nunca formen parte de la ficha pública del técnico.
-- ============================================================

begin;

-- Perfil público/profesional (ninguno de estos campos es bancario).
alter table public.technicians
  add column if not exists work_phone text,
  add column if not exists bio text,
  add column if not exists education_level text,
  add column if not exists degree_title text,
  add column if not exists institution_name text,
  add column if not exists public_avatar_path text,
  add column if not exists validation_status text not null default 'pending',
  add column if not exists validation_notes text,
  add column if not exists validated_at timestamptz,
  add column if not exists validated_by uuid references public.profiles(id) on delete set null,
  add column if not exists is_enabled boolean not null default false;

alter table public.technicians
  drop constraint if exists technicians_education_level_check;
alter table public.technicians
  add constraint technicians_education_level_check
  check (education_level is null or education_level in ('idoneo', 'curso_certificado', 'tecnico', 'tecnico_superior', 'ingeniero', 'otro'));

alter table public.technicians
  drop constraint if exists technicians_validation_status_check;
alter table public.technicians
  add constraint technicians_validation_status_check
  check (validation_status in ('pending', 'approved', 'observed', 'suspended'));

-- Matrículas: número y entidad pueden mostrarse únicamente si fueron aprobados.
create table if not exists public.technician_matriculas (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  issuing_entity text not null,
  license_number text not null,
  specialty text,
  expires_at date,
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'approved', 'observed', 'expired')),
  validation_notes text,
  validated_at timestamptz,
  validated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists technician_matriculas_technician_idx
  on public.technician_matriculas(technician_id, validation_status);

-- PDFs sensibles. La ruta apunta al bucket PRIVADO technician-documents.
create table if not exists public.technician_documents (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null references public.technicians(id) on delete cascade,
  document_type text not null check (document_type in ('monotributo', 'identity', 'degree', 'certificate', 'license_support')),
  label text not null,
  storage_path text not null unique,
  issuer_name text,
  issued_at date,
  version integer not null default 1 check (version > 0),
  is_current boolean not null default true,
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'approved', 'observed', 'replaced')),
  validation_notes text,
  validated_at timestamptz,
  validated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists technician_documents_technician_idx
  on public.technician_documents(technician_id, document_type, is_current);

-- Datos de cobro: tabla separada y privada.
create table if not exists public.technician_payment_accounts (
  id uuid primary key default gen_random_uuid(),
  technician_id uuid not null unique references public.technicians(id) on delete cascade,
  account_holder text not null,
  cbu_cvu text not null check (cbu_cvu ~ '^[0-9]{22}$'),
  alias text,
  provider text not null default 'bank' check (provider in ('bank', 'mercadopago', 'other')),
  validation_status text not null default 'pending'
    check (validation_status in ('pending', 'approved', 'observed')),
  validation_notes text,
  updated_at timestamptz not null default now()
);

-- Estado administrativo que muestra al técnico qué le falta.
create table if not exists public.technician_enablement_checklist (
  technician_id uuid primary key references public.technicians(id) on delete cascade,
  profile_complete boolean not null default false,
  identity_verified boolean not null default false,
  tax_document_approved boolean not null default false,
  payment_account_valid boolean not null default false,
  professional_license_valid boolean not null default false,
  is_ready boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Una fila de checklist para cada técnico que ya exista.
insert into public.technician_enablement_checklist (technician_id)
select id from public.technicians
on conflict (technician_id) do nothing;

-- Buckets. El avatar se usa como tarjeta pública; los documentos sólo por URL firmada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('technician-documents', 'technician-documents', false, 10485760, array['application/pdf']),
  ('technician-avatars', 'technician-avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.technician_matriculas enable row level security;
alter table public.technician_documents enable row level security;
alter table public.technician_payment_accounts enable row level security;
alter table public.technician_enablement_checklist enable row level security;

-- A technician may maintain their own records, but cannot approve their own
-- licence, monotributo or payment account through an UPDATE/INSERT payload.
create or replace function public.lock_technician_review_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if (select is_admin()) then
    return new;
  end if;

  if tg_table_name = 'technician_matriculas' then
    new.validation_status := case when tg_op = 'INSERT' then 'pending' else old.validation_status end;
    new.validation_notes := case when tg_op = 'INSERT' then null else old.validation_notes end;
    new.validated_at := case when tg_op = 'INSERT' then null else old.validated_at end;
    new.validated_by := case when tg_op = 'INSERT' then null else old.validated_by end;
  elsif tg_table_name = 'technician_documents' then
    new.validation_status := case when tg_op = 'INSERT' then 'pending' else old.validation_status end;
    new.validation_notes := case when tg_op = 'INSERT' then null else old.validation_notes end;
    new.validated_at := case when tg_op = 'INSERT' then null else old.validated_at end;
    new.validated_by := case when tg_op = 'INSERT' then null else old.validated_by end;
  elsif tg_table_name = 'technician_payment_accounts' then
    new.validation_status := case when tg_op = 'INSERT' then 'pending' else old.validation_status end;
    new.validation_notes := case when tg_op = 'INSERT' then null else old.validation_notes end;
  end if;
  return new;
end;
$$;

drop trigger if exists lock_technician_matricula_review on public.technician_matriculas;
create trigger lock_technician_matricula_review before insert or update on public.technician_matriculas
  for each row execute function public.lock_technician_review_fields();
drop trigger if exists lock_technician_document_review on public.technician_documents;
create trigger lock_technician_document_review before insert or update on public.technician_documents
  for each row execute function public.lock_technician_review_fields();
drop trigger if exists lock_technician_payment_review on public.technician_payment_accounts;
create trigger lock_technician_payment_review before insert or update on public.technician_payment_accounts
  for each row execute function public.lock_technician_review_fields();

-- Matriculas: dueño/admin; clientes únicamente las aprobadas de técnicos asignados.
drop policy if exists technician_matriculas_owner_or_admin on public.technician_matriculas;
create policy technician_matriculas_owner_or_admin on public.technician_matriculas
  for all to authenticated
  using (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  );

drop policy if exists technician_matriculas_customer_assigned_approved on public.technician_matriculas;
create policy technician_matriculas_customer_assigned_approved on public.technician_matriculas
  for select to authenticated
  using (
    validation_status = 'approved'
    and exists (
      select 1 from public.service_orders o
      join public.profiles p on p.id = (select auth.uid())
      where o.assigned_technician_id = technician_matriculas.technician_id
        and o.customer_id = p.customer_id
    )
  );

-- Documents and payment details are never visible to customers.
drop policy if exists technician_documents_owner_or_admin on public.technician_documents;
create policy technician_documents_owner_or_admin on public.technician_documents
  for all to authenticated
  using (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  );

drop policy if exists technician_payment_accounts_owner_or_admin on public.technician_payment_accounts;
create policy technician_payment_accounts_owner_or_admin on public.technician_payment_accounts
  for all to authenticated
  using (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  )
  with check (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  );

drop policy if exists technician_enablement_owner_or_admin on public.technician_enablement_checklist;
create policy technician_enablement_owner_or_admin on public.technician_enablement_checklist
  for select to authenticated
  using (
    (select is_admin())
    or technician_id in (select technician_id from public.profiles where id = (select auth.uid()))
  );

drop policy if exists technician_enablement_admin_write on public.technician_enablement_checklist;
create policy technician_enablement_admin_write on public.technician_enablement_checklist
  for update to authenticated
  using ((select is_admin())) with check ((select is_admin()));

-- Storage policies. Path required: <technician_id>/<file-name>.
drop policy if exists technician_documents_owner_read on storage.objects;
create policy technician_documents_owner_read on storage.objects for select to authenticated
  using (bucket_id = 'technician-documents' and (
    (select is_admin()) or (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  ));
drop policy if exists technician_documents_owner_insert on storage.objects;
create policy technician_documents_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'technician-documents' and (
    (select is_admin()) or (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  ));
drop policy if exists technician_documents_owner_update on storage.objects;
create policy technician_documents_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'technician-documents' and (
    (select is_admin()) or (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  )) with check (bucket_id = 'technician-documents' and (
    (select is_admin()) or (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  ));
drop policy if exists technician_documents_owner_delete on storage.objects;
create policy technician_documents_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'technician-documents' and (
    (select is_admin()) or (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  ));

drop policy if exists technician_avatars_owner_write on storage.objects;
create policy technician_avatars_owner_write on storage.objects for insert to authenticated
  with check (bucket_id = 'technician-avatars' and (
    (select is_admin()) or (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  ));
drop policy if exists technician_avatars_owner_update on storage.objects;
create policy technician_avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'technician-avatars' and (
    (select is_admin()) or (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  )) with check (bucket_id = 'technician-avatars' and (
    (select is_admin()) or (storage.foldername(name))[1] in (
      select technician_id::text from public.profiles where id = (select auth.uid())
    )
  ));

-- Deliberately security-definer view: it only exposes selected safe fields and
-- predicates every result against an assignment belonging to the signed-in client.
create or replace view public.technician_public_view
with (security_invoker = false)
as
select
  t.id,
  t.name,
  t.specialty,
  t.rating,
  t.completed_orders_count,
  t.public_avatar_path,
  t.bio,
  t.education_level,
  t.degree_title,
  t.institution_name,
  t.validation_status,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'issuing_entity', m.issuing_entity,
      'license_number', m.license_number,
      'specialty', m.specialty
    ) order by m.created_at desc)
    from public.technician_matriculas m
    where m.technician_id = t.id and m.validation_status = 'approved'
  ), '[]'::jsonb) as validated_licenses
from public.technicians t
where (select is_admin())
   or t.id in (select technician_id from public.profiles where id = (select auth.uid()))
   or exists (
     select 1 from public.service_orders o
     join public.profiles p on p.id = (select auth.uid())
     where o.assigned_technician_id = t.id and o.customer_id = p.customer_id
   );

grant select on public.technician_public_view to authenticated;
grant select, insert, update, delete on public.technician_matriculas, public.technician_documents, public.technician_payment_accounts, public.technician_enablement_checklist to authenticated;

commit;

-- Verification (expected: two buckets and the four profile tables).
select id, public, file_size_limit, allowed_mime_types
from storage.buckets
where id in ('technician-documents', 'technician-avatars')
order by id;
