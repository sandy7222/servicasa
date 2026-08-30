-- Generaliza la validación de system_settings_audit(): cualquier clave que
-- termine en "_commission_rate" (platform_commission_rate,
-- visit_settlement_commission_rate) debe ser una fracción entre 0 y 1.
-- Esto también protege retroactivamente a platform_commission_rate, que no
-- tenía validación de rango antes.
create or replace function public.system_settings_audit()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.value_type = 'number' and jsonb_typeof(new.value) <> 'number' then
    raise exception 'system_settings.%: value_type=number pero el value no es un número', new.key;
  elsif new.value_type = 'boolean' and jsonb_typeof(new.value) <> 'boolean' then
    raise exception 'system_settings.%: value_type=boolean pero el value no es un booleano', new.key;
  elsif new.value_type = 'text' and jsonb_typeof(new.value) <> 'string' then
    raise exception 'system_settings.%: value_type=text pero el value no es un string', new.key;
  end if;

  if new.key like '%\_commission_rate' escape '\'
     and (
       jsonb_typeof(new.value) <> 'number'
       or (new.value#>>'{}')::numeric < 0
       or (new.value#>>'{}')::numeric > 1
     ) then
    raise exception 'system_settings.%: debe ser una fracción entre 0 y 1 (ej. 0.15 = 15%%)', new.key;
  end if;

  if tg_op = 'INSERT' then
    new.version := coalesce(new.version, 1);
    new.updated_by := coalesce(new.updated_by, (select auth.uid()));
    new.updated_at := now();
    insert into public.system_settings_history (key, old_value, new_value, version, changed_by)
    values (new.key, null, new.value, new.version, new.updated_by);
  elsif tg_op = 'UPDATE' then
    new.version := old.version + 1;
    new.updated_by := (select auth.uid());
    new.updated_at := now();
    if new.value is distinct from old.value then
      insert into public.system_settings_history (key, old_value, new_value, version, changed_by)
      values (new.key, old.value, new.value, new.version, new.updated_by);
    end if;
  end if;
  return new;
end;
$function$;
