--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: material_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.material_category AS ENUM (
    'Fijaciones',
    'Electricidad',
    'Plomería',
    'Ferretería',
    'Insumos'
);


--
-- Name: order_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_event_type AS ENUM (
    'assigned',
    'started',
    'paused',
    'resumed',
    'material_added',
    'checklist_updated',
    'time_logged',
    'note_added',
    'signed',
    'completed',
    'cancelled',
    'reassigned'
);


--
-- Name: order_priority; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_priority AS ENUM (
    'baja',
    'media',
    'alta',
    'urgente'
);


--
-- Name: order_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.order_status AS ENUM (
    'assigned',
    'in_progress',
    'paused',
    'completed',
    'cancelled'
);


--
-- Name: service_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.service_type AS ENUM (
    'Plomería',
    'Electricidad',
    'Reparaciones del hogar',
    'Mantenimiento general',
    'Instalación de equipos',
    'Cerrajería',
    'Refrigeración',
    'Soldadura'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'technician',
    'customer'
);


--
-- Name: apply_catalog_price_to_quote_item(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_catalog_price_to_quote_item() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  catalog_item public.service_categories%rowtype;
  service_item public.services%rowtype;
begin
  if new.category_id is not null then
    select * into catalog_item from public.service_categories where id = new.category_id and is_active = true;
    if not found then raise exception 'La categoría seleccionada no está activa'; end if;
    new.description := catalog_item.name;
    new.unit := catalog_item.unit;
    new.unit_price := catalog_item.base_price;
    new.item_type := 'labor';
  elsif new.service_id is not null then
    select * into service_item from public.services where id = new.service_id and active = true;
    if not found then raise exception 'El servicio seleccionado no está activo'; end if;
    new.description := service_item.name;
    new.unit := coalesce(nullif(trim(new.unit), ''), 'unidad');
    new.unit_price := service_item.price;
    new.item_type := 'labor';
  elsif new.item_type = 'material' then
    null;
  else
    raise exception 'Cada ítem de mano de obra debe provenir del catálogo publicado (categoría o servicio)';
  end if;
  return new;
end;
$$;


--
-- Name: close_payout_batch(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.close_payout_batch(p_batch_id uuid, p_transfer_reference text DEFAULT NULL::text, p_receipt_url text DEFAULT NULL::text, p_destination_last4 text DEFAULT NULL::text) RETURNS TABLE(closed boolean, settlement_count integer, total_amount numeric, batch_recorded_total numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_batch public.technician_payout_batches;
  v_count integer;
  v_actual_total numeric;
begin
  if not (select public.is_admin()) then
    raise exception 'Solo administración puede cerrar un lote de pago';
  end if;

  update public.technician_payout_batches
  set status = 'completed',
      completed_at = now(),
      completed_by = (select auth.uid()),
      transfer_reference = coalesce(p_transfer_reference, transfer_reference),
      receipt_url = coalesce(p_receipt_url, receipt_url),
      receipt_uploaded_at = case when p_receipt_url is not null then now() else receipt_uploaded_at end,
      destination_last4 = coalesce(p_destination_last4, destination_last4),
      updated_at = now()
  where id = p_batch_id and status = 'scheduled'
  returning * into v_batch;

  if v_batch.id is null then
    return query select false, 0, 0::numeric, 0::numeric;
    return;
  end if;

  with paid_rows as (
    update public.technician_settlements
    set status = 'paid', paid_at = now()
    where payout_batch_id = p_batch_id and status = 'scheduled'
    returning net_amount
  )
  select count(*), coalesce(sum(net_amount), 0) into v_count, v_actual_total from paid_rows;

  insert into public.technician_payout_batch_audit (batch_id, action, performed_by, detail)
  values (
    p_batch_id, 'closed', (select auth.uid()),
    jsonb_build_object(
      'settlement_count', v_count, 'actual_total', v_actual_total,
      'batch_recorded_total', v_batch.total_amount, 'transfer_reference', p_transfer_reference
    )
  );

  return query select true, v_count, v_actual_total, v_batch.total_amount;
end;
$$;


--
-- Name: create_notification(uuid, text, text, text, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_recipient_profile_id uuid, p_type text, p_title text, p_body text, p_entity_type text, p_entity_id uuid, p_priority text, p_dedupe_key text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_id uuid;
begin
  if p_recipient_profile_id is null then
    return null;
  end if;
  insert into public.notifications (
    recipient_profile_id, type, title, body, entity_type, entity_id, priority, dedupe_key
  ) values (
    p_recipient_profile_id, p_type, p_title, p_body, p_entity_type, p_entity_id, coalesce(p_priority, 'normal'), p_dedupe_key
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;


--
-- Name: create_settlement_on_order_completed_and_paid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_settlement_on_order_completed_and_paid() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_commission_rate numeric;
  v_release_days integer;
  v_gross numeric;
  v_fee numeric;
  v_commission numeric;
  v_net numeric;
begin
  if new.status <> 'completed' or new.payment_status <> 'paid_in_full' then
    return new;
  end if;
  if new.assigned_technician_id is null then
    return new;
  end if;

  if exists (
    select 1 from public.technician_settlements
    where order_id = new.id and settlement_type = 'completed_work'
  ) then
    return new;
  end if;

  v_gross := coalesce(new.total_paid_amount, 0);
  if v_gross <= 0 then
    return new;
  end if;

  select coalesce((value#>>'{}')::numeric, 0.17) into v_commission_rate
  from public.system_settings where key = 'platform_commission_rate';

  select coalesce((value#>>'{}')::int, 7) into v_release_days
  from public.system_settings where key = 'settlement_release_days';

  select coalesce(sum(mp_fee_amount), 0) into v_fee
  from public.payment_transactions
  where order_id = new.id and status = 'approved';

  v_commission := round(v_gross * coalesce(v_commission_rate, 0.17), 2);
  v_net := greatest(0, v_gross - v_commission - v_fee);

  insert into public.technician_settlements (
    order_id, technician_id, settlement_type,
    gross_amount, platform_commission_amount, payment_fee_amount, net_amount,
    status, release_date
  ) values (
    new.id, new.assigned_technician_id, 'completed_work',
    v_gross, v_commission, v_fee, v_net,
    'pending_release', now() + (coalesce(v_release_days, 7) * interval '1 day')
  )
  on conflict (order_id) where settlement_type = 'completed_work' do nothing;

  return new;
end;
$$;


--
-- Name: current_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


--
-- Name: enforce_max_length(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_max_length(p_text text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_max integer;
begin
  select (value#>>'{}')::int into v_max from public.system_settings where key = 'message_max_length';
  v_max := coalesce(v_max, 2000);
  if length(p_text) > v_max then
    raise exception 'El mensaje supera el largo máximo permitido (% caracteres)', v_max;
  end if;
end;
$$;


--
-- Name: enforce_message_max_length(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_message_max_length() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.enforce_max_length(new.body);
  return new;
end;
$$;


--
-- Name: enforce_service_order_pricing(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_service_order_pricing() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  catalog_price numeric(12,2);
  deposit_setting numeric(12,2);
begin
  if new.work_mode = 'direct' then
    if new.fixed_price_service_id is null or new.fixed_price_quantity is null then
      raise exception 'Un pedido de precio fijo necesita un servicio de catálogo y una cantidad válidos.';
    end if;
    select price into catalog_price
      from public.services
      where id = new.fixed_price_service_id and active = true;
    if catalog_price is null then
      raise exception 'Servicio de precio fijo inválido o inactivo.';
    end if;
    new.total_quoted_amount := catalog_price * new.fixed_price_quantity;
    new.visit_deposit_amount := 0;
  elsif new.work_mode = 'diagnosis' then
    select (value #>> '{}')::numeric into deposit_setting
      from public.system_settings
      where key = 'visit_deposit_amount';
    new.visit_deposit_amount := coalesce(deposit_setting, 0);
    new.total_quoted_amount := 0;
  end if;
  return new;
end;
$$;


--
-- Name: enforce_support_message_max_length(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enforce_support_message_max_length() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.enforce_max_length(new.message);
  return new;
end;
$$;


--
-- Name: get_account_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_account_invite(p_token text) RETURNS TABLE(kind text, email text, full_name text, expires_at timestamp with time zone, already_used boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    i.kind,
    i.email,
    i.full_name,
    i.expires_at,
    (i.used_at IS NOT NULL) AS already_used
  FROM public.account_invites i
  WHERE i.token = p_token
  LIMIT 1;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  chosen_role public.user_role;
  display_name text;
BEGIN
  chosen_role := COALESCE(
    (NEW.raw_app_meta_data ->> 'role')::public.user_role,
    'customer'
  );
  display_name := COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1),
    'Usuario'
  );

  INSERT INTO public.profiles (id, full_name, email, role, avatar_text)
  VALUES (
    NEW.id,
    display_name,
    COALESCE(NEW.email, ''),
    chosen_role,
    upper(left(display_name, 2))
  );

  RETURN NEW;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


--
-- Name: is_conversation_participant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_conversation_participant(p_conversation_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select exists (
    select 1 from public.conversation_participants cp
    where cp.conversation_id = p_conversation_id and cp.profile_id = auth.uid()
  );
$$;


--
-- Name: lock_technician_admin_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_technician_admin_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if (select is_admin()) then
    return new;
  end if;

  new.validation_status := old.validation_status;
  new.validation_notes := old.validation_notes;
  new.validated_at := old.validated_at;
  new.validated_by := old.validated_by;
  new.is_enabled := old.is_enabled;
  new.rating := old.rating;
  new.active_orders_count := old.active_orders_count;
  new.completed_orders_count := old.completed_orders_count;
  return new;
end;
$$;


--
-- Name: lock_technician_review_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lock_technician_review_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
    new.validation_status := case when tg_op = 'INSERT' then 'pending' else old.validation_status end;
    new.validation_notes := case when tg_op = 'INSERT' then null else old.validation_notes end;
  end if;
  return new;
end;
$$;


--
-- Name: notifications_protect_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notifications_protect_immutable() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if (select public.is_admin()) then
    return new;
  end if;
  if new.recipient_profile_id is distinct from old.recipient_profile_id
     or new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.body is distinct from old.body
     or new.entity_type is distinct from old.entity_type
     or new.entity_id is distinct from old.entity_id
     or new.priority is distinct from old.priority
     or new.dedupe_key is distinct from old.dedupe_key
     or new.created_at is distinct from old.created_at
  then
    raise exception 'notifications: solo se puede modificar read_at';
  end if;
  return new;
end;
$$;


--
-- Name: notify_case_stakeholders(uuid, text, text, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_case_stakeholders(p_case_id uuid, p_type text, p_title text, p_body text, p_priority text, p_dedupe_prefix text, p_exclude_profile uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_case record;
  v_recipient uuid;
begin
  select customer_id, technician_id into v_case from public.support_cases where id = p_case_id;
  if v_case is null then
    return;
  end if;
  for v_recipient in
    select distinct p.id from public.profiles p
    where p.role = 'admin'
       or (v_case.customer_id is not null and p.customer_id = v_case.customer_id)
       or (v_case.technician_id is not null and p.technician_id = v_case.technician_id)
  loop
    if v_recipient is distinct from p_exclude_profile then
      perform public.create_notification(
        v_recipient, p_type, p_title, p_body, 'claim', p_case_id, p_priority,
        p_dedupe_prefix || ':' || v_recipient::text
      );
    end if;
  end loop;
end;
$$;


--
-- Name: notify_claim_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_claim_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_subject text;
begin
  if new.is_internal then
    return new;
  end if;
  select subject into v_subject from public.support_cases where id = new.case_id;
  perform public.notify_case_stakeholders(
    new.case_id, 'claim_message', 'Nuevo mensaje en reclamo: ' || coalesce(v_subject, ''), new.message, 'normal',
    'claim_message:' || new.id::text, new.created_by
  );
  return new;
end;
$$;


--
-- Name: notify_claim_opened(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_claim_opened() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.notify_case_stakeholders(
    new.id, 'claim_opened', 'Reclamo abierto: ' || new.subject, new.description, 'high',
    'claim_opened:' || new.id::text, new.opened_by
  );
  return new;
end;
$$;


--
-- Name: notify_claim_resolved(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_claim_resolved() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.notify_case_stakeholders(
    new.id, 'claim_resolved', 'Reclamo resuelto: ' || new.subject, new.resolution_notes, 'normal',
    'claim_resolved:' || new.id::text, new.resolved_by
  );
  return new;
end;
$$;


--
-- Name: notify_new_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_new_message() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_recipient uuid;
  v_subject text;
begin
  if new.is_internal then
    return new;
  end if;
  select subject into v_subject from public.conversations where id = new.conversation_id;
  for v_recipient in
    select profile_id from public.conversation_participants
    where conversation_id = new.conversation_id and profile_id is distinct from new.sender_id
  loop
    perform public.create_notification(
      v_recipient, 'message_new', 'Nuevo mensaje: ' || coalesce(v_subject, 'Conversacion'), new.body,
      'conversation', new.conversation_id, 'normal',
      'message_new:' || new.id::text || ':' || v_recipient::text
    );
  end loop;
  return new;
end;
$$;


--
-- Name: notify_order_assigned(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_order_assigned() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.create_notification(
    public.profile_id_for_technician(new.assigned_technician_id),
    'order_assigned', 'Nueva orden asignada', new.title, 'order', new.id, 'high',
    'order_assigned:' || new.id::text || ':' || new.assigned_technician_id::text
  );
  return new;
end;
$$;


--
-- Name: notify_payment_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_payment_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_customer_id uuid;
  v_order_title text;
  v_type text;
  v_title text;
begin
  select customer_id, title into v_customer_id, v_order_title
  from public.service_orders where id = new.order_id;
  if v_customer_id is null then
    return new;
  end if;
  v_type := 'payment_' || new.status;
  v_title := case new.status
    when 'approved' then 'Pago aprobado'
    when 'rejected' then 'Pago rechazado'
    else 'Pago pendiente'
  end;
  perform public.create_notification(
    public.profile_id_for_customer(v_customer_id), v_type, v_title, v_order_title, 'payment', new.id,
    case when new.status = 'approved' then 'high' else 'normal' end,
    'payment_' || new.status || ':' || new.id::text
  );
  return new;
end;
$$;


--
-- Name: notify_quote_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_quote_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_order record;
  v_recipient uuid;
  v_type text;
  v_title text;
begin
  select customer_id, assigned_technician_id, title into v_order
  from public.service_orders where id = new.order_id;
  if v_order is null then
    return new;
  end if;
  if new.status = 'sent' then
    v_type := 'quote_sent'; v_title := 'Presupuesto enviado';
    v_recipient := public.profile_id_for_customer(v_order.customer_id);
  elsif new.status = 'accepted' then
    v_type := 'quote_accepted'; v_title := 'Presupuesto aceptado';
    v_recipient := public.profile_id_for_technician(v_order.assigned_technician_id);
  elsif new.status = 'rejected' then
    v_type := 'quote_rejected'; v_title := 'Presupuesto rechazado';
    v_recipient := public.profile_id_for_technician(v_order.assigned_technician_id);
  else
    return new;
  end if;
  perform public.create_notification(
    v_recipient, v_type, v_title, v_order.title, 'quote', new.id, 'normal',
    'quote_' || new.status || ':' || new.id::text
  );
  return new;
end;
$$;


--
-- Name: notify_settlement_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_settlement_status() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
declare
  v_type text;
  v_title text;
begin
  if new.status = 'scheduled' then v_type := 'settlement_scheduled'; v_title := 'Liquidacion programada';
  elsif new.status = 'released' then v_type := 'settlement_released'; v_title := 'Liquidacion liberada';
  elsif new.status = 'paid' then v_type := 'settlement_paid'; v_title := 'Liquidacion pagada';
  else
    return new;
  end if;
  perform public.create_notification(
    public.profile_id_for_technician(new.technician_id), v_type, v_title,
    'Monto neto: $' || new.net_amount::text, 'settlement', new.id, 'high',
    v_type || ':' || new.id::text
  );
  return new;
end;
$_$;


--
-- Name: notify_technician_validation_mirror(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notify_technician_validation_mirror() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  perform public.create_notification(
    public.profile_id_for_technician(new.technician_id), 'technician_validation', new.title, new.message,
    'technician_validation', new.id,
    case new.kind when 'error' then 'high' when 'warning' then 'normal' else 'low' end,
    'technician_validation:' || new.id::text
  );
  return new;
end;
$$;


--
-- Name: payout_batch_recalc_after_pull(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payout_batch_recalc_after_pull() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_batch_id uuid;
  v_remaining_count integer;
  v_remaining_total numeric;
begin
  v_batch_id := old.payout_batch_id;
  if v_batch_id is null then
    return new;
  end if;

  select count(*), coalesce(sum(net_amount), 0)
  into v_remaining_count, v_remaining_total
  from public.technician_settlements
  where payout_batch_id = v_batch_id and status = 'scheduled';

  if v_remaining_count = 0 then
    update public.technician_payout_batches
    set status = 'cancelled', updated_at = now()
    where id = v_batch_id and status = 'scheduled';
  else
    update public.technician_payout_batches
    set total_amount = v_remaining_total, settlement_count = v_remaining_count, updated_at = now()
    where id = v_batch_id;
  end if;

  return new;
end;
$$;


--
-- Name: prevent_sent_quote_content_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_sent_quote_content_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if old.status <> 'draft' and (
    new.order_id is distinct from old.order_id or
    new.version is distinct from old.version or
    new.notes is distinct from old.notes or
    new.subtotal_labor is distinct from old.subtotal_labor or
    new.subtotal_materials is distinct from old.subtotal_materials or
    new.total_amount is distinct from old.total_amount or
    new.visit_deposit_credit is distinct from old.visit_deposit_credit or
    new.remaining_amount is distinct from old.remaining_amount or
    new.currency is distinct from old.currency or
    new.valid_until is distinct from old.valid_until or
    new.created_by is distinct from old.created_by
  ) then
    raise exception 'El presupuesto enviado es inmutable';
  end if;
  new.updated_at = now();
  return new;
end;
$$;


--
-- Name: prevent_sent_quote_item_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_sent_quote_item_change() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  target_quote_id uuid;
  quote_state text;
begin
  target_quote_id := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;
  select status into quote_state from public.order_quotes where id = target_quote_id;
  if quote_state is distinct from 'draft' then
    raise exception 'Los Ã­tems de un presupuesto enviado no pueden modificarse';
  end if;
  return coalesce(new, old);
end;
$$;


--
-- Name: prevent_unpaid_execution_timer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prevent_unpaid_execution_timer() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.status = 'in_progress' and new.work_mode = 'diagnosis'
     and (new.payment_status <> 'paid_in_full' or new.quote_status <> 'accepted') then
    raise exception 'El trabajo presupuestado solo puede iniciarse tras aceptación y pago confirmado';
  end if;

  if new.status = 'in_progress' and new.work_mode = 'direct'
     and new.payment_status <> 'paid_in_full' then
    raise exception 'El trabajo directo solo puede iniciarse tras el pago completo confirmado';
  end if;
  return new;
end;
$$;


--
-- Name: profile_id_for_customer(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_id_for_customer(p_customer_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select id from public.profiles where customer_id = p_customer_id limit 1;
$$;


--
-- Name: profile_id_for_technician(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.profile_id_for_technician(p_technician_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select id from public.profiles where technician_id = p_technician_id limit 1;
$$;


--
-- Name: protect_admin_order_control_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.protect_admin_order_control_fields() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if public.is_admin() then
    return new;
  end if;

  new.cancellation_reason := old.cancellation_reason;
  new.cancelled_at := old.cancelled_at;
  new.cancelled_by := old.cancelled_by;
  new.admin_incident_status := old.admin_incident_status;
  new.admin_incident_reason := old.admin_incident_reason;
  new.admin_incident_opened_at := old.admin_incident_opened_at;
  new.admin_incident_opened_by := old.admin_incident_opened_by;
  new.admin_incident_resolved_at := old.admin_incident_resolved_at;
  new.admin_incident_resolved_by := old.admin_incident_resolved_by;
  new.admin_exception_reason := old.admin_exception_reason;
  new.admin_exception_closed_at := old.admin_exception_closed_at;
  new.admin_exception_closed_by := old.admin_exception_closed_by;
  return new;
end;
$$;


--
-- Name: redeem_account_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.redeem_account_invite(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  inv public.account_invites;
  uid uuid;
  user_email text;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Tenés que estar autenticado para activar la invitación.';
  END IF;

  SELECT * INTO inv FROM public.account_invites WHERE token = p_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El enlace de invitación no es válido.';
  END IF;
  IF inv.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Esta invitación ya fue utilizada.';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'Esta invitación venció. Pedile una nueva al administrador.';
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = uid;
  IF lower(COALESCE(user_email, '')) <> lower(inv.email) THEN
    RAISE EXCEPTION 'El email de la cuenta no coincide con la invitación.';
  END IF;

  IF inv.kind = 'technician' THEN
    IF EXISTS (SELECT 1 FROM public.technicians WHERE id = inv.target_id AND profile_id IS NOT NULL AND profile_id <> uid) THEN
      RAISE EXCEPTION 'Este técnico ya tiene una cuenta vinculada.';
    END IF;

    UPDATE public.technicians
    SET profile_id = uid,
        name = COALESCE(NULLIF(name, ''), inv.full_name),
        email = inv.email
    WHERE id = inv.target_id;

    UPDATE public.profiles
    SET role = 'technician',
        technician_id = inv.target_id,
        full_name = inv.full_name,
        email = inv.email,
        avatar_text = upper(left(inv.full_name, 2))
    WHERE id = uid;

    -- If this technician already has a customer ficha with same email, keep dual link
    UPDATE public.profiles p
    SET customer_id = c.id
    FROM public.customers c
    WHERE p.id = uid
      AND lower(c.email) = lower(inv.email);

    UPDATE public.customers
    SET profile_id = uid
    WHERE lower(email) = lower(inv.email)
      AND (profile_id IS NULL OR profile_id = uid);
  ELSE
    IF EXISTS (SELECT 1 FROM public.customers WHERE id = inv.target_id AND profile_id IS NOT NULL AND profile_id <> uid) THEN
      RAISE EXCEPTION 'Este cliente ya tiene una cuenta vinculada.';
    END IF;

    UPDATE public.customers
    SET profile_id = uid,
        name = COALESCE(NULLIF(name, ''), inv.full_name),
        email = inv.email
    WHERE id = inv.target_id;

    UPDATE public.profiles
    SET role = 'customer',
        customer_id = inv.target_id,
        full_name = inv.full_name,
        email = inv.email,
        avatar_text = upper(left(inv.full_name, 2))
    WHERE id = uid;
  END IF;

  UPDATE public.account_invites SET used_at = now() WHERE id = inv.id;

  RETURN jsonb_build_object('ok', true, 'kind', inv.kind, 'target_id', inv.target_id);
END;
$$;


--
-- Name: release_due_technician_settlements(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_due_technician_settlements() RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare updated_count integer;
begin
  update public.technician_settlements
  set status = 'released', released_at = now()
  where status = 'pending_release'
    and coalesce(release_date, release_at) <= now()
    and dispute_reason is null;
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;


--
-- Name: require_eligible_technician_assignment(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.require_eligible_technician_assignment() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.assigned_technician_id is not null and new.assigned_technician_id is distinct from old.assigned_technician_id then
    if not exists (
      select 1 from public.technicians t
      where t.id = new.assigned_technician_id and t.validation_status = 'approved' and t.can_receive_orders = true
    ) then
      raise exception 'El técnico no está habilitado para recibir órdenes';
    end if;
    if exists (
      select 1 from public.technician_requirements r
      where r.technician_id = new.assigned_technician_id and r.is_required = true
        and r.status not in ('approved', 'not_required')
    ) then
      raise exception 'El técnico tiene requisitos obligatorios pendientes';
    end if;
  end if;
  return new;
end;
$$;


--
-- Name: run_scheduled_settlement_release(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_scheduled_settlement_release() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_admin uuid;
begin
  begin
    perform public.release_due_technician_settlements();
  exception when others then
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform public.create_notification(
        v_admin, 'cron_failure', 'Falló la liberación automática de liquidaciones',
        sqlerrm, null, null, 'high',
        'cron_failure:release_due_technician_settlements:' || to_char(now(), 'YYYY-MM-DD')
      );
    end loop;
    raise warning 'release_due_technician_settlements() falló: %', sqlerrm;
  end;
end;
$$;


--
-- Name: set_support_case_number(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_support_case_number() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.case_number is null or new.case_number = '' then
    new.case_number := 'REC-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.support_case_number_seq')::text, 4, '0');
  end if;
  new.updated_at = now();
  return new;
end;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: technician_goals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    goal_type text NOT NULL,
    target_amount numeric(12,2),
    target_count integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_goals_goal_type_check CHECK ((goal_type = ANY (ARRAY['monthly_earnings'::text, 'monthly_jobs'::text, 'weekly_jobs'::text]))),
    CONSTRAINT technician_goals_target_amount_check CHECK (((target_amount IS NULL) OR (target_amount > (0)::numeric))),
    CONSTRAINT technician_goals_target_count_check CHECK (((target_count IS NULL) OR (target_count > 0)))
);


--
-- Name: set_technician_goal(text, numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_technician_goal(p_goal_type text, p_target_amount numeric DEFAULT NULL::numeric, p_target_count integer DEFAULT NULL::integer) RETURNS public.technician_goals
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_technician_id uuid;
  v_goal public.technician_goals;
begin
  select technician_id into v_technician_id from public.profiles where id = (select auth.uid());
  if v_technician_id is null then
    raise exception 'Solo un técnico con cuenta puede definir metas';
  end if;

  if p_goal_type not in ('monthly_earnings', 'monthly_jobs', 'weekly_jobs') then
    raise exception 'Tipo de meta inválido: %', p_goal_type;
  end if;
  if p_goal_type = 'monthly_earnings' and (p_target_amount is null or p_target_amount <= 0) then
    raise exception 'Las metas de ganancias necesitan un monto objetivo mayor a 0';
  end if;
  if p_goal_type in ('monthly_jobs', 'weekly_jobs') and (p_target_count is null or p_target_count <= 0) then
    raise exception 'Las metas de trabajos necesitan una cantidad objetivo mayor a 0';
  end if;

  update public.technician_goals
  set is_active = false, updated_at = now()
  where technician_id = v_technician_id and goal_type = p_goal_type and is_active;

  insert into public.technician_goals (technician_id, goal_type, target_amount, target_count, is_active)
  values (v_technician_id, p_goal_type, p_target_amount, p_target_count, true)
  returning * into v_goal;

  return v_goal;
end;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: start_execution_after_payment_confirmation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_execution_after_payment_confirmation() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.assigned_technician_id is not null
     and new.status = 'assigned'
     and new.work_started_at is null
     and (
       (new.work_mode = 'diagnosis' and new.quote_status = 'accepted' and new.payment_status = 'paid_in_full')
       or (new.work_mode = 'direct' and new.payment_status = 'paid_in_full')
     ) then
    update public.service_orders
    set status = 'in_progress', service_status = 'in_progress', work_started_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;


--
-- Name: start_order_conversation(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.start_order_conversation(p_order_id uuid, p_subject text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  v_caller_id uuid := auth.uid();
  v_caller_customer_id uuid;
  v_caller_technician_id uuid;
  v_order record;
  v_caller_role text;
  v_caller_name text;
  v_other_profile_id uuid;
  v_other_role text;
  v_other_name text;
  v_conversation_id uuid;
begin
  select customer_id, technician_id, full_name into v_caller_customer_id, v_caller_technician_id, v_caller_name
  from public.profiles where id = v_caller_id;

  select id, customer_id, assigned_technician_id, title into v_order
  from public.service_orders where id = p_order_id;

  if v_order.id is null then
    raise exception 'Orden no encontrada';
  end if;

  if v_caller_customer_id is not null and v_caller_customer_id = v_order.customer_id then
    v_caller_role := 'customer';
    select id, full_name into v_other_profile_id, v_other_name from public.profiles where technician_id = v_order.assigned_technician_id;
    v_other_role := 'technician';
  elsif v_caller_technician_id is not null and v_caller_technician_id = v_order.assigned_technician_id then
    v_caller_role := 'technician';
    select id, full_name into v_other_profile_id, v_other_name from public.profiles where customer_id = v_order.customer_id;
    v_other_role := 'customer';
  else
    raise exception 'No tenés permiso para iniciar una conversación sobre esta orden';
  end if;

  if v_other_profile_id is null then
    raise exception 'Todavía no hay alguien del otro lado para conversar en esta orden';
  end if;

  select c.id into v_conversation_id
  from public.conversations c
  where c.order_id = p_order_id
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.profile_id = v_caller_id)
    and exists (select 1 from public.conversation_participants cp where cp.conversation_id = c.id and cp.profile_id = v_other_profile_id)
  limit 1;

  if v_conversation_id is not null then
    return v_conversation_id;
  end if;

  insert into public.conversations (order_id, subject, subject_order_title, created_by)
  values (p_order_id, p_subject, v_order.title, v_caller_id)
  returning id into v_conversation_id;

  insert into public.conversation_participants (conversation_id, profile_id, role, display_name)
  values
    (v_conversation_id, v_caller_id, v_caller_role, v_caller_name),
    (v_conversation_id, v_other_profile_id, v_other_role, v_other_name);

  return v_conversation_id;
end;
$$;


--
-- Name: sync_accepted_quote_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_accepted_quote_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.service_orders set quote_status = 'accepted' where id = new.order_id;
  end if;
  return new;
end;
$$;


--
-- Name: sync_quote_totals_from_items(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_quote_totals_from_items() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
declare
  target_quote_id uuid;
begin
  target_quote_id := case when tg_op = 'DELETE' then old.quote_id else new.quote_id end;

  update public.order_quotes as q
  set
    subtotal_labor = coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id and i.item_type = 'labor'
    ), 0),
    subtotal_materials = coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id and i.item_type = 'material'
    ), 0),
    total_amount = coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id
    ), 0),
    remaining_amount = greatest(0, coalesce((
      select sum(i.subtotal) from public.order_quote_items as i
      where i.quote_id = target_quote_id
    ), 0) - q.visit_deposit_credit)
  where q.id = target_quote_id;

  return coalesce(new, old);
end;
$$;


--
-- Name: sync_rejected_quote_order_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_rejected_quote_order_state() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if new.status = 'rejected' and old.status is distinct from 'rejected' then
    update public.service_orders
    set
      status = 'cancelled',
      service_status = 'cancelled',
      quote_status = 'rejected'
    where id = new.order_id
      and status <> 'completed';
  end if;
  return new;
end;
$$;


--
-- Name: sync_service_order_quote_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_service_order_quote_status() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  update public.service_orders set quote_status = new.status where id = new.order_id;
  return new;
end;
$$;


--
-- Name: system_settings_audit(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.system_settings_audit() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if new.value_type = 'number' and jsonb_typeof(new.value) <> 'number' then
    raise exception 'system_settings.%: value_type=number pero el value no es un número', new.key;
  elsif new.value_type = 'boolean' and jsonb_typeof(new.value) <> 'boolean' then
    raise exception 'system_settings.%: value_type=boolean pero el value no es un booleano', new.key;
  elsif new.value_type = 'text' and jsonb_typeof(new.value) <> 'string' then
    raise exception 'system_settings.%: value_type=text pero el value no es un string', new.key;
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
$$;


--
-- Name: technician_settlements_clear_batch_on_pull(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.technician_settlements_clear_batch_on_pull() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
begin
  if old.status = 'scheduled' and new.status not in ('scheduled', 'paid') then
    new.payout_batch_id := null;
    new.scheduled_date := null;
  end if;
  return new;
end;
$$;


--
-- Name: touch_conversation_last_message(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.touch_conversation_last_message() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;


--
-- Name: account_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    token text DEFAULT encode(extensions.gen_random_bytes(24), 'hex'::text) NOT NULL,
    kind text NOT NULL,
    target_id uuid NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '14 days'::interval) NOT NULL,
    used_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT account_invites_kind_check CHECK ((kind = ANY (ARRAY['technician'::text, 'customer'::text])))
);


--
-- Name: technician_payout_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_payout_batches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    scheduled_date timestamp with time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    settlement_count integer NOT NULL,
    transfer_method text,
    destination_last4 text,
    transfer_reference text,
    receipt_url text,
    receipt_uploaded_at timestamp with time zone,
    created_by uuid,
    completed_at timestamp with time zone,
    completed_by uuid,
    admin_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_payout_batches_settlement_count_check CHECK ((settlement_count > 0)),
    CONSTRAINT technician_payout_batches_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT technician_payout_batches_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT technician_payout_batches_transfer_method_check CHECK ((transfer_method = ANY (ARRAY['bank_transfer'::text, 'mercadopago'::text, 'cash'::text])))
);


--
-- Name: technician_settlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_settlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    technician_id uuid NOT NULL,
    payment_transaction_id uuid,
    settlement_type text NOT NULL,
    gross_amount numeric(12,2) NOT NULL,
    platform_commission_amount numeric(12,2) NOT NULL,
    payment_fee_amount numeric(12,2) NOT NULL,
    net_amount numeric(12,2) NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    release_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    release_date timestamp with time zone,
    released_at timestamp with time zone,
    scheduled_date timestamp with time zone,
    transfer_reference text,
    receipt_url text,
    admin_notes text,
    dispute_reason text,
    resolved_at timestamp with time zone,
    payout_batch_id uuid,
    CONSTRAINT technician_settlements_gross_amount_check CHECK ((gross_amount >= (0)::numeric)),
    CONSTRAINT technician_settlements_net_amount_check CHECK ((net_amount >= (0)::numeric)),
    CONSTRAINT technician_settlements_payment_fee_amount_check CHECK ((payment_fee_amount >= (0)::numeric)),
    CONSTRAINT technician_settlements_platform_commission_amount_check CHECK ((platform_commission_amount >= (0)::numeric)),
    CONSTRAINT technician_settlements_settlement_type_check CHECK ((settlement_type = ANY (ARRAY['completed_work'::text, 'rejected_visit'::text]))),
    CONSTRAINT technician_settlements_status_check CHECK ((status = ANY (ARRAY['pending_release'::text, 'released'::text, 'scheduled'::text, 'in_transit'::text, 'paid'::text, 'in_review'::text, 'cancelled'::text])))
);


--
-- Name: technicians; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technicians (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    name text NOT NULL,
    specialty text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    rating numeric(3,2) DEFAULT 5.00 NOT NULL,
    avatar_bg text DEFAULT 'bg-sky-600'::text NOT NULL,
    active_orders_count integer DEFAULT 0 NOT NULL,
    completed_orders_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    zone text DEFAULT ''::text NOT NULL,
    province text DEFAULT ''::text NOT NULL,
    work_phone text,
    bio text,
    education_level text,
    degree_title text,
    institution_name text,
    public_avatar_path text,
    validation_status text DEFAULT 'pending'::text NOT NULL,
    validation_notes text,
    validated_at timestamp with time zone,
    validated_by uuid,
    is_enabled boolean DEFAULT false NOT NULL,
    can_receive_orders boolean DEFAULT false NOT NULL,
    technician_number integer NOT NULL,
    CONSTRAINT technicians_education_level_check CHECK (((education_level IS NULL) OR (education_level = ANY (ARRAY['idoneo'::text, 'curso_certificado'::text, 'tecnico'::text, 'tecnico_superior'::text, 'ingeniero'::text, 'otro'::text])))),
    CONSTRAINT technicians_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric))),
    CONSTRAINT technicians_validation_status_check CHECK ((validation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'observed'::text, 'suspended'::text])))
);


--
-- Name: admin_settlement_reconciliation; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.admin_settlement_reconciliation WITH (security_invoker='true') AS
 SELECT s.id AS settlement_id,
    s.order_id,
    s.technician_id,
    t.name AS technician_name,
    s.settlement_type,
    s.status,
    s.gross_amount,
    s.platform_commission_amount,
    s.payment_fee_amount,
    s.net_amount,
    s.release_date,
    s.release_at,
    s.released_at,
    s.scheduled_date,
    s.paid_at,
    s.dispute_reason,
    s.payout_batch_id,
    b.status AS batch_status,
    b.transfer_reference AS batch_transfer_reference,
    b.completed_at AS batch_completed_at,
    s.created_at
   FROM ((public.technician_settlements s
     JOIN public.technicians t ON ((t.id = s.technician_id)))
     LEFT JOIN public.technician_payout_batches b ON ((b.id = s.payout_batch_id)));


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    icon text,
    description text,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    role text NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    display_name text,
    CONSTRAINT conversation_participants_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'technician'::text, 'customer'::text])))
);


--
-- Name: message_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_reads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    read_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid,
    sender_role text NOT NULL,
    body text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_body_check CHECK ((char_length(TRIM(BOTH FROM body)) > 0)),
    CONSTRAINT messages_sender_role_check CHECK ((sender_role = ANY (ARRAY['admin'::text, 'technician'::text, 'customer'::text, 'system'::text])))
);


--
-- Name: conversation_unread_counts; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.conversation_unread_counts WITH (security_invoker='true') AS
 SELECT conversation_id,
    count(*) AS unread_count
   FROM public.messages m
  WHERE ((sender_id IS DISTINCT FROM auth.uid()) AND (is_internal = false) AND (NOT (EXISTS ( SELECT 1
           FROM public.message_reads mr
          WHERE ((mr.message_id = m.id) AND (mr.profile_id = auth.uid()))))))
  GROUP BY conversation_id;


--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid,
    case_id uuid,
    subject text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_message_at timestamp with time zone DEFAULT now() NOT NULL,
    subject_order_title text
);


--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_addresses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    label text,
    address_line text NOT NULL,
    neighborhood text,
    city text DEFAULT 'CABA'::text NOT NULL,
    postal_code text,
    lat numeric(10,7),
    lng numeric(10,7),
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customer_admin_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customer_admin_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    customer_id uuid NOT NULL,
    note text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT customer_admin_notes_note_check CHECK (((length(TRIM(BOTH FROM note)) >= 1) AND (length(TRIM(BOTH FROM note)) <= 4000)))
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid,
    name text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    neighborhood text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    province text,
    customer_number integer NOT NULL
);


--
-- Name: service_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    service_type public.service_type NOT NULL,
    priority public.order_priority DEFAULT 'media'::public.order_priority NOT NULL,
    status public.order_status DEFAULT 'assigned'::public.order_status NOT NULL,
    scheduled_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    customer_id uuid NOT NULL,
    client_name text NOT NULL,
    client_phone text DEFAULT ''::text NOT NULL,
    client_address text DEFAULT ''::text NOT NULL,
    client_neighborhood text DEFAULT ''::text NOT NULL,
    assigned_technician_id uuid,
    assigned_technician_name text,
    work_started_at timestamp with time zone,
    work_elapsed_seconds bigint DEFAULT 0 NOT NULL,
    work_mode text DEFAULT 'diagnosis'::text NOT NULL,
    service_status text NOT NULL,
    quote_status text DEFAULT 'none'::text NOT NULL,
    payment_status text DEFAULT 'pending'::text NOT NULL,
    visit_deposit_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_quoted_amount numeric(12,2) DEFAULT 0 NOT NULL,
    total_paid_amount numeric(12,2) DEFAULT 0 NOT NULL,
    extra_amount numeric(12,2) DEFAULT 0 NOT NULL,
    cancellation_reason text,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    admin_incident_status text DEFAULT 'none'::text NOT NULL,
    admin_incident_reason text,
    admin_incident_opened_at timestamp with time zone,
    admin_incident_opened_by uuid,
    admin_incident_resolved_at timestamp with time zone,
    admin_incident_resolved_by uuid,
    admin_exception_reason text,
    admin_exception_closed_at timestamp with time zone,
    admin_exception_closed_by uuid,
    guest_access_token text,
    archived_at timestamp with time zone,
    fixed_price_service_id uuid,
    fixed_price_quantity integer,
    client_province text,
    CONSTRAINT service_orders_admin_incident_status_check CHECK ((admin_incident_status = ANY (ARRAY['none'::text, 'open'::text, 'resolved'::text]))),
    CONSTRAINT service_orders_fixed_price_quantity_check CHECK (((fixed_price_quantity IS NULL) OR ((fixed_price_quantity >= 1) AND (fixed_price_quantity <= 20)))),
    CONSTRAINT service_orders_non_negative_money_check CHECK (((visit_deposit_amount >= (0)::numeric) AND (total_quoted_amount >= (0)::numeric) AND (total_paid_amount >= (0)::numeric) AND (extra_amount >= (0)::numeric))),
    CONSTRAINT service_orders_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'deposit_paid'::text, 'balance_pending'::text, 'paid_in_full'::text, 'refunded'::text]))),
    CONSTRAINT service_orders_quote_status_check CHECK ((quote_status = ANY (ARRAY['none'::text, 'draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text]))),
    CONSTRAINT service_orders_service_status_check CHECK ((service_status = ANY (ARRAY['pending'::text, 'assigned'::text, 'en_route'::text, 'in_progress'::text, 'paused'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT service_orders_work_mode_check CHECK ((work_mode = ANY (ARRAY['diagnosis'::text, 'direct'::text])))
);


--
-- Name: COLUMN service_orders.work_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_orders.work_started_at IS 'Momento en que el cronómetro está corriendo. NULL cuando está pausado o finalizado.';


--
-- Name: COLUMN service_orders.work_elapsed_seconds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_orders.work_elapsed_seconds IS 'Segundos acumulados de trabajo antes de la última pausa o finalización.';


--
-- Name: COLUMN service_orders.guest_access_token; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.service_orders.guest_access_token IS 'Opaque token for unauthenticated guest checkout order tracking. Only set for orders created via api/orders/guest-checkout.ts. Looked up exclusively through server endpoints using the service-role key — never exposed via client-side RLS.';


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid,
    value_type text DEFAULT 'json'::text NOT NULL,
    description text,
    visibility text DEFAULT 'authenticated'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT system_settings_value_type_check CHECK ((value_type = ANY (ARRAY['number'::text, 'boolean'::text, 'text'::text, 'json'::text]))),
    CONSTRAINT system_settings_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text, 'admin'::text])))
);


--
-- Name: customer_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.customer_summary WITH (security_invoker='true') AS
 SELECT c.id,
    c.profile_id,
    c.name AS full_name,
    c.email,
    c.phone,
    count(so.id) FILTER (WHERE (so.status = 'completed'::public.order_status)) AS completed_orders,
    count(so.id) AS total_orders,
    COALESCE(sum(so.total_paid_amount) FILTER (WHERE (so.status = 'completed'::public.order_status)), (0)::numeric) AS total_spent,
    count(so.id) FILTER (WHERE ((so.status = 'completed'::public.order_status) AND (so.completed_at IS NOT NULL) AND ((so.completed_at + ((( SELECT ((system_settings.value #>> '{}'::text[]))::integer AS int4
           FROM public.system_settings
          WHERE (system_settings.key = 'warranty_days'::text)))::double precision * '1 day'::interval)) > now()))) AS active_warranties,
    max(so.created_at) AS last_order_date
   FROM (public.customers c
     LEFT JOIN public.service_orders so ON ((so.customer_id = c.id)))
  GROUP BY c.id, c.profile_id, c.name, c.email, c.phone;


--
-- Name: customers_customer_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.customers_customer_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: customers_customer_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.customers_customer_number_seq OWNED BY public.customers.customer_number;


--
-- Name: guest_checkout_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guest_checkout_drafts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    guest_access_token text DEFAULT (gen_random_uuid())::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_type text NOT NULL,
    amount numeric(12,2) NOT NULL,
    payload jsonb NOT NULL,
    mp_preference_id text,
    mp_payment_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT guest_checkout_drafts_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT guest_checkout_drafts_payment_type_check CHECK ((payment_type = ANY (ARRAY['visit_deposit'::text, 'full_advance'::text]))),
    CONSTRAINT guest_checkout_drafts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text])))
);


--
-- Name: materials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.materials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category public.material_category NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    unit text DEFAULT 'u'::text NOT NULL,
    cost_estimate numeric(12,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT materials_stock_check CHECK ((stock >= 0))
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_profile_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    entity_type text,
    entity_id uuid,
    priority text DEFAULT 'normal'::text NOT NULL,
    dedupe_key text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_entity_type_check CHECK ((entity_type = ANY (ARRAY['order'::text, 'quote'::text, 'payment'::text, 'claim'::text, 'conversation'::text, 'settlement'::text, 'technician_validation'::text]))),
    CONSTRAINT notifications_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text]))),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['order_assigned'::text, 'quote_sent'::text, 'quote_accepted'::text, 'quote_rejected'::text, 'payment_approved'::text, 'payment_rejected'::text, 'payment_pending'::text, 'claim_opened'::text, 'claim_message'::text, 'claim_resolved'::text, 'message_new'::text, 'settlement_scheduled'::text, 'settlement_released'::text, 'settlement_paid'::text, 'technician_validation'::text, 'cron_failure'::text])))
);


