-- Proyecto de instalación, Fase 2C (opcional): adjuntar el plano (PDF, JPG o PNG) al proyecto.
-- Bucket PRIVADO 'installation-plans', una carpeta por técnico: <technician_id>/<project_id>/<archivo>.
-- Solo el dueño lee, sube, reemplaza y borra sus planos (los proyectos son de trabajo, no los ve el admin).
-- El proyecto guarda la ruta y el nombre del archivo en dos columnas nuevas. No toca pagos, órdenes ni presupuestos.

alter table public.installation_projects
  add column if not exists plan_path text,
  add column if not exists plan_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('installation-plans', 'installation-plans', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

drop policy if exists installation_plans_owner_read on storage.objects;
create policy installation_plans_owner_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'installation-plans'
    and (storage.foldername(name))[1] in (select technician_id::text from public.profiles where id = (select auth.uid()))
  );

drop policy if exists installation_plans_owner_insert on storage.objects;
create policy installation_plans_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'installation-plans'
    and (storage.foldername(name))[1] in (select technician_id::text from public.profiles where id = (select auth.uid()))
  );

drop policy if exists installation_plans_owner_update on storage.objects;
create policy installation_plans_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'installation-plans'
    and (storage.foldername(name))[1] in (select technician_id::text from public.profiles where id = (select auth.uid()))
  )
  with check (
    bucket_id = 'installation-plans'
    and (storage.foldername(name))[1] in (select technician_id::text from public.profiles where id = (select auth.uid()))
  );

drop policy if exists installation_plans_owner_delete on storage.objects;
create policy installation_plans_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'installation-plans'
    and (storage.foldername(name))[1] in (select technician_id::text from public.profiles where id = (select auth.uid()))
  );
