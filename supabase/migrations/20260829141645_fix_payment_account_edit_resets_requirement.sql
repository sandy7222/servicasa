-- lock_technician_review_fields only reset validation_status to 'pending' on
-- INSERT, never on UPDATE — a technician could edit an already-approved CBU
-- without it going back for review. Add the UPDATE case for
-- technician_payment_accounts and reset the linked bank_account_valid
-- requirement too, since it's a separate row from the account itself.
--
-- NOTE: this version was found (via a rolled-back impersonation test right
-- after applying it) to be missing SECURITY DEFINER, which silently blocked
-- the cross-table UPDATE to technician_requirements under RLS. Fixed in the
-- very next migration (fix_lock_technician_review_fields_security_definer).
-- Reconstructed here to match exactly what was applied to the remote DB, in
-- order.
create or replace function public.lock_technician_review_fields()
returns trigger
language plpgsql
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
  elsif tg_table_name = 'technician_documents' then
    new.validation_status := case when tg_op = 'INSERT' then 'pending' else old.validation_status end;
    new.validation_notes := case when tg_op = 'INSERT' then null else old.validation_notes end;
    new.validated_at := case when tg_op = 'INSERT' then null else old.validated_at end;
    new.validated_by := case when tg_op = 'INSERT' then null else old.validated_by end;
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