--
-- Name: order_checklist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_checklist_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    label text NOT NULL,
    completed boolean DEFAULT false NOT NULL,
    completed_at timestamp with time zone,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: order_diagnosis_photos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_diagnosis_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    quote_id uuid,
    storage_path text NOT NULL,
    caption text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    type public.order_event_type NOT NULL,
    description text NOT NULL,
    author text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_materials_used; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_materials_used (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    material_id uuid,
    material_name text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    unit text DEFAULT 'u'::text NOT NULL,
    note text,
    added_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_materials_used_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: order_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    text text NOT NULL,
    author text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_quote_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_quote_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    quote_id uuid NOT NULL,
    item_type text NOT NULL,
    description text NOT NULL,
    quantity numeric(12,3) DEFAULT 1 NOT NULL,
    unit text DEFAULT 'unidad'::text NOT NULL,
    unit_price numeric(12,2) NOT NULL,
    subtotal numeric(12,2) GENERATED ALWAYS AS (round((quantity * unit_price), 2)) STORED,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    category_id uuid,
    notes text,
    service_id uuid,
    CONSTRAINT order_quote_items_description_check CHECK ((char_length(TRIM(BOTH FROM description)) > 0)),
    CONSTRAINT order_quote_items_item_type_check CHECK ((item_type = ANY (ARRAY['labor'::text, 'material'::text]))),
    CONSTRAINT order_quote_items_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT order_quote_items_unit_price_check CHECK ((unit_price >= (0)::numeric))
);


