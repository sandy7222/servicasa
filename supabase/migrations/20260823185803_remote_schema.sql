drop extension if exists "pg_net";

drop policy "technician_applications_insert_public" on "public"."technician_applications";

revoke delete on table "public"."rubro_matricula_config" from "anon";

revoke insert on table "public"."rubro_matricula_config" from "anon";

revoke references on table "public"."rubro_matricula_config" from "anon";

revoke select on table "public"."rubro_matricula_config" from "anon";

revoke trigger on table "public"."rubro_matricula_config" from "anon";

revoke truncate on table "public"."rubro_matricula_config" from "anon";

revoke update on table "public"."rubro_matricula_config" from "anon";

revoke delete on table "public"."rubro_matricula_config" from "authenticated";

revoke insert on table "public"."rubro_matricula_config" from "authenticated";

revoke references on table "public"."rubro_matricula_config" from "authenticated";

revoke trigger on table "public"."rubro_matricula_config" from "authenticated";

revoke truncate on table "public"."rubro_matricula_config" from "authenticated";

revoke update on table "public"."rubro_matricula_config" from "authenticated";

revoke delete on table "public"."service_categories" from "anon";

revoke insert on table "public"."service_categories" from "anon";

revoke references on table "public"."service_categories" from "anon";

revoke select on table "public"."service_categories" from "anon";

revoke trigger on table "public"."service_categories" from "anon";

revoke truncate on table "public"."service_categories" from "anon";

revoke update on table "public"."service_categories" from "anon";

revoke references on table "public"."service_categories" from "authenticated";

revoke trigger on table "public"."service_categories" from "authenticated";

revoke truncate on table "public"."service_categories" from "authenticated";

revoke delete on table "public"."service_rubros" from "anon";

revoke insert on table "public"."service_rubros" from "anon";

revoke references on table "public"."service_rubros" from "anon";

revoke select on table "public"."service_rubros" from "anon";

revoke trigger on table "public"."service_rubros" from "anon";

revoke truncate on table "public"."service_rubros" from "anon";

revoke update on table "public"."service_rubros" from "anon";

revoke references on table "public"."service_rubros" from "authenticated";

revoke trigger on table "public"."service_rubros" from "authenticated";

revoke truncate on table "public"."service_rubros" from "authenticated";

revoke delete on table "public"."technician_notifications" from "anon";

revoke insert on table "public"."technician_notifications" from "anon";

revoke references on table "public"."technician_notifications" from "anon";

revoke select on table "public"."technician_notifications" from "anon";

revoke trigger on table "public"."technician_notifications" from "anon";

revoke truncate on table "public"."technician_notifications" from "anon";

revoke update on table "public"."technician_notifications" from "anon";

revoke references on table "public"."technician_notifications" from "authenticated";

revoke trigger on table "public"."technician_notifications" from "authenticated";

revoke truncate on table "public"."technician_notifications" from "authenticated";

revoke delete on table "public"."technician_requirements" from "anon";

revoke insert on table "public"."technician_requirements" from "anon";

revoke references on table "public"."technician_requirements" from "anon";

revoke select on table "public"."technician_requirements" from "anon";

revoke trigger on table "public"."technician_requirements" from "anon";

revoke truncate on table "public"."technician_requirements" from "anon";

revoke update on table "public"."technician_requirements" from "anon";

revoke references on table "public"."technician_requirements" from "authenticated";

revoke trigger on table "public"."technician_requirements" from "authenticated";

revoke truncate on table "public"."technician_requirements" from "authenticated";

revoke delete on table "public"."technician_review_history" from "anon";

revoke insert on table "public"."technician_review_history" from "anon";

revoke references on table "public"."technician_review_history" from "anon";

revoke select on table "public"."technician_review_history" from "anon";

revoke trigger on table "public"."technician_review_history" from "anon";

revoke truncate on table "public"."technician_review_history" from "anon";

revoke update on table "public"."technician_review_history" from "anon";

revoke references on table "public"."technician_review_history" from "authenticated";

revoke trigger on table "public"."technician_review_history" from "authenticated";

revoke truncate on table "public"."technician_review_history" from "authenticated";


  create policy "technician_applications_insert_public"
  on "public"."technician_applications"
  as permissive
  for insert
  to anon, authenticated
with check (((status = 'pending'::text) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL)));


CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "avatars_owner_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));



  create policy "avatars_owner_select"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));



  create policy "avatars_owner_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))))
with check (((bucket_id = 'avatars'::text) AND ((storage.foldername(name))[1] = ( SELECT (auth.uid())::text AS uid))));



  create policy "diagnosis_photos_insert_assigned_technician"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'diagnosis-photos'::text) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12};
::text) AND (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE (((o.id)::text = (storage.foldername(objects.name))[1]) AND (o.assigned_technician_id = p.technician_id) AND (o.work_mode = 'diagnosis'::text) AND (o.payment_status = 'deposit_paid'::text))))));



  create policy "diagnosis_photos_select_stakeholders"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'diagnosis-photos'::text) AND ((storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12};
::text) AND (EXISTS ( SELECT 1
   FROM (public.service_orders o
     LEFT JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE (((o.id)::text = (storage.foldername(objects.name))[1]) AND (public.is_admin() OR (o.assigned_technician_id = p.technician_id) OR (o.customer_id = p.customer_id)))))));



  create policy "technician_avatars_owner_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'technician-avatars'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));



  create policy "technician_avatars_owner_select"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'technician-avatars'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));



  create policy "technician_avatars_owner_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'technician-avatars'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))))
with check (((bucket_id = 'technician-avatars'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));



  create policy "technician_avatars_owner_write"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'technician-avatars'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));



  create policy "technician_documents_owner_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'technician-documents'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));



  create policy "technician_documents_owner_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'technician-documents'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));



  create policy "technician_documents_owner_read"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'technician-documents'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));



  create policy "technician_documents_owner_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'technician-documents'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))))
with check (((bucket_id = 'technician-documents'::text) AND (( SELECT public.is_admin() AS is_admin) OR ((storage.foldername(name))[1] IN ( SELECT (profiles.technician_id)::text AS technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))));



