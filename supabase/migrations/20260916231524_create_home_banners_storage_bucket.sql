-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

-- Bucket público para los banners del editor de página del cliente:
-- soporta jpg/png/gif/mp4, solo el admin puede subir/editar/borrar (mismo
-- patrón que technician-avatars: bucket público + policies solo-admin en
-- storage.objects). Límite 20MB para permitir video corto.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'home-banners',
  'home-banners',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/gif', 'video/mp4']
);

create policy home_banners_admin_all
  on storage.objects for all
  to authenticated
  using (bucket_id = 'home-banners' and (select is_admin()))
  with check (bucket_id = 'home-banners' and (select is_admin()));