--
-- Name: order_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_quotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    version integer NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    notes text,
    subtotal_labor numeric(12,2) DEFAULT 0 NOT NULL,
    subtotal_materials numeric(12,2) DEFAULT 0 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0 NOT NULL,
    visit_deposit_credit numeric(12,2) DEFAULT 0 NOT NULL,
    remaining_amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'ARS'::text NOT NULL,
    valid_until timestamp with time zone,
    created_by uuid,
    sent_at timestamp with time zone,
    accepted_at timestamp with time zone,
    rejected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_quotes_currency_check CHECK ((currency = 'ARS'::text)),
    CONSTRAINT order_quotes_remaining_amount_check CHECK ((remaining_amount >= (0)::numeric)),
    CONSTRAINT order_quotes_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'accepted'::text, 'rejected'::text]))),
    CONSTRAINT order_quotes_subtotal_labor_check CHECK ((subtotal_labor >= (0)::numeric)),
    CONSTRAINT order_quotes_subtotal_materials_check CHECK ((subtotal_materials >= (0)::numeric)),
    CONSTRAINT order_quotes_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT order_quotes_visit_deposit_credit_check CHECK ((visit_deposit_credit >= (0)::numeric))
);


--
-- Name: order_signatures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_signatures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    signer_name text NOT NULL,
    signature_data_url text NOT NULL,
    comments text,
    signed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: order_time_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.order_time_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    minutes integer NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    technician_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT order_time_logs_minutes_check CHECK ((minutes > 0))
);


