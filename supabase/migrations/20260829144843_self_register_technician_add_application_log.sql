create or replace function public.self_register_technician(
  p_full_name text,
  p_phone text,
  p_address text,
  p_category_ids uuid[],
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid;
  v_role public.user_role;
  v_email text;
  v_technician_id uuid;
  v_requires_matricula boolean;
  v_specialty_names text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Tenés que estar autenticado.';
  end if;

  if p_full_name is null or btrim(p_full_name) = '' then
    raise exception 'Falta el nombre completo.';
  end if;
  if p_category_ids is null or array_length(p_category_ids, 1) is null then
    raise exception 'Elegí al menos un rubro.';
  end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role = 'admin' then
    raise exception 'Esta cuenta ya es de administración.';
  end if;

  if exists (select 1 from public.technicians where profile_id = v_uid) then
    raise exception 'Esta cuenta ya tiene una ficha de técnico.';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null or btrim(v_email) = '' then
    raise exception 'No se encontró el email de la cuenta.';
  end if;

  insert into public.technicians (profile_id, name, email, phone, address)
  values (v_uid, btrim(p_full_name), v_email, coalesce(btrim(p_phone), ''), coalesce(btrim(p_address), ''))
  returning id into v_technician_id;

  insert into public.technician_specialties (technician_id, category_id)
  select v_technician_id, c.id
  from public.categories c
  where c.id = any(p_category_ids)
  on conflict do nothing;

  select string_agg(c.name, ', ' order by c.name), bool_or(c.name ~* '(electric|refriger|plomer)')
  into v_specialty_names, v_requires_matricula
  from public.categories c
  where c.id = any(p_category_ids);

  insert into public.technician_requirements (technician_id, requirement_type, is_required, status)
  values
    (v_technician_id, 'profile_complete', true, 'pending'),
    (v_technician_id, 'education_verified', true, 'pending'),
    (v_technician_id, 'matricula_validated', coalesce(v_requires_matricula, false), case when coalesce(v_requires_matricula, false) then 'pending' else 'not_required' end),
    (v_technician_id, 'monotributo_approved', true, 'pending'),
    (v_technician_id, 'identity_verified', true, 'pending'),
    (v_technician_id, 'bank_account_valid', true, 'pending');

  update public.profiles
  set role = 'technician', technician_id = v_technician_id
  where id = v_uid;

  update public.profiles p
  set customer_id = c.id
  from public.customers c
  where p.id = v_uid and lower(c.email) = lower(v_email) and p.customer_id is null;

  update public.customers
  set profile_id = v_uid
  where lower(email) = lower(v_email) and profile_id is null;

  -- Bitácora de solo lectura para el admin: qué puso la persona al pedir ser
  -- técnico. specialty ya no es la fuente de verdad (technician_specialties
  -- lo es) — acá solo se guarda el texto legible para mostrarlo sin otro
  -- join. status='approved' porque para cuando existe esta fila la cuenta y
  -- la ficha ya se crearon (a diferencia del viejo flujo, donde 'approved'
  -- lo tipeaba un admin a mano).
  insert into public.technician_applications (full_name, email, phone, specialty, message, status, reviewed_at)
  values (btrim(p_full_name), v_email, coalesce(btrim(p_phone), ''), coalesce(v_specialty_names, 'Sin especificar'), nullif(btrim(coalesce(p_message, '')), ''), 'approved', now());

  return v_technician_id;
end;
$function$;
