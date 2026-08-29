-- Problema 7 (Sandy): technician_documents / technician_matriculas never
-- cross-updated technician_requirements when new evidence arrived, unlike
-- technician_payment_accounts (fixed for the CBU bug in
-- fix_lock_technician_review_fields_security_definer). A technician could
-- replace an already-approved monotributo/identity PDF, or add/replace a
-- matricula, and the corresponding requirement stayed 'approved' with no
-- re-review — same bug class, just missing in two more branches of the same
-- function. SECURITY DEFINER was already present (confirmed: this is NOT
-- the CBU bug's root cause here), so this is purely the missing cross-table
-- UPDATE, added on INSERT since that's how the real upload code replaces
-- evidence (new row inserted, old one flagged is_current=false separately)
-- rather than an UPDATE-in-place like the payment account upsert.
--
-- Mapping confirmed against the actual app code (not guessed): the admin
-- review UI (TechnicianReviewCard.renderRequirementEvidence) only ever reads
-- document_type 'monotributo' for monotributo_approved and 'identity' for
-- identity_verified. 'degree' is uploaded (ProfessionalProfile's "Título o
-- certificación") but education_verified's evidence view reads the plain
-- technicians.degree_title/education_level/institution_name text fields
-- instead, never the PDF -- so 'degree' isn't linked to anything here; that
-- disconnect is a separate finding, flagged to Sandy, not fixed in this
-- migration. 'certificate' and 'license_support' are allowed by the
-- document_type CHECK constraint but never produced anywhere in the app.
create or replace function public.lock_technician_review_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if (select is_admin()) then
    return new;
  end if;

  if tg_table_name = 'technician_matriculas' then
    new.validation_status := case when tg_op = 'INSERT' then 'pending' else old.validation_status end;
    new.validation_notes := case when tg_op = 'INSERT' then null else old.validation_notes end;
    new.validated_at := case when tg_op = 'INSERT' then null else old.validated_at end;
    new.validated_by := case when tg_op = 'INSERT' then null else old.validated_by end;
    if tg_op = 'INSERT' then
      update public.technician_requirements
      set status = 'pending', review_notes = null, reviewed_at = null, reviewed_by = null
      where technician_id = new.technician_id and requirement_type = 'matricula_validated';
    end if;
  elsif tg_table_name = 'technician_documents' then
    new.validation_status := case when tg_op = 'INSERT' then 'pending' else old.validation_status end;
    new.validation_notes := case when tg_op = 'INSERT' then null else old.validation_notes end;
    new.validated_at := case when tg_op = 'INSERT' then null else old.validated_at end;
    new.validated_by := case when tg_op = 'INSERT' then null else old.validated_by end;
    if tg_op = 'INSERT' and new.document_type in ('monotributo', 'identity') then
      update public.technician_requirements
      set status = 'pending', review_notes = null, reviewed_at = null, reviewed_by = null
      where technician_id = new.technician_id
        and requirement_type = case new.document_type
          when 'monotributo' then 'monotributo_approved'
          when 'identity' then 'identity_verified'
        end;
    end if;
  elsif tg_table_name = 'technician_payment_accounts' then
    new.validation_status := 'pending';
    new.validation_notes := null;
    if tg_op = 'UPDATE' then
      update public.technician_requirements
      set status = 'pending', review_notes = null, reviewed_at = null, reviewed_by = null
      where technician_id = new.technician_id and requirement_type = 'bank_account_valid';
    end if;
  end if;
  return new;
end;
$function$;