--
-- Name: payment_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    order_id uuid NOT NULL,
    quote_id uuid,
    payment_type text NOT NULL,
    provider text DEFAULT 'mercadopago'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'ARS'::text NOT NULL,
    mp_preference_id text,
    mp_payment_id text,
    mp_payment_method text,
    mp_installments integer,
    mp_fee_amount numeric(12,2) DEFAULT 0 NOT NULL,
    provider_payload jsonb,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payment_transactions_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT payment_transactions_currency_check CHECK ((currency = 'ARS'::text)),
    CONSTRAINT payment_transactions_mp_fee_amount_check CHECK ((mp_fee_amount >= (0)::numeric)),
    CONSTRAINT payment_transactions_payment_type_check CHECK ((payment_type = ANY (ARRAY['visit_deposit'::text, 'balance_payment'::text, 'full_advance'::text, 'extra_payment'::text]))),
    CONSTRAINT payment_transactions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'cancelled'::text, 'refunded'::text])))
);


--
-- Name: price_adjustments_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_adjustments_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_filter text,
    percentage numeric NOT NULL,
    rounding_mode text NOT NULL,
    services_affected integer DEFAULT 0 NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_by uuid
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    role public.user_role DEFAULT 'customer'::public.user_role NOT NULL,
    avatar_text text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    technician_id uuid,
    customer_id uuid,
    avatar_url text
);


--
-- Name: rubro_matricula_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rubro_matricula_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rubro_key text NOT NULL,
    display_name text NOT NULL,
    requires_matricula boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: service_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    rubro_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    base_price numeric(12,2) NOT NULL,
    unit text DEFAULT 'servicio'::text NOT NULL,
    unit_type text DEFAULT 'servicio'::text NOT NULL,
    estimated_duration_minutes integer,
    materials_included boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_categories_base_price_check CHECK ((base_price >= (0)::numeric)),
    CONSTRAINT service_categories_estimated_duration_minutes_check CHECK (((estimated_duration_minutes IS NULL) OR (estimated_duration_minutes > 0))),
    CONSTRAINT service_categories_name_check CHECK ((char_length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT service_categories_unit_type_check CHECK ((unit_type = ANY (ARRAY['servicio'::text, 'por_hora'::text, 'por_metro'::text, 'por_unidad'::text, 'por_circuito'::text, 'estimado'::text])))
);


--
-- Name: service_rubros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_rubros (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    icon text,
    visit_deposit numeric(12,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT service_rubros_name_check CHECK ((char_length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT service_rubros_slug_check CHECK ((slug ~ '^[a-z0-9-]+$'::text)),
    CONSTRAINT service_rubros_visit_deposit_check CHECK ((visit_deposit >= (0)::numeric))
);


--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    price numeric DEFAULT 0 NOT NULL,
    category text DEFAULT 'General'::text NOT NULL,
    estimated_duration_minutes integer DEFAULT 60 NOT NULL,
    features text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    subcategoria text,
    category_id uuid,
    subcategory_id uuid,
    CONSTRAINT services_estimated_duration_minutes_check CHECK ((estimated_duration_minutes > 0)),
    CONSTRAINT services_name_check CHECK ((char_length(TRIM(BOTH FROM name)) > 0)),
    CONSTRAINT services_price_check CHECK ((price >= (0)::numeric))
);


--
-- Name: subcategories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subcategories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    category_id uuid NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: support_case_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_case_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    changed_by uuid,
    change_type text NOT NULL,
    previous_value text,
    new_value text,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_case_history_change_type_check CHECK ((change_type = ANY (ARRAY['created'::text, 'status_change'::text, 'priority_change'::text, 'message_added'::text, 'settlement_paused'::text, 'settlement_released'::text, 'settlement_cancelled'::text, 'settlement_retained'::text, 'resolution_added'::text, 'closed'::text])))
);


--
-- Name: support_case_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_case_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_id uuid NOT NULL,
    sender_type text DEFAULT 'admin'::text NOT NULL,
    channel text DEFAULT 'in_app'::text NOT NULL,
    message text NOT NULL,
    is_internal boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_case_messages_channel_check CHECK ((channel = ANY (ARRAY['in_app'::text, 'phone'::text, 'email'::text, 'whatsapp'::text, 'internal_note'::text]))),
    CONSTRAINT support_case_messages_message_check CHECK ((char_length(TRIM(BOTH FROM message)) > 0)),
    CONSTRAINT support_case_messages_sender_type_check CHECK ((sender_type = ANY (ARRAY['admin'::text, 'client'::text, 'technician'::text, 'system'::text])))
);


--
-- Name: support_case_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.support_case_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: support_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.support_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    case_number text,
    customer_id uuid,
    order_id uuid,
    technician_id uuid,
    customer_name text,
    technician_name text,
    case_type text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    subject text NOT NULL,
    description text,
    resolution_type text,
    resolution_amount numeric(12,2),
    resolution_notes text,
    settlement_paused boolean DEFAULT false NOT NULL,
    settlement_id uuid,
    opened_by uuid,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_by uuid,
    resolved_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT support_cases_case_type_check CHECK ((case_type = ANY (ARRAY['warranty'::text, 'complaint'::text, 'dispute'::text, 'no_show'::text, 'damage'::text, 'other'::text]))),
    CONSTRAINT support_cases_priority_check CHECK ((priority = ANY (ARRAY['low'::text, 'medium'::text, 'high'::text, 'urgent'::text]))),
    CONSTRAINT support_cases_resolution_amount_check CHECK (((resolution_amount IS NULL) OR (resolution_amount >= (0)::numeric))),
    CONSTRAINT support_cases_resolution_type_check CHECK ((resolution_type = ANY (ARRAY['full_refund'::text, 'partial_refund'::text, 'redo_work'::text, 'send_another_technician'::text, 'credit_note'::text, 'no_action'::text, 'other'::text]))),
    CONSTRAINT support_cases_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'waiting_client'::text, 'waiting_technician'::text, 'resolved'::text, 'closed'::text, 'escalated'::text]))),
    CONSTRAINT support_cases_subject_check CHECK ((char_length(TRIM(BOTH FROM subject)) > 0))
);


--
-- Name: support_cases_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.support_cases_summary WITH (security_invoker='true') AS
 SELECT id,
    case_number,
    case_type,
    status,
    priority,
    subject,
    customer_name,
    technician_name,
    order_id,
    settlement_paused,
    opened_at,
    resolved_at,
    closed_at,
    ( SELECT count(*) AS count
           FROM public.support_case_messages m
          WHERE (m.case_id = sc.id)) AS message_count
   FROM public.support_cases sc;


--
-- Name: system_settings_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    old_value jsonb,
    new_value jsonb,
    version integer NOT NULL,
    changed_by uuid,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: technician_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    specialty text NOT NULL,
    message text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    CONSTRAINT technician_applications_email_check CHECK ((char_length(TRIM(BOTH FROM email)) > 0)),
    CONSTRAINT technician_applications_full_name_check CHECK ((char_length(TRIM(BOTH FROM full_name)) > 0)),
    CONSTRAINT technician_applications_phone_check CHECK ((char_length(TRIM(BOTH FROM phone)) > 0)),
    CONSTRAINT technician_applications_specialty_check CHECK ((char_length(TRIM(BOTH FROM specialty)) > 0)),
    CONSTRAINT technician_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


--
-- Name: technician_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    document_type text NOT NULL,
    label text NOT NULL,
    storage_path text NOT NULL,
    issuer_name text,
    issued_at date,
    version integer DEFAULT 1 NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    validation_status text DEFAULT 'pending'::text NOT NULL,
    validation_notes text,
    validated_at timestamp with time zone,
    validated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_documents_document_type_check CHECK ((document_type = ANY (ARRAY['monotributo'::text, 'identity'::text, 'degree'::text, 'certificate'::text, 'license_support'::text]))),
    CONSTRAINT technician_documents_validation_status_check CHECK ((validation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'observed'::text, 'replaced'::text]))),
    CONSTRAINT technician_documents_version_check CHECK ((version > 0))
);


--
-- Name: technician_enablement_checklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_enablement_checklist (
    technician_id uuid NOT NULL,
    profile_complete boolean DEFAULT false NOT NULL,
    identity_verified boolean DEFAULT false NOT NULL,
    tax_document_approved boolean DEFAULT false NOT NULL,
    payment_account_valid boolean DEFAULT false NOT NULL,
    professional_license_valid boolean DEFAULT false NOT NULL,
    is_ready boolean DEFAULT false NOT NULL,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: technician_matriculas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_matriculas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    issuing_entity text NOT NULL,
    license_number text NOT NULL,
    specialty text,
    expires_at date,
    validation_status text DEFAULT 'pending'::text NOT NULL,
    validation_notes text,
    validated_at timestamp with time zone,
    validated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_matriculas_validation_status_check CHECK ((validation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'observed'::text, 'expired'::text])))
);


--
-- Name: technician_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    kind text DEFAULT 'info'::text NOT NULL,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_notifications_kind_check CHECK ((kind = ANY (ARRAY['success'::text, 'warning'::text, 'error'::text, 'info'::text])))
);


