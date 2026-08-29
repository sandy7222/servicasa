-- The technician_requirements reset added in fix_payment_account_edit_resets_requirement
-- writes to a DIFFERENT table than the one the trigger fires on. Since this
-- function runs as the calling role (a non-admin technician editing their
-- own CBU), and technician_requirements has no non-admin write policy, that
-- UPDATE was silently blocked by RLS (0 rows affected, no error) — verified
-- with a rolled-back impersonation test: the payment account correctly went
-- back to 'pending' but the linked requirement stayed 'approved'. Needs
-- SECURITY DEFINER, same as every other helper in this codebase that
-- legitimately crosses a table boundary a normal user can't write to
-- directly (technician_assigned_to_customer, offer_to_next_eligible_technician, etc).
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
