-- Technicians can now upload JPG/PNG for their documents (not just PDF),
-- matching what the client-side upload forms already accept and what the
-- technician-avatars bucket already allows.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'technician-documents';