--
-- Name: technician_payment_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_payment_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    account_holder text NOT NULL,
    cbu_cvu text NOT NULL,
    alias text,
    provider text DEFAULT 'bank'::text NOT NULL,
    validation_status text DEFAULT 'pending'::text NOT NULL,
    validation_notes text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_payment_accounts_cbu_cvu_check CHECK ((cbu_cvu ~ '^[0-9]{22}$'::text)),
    CONSTRAINT technician_payment_accounts_provider_check CHECK ((provider = ANY (ARRAY['bank'::text, 'mercadopago'::text, 'other'::text]))),
    CONSTRAINT technician_payment_accounts_validation_status_check CHECK ((validation_status = ANY (ARRAY['pending'::text, 'approved'::text, 'observed'::text])))
);


--
-- Name: technician_payout_batch_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_payout_batch_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    batch_id uuid NOT NULL,
    action text NOT NULL,
    performed_by uuid,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: technician_public_view; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.technician_public_view WITH (security_invoker='true') AS
 SELECT id,
    name,
    specialty,
    rating,
    completed_orders_count,
    public_avatar_path,
    bio,
    education_level,
    degree_title,
    institution_name,
    validation_status,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('issuing_entity', m.issuing_entity, 'license_number', m.license_number, 'specialty', m.specialty) ORDER BY m.created_at DESC) AS jsonb_agg
           FROM public.technician_matriculas m
          WHERE ((m.technician_id = t.id) AND (m.validation_status = 'approved'::text))), '[]'::jsonb) AS validated_licenses
   FROM public.technicians t
  WHERE (( SELECT public.is_admin() AS is_admin) OR (id IN ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
           FROM (public.service_orders o
             JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
          WHERE ((o.assigned_technician_id = t.id) AND (o.customer_id = p.customer_id)))));


--
-- Name: technician_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_requirements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    requirement_type text NOT NULL,
    is_required boolean DEFAULT true NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    review_notes text,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_requirements_requirement_type_check CHECK ((requirement_type = ANY (ARRAY['profile_complete'::text, 'education_verified'::text, 'matricula_validated'::text, 'monotributo_approved'::text, 'identity_verified'::text, 'bank_account_valid'::text]))),
    CONSTRAINT technician_requirements_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'observed'::text, 'not_required'::text])))
);


--
-- Name: technician_review_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.technician_review_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    technician_id uuid NOT NULL,
    requirement_type text,
    action text NOT NULL,
    reason text,
    reviewed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT technician_review_history_action_check CHECK ((action = ANY (ARRAY['requirement_approved'::text, 'requirement_observed'::text, 'requirement_not_required'::text, 'technician_approved'::text, 'technician_observed'::text, 'technician_suspended'::text])))
);


--
-- Name: technicians_technician_number_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.technicians_technician_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: technicians_technician_number_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.technicians_technician_number_seq OWNED BY public.technicians.technician_number;


--
-- Name: customers customer_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers ALTER COLUMN customer_number SET DEFAULT nextval('public.customers_customer_number_seq'::regclass);


--
-- Name: technicians technician_number; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians ALTER COLUMN technician_number SET DEFAULT nextval('public.technicians_technician_number_seq'::regclass);


--
-- Name: account_invites account_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_pkey PRIMARY KEY (id);


--
-- Name: account_invites account_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_token_key UNIQUE (token);


--
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: conversation_participants conversation_participants_conversation_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_profile_id_key UNIQUE (conversation_id, profile_id);


--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: customer_admin_notes customer_admin_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_admin_notes
    ADD CONSTRAINT customer_admin_notes_pkey PRIMARY KEY (id);


--
-- Name: customers customers_customer_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_customer_number_key UNIQUE (customer_number);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_profile_id_key UNIQUE (profile_id);


--
-- Name: guest_checkout_drafts guest_checkout_drafts_guest_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_checkout_drafts
    ADD CONSTRAINT guest_checkout_drafts_guest_access_token_key UNIQUE (guest_access_token);


--
-- Name: guest_checkout_drafts guest_checkout_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guest_checkout_drafts
    ADD CONSTRAINT guest_checkout_drafts_pkey PRIMARY KEY (id);


--
-- Name: materials materials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.materials
    ADD CONSTRAINT materials_pkey PRIMARY KEY (id);


--
-- Name: message_reads message_reads_message_id_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_message_id_profile_id_key UNIQUE (message_id, profile_id);


--
-- Name: message_reads message_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: order_checklist_items order_checklist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_checklist_items
    ADD CONSTRAINT order_checklist_items_pkey PRIMARY KEY (id);


--
-- Name: order_diagnosis_photos order_diagnosis_photos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_diagnosis_photos
    ADD CONSTRAINT order_diagnosis_photos_pkey PRIMARY KEY (id);


--
-- Name: order_events order_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_events
    ADD CONSTRAINT order_events_pkey PRIMARY KEY (id);


--
-- Name: order_materials_used order_materials_used_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_materials_used
    ADD CONSTRAINT order_materials_used_pkey PRIMARY KEY (id);


--
-- Name: order_notes order_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_notes
    ADD CONSTRAINT order_notes_pkey PRIMARY KEY (id);


--
-- Name: order_quote_items order_quote_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_quote_items
    ADD CONSTRAINT order_quote_items_pkey PRIMARY KEY (id);


--
-- Name: order_quotes order_quotes_order_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_quotes
    ADD CONSTRAINT order_quotes_order_id_version_key UNIQUE (order_id, version);


--
-- Name: order_quotes order_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_quotes
    ADD CONSTRAINT order_quotes_pkey PRIMARY KEY (id);


--
-- Name: order_signatures order_signatures_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_signatures
    ADD CONSTRAINT order_signatures_order_id_key UNIQUE (order_id);


--
-- Name: order_signatures order_signatures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_signatures
    ADD CONSTRAINT order_signatures_pkey PRIMARY KEY (id);


--
-- Name: order_time_logs order_time_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_time_logs
    ADD CONSTRAINT order_time_logs_pkey PRIMARY KEY (id);


--
-- Name: payment_transactions payment_transactions_mp_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_mp_payment_id_key UNIQUE (mp_payment_id);


--
-- Name: payment_transactions payment_transactions_mp_preference_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_mp_preference_id_key UNIQUE (mp_preference_id);


--
-- Name: payment_transactions payment_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_pkey PRIMARY KEY (id);


--
-- Name: price_adjustments_log price_adjustments_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_adjustments_log
    ADD CONSTRAINT price_adjustments_log_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: rubro_matricula_config rubro_matricula_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubro_matricula_config
    ADD CONSTRAINT rubro_matricula_config_pkey PRIMARY KEY (id);


--
-- Name: rubro_matricula_config rubro_matricula_config_rubro_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rubro_matricula_config
    ADD CONSTRAINT rubro_matricula_config_rubro_key_key UNIQUE (rubro_key);


--
-- Name: service_categories service_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);


--
-- Name: service_categories service_categories_rubro_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_rubro_id_slug_key UNIQUE (rubro_id, slug);


--
-- Name: service_orders service_orders_guest_access_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_guest_access_token_key UNIQUE (guest_access_token);


--
-- Name: service_orders service_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_pkey PRIMARY KEY (id);


--
-- Name: service_rubros service_rubros_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_rubros
    ADD CONSTRAINT service_rubros_name_key UNIQUE (name);


--
-- Name: service_rubros service_rubros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_rubros
    ADD CONSTRAINT service_rubros_pkey PRIMARY KEY (id);


--
-- Name: service_rubros service_rubros_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_rubros
    ADD CONSTRAINT service_rubros_slug_key UNIQUE (slug);


--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);


--
-- Name: subcategories subcategories_category_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_category_id_name_key UNIQUE (category_id, name);


--
-- Name: subcategories subcategories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_pkey PRIMARY KEY (id);


--
-- Name: support_case_history support_case_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_case_history
    ADD CONSTRAINT support_case_history_pkey PRIMARY KEY (id);


--
-- Name: support_case_messages support_case_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_case_messages
    ADD CONSTRAINT support_case_messages_pkey PRIMARY KEY (id);


--
-- Name: support_cases support_cases_case_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_case_number_key UNIQUE (case_number);


--
-- Name: support_cases support_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_pkey PRIMARY KEY (id);


--
-- Name: system_settings_history system_settings_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings_history
    ADD CONSTRAINT system_settings_history_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: technician_applications technician_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_applications
    ADD CONSTRAINT technician_applications_pkey PRIMARY KEY (id);


--
-- Name: technician_documents technician_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_documents
    ADD CONSTRAINT technician_documents_pkey PRIMARY KEY (id);


--
-- Name: technician_documents technician_documents_storage_path_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_documents
    ADD CONSTRAINT technician_documents_storage_path_key UNIQUE (storage_path);


--
-- Name: technician_enablement_checklist technician_enablement_checklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_enablement_checklist
    ADD CONSTRAINT technician_enablement_checklist_pkey PRIMARY KEY (technician_id);


--
-- Name: technician_goals technician_goals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_goals
    ADD CONSTRAINT technician_goals_pkey PRIMARY KEY (id);


--
-- Name: technician_matriculas technician_matriculas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_matriculas
    ADD CONSTRAINT technician_matriculas_pkey PRIMARY KEY (id);


--
-- Name: technician_notifications technician_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_notifications
    ADD CONSTRAINT technician_notifications_pkey PRIMARY KEY (id);


--
-- Name: technician_payment_accounts technician_payment_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payment_accounts
    ADD CONSTRAINT technician_payment_accounts_pkey PRIMARY KEY (id);


--
-- Name: technician_payment_accounts technician_payment_accounts_technician_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payment_accounts
    ADD CONSTRAINT technician_payment_accounts_technician_id_key UNIQUE (technician_id);


--
-- Name: technician_payout_batch_audit technician_payout_batch_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payout_batch_audit
    ADD CONSTRAINT technician_payout_batch_audit_pkey PRIMARY KEY (id);


--
-- Name: technician_payout_batches technician_payout_batches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payout_batches
    ADD CONSTRAINT technician_payout_batches_pkey PRIMARY KEY (id);


--
-- Name: technician_requirements technician_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_requirements
    ADD CONSTRAINT technician_requirements_pkey PRIMARY KEY (id);


--
-- Name: technician_requirements technician_requirements_technician_id_requirement_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_requirements
    ADD CONSTRAINT technician_requirements_technician_id_requirement_type_key UNIQUE (technician_id, requirement_type);


--
-- Name: technician_review_history technician_review_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_review_history
    ADD CONSTRAINT technician_review_history_pkey PRIMARY KEY (id);


--
-- Name: technician_settlements technician_settlements_payment_transaction_id_settlement_ty_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_settlements
    ADD CONSTRAINT technician_settlements_payment_transaction_id_settlement_ty_key UNIQUE (payment_transaction_id, settlement_type);


--
-- Name: technician_settlements technician_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_settlements
    ADD CONSTRAINT technician_settlements_pkey PRIMARY KEY (id);


--
-- Name: technicians technicians_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_pkey PRIMARY KEY (id);


--
-- Name: technicians technicians_profile_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_profile_id_key UNIQUE (profile_id);


--
-- Name: technicians technicians_technician_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_technician_number_key UNIQUE (technician_number);


--
-- Name: account_invites_target_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_invites_target_idx ON public.account_invites USING btree (kind, target_id);


--
-- Name: account_invites_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX account_invites_token_idx ON public.account_invites USING btree (token);


--
-- Name: conversation_participants_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_participants_conversation_idx ON public.conversation_participants USING btree (conversation_id);


--
-- Name: conversation_participants_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_participants_profile_idx ON public.conversation_participants USING btree (profile_id);


--
-- Name: conversations_last_message_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_last_message_idx ON public.conversations USING btree (last_message_at DESC);


--
-- Name: conversations_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversations_order_idx ON public.conversations USING btree (order_id);


--
-- Name: customer_addresses_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_addresses_customer_idx ON public.customer_addresses USING btree (customer_id);


--
-- Name: customer_addresses_one_default_per_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customer_addresses_one_default_per_customer_idx ON public.customer_addresses USING btree (customer_id) WHERE is_default;


--
-- Name: customer_admin_notes_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX customer_admin_notes_customer_idx ON public.customer_admin_notes USING btree (customer_id, created_at DESC);


--
-- Name: customers_email_lower_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX customers_email_lower_uidx ON public.customers USING btree (lower(email)) WHERE ((email IS NOT NULL) AND (btrim(email) <> ''::text));


--
-- Name: guest_checkout_drafts_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guest_checkout_drafts_created_at_idx ON public.guest_checkout_drafts USING btree (created_at);


--
-- Name: idx_materials_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_materials_category ON public.materials USING btree (category);


--
-- Name: idx_order_events_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_order_events_order ON public.order_events USING btree (order_id);


--
-- Name: idx_service_orders_admin_incident_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_admin_incident_status ON public.service_orders USING btree (admin_incident_status) WHERE (admin_incident_status = 'open'::text);


--
-- Name: idx_service_orders_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_customer ON public.service_orders USING btree (customer_id);


--
-- Name: idx_service_orders_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_status ON public.service_orders USING btree (status);


--
-- Name: idx_service_orders_technician; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_service_orders_technician ON public.service_orders USING btree (assigned_technician_id);


--
-- Name: message_reads_profile_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX message_reads_profile_idx ON public.message_reads USING btree (profile_id);


--
-- Name: messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_conversation_idx ON public.messages USING btree (conversation_id, created_at);


--
-- Name: notifications_dedupe_key_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_dedupe_key_uidx ON public.notifications USING btree (dedupe_key) WHERE (dedupe_key IS NOT NULL);


--
-- Name: notifications_recipient_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_recipient_created_idx ON public.notifications USING btree (recipient_profile_id, created_at DESC);


--
-- Name: notifications_recipient_unread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_recipient_unread_idx ON public.notifications USING btree (recipient_profile_id) WHERE (read_at IS NULL);


--
-- Name: order_diagnosis_photos_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_diagnosis_photos_order_idx ON public.order_diagnosis_photos USING btree (order_id, created_at DESC);


--
-- Name: order_quote_items_quote_sort_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_quote_items_quote_sort_idx ON public.order_quote_items USING btree (quote_id, sort_order);


--
-- Name: order_quotes_order_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX order_quotes_order_version_idx ON public.order_quotes USING btree (order_id, version DESC);


--
-- Name: payment_transactions_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_transactions_order_idx ON public.payment_transactions USING btree (order_id, created_at DESC);


