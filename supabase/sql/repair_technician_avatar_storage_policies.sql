-- Repair for technician avatar uploads.
-- The current UI uses unique files (INSERT only), but these policies also allow
-- a future safe replacement/delete of an avatar in the technician's own folder.
-- Run once in the Supabase SQL Editor.

begin;

drop policy if exists technician_avatars_owner_select on storage.objects;
create policy technician_avatars_owner_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'technician-avatars'
    and (
      (select is_admin())
      or (storage.foldername(name))[1] in (
        select technician_id::text from public.profiles where id = (select auth.uid())
      )
    )
  );

drop policy if exists technician_avatars_owner_delete on storage.objects;
create policy technician_avatars_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'technician-avatars'
    and (
      (select is_admin())
      or (storage.foldername(name))[1] in (
        select technician_id::text from public.profiles where id = (select auth.uid())
      )
    )
  );

commit;