--
-- Name: service_categories_rubro_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_categories_rubro_active_idx ON public.service_categories USING btree (rubro_id, is_active, sort_order);


--
-- Name: service_orders_archived_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX service_orders_archived_at_idx ON public.service_orders USING btree (archived_at);


--
-- Name: support_case_history_case_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_case_history_case_idx ON public.support_case_history USING btree (case_id, created_at DESC);


--
-- Name: support_case_messages_case_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_case_messages_case_idx ON public.support_case_messages USING btree (case_id, created_at);


--
-- Name: support_cases_customer_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_cases_customer_idx ON public.support_cases USING btree (customer_id);


--
-- Name: support_cases_opened_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_cases_opened_idx ON public.support_cases USING btree (opened_at DESC);


--
-- Name: support_cases_order_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_cases_order_idx ON public.support_cases USING btree (order_id);


--
-- Name: support_cases_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_cases_status_idx ON public.support_cases USING btree (status);


--
-- Name: support_cases_technician_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX support_cases_technician_idx ON public.support_cases USING btree (technician_id);


--
-- Name: technician_documents_technician_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX technician_documents_technician_idx ON public.technician_documents USING btree (technician_id, document_type, is_current);


--
-- Name: technician_goals_one_active_per_type; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX technician_goals_one_active_per_type ON public.technician_goals USING btree (technician_id, goal_type) WHERE is_active;


--
-- Name: technician_goals_technician_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX technician_goals_technician_active_idx ON public.technician_goals USING btree (technician_id, is_active);


--
-- Name: technician_matriculas_technician_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX technician_matriculas_technician_idx ON public.technician_matriculas USING btree (technician_id, validation_status);


--
-- Name: technician_payout_batches_technician_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX technician_payout_batches_technician_status_idx ON public.technician_payout_batches USING btree (technician_id, status, scheduled_date DESC);


--
-- Name: technician_settlements_one_completed_work_per_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX technician_settlements_one_completed_work_per_order ON public.technician_settlements USING btree (order_id) WHERE (settlement_type = 'completed_work'::text);


--
-- Name: technician_settlements_status_release_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX technician_settlements_status_release_idx ON public.technician_settlements USING btree (status, release_date);


--
-- Name: technician_settlements_technician_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX technician_settlements_technician_created_idx ON public.technician_settlements USING btree (technician_id, created_at DESC);


--
-- Name: technician_settlements_technician_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX technician_settlements_technician_status_idx ON public.technician_settlements USING btree (technician_id, status, release_at);


--
-- Name: technicians_email_lower_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX technicians_email_lower_uidx ON public.technicians USING btree (lower(email)) WHERE ((email IS NOT NULL) AND (btrim(email) <> ''::text));


--
-- Name: technicians lock_technician_admin_fields_before_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lock_technician_admin_fields_before_update BEFORE UPDATE ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.lock_technician_admin_fields();


--
-- Name: technician_documents lock_technician_document_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lock_technician_document_review BEFORE INSERT OR UPDATE ON public.technician_documents FOR EACH ROW EXECUTE FUNCTION public.lock_technician_review_fields();


--
-- Name: technician_matriculas lock_technician_matricula_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lock_technician_matricula_review BEFORE INSERT OR UPDATE ON public.technician_matriculas FOR EACH ROW EXECUTE FUNCTION public.lock_technician_review_fields();


--
-- Name: technician_payment_accounts lock_technician_payment_review; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lock_technician_payment_review BEFORE INSERT OR UPDATE ON public.technician_payment_accounts FOR EACH ROW EXECUTE FUNCTION public.lock_technician_review_fields();


--
-- Name: materials materials_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER materials_set_updated_at BEFORE UPDATE ON public.materials FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: messages messages_touch_conversation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER messages_touch_conversation AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.touch_conversation_last_message();


--
-- Name: order_quote_items order_quote_items_apply_catalog_price; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_quote_items_apply_catalog_price BEFORE INSERT OR UPDATE ON public.order_quote_items FOR EACH ROW EXECUTE FUNCTION public.apply_catalog_price_to_quote_item();


--
-- Name: order_quote_items order_quote_items_prevent_sent_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_quote_items_prevent_sent_change BEFORE INSERT OR DELETE OR UPDATE ON public.order_quote_items FOR EACH ROW EXECUTE FUNCTION public.prevent_sent_quote_item_change();


--
-- Name: order_quote_items order_quote_items_sync_totals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_quote_items_sync_totals AFTER INSERT OR DELETE OR UPDATE ON public.order_quote_items FOR EACH ROW EXECUTE FUNCTION public.sync_quote_totals_from_items();


--
-- Name: order_quotes order_quotes_prevent_content_change; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_quotes_prevent_content_change BEFORE UPDATE ON public.order_quotes FOR EACH ROW EXECUTE FUNCTION public.prevent_sent_quote_content_change();


--
-- Name: order_quotes order_quotes_sync_accepted_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_quotes_sync_accepted_status AFTER UPDATE OF status ON public.order_quotes FOR EACH ROW EXECUTE FUNCTION public.sync_accepted_quote_status();


--
-- Name: order_quotes order_quotes_sync_order_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_quotes_sync_order_status AFTER INSERT OR UPDATE OF status ON public.order_quotes FOR EACH ROW EXECUTE FUNCTION public.sync_service_order_quote_status();


--
-- Name: order_quotes order_quotes_sync_rejected_order_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER order_quotes_sync_rejected_order_state AFTER UPDATE OF status ON public.order_quotes FOR EACH ROW EXECUTE FUNCTION public.sync_rejected_quote_order_state();


--
-- Name: profiles profiles_set_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: service_orders protect_admin_order_control_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER protect_admin_order_control_fields BEFORE UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.protect_admin_order_control_fields();


--
-- Name: service_orders require_eligible_technician_assignment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER require_eligible_technician_assignment BEFORE UPDATE OF assigned_technician_id ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.require_eligible_technician_assignment();


--
-- Name: service_orders service_orders_enforce_pricing; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_orders_enforce_pricing BEFORE INSERT ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.enforce_service_order_pricing();


--
-- Name: service_orders service_orders_prevent_unpaid_execution_timer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_orders_prevent_unpaid_execution_timer BEFORE INSERT OR UPDATE OF status, work_started_at ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.prevent_unpaid_execution_timer();


--
-- Name: service_orders service_orders_start_execution_after_payment; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER service_orders_start_execution_after_payment AFTER UPDATE OF payment_status, quote_status, assigned_technician_id ON public.service_orders FOR EACH ROW EXECUTE FUNCTION public.start_execution_after_payment_confirmation();


--
-- Name: support_cases support_cases_set_number; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER support_cases_set_number BEFORE INSERT ON public.support_cases FOR EACH ROW EXECUTE FUNCTION public.set_support_case_number();


--
-- Name: service_orders trg_create_settlement_on_completion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_create_settlement_on_completion AFTER UPDATE OF status, payment_status ON public.service_orders FOR EACH ROW WHEN (((new.status = 'completed'::public.order_status) AND (new.payment_status = 'paid_in_full'::text))) EXECUTE FUNCTION public.create_settlement_on_order_completed_and_paid();


--
-- Name: messages trg_enforce_message_max_length; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_message_max_length BEFORE INSERT OR UPDATE OF body ON public.messages FOR EACH ROW EXECUTE FUNCTION public.enforce_message_max_length();


--
-- Name: support_case_messages trg_enforce_support_message_max_length; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_enforce_support_message_max_length BEFORE INSERT OR UPDATE OF message ON public.support_case_messages FOR EACH ROW EXECUTE FUNCTION public.enforce_support_message_max_length();


--
-- Name: notifications trg_notifications_protect_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notifications_protect_immutable BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.notifications_protect_immutable();


--
-- Name: support_case_messages trg_notify_claim_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_claim_message AFTER INSERT ON public.support_case_messages FOR EACH ROW WHEN ((new.is_internal = false)) EXECUTE FUNCTION public.notify_claim_message();


--
-- Name: support_cases trg_notify_claim_opened; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_claim_opened AFTER INSERT ON public.support_cases FOR EACH ROW EXECUTE FUNCTION public.notify_claim_opened();


--
-- Name: support_cases trg_notify_claim_resolved; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_claim_resolved AFTER UPDATE OF status ON public.support_cases FOR EACH ROW WHEN (((new.status = 'resolved'::text) AND (old.status IS DISTINCT FROM 'resolved'::text))) EXECUTE FUNCTION public.notify_claim_resolved();


--
-- Name: messages trg_notify_new_message; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_new_message AFTER INSERT ON public.messages FOR EACH ROW WHEN ((new.is_internal = false)) EXECUTE FUNCTION public.notify_new_message();


--
-- Name: service_orders trg_notify_order_assigned; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_order_assigned AFTER UPDATE OF assigned_technician_id ON public.service_orders FOR EACH ROW WHEN (((new.assigned_technician_id IS NOT NULL) AND (new.assigned_technician_id IS DISTINCT FROM old.assigned_technician_id))) EXECUTE FUNCTION public.notify_order_assigned();


--
-- Name: payment_transactions trg_notify_payment_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_payment_insert AFTER INSERT ON public.payment_transactions FOR EACH ROW WHEN ((new.status = ANY (ARRAY['approved'::text, 'rejected'::text, 'pending'::text]))) EXECUTE FUNCTION public.notify_payment_status();


--
-- Name: payment_transactions trg_notify_payment_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_payment_update AFTER UPDATE OF status ON public.payment_transactions FOR EACH ROW WHEN (((new.status = ANY (ARRAY['approved'::text, 'rejected'::text, 'pending'::text])) AND (new.status IS DISTINCT FROM old.status))) EXECUTE FUNCTION public.notify_payment_status();


--
-- Name: order_quotes trg_notify_quote_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_quote_status AFTER UPDATE OF status ON public.order_quotes FOR EACH ROW WHEN (((new.status IS DISTINCT FROM old.status) AND (new.status = ANY (ARRAY['sent'::text, 'accepted'::text, 'rejected'::text])))) EXECUTE FUNCTION public.notify_quote_status();


--
-- Name: technician_settlements trg_notify_settlement_status; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_settlement_status AFTER UPDATE OF status ON public.technician_settlements FOR EACH ROW WHEN (((new.status IS DISTINCT FROM old.status) AND (new.status = ANY (ARRAY['scheduled'::text, 'released'::text, 'paid'::text])))) EXECUTE FUNCTION public.notify_settlement_status();


--
-- Name: technician_notifications trg_notify_technician_validation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notify_technician_validation AFTER INSERT ON public.technician_notifications FOR EACH ROW EXECUTE FUNCTION public.notify_technician_validation_mirror();


--
-- Name: technician_settlements trg_payout_batch_recalc_after_pull; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_payout_batch_recalc_after_pull AFTER UPDATE OF status ON public.technician_settlements FOR EACH ROW WHEN (((old.status = 'scheduled'::text) AND (new.status IS DISTINCT FROM old.status) AND (new.status <> ALL (ARRAY['scheduled'::text, 'paid'::text])))) EXECUTE FUNCTION public.payout_batch_recalc_after_pull();


--
-- Name: technician_settlements trg_settlements_clear_batch_on_pull; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_settlements_clear_batch_on_pull BEFORE UPDATE OF status ON public.technician_settlements FOR EACH ROW WHEN (((old.status = 'scheduled'::text) AND (new.status IS DISTINCT FROM old.status))) EXECUTE FUNCTION public.technician_settlements_clear_batch_on_pull();


--
-- Name: system_settings trg_system_settings_audit; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_system_settings_audit BEFORE INSERT OR UPDATE ON public.system_settings FOR EACH ROW EXECUTE FUNCTION public.system_settings_audit();


--
-- Name: account_invites account_invites_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_invites
    ADD CONSTRAINT account_invites_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: conversation_participants conversation_participants_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.support_cases(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: conversations conversations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE SET NULL;


--
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_admin_notes customer_admin_notes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_admin_notes
    ADD CONSTRAINT customer_admin_notes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: customer_admin_notes customer_admin_notes_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customer_admin_notes
    ADD CONSTRAINT customer_admin_notes_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customers customers_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: message_reads message_reads_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;


--
-- Name: message_reads message_reads_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_reads
    ADD CONSTRAINT message_reads_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: notifications notifications_recipient_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_recipient_profile_id_fkey FOREIGN KEY (recipient_profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;


--
-- Name: order_checklist_items order_checklist_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_checklist_items
    ADD CONSTRAINT order_checklist_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: order_diagnosis_photos order_diagnosis_photos_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_diagnosis_photos
    ADD CONSTRAINT order_diagnosis_photos_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: order_diagnosis_photos order_diagnosis_photos_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_diagnosis_photos
    ADD CONSTRAINT order_diagnosis_photos_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.order_quotes(id) ON DELETE SET NULL;


--
-- Name: order_diagnosis_photos order_diagnosis_photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_diagnosis_photos
    ADD CONSTRAINT order_diagnosis_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: order_events order_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_events
    ADD CONSTRAINT order_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: order_materials_used order_materials_used_material_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_materials_used
    ADD CONSTRAINT order_materials_used_material_id_fkey FOREIGN KEY (material_id) REFERENCES public.materials(id) ON DELETE SET NULL;


--
-- Name: order_materials_used order_materials_used_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_materials_used
    ADD CONSTRAINT order_materials_used_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: order_notes order_notes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_notes
    ADD CONSTRAINT order_notes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: order_quote_items order_quote_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_quote_items
    ADD CONSTRAINT order_quote_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.service_categories(id) ON DELETE RESTRICT;


--
-- Name: order_quote_items order_quote_items_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_quote_items
    ADD CONSTRAINT order_quote_items_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.order_quotes(id) ON DELETE CASCADE;


--
-- Name: order_quote_items order_quote_items_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_quote_items
    ADD CONSTRAINT order_quote_items_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id);


--
-- Name: order_quotes order_quotes_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_quotes
    ADD CONSTRAINT order_quotes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: order_quotes order_quotes_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_quotes
    ADD CONSTRAINT order_quotes_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: order_signatures order_signatures_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_signatures
    ADD CONSTRAINT order_signatures_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: order_time_logs order_time_logs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.order_time_logs
    ADD CONSTRAINT order_time_logs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE CASCADE;


--
-- Name: payment_transactions payment_transactions_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE RESTRICT;


--
-- Name: payment_transactions payment_transactions_quote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_transactions
    ADD CONSTRAINT payment_transactions_quote_id_fkey FOREIGN KEY (quote_id) REFERENCES public.order_quotes(id) ON DELETE SET NULL;


--
-- Name: price_adjustments_log price_adjustments_log_applied_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_adjustments_log
    ADD CONSTRAINT price_adjustments_log_applied_by_fkey FOREIGN KEY (applied_by) REFERENCES public.profiles(id);


--
-- Name: profiles profiles_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE SET NULL;


--
-- Name: service_categories service_categories_rubro_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_rubro_id_fkey FOREIGN KEY (rubro_id) REFERENCES public.service_rubros(id) ON DELETE RESTRICT;


--
-- Name: service_orders service_orders_admin_exception_closed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_admin_exception_closed_by_fkey FOREIGN KEY (admin_exception_closed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: service_orders service_orders_admin_incident_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_admin_incident_opened_by_fkey FOREIGN KEY (admin_incident_opened_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: service_orders service_orders_admin_incident_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_admin_incident_resolved_by_fkey FOREIGN KEY (admin_incident_resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: service_orders service_orders_assigned_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_assigned_technician_id_fkey FOREIGN KEY (assigned_technician_id) REFERENCES public.technicians(id) ON DELETE SET NULL;


--
-- Name: service_orders service_orders_cancelled_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: service_orders service_orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: service_orders service_orders_fixed_price_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_orders
    ADD CONSTRAINT service_orders_fixed_price_service_id_fkey FOREIGN KEY (fixed_price_service_id) REFERENCES public.services(id);


--
-- Name: services services_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);


--
-- Name: services services_subcategory_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_subcategory_id_fkey FOREIGN KEY (subcategory_id) REFERENCES public.subcategories(id);


--
-- Name: subcategories subcategories_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subcategories
    ADD CONSTRAINT subcategories_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE RESTRICT;


--
-- Name: support_case_history support_case_history_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_case_history
    ADD CONSTRAINT support_case_history_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.support_cases(id) ON DELETE CASCADE;


--
-- Name: support_case_history support_case_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_case_history
    ADD CONSTRAINT support_case_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_case_messages support_case_messages_case_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_case_messages
    ADD CONSTRAINT support_case_messages_case_id_fkey FOREIGN KEY (case_id) REFERENCES public.support_cases(id) ON DELETE CASCADE;


--
-- Name: support_case_messages support_case_messages_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_case_messages
    ADD CONSTRAINT support_case_messages_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_opened_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_opened_by_fkey FOREIGN KEY (opened_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: support_cases support_cases_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.support_cases
    ADD CONSTRAINT support_cases_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE SET NULL;


--
-- Name: system_settings_history system_settings_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings_history
    ADD CONSTRAINT system_settings_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.profiles(id);


--
-- Name: system_settings system_settings_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id);


--
-- Name: technician_applications technician_applications_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_applications
    ADD CONSTRAINT technician_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id);


--
-- Name: technician_documents technician_documents_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_documents
    ADD CONSTRAINT technician_documents_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: technician_documents technician_documents_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_documents
    ADD CONSTRAINT technician_documents_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: technician_enablement_checklist technician_enablement_checklist_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_enablement_checklist
    ADD CONSTRAINT technician_enablement_checklist_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: technician_enablement_checklist technician_enablement_checklist_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_enablement_checklist
    ADD CONSTRAINT technician_enablement_checklist_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: technician_goals technician_goals_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_goals
    ADD CONSTRAINT technician_goals_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: technician_matriculas technician_matriculas_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_matriculas
    ADD CONSTRAINT technician_matriculas_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: technician_matriculas technician_matriculas_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_matriculas
    ADD CONSTRAINT technician_matriculas_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: technician_notifications technician_notifications_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_notifications
    ADD CONSTRAINT technician_notifications_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: technician_payment_accounts technician_payment_accounts_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payment_accounts
    ADD CONSTRAINT technician_payment_accounts_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: technician_payout_batch_audit technician_payout_batch_audit_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payout_batch_audit
    ADD CONSTRAINT technician_payout_batch_audit_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES public.technician_payout_batches(id) ON DELETE CASCADE;


--
-- Name: technician_payout_batches technician_payout_batches_completed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payout_batches
    ADD CONSTRAINT technician_payout_batches_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: technician_payout_batches technician_payout_batches_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payout_batches
    ADD CONSTRAINT technician_payout_batches_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: technician_payout_batches technician_payout_batches_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_payout_batches
    ADD CONSTRAINT technician_payout_batches_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE RESTRICT;


--
-- Name: technician_requirements technician_requirements_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_requirements
    ADD CONSTRAINT technician_requirements_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: technician_requirements technician_requirements_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_requirements
    ADD CONSTRAINT technician_requirements_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: technician_review_history technician_review_history_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_review_history
    ADD CONSTRAINT technician_review_history_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: technician_review_history technician_review_history_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_review_history
    ADD CONSTRAINT technician_review_history_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE CASCADE;


--
-- Name: technician_settlements technician_settlements_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_settlements
    ADD CONSTRAINT technician_settlements_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.service_orders(id) ON DELETE RESTRICT;


--
-- Name: technician_settlements technician_settlements_payment_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_settlements
    ADD CONSTRAINT technician_settlements_payment_transaction_id_fkey FOREIGN KEY (payment_transaction_id) REFERENCES public.payment_transactions(id) ON DELETE SET NULL;


--
-- Name: technician_settlements technician_settlements_payout_batch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_settlements
    ADD CONSTRAINT technician_settlements_payout_batch_id_fkey FOREIGN KEY (payout_batch_id) REFERENCES public.technician_payout_batches(id) ON DELETE SET NULL;


--
-- Name: technician_settlements technician_settlements_technician_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technician_settlements
    ADD CONSTRAINT technician_settlements_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES public.technicians(id) ON DELETE RESTRICT;


--
-- Name: technicians technicians_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: technicians technicians_validated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.technicians
    ADD CONSTRAINT technicians_validated_by_fkey FOREIGN KEY (validated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


--
-- Name: account_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: account_invites account_invites_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_invites_admin ON public.account_invites TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

--
-- Name: categories categories_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select_anon ON public.categories FOR SELECT TO anon USING ((is_active = true));


--
-- Name: categories categories_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_select_authenticated ON public.categories FOR SELECT TO authenticated USING (true);


--
-- Name: categories categories_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY categories_write_admin ON public.categories TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants conversation_participants_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_participants_admin_all ON public.conversation_participants TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: conversation_participants conversation_participants_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_participants_insert_self ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK ((profile_id = ( SELECT auth.uid() AS uid)));


--
-- Name: conversation_participants conversation_participants_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_participants_select_own ON public.conversation_participants FOR SELECT TO authenticated USING (( SELECT public.is_conversation_participant(conversation_participants.conversation_id) AS is_conversation_participant));


--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_admin_all ON public.conversations TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: conversations conversations_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert_self ON public.conversations FOR INSERT TO authenticated WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));


--
-- Name: conversations conversations_select_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select_participant ON public.conversations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = conversations.id) AND (cp.profile_id = ( SELECT auth.uid() AS uid))))));


--
-- Name: customer_addresses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_addresses customer_addresses_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_addresses_owner_or_admin ON public.customer_addresses FOR SELECT TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.id = customer_addresses.customer_id) AND (c.profile_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: customer_addresses customer_addresses_owner_write_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_addresses_owner_write_or_admin ON public.customer_addresses TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.id = customer_addresses.customer_id) AND (c.profile_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK ((( SELECT public.is_admin() AS is_admin) OR (EXISTS ( SELECT 1
   FROM public.customers c
  WHERE ((c.id = customer_addresses.customer_id) AND (c.profile_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: customer_admin_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customer_admin_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: customer_admin_notes customer_admin_notes_admin_only; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customer_admin_notes_admin_only ON public.customer_admin_notes TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

--
-- Name: customers customers_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_insert_self ON public.customers FOR INSERT TO authenticated WITH CHECK ((profile_id = auth.uid()));


--
-- Name: customers customers_select_own_or_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_select_own_or_staff ON public.customers FOR SELECT TO authenticated USING ((public.is_admin() OR (profile_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM (public.service_orders so
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((so.customer_id = customers.id) AND (so.assigned_technician_id = p.technician_id))))));


--
-- Name: customers customers_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY customers_write_admin ON public.customers TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: guest_checkout_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guest_checkout_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: materials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

--
-- Name: materials materials_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_select_authenticated ON public.materials FOR SELECT TO authenticated USING (true);


--
-- Name: materials materials_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY materials_write_admin ON public.materials TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: message_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: message_reads message_reads_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_reads_admin_all ON public.message_reads TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: message_reads message_reads_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_reads_insert_own ON public.message_reads FOR INSERT TO authenticated WITH CHECK (((profile_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM (public.messages m
     JOIN public.conversation_participants cp ON ((cp.conversation_id = m.conversation_id)))
  WHERE ((m.id = message_reads.message_id) AND (cp.profile_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: message_reads message_reads_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY message_reads_select_own ON public.message_reads FOR SELECT TO authenticated USING ((profile_id = ( SELECT auth.uid() AS uid)));


--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_admin_all ON public.messages TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: messages messages_insert_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_insert_participant ON public.messages FOR INSERT TO authenticated WITH CHECK (((is_internal = false) AND (sender_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.profile_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: messages messages_select_participant; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_select_participant ON public.messages FOR SELECT TO authenticated USING (((is_internal = false) AND (EXISTS ( SELECT 1
   FROM public.conversation_participants cp
  WHERE ((cp.conversation_id = messages.conversation_id) AND (cp.profile_id = ( SELECT auth.uid() AS uid)))))));


--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications notifications_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_admin_all ON public.notifications TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: notifications notifications_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING ((recipient_profile_id = ( SELECT auth.uid() AS uid)));


--
-- Name: notifications notifications_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING ((recipient_profile_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((recipient_profile_id = ( SELECT auth.uid() AS uid)));


--
-- Name: order_checklist_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_checklist_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_checklist_items order_children_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_children_select ON public.order_checklist_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_checklist_items.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (o.customer_id = ( SELECT profiles.customer_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_checklist_items order_children_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_children_write ON public.order_checklist_items TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_checklist_items.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_checklist_items.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_diagnosis_photos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_diagnosis_photos ENABLE ROW LEVEL SECURITY;

--
-- Name: order_diagnosis_photos order_diagnosis_photos_insert_assigned_technician; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_diagnosis_photos_insert_assigned_technician ON public.order_diagnosis_photos FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_diagnosis_photos.order_id) AND (o.assigned_technician_id = p.technician_id) AND (o.work_mode = 'diagnosis'::text) AND (o.payment_status = 'deposit_paid'::text)))));


--
-- Name: order_diagnosis_photos order_diagnosis_photos_select_stakeholders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_diagnosis_photos_select_stakeholders ON public.order_diagnosis_photos FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.service_orders o
     LEFT JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_diagnosis_photos.order_id) AND (public.is_admin() OR (o.assigned_technician_id = p.technician_id) OR (o.customer_id = p.customer_id))))));


--
-- Name: order_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

--
-- Name: order_events order_events_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_events_select ON public.order_events FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_events.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (o.customer_id = ( SELECT profiles.customer_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_events order_events_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_events_write ON public.order_events TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_events.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_events.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_materials_used; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_materials_used ENABLE ROW LEVEL SECURITY;

--
-- Name: order_materials_used order_materials_used_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_materials_used_select ON public.order_materials_used FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_materials_used.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (o.customer_id = ( SELECT profiles.customer_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_materials_used order_materials_used_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_materials_used_write ON public.order_materials_used TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_materials_used.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_materials_used.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: order_notes order_notes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_notes_select ON public.order_notes FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_notes.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (o.customer_id = ( SELECT profiles.customer_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_notes order_notes_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_notes_write ON public.order_notes TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_notes.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_notes.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_quote_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_quote_items ENABLE ROW LEVEL SECURITY;

--
-- Name: order_quote_items order_quote_items_select_stakeholders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_quote_items_select_stakeholders ON public.order_quote_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.order_quotes q
  WHERE (q.id = order_quote_items.quote_id))));


--
-- Name: order_quote_items order_quote_items_write_assigned_technician_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_quote_items_write_assigned_technician_draft ON public.order_quote_items TO authenticated USING ((EXISTS ( SELECT 1
   FROM ((public.order_quotes q
     JOIN public.service_orders o ON ((o.id = q.order_id)))
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((q.id = order_quote_items.quote_id) AND (q.status = 'draft'::text) AND (o.assigned_technician_id = p.technician_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ((public.order_quotes q
     JOIN public.service_orders o ON ((o.id = q.order_id)))
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((q.id = order_quote_items.quote_id) AND (q.status = 'draft'::text) AND (o.assigned_technician_id = p.technician_id)))));


--
-- Name: order_quotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_quotes ENABLE ROW LEVEL SECURITY;

--
-- Name: order_quotes order_quotes_delete_technician_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_quotes_delete_technician_draft ON public.order_quotes FOR DELETE TO authenticated USING (((status = 'draft'::text) AND (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_quotes.order_id) AND (o.assigned_technician_id = p.technician_id))))));


--
-- Name: order_quotes order_quotes_insert_assigned_technician; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_quotes_insert_assigned_technician ON public.order_quotes FOR INSERT TO authenticated WITH CHECK (((status = 'draft'::text) AND (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_quotes.order_id) AND (o.assigned_technician_id = p.technician_id) AND (o.work_mode = 'diagnosis'::text) AND (o.payment_status = 'deposit_paid'::text))))));


--
-- Name: order_quotes order_quotes_select_stakeholders; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_quotes_select_stakeholders ON public.order_quotes FOR SELECT TO authenticated USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.service_orders o
     LEFT JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_quotes.order_id) AND ((o.assigned_technician_id = p.technician_id) OR (o.customer_id = p.customer_id)))))));


--
-- Name: order_quotes order_quotes_update_customer_decision; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_quotes_update_customer_decision ON public.order_quotes FOR UPDATE TO authenticated USING (((status = 'sent'::text) AND (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_quotes.order_id) AND (o.customer_id = p.customer_id)))))) WITH CHECK (((status = ANY (ARRAY['accepted'::text, 'rejected'::text])) AND (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_quotes.order_id) AND (o.customer_id = p.customer_id))))));


--
-- Name: order_quotes order_quotes_update_technician_draft; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_quotes_update_technician_draft ON public.order_quotes FOR UPDATE TO authenticated USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_quotes.order_id) AND (o.assigned_technician_id = p.technician_id) AND (order_quotes.status = 'draft'::text)))))) WITH CHECK ((public.is_admin() OR ((status = ANY (ARRAY['draft'::text, 'sent'::text])) AND (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.id = order_quotes.order_id) AND (o.assigned_technician_id = p.technician_id) AND (o.work_mode = 'diagnosis'::text) AND (o.payment_status = 'deposit_paid'::text)))))));


--
-- Name: order_signatures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_signatures ENABLE ROW LEVEL SECURITY;

--
-- Name: order_signatures order_signatures_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_signatures_select ON public.order_signatures FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_signatures.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (o.customer_id = ( SELECT profiles.customer_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_signatures order_signatures_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_signatures_write ON public.order_signatures TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_signatures.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (o.customer_id = ( SELECT profiles.customer_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_signatures.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (o.customer_id = ( SELECT profiles.customer_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_time_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.order_time_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: order_time_logs order_time_logs_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_time_logs_select ON public.order_time_logs FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_time_logs.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))) OR (o.customer_id = ( SELECT profiles.customer_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: order_time_logs order_time_logs_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY order_time_logs_write ON public.order_time_logs TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_time_logs.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = order_time_logs.order_id) AND (public.is_admin() OR (o.assigned_technician_id = ( SELECT profiles.technician_id
           FROM public.profiles
          WHERE (profiles.id = auth.uid()))))))));


--
-- Name: payment_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_transactions payment_transactions_select_admin_or_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_transactions_select_admin_or_owner ON public.payment_transactions FOR SELECT TO authenticated USING ((public.is_admin() OR (EXISTS ( SELECT 1
   FROM (public.service_orders so
     JOIN public.profiles p ON ((p.id = auth.uid())))
  WHERE ((so.id = payment_transactions.order_id) AND (so.customer_id = p.customer_id))))));


--
-- Name: technician_payout_batch_audit payout_batch_audit_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payout_batch_audit_admin_read ON public.technician_payout_batch_audit FOR SELECT TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: technician_payout_batches payout_batches_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payout_batches_admin_all ON public.technician_payout_batches TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: technician_payout_batches payout_batches_technician_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payout_batches_technician_read ON public.technician_payout_batches FOR SELECT TO authenticated USING ((technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));


--
-- Name: price_adjustments_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.price_adjustments_log ENABLE ROW LEVEL SECURITY;

--
-- Name: price_adjustments_log price_adjustments_log_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY price_adjustments_log_admin_all ON public.price_adjustments_log TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_select_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.is_admin()));


--
-- Name: profiles profiles_update_own_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_update_own_or_admin ON public.profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR public.is_admin())) WITH CHECK (((id = auth.uid()) OR public.is_admin()));


--
-- Name: rubro_matricula_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rubro_matricula_config ENABLE ROW LEVEL SECURITY;

--
-- Name: rubro_matricula_config rubro_matricula_config_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY rubro_matricula_config_read ON public.rubro_matricula_config FOR SELECT TO authenticated USING (true);


--
-- Name: service_categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

--
-- Name: service_categories service_categories_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_categories_admin_write ON public.service_categories TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: service_categories service_categories_read_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_categories_read_authenticated ON public.service_categories FOR SELECT TO authenticated USING (((is_active AND (EXISTS ( SELECT 1
   FROM public.service_rubros r
  WHERE ((r.id = service_categories.rubro_id) AND r.is_active)))) OR public.is_admin()));


--
-- Name: service_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: service_orders service_orders_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_orders_delete_admin ON public.service_orders FOR DELETE TO authenticated USING (public.is_admin());


--
-- Name: service_orders service_orders_delete_customer_cancelled; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_orders_delete_customer_cancelled ON public.service_orders FOR DELETE TO authenticated USING (((status = 'cancelled'::public.order_status) AND (customer_id = ( SELECT profiles.customer_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: service_orders service_orders_insert_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_orders_insert_admin ON public.service_orders FOR INSERT TO authenticated WITH CHECK (public.is_admin());


--
-- Name: service_orders service_orders_insert_customer_request; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_orders_insert_customer_request ON public.service_orders FOR INSERT TO authenticated WITH CHECK (((customer_id IN ( SELECT c.id
   FROM public.customers c
  WHERE (c.profile_id = ( SELECT auth.uid() AS uid)))) AND (assigned_technician_id IS NULL) AND (assigned_technician_name IS NULL) AND ((status)::text = 'assigned'::text) AND (service_status = 'pending'::text) AND (quote_status = 'none'::text) AND (payment_status = 'pending'::text) AND (work_mode = ANY (ARRAY['diagnosis'::text, 'direct'::text])) AND (COALESCE(total_paid_amount, (0)::numeric) = (0)::numeric) AND (COALESCE(extra_amount, (0)::numeric) = (0)::numeric)));


--
-- Name: service_orders service_orders_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_orders_select_scoped ON public.service_orders FOR SELECT TO authenticated USING ((public.is_admin() OR (assigned_technician_id = ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (customer_id = ( SELECT profiles.customer_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: service_orders service_orders_update_admin_or_tech; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_orders_update_admin_or_tech ON public.service_orders FOR UPDATE TO authenticated USING ((public.is_admin() OR (assigned_technician_id = ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))))) WITH CHECK ((public.is_admin() OR (assigned_technician_id = ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = auth.uid())))));


--
-- Name: service_rubros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.service_rubros ENABLE ROW LEVEL SECURITY;

--
-- Name: service_rubros service_rubros_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_rubros_admin_write ON public.service_rubros TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: service_rubros service_rubros_read_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY service_rubros_read_authenticated ON public.service_rubros FOR SELECT TO authenticated USING ((is_active OR public.is_admin()));


--
-- Name: services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

--
-- Name: services services_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_select_anon ON public.services FOR SELECT TO anon USING ((active = true));


--
-- Name: services services_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_select_authenticated ON public.services FOR SELECT TO authenticated USING (true);


--
-- Name: services services_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY services_write_admin ON public.services TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: subcategories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;

--
-- Name: subcategories subcategories_select_anon; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subcategories_select_anon ON public.subcategories FOR SELECT TO anon USING ((is_active = true));


--
-- Name: subcategories subcategories_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subcategories_select_authenticated ON public.subcategories FOR SELECT TO authenticated USING (true);


--
-- Name: subcategories subcategories_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY subcategories_write_admin ON public.subcategories TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: support_case_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_case_history ENABLE ROW LEVEL SECURITY;

--
-- Name: support_case_history support_case_history_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_case_history_admin_all ON public.support_case_history TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: support_case_history support_case_history_insert_stakeholder; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_case_history_insert_stakeholder ON public.support_case_history FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.support_cases sc
  WHERE ((sc.id = support_case_history.case_id) AND ((sc.customer_id = ( SELECT p.customer_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid)))) OR (sc.technician_id = ( SELECT p.technician_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid)))))))));


--
-- Name: support_case_history support_case_history_select_stakeholder; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_case_history_select_stakeholder ON public.support_case_history FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.support_cases sc
  WHERE ((sc.id = support_case_history.case_id) AND ((sc.customer_id = ( SELECT p.customer_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid)))) OR (sc.technician_id = ( SELECT p.technician_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid)))))))));


--
-- Name: support_case_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_case_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: support_case_messages support_case_messages_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_case_messages_admin_all ON public.support_case_messages TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: support_case_messages support_case_messages_insert_stakeholder; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_case_messages_insert_stakeholder ON public.support_case_messages FOR INSERT TO authenticated WITH CHECK (((is_internal = false) AND (((sender_type = 'client'::text) AND (EXISTS ( SELECT 1
   FROM public.support_cases sc
  WHERE ((sc.id = support_case_messages.case_id) AND (sc.customer_id = ( SELECT p.customer_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid)))))))) OR ((sender_type = 'technician'::text) AND (EXISTS ( SELECT 1
   FROM public.support_cases sc
  WHERE ((sc.id = support_case_messages.case_id) AND (sc.technician_id = ( SELECT p.technician_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid)))))))))));


--
-- Name: support_case_messages support_case_messages_select_stakeholder; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_case_messages_select_stakeholder ON public.support_case_messages FOR SELECT TO authenticated USING (((is_internal = false) AND (EXISTS ( SELECT 1
   FROM public.support_cases sc
  WHERE ((sc.id = support_case_messages.case_id) AND ((sc.customer_id = ( SELECT p.customer_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid)))) OR (sc.technician_id = ( SELECT p.technician_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid))))))))));


--
-- Name: support_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: support_cases support_cases_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_cases_admin_all ON public.support_cases TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: support_cases support_cases_insert_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_cases_insert_customer ON public.support_cases FOR INSERT TO authenticated WITH CHECK (((customer_id = ( SELECT p.customer_id
   FROM public.profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid)))) AND (order_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.service_orders o
  WHERE ((o.id = support_cases.order_id) AND (o.customer_id = ( SELECT p.customer_id
           FROM public.profiles p
          WHERE (p.id = ( SELECT auth.uid() AS uid)))))))));


--
-- Name: support_cases support_cases_select_customer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_cases_select_customer ON public.support_cases FOR SELECT TO authenticated USING ((customer_id = ( SELECT p.customer_id
   FROM public.profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid)))));


--
-- Name: support_cases support_cases_select_technician; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY support_cases_select_technician ON public.support_cases FOR SELECT TO authenticated USING ((technician_id = ( SELECT p.technician_id
   FROM public.profiles p
  WHERE (p.id = ( SELECT auth.uid() AS uid)))));


--
-- Name: system_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings system_settings_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_admin_all ON public.system_settings TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: system_settings_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.system_settings_history ENABLE ROW LEVEL SECURITY;

--
-- Name: system_settings_history system_settings_history_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_history_admin_read ON public.system_settings_history FOR SELECT TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: system_settings system_settings_select_authenticated; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_select_authenticated ON public.system_settings FOR SELECT TO authenticated USING ((visibility = ANY (ARRAY['public'::text, 'authenticated'::text])));


--
-- Name: system_settings system_settings_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY system_settings_select_public ON public.system_settings FOR SELECT TO authenticated, anon USING ((visibility = 'public'::text));


--
-- Name: technician_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_applications technician_applications_admin_manage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_applications_admin_manage ON public.technician_applications TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: technician_applications technician_applications_insert_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_applications_insert_public ON public.technician_applications FOR INSERT TO authenticated, anon WITH CHECK (((status = 'pending'::text) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL)));


--
-- Name: technician_documents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_documents ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_documents technician_documents_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_documents_owner_or_admin ON public.technician_documents TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: technician_enablement_checklist technician_enablement_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_enablement_admin_write ON public.technician_enablement_checklist FOR UPDATE TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: technician_enablement_checklist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_enablement_checklist ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_enablement_checklist technician_enablement_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_enablement_owner_or_admin ON public.technician_enablement_checklist FOR SELECT TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: technician_goals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_goals ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_goals technician_goals_admin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_goals_admin_read ON public.technician_goals FOR SELECT TO authenticated USING (( SELECT public.is_admin() AS is_admin));


--
-- Name: technician_goals technician_goals_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_goals_owner ON public.technician_goals TO authenticated USING ((technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));


--
-- Name: technician_matriculas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_matriculas ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_matriculas technician_matriculas_customer_assigned_approved; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_matriculas_customer_assigned_approved ON public.technician_matriculas FOR SELECT TO authenticated USING (((validation_status = 'approved'::text) AND (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.assigned_technician_id = technician_matriculas.technician_id) AND (o.customer_id = p.customer_id))))));


--
-- Name: technician_matriculas technician_matriculas_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_matriculas_owner_or_admin ON public.technician_matriculas TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: technician_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_notifications technician_notifications_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_notifications_admin_write ON public.technician_notifications TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: technician_notifications technician_notifications_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_notifications_owner_or_admin ON public.technician_notifications FOR SELECT TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: technician_notifications technician_notifications_owner_read_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_notifications_owner_read_update ON public.technician_notifications FOR UPDATE TO authenticated USING ((technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));


--
-- Name: technician_payment_accounts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_payment_accounts ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_payment_accounts technician_payment_accounts_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_payment_accounts_owner_or_admin ON public.technician_payment_accounts TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: technician_payout_batch_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_payout_batch_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_payout_batches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_payout_batches ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_requirements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_requirements ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_requirements technician_requirements_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_requirements_admin_write ON public.technician_requirements TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: technician_requirements technician_requirements_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_requirements_owner_or_admin ON public.technician_requirements FOR SELECT TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: technician_review_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_review_history ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_review_history technician_review_history_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_review_history_admin_write ON public.technician_review_history FOR INSERT TO authenticated WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: technician_review_history technician_review_history_owner_or_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_review_history_owner_or_admin ON public.technician_review_history FOR SELECT TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: technician_settlements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technician_settlements ENABLE ROW LEVEL SECURITY;

--
-- Name: technician_settlements technician_settlements_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_settlements_admin_all ON public.technician_settlements TO authenticated USING (( SELECT public.is_admin() AS is_admin)) WITH CHECK (( SELECT public.is_admin() AS is_admin));


--
-- Name: technician_settlements technician_settlements_own_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technician_settlements_own_read ON public.technician_settlements FOR SELECT TO authenticated USING ((technician_id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))));


--
-- Name: technicians; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;

--
-- Name: technicians technicians_select_scoped; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technicians_select_scoped ON public.technicians FOR SELECT TO authenticated USING ((public.is_admin() OR (id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM (public.service_orders o
     JOIN public.profiles p ON ((p.id = ( SELECT auth.uid() AS uid))))
  WHERE ((o.assigned_technician_id = technicians.id) AND (o.customer_id = p.customer_id))))));


--
-- Name: technicians technicians_update_own_professional_profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technicians_update_own_professional_profile ON public.technicians FOR UPDATE TO authenticated USING ((( SELECT public.is_admin() AS is_admin) OR (id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid)))))) WITH CHECK ((( SELECT public.is_admin() AS is_admin) OR (id IN ( SELECT profiles.technician_id
   FROM public.profiles
  WHERE (profiles.id = ( SELECT auth.uid() AS uid))))));


--
-- Name: technicians technicians_write_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY technicians_write_admin ON public.technicians TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- PostgreSQL database dump complete
--


