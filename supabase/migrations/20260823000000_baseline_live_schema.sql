


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."material_category" AS ENUM (
    'Fijaciones',
    'Electricidad',
    'Plomería',
    'Ferretería',
    'Insumos'
);


ALTER TYPE "public"."material_category" OWNER TO "postgres";


CREATE TYPE "public"."order_event_type" AS ENUM (
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


ALTER TYPE "public"."order_event_type" OWNER TO "postgres";


CREATE TYPE "public"."order_priority" AS ENUM (
    'baja',
    'media',
    'alta',
    'urgente'
);


ALTER TYPE "public"."order_priority" OWNER TO "postgres";


CREATE TYPE "public"."order_status" AS ENUM (
    'assigned',
    'in_progress',
    'paused',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."order_status" OWNER TO "postgres";


CREATE TYPE "public"."service_type" AS ENUM (
    'Plomería',
    'Electricidad',
    'Reparaciones del hogar',
    'Mantenimiento general',
    'Instalación de equipos',
    'Cerrajería',
    'Refrigeración',
    'Soldadura'
);


ALTER TYPE "public"."service_type" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'technician',
    'customer'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_catalog_price_to_quote_item"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."apply_catalog_price_to_quote_item"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "public"."user_role"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_service_order_pricing"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."enforce_service_order_pricing"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_account_invite"("p_token" "text") RETURNS TABLE("kind" "text", "email" "text", "full_name" "text", "expires_at" timestamp with time zone, "already_used" boolean)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."get_account_invite"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_technician_admin_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."lock_technician_admin_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_technician_review_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."lock_technician_review_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_sent_quote_content_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."prevent_sent_quote_content_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_sent_quote_item_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."prevent_sent_quote_item_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_unpaid_execution_timer"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."prevent_unpaid_execution_timer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."protect_admin_order_control_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."protect_admin_order_control_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."redeem_account_invite"("p_token" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."redeem_account_invite"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."release_due_technician_settlements"() RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


ALTER FUNCTION "public"."release_due_technician_settlements"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_eligible_technician_assignment"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.assigned_technician_id is not null and new.assigned_technician_id is distinct from old.assigned_technician_id then
    if not exists (
      select 1 from public.technicians t
      where t.id = new.assigned_technician_id and t.validation_status = 'approved' and t.can_receive_orders = true
    ) then
      raise exception 'El técnico no está habilitado para recibir órdenes';
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."require_eligible_technician_assignment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."start_execution_after_payment_confirmation"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."start_execution_after_payment_confirmation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_accepted_quote_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    update public.service_orders set quote_status = 'accepted' where id = new.order_id;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_accepted_quote_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_quote_totals_from_items"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."sync_quote_totals_from_items"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_rejected_quote_order_state"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
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


ALTER FUNCTION "public"."sync_rejected_quote_order_state"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_service_order_quote_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  update public.service_orders set quote_status = new.status where id = new.order_id;
  return new;
end;
$$;


ALTER FUNCTION "public"."sync_service_order_quote_status"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."account_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(24), 'hex'::"text") NOT NULL,
    "kind" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL,
    "used_at" timestamp with time zone,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "account_invites_kind_check" CHECK (("kind" = ANY (ARRAY['technician'::"text", 'customer'::"text"])))
);


ALTER TABLE "public"."account_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "icon" "text",
    "description" "text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "label" "text",
    "address_line" "text" NOT NULL,
    "neighborhood" "text",
    "city" "text" DEFAULT 'CABA'::"text" NOT NULL,
    "postal_code" "text",
    "lat" numeric(10,7),
    "lng" numeric(10,7),
    "is_default" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customer_addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_admin_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "note" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "customer_admin_notes_note_check" CHECK ((("length"(TRIM(BOTH FROM "note")) >= 1) AND ("length"(TRIM(BOTH FROM "note")) <= 4000)))
);


ALTER TABLE "public"."customer_admin_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "address" "text" DEFAULT ''::"text" NOT NULL,
    "neighborhood" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "province" "text",
    "customer_number" integer NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "service_type" "public"."service_type" NOT NULL,
    "priority" "public"."order_priority" DEFAULT 'media'::"public"."order_priority" NOT NULL,
    "status" "public"."order_status" DEFAULT 'assigned'::"public"."order_status" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_at" timestamp with time zone,
    "customer_id" "uuid" NOT NULL,
    "client_name" "text" NOT NULL,
    "client_phone" "text" DEFAULT ''::"text" NOT NULL,
    "client_address" "text" DEFAULT ''::"text" NOT NULL,
    "client_neighborhood" "text" DEFAULT ''::"text" NOT NULL,
    "assigned_technician_id" "uuid",
    "assigned_technician_name" "text",
    "work_started_at" timestamp with time zone,
    "work_elapsed_seconds" bigint DEFAULT 0 NOT NULL,
    "work_mode" "text" DEFAULT 'diagnosis'::"text" NOT NULL,
    "service_status" "text" NOT NULL,
    "quote_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "visit_deposit_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_quoted_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_paid_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "extra_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "cancellation_reason" "text",
    "cancelled_at" timestamp with time zone,
    "cancelled_by" "uuid",
    "admin_incident_status" "text" DEFAULT 'none'::"text" NOT NULL,
    "admin_incident_reason" "text",
    "admin_incident_opened_at" timestamp with time zone,
    "admin_incident_opened_by" "uuid",
    "admin_incident_resolved_at" timestamp with time zone,
    "admin_incident_resolved_by" "uuid",
    "admin_exception_reason" "text",
    "admin_exception_closed_at" timestamp with time zone,
    "admin_exception_closed_by" "uuid",
    "guest_access_token" "text",
    "archived_at" timestamp with time zone,
    "fixed_price_service_id" "uuid",
    "fixed_price_quantity" integer,
    "client_province" "text",
    CONSTRAINT "service_orders_admin_incident_status_check" CHECK (("admin_incident_status" = ANY (ARRAY['none'::"text", 'open'::"text", 'resolved'::"text"]))),
    CONSTRAINT "service_orders_fixed_price_quantity_check" CHECK ((("fixed_price_quantity" IS NULL) OR (("fixed_price_quantity" >= 1) AND ("fixed_price_quantity" <= 20)))),
    CONSTRAINT "service_orders_non_negative_money_check" CHECK ((("visit_deposit_amount" >= (0)::numeric) AND ("total_quoted_amount" >= (0)::numeric) AND ("total_paid_amount" >= (0)::numeric) AND ("extra_amount" >= (0)::numeric))),
    CONSTRAINT "service_orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['pending'::"text", 'deposit_paid'::"text", 'balance_pending'::"text", 'paid_in_full'::"text", 'refunded'::"text"]))),
    CONSTRAINT "service_orders_quote_status_check" CHECK (("quote_status" = ANY (ARRAY['none'::"text", 'draft'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text"]))),
    CONSTRAINT "service_orders_service_status_check" CHECK (("service_status" = ANY (ARRAY['pending'::"text", 'assigned'::"text", 'en_route'::"text", 'in_progress'::"text", 'paused'::"text", 'completed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "service_orders_work_mode_check" CHECK (("work_mode" = ANY (ARRAY['diagnosis'::"text", 'direct'::"text"])))
);


ALTER TABLE "public"."service_orders" OWNER TO "postgres";


COMMENT ON COLUMN "public"."service_orders"."work_started_at" IS 'Momento en que el cronómetro está corriendo. NULL cuando está pausado o finalizado.';



COMMENT ON COLUMN "public"."service_orders"."work_elapsed_seconds" IS 'Segundos acumulados de trabajo antes de la última pausa o finalización.';



COMMENT ON COLUMN "public"."service_orders"."guest_access_token" IS 'Opaque token for unauthenticated guest checkout order tracking. Only set for orders created via api/orders/guest-checkout.ts. Looked up exclusively through server endpoints using the service-role key — never exposed via client-side RLS.';



CREATE OR REPLACE VIEW "public"."customer_summary" WITH ("security_invoker"='true') AS
 SELECT "c"."id",
    "c"."profile_id",
    "c"."name" AS "full_name",
    "c"."email",
    "c"."phone",
    "count"("so"."id") FILTER (WHERE ("so"."status" = 'completed'::"public"."order_status")) AS "completed_orders",
    "count"("so"."id") AS "total_orders",
    COALESCE("sum"("so"."total_paid_amount") FILTER (WHERE ("so"."status" = 'completed'::"public"."order_status")), (0)::numeric) AS "total_spent",
    "count"("so"."id") FILTER (WHERE (("so"."status" = 'completed'::"public"."order_status") AND ("so"."completed_at" IS NOT NULL) AND (("so"."completed_at" + '30 days'::interval) > "now"()))) AS "active_warranties",
    "max"("so"."created_at") AS "last_order_date"
   FROM ("public"."customers" "c"
     LEFT JOIN "public"."service_orders" "so" ON (("so"."customer_id" = "c"."id")))
  GROUP BY "c"."id", "c"."profile_id", "c"."name", "c"."email", "c"."phone";


ALTER VIEW "public"."customer_summary" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."customers_customer_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."customers_customer_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."customers_customer_number_seq" OWNED BY "public"."customers"."customer_number";



CREATE TABLE IF NOT EXISTS "public"."guest_checkout_drafts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "guest_access_token" "text" DEFAULT ("gen_random_uuid"())::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_type" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "payload" "jsonb" NOT NULL,
    "mp_preference_id" "text",
    "mp_payment_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "guest_checkout_drafts_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "guest_checkout_drafts_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['visit_deposit'::"text", 'full_advance'::"text"]))),
    CONSTRAINT "guest_checkout_drafts_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."guest_checkout_drafts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."materials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "category" "public"."material_category" NOT NULL,
    "stock" integer DEFAULT 0 NOT NULL,
    "unit" "text" DEFAULT 'u'::"text" NOT NULL,
    "cost_estimate" numeric(12,2) DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "materials_stock_check" CHECK (("stock" >= 0))
);


ALTER TABLE "public"."materials" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_checklist_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "completed" boolean DEFAULT false NOT NULL,
    "completed_at" timestamp with time zone,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."order_checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_diagnosis_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "storage_path" "text" NOT NULL,
    "caption" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_diagnosis_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "type" "public"."order_event_type" NOT NULL,
    "description" "text" NOT NULL,
    "author" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_materials_used" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "material_id" "uuid",
    "material_name" "text" NOT NULL,
    "quantity" numeric(12,2) NOT NULL,
    "unit" "text" DEFAULT 'u'::"text" NOT NULL,
    "note" "text",
    "added_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_materials_used_quantity_check" CHECK (("quantity" > (0)::numeric))
);


ALTER TABLE "public"."order_materials_used" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "author" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_quote_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "quote_id" "uuid" NOT NULL,
    "item_type" "text" NOT NULL,
    "description" "text" NOT NULL,
    "quantity" numeric(12,3) DEFAULT 1 NOT NULL,
    "unit" "text" DEFAULT 'unidad'::"text" NOT NULL,
    "unit_price" numeric(12,2) NOT NULL,
    "subtotal" numeric(12,2) GENERATED ALWAYS AS ("round"(("quantity" * "unit_price"), 2)) STORED,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "category_id" "uuid",
    "notes" "text",
    "service_id" "uuid",
    CONSTRAINT "order_quote_items_description_check" CHECK (("char_length"(TRIM(BOTH FROM "description")) > 0)),
    CONSTRAINT "order_quote_items_item_type_check" CHECK (("item_type" = ANY (ARRAY['labor'::"text", 'material'::"text"]))),
    CONSTRAINT "order_quote_items_quantity_check" CHECK (("quantity" > (0)::numeric)),
    CONSTRAINT "order_quote_items_unit_price_check" CHECK (("unit_price" >= (0)::numeric))
);


ALTER TABLE "public"."order_quote_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "version" integer NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "notes" "text",
    "subtotal_labor" numeric(12,2) DEFAULT 0 NOT NULL,
    "subtotal_materials" numeric(12,2) DEFAULT 0 NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "visit_deposit_credit" numeric(12,2) DEFAULT 0 NOT NULL,
    "remaining_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "currency" "text" DEFAULT 'ARS'::"text" NOT NULL,
    "valid_until" timestamp with time zone,
    "created_by" "uuid",
    "sent_at" timestamp with time zone,
    "accepted_at" timestamp with time zone,
    "rejected_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_quotes_currency_check" CHECK (("currency" = 'ARS'::"text")),
    CONSTRAINT "order_quotes_remaining_amount_check" CHECK (("remaining_amount" >= (0)::numeric)),
    CONSTRAINT "order_quotes_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text", 'accepted'::"text", 'rejected'::"text"]))),
    CONSTRAINT "order_quotes_subtotal_labor_check" CHECK (("subtotal_labor" >= (0)::numeric)),
    CONSTRAINT "order_quotes_subtotal_materials_check" CHECK (("subtotal_materials" >= (0)::numeric)),
    CONSTRAINT "order_quotes_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "order_quotes_visit_deposit_credit_check" CHECK (("visit_deposit_credit" >= (0)::numeric))
);


ALTER TABLE "public"."order_quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_signatures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "signer_name" "text" NOT NULL,
    "signature_data_url" "text" NOT NULL,
    "comments" "text",
    "signed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."order_signatures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_time_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "minutes" integer NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "technician_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "order_time_logs_minutes_check" CHECK (("minutes" > 0))
);


ALTER TABLE "public"."order_time_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "payment_type" "text" NOT NULL,
    "provider" "text" DEFAULT 'mercadopago'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "currency" "text" DEFAULT 'ARS'::"text" NOT NULL,
    "mp_preference_id" "text",
    "mp_payment_id" "text",
    "mp_payment_method" "text",
    "mp_installments" integer,
    "mp_fee_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "provider_payload" "jsonb",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payment_transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "payment_transactions_currency_check" CHECK (("currency" = 'ARS'::"text")),
    CONSTRAINT "payment_transactions_mp_fee_amount_check" CHECK (("mp_fee_amount" >= (0)::numeric)),
    CONSTRAINT "payment_transactions_payment_type_check" CHECK (("payment_type" = ANY (ARRAY['visit_deposit'::"text", 'balance_payment'::"text", 'full_advance'::"text", 'extra_payment'::"text"]))),
    CONSTRAINT "payment_transactions_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text", 'cancelled'::"text", 'refunded'::"text"])))
);


ALTER TABLE "public"."payment_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."price_adjustments_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_filter" "text",
    "percentage" numeric NOT NULL,
    "rounding_mode" "text" NOT NULL,
    "services_affected" integer DEFAULT 0 NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "applied_by" "uuid"
);


ALTER TABLE "public"."price_adjustments_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'customer'::"public"."user_role" NOT NULL,
    "avatar_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "technician_id" "uuid",
    "customer_id" "uuid",
    "avatar_url" "text"
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."rubro_matricula_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rubro_key" "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "requires_matricula" boolean DEFAULT false NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."rubro_matricula_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "rubro_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "description" "text",
    "base_price" numeric(12,2) NOT NULL,
    "unit" "text" DEFAULT 'servicio'::"text" NOT NULL,
    "unit_type" "text" DEFAULT 'servicio'::"text" NOT NULL,
    "estimated_duration_minutes" integer,
    "materials_included" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_categories_base_price_check" CHECK (("base_price" >= (0)::numeric)),
    CONSTRAINT "service_categories_estimated_duration_minutes_check" CHECK ((("estimated_duration_minutes" IS NULL) OR ("estimated_duration_minutes" > 0))),
    CONSTRAINT "service_categories_name_check" CHECK (("char_length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "service_categories_unit_type_check" CHECK (("unit_type" = ANY (ARRAY['servicio'::"text", 'por_hora'::"text", 'por_metro'::"text", 'por_unidad'::"text", 'por_circuito'::"text", 'estimado'::"text"])))
);


ALTER TABLE "public"."service_categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_rubros" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "icon" "text",
    "visit_deposit" numeric(12,2) DEFAULT 0 NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "service_rubros_name_check" CHECK (("char_length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "service_rubros_slug_check" CHECK (("slug" ~ '^[a-z0-9-]+$'::"text")),
    CONSTRAINT "service_rubros_visit_deposit_check" CHECK (("visit_deposit" >= (0)::numeric))
);


ALTER TABLE "public"."service_rubros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."services" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "price" numeric DEFAULT 0 NOT NULL,
    "category" "text" DEFAULT 'General'::"text" NOT NULL,
    "estimated_duration_minutes" integer DEFAULT 60 NOT NULL,
    "features" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subcategoria" "text",
    "category_id" "uuid",
    "subcategory_id" "uuid",
    CONSTRAINT "services_estimated_duration_minutes_check" CHECK (("estimated_duration_minutes" > 0)),
    CONSTRAINT "services_name_check" CHECK (("char_length"(TRIM(BOTH FROM "name")) > 0)),
    CONSTRAINT "services_price_check" CHECK (("price" >= (0)::numeric))
);


ALTER TABLE "public"."services" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subcategories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "slug" "text" NOT NULL,
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."subcategories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_settings" (
    "key" "text" NOT NULL,
    "value" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."system_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_applications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "specialty" "text" NOT NULL,
    "message" "text",
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    CONSTRAINT "technician_applications_email_check" CHECK (("char_length"(TRIM(BOTH FROM "email")) > 0)),
    CONSTRAINT "technician_applications_full_name_check" CHECK (("char_length"(TRIM(BOTH FROM "full_name")) > 0)),
    CONSTRAINT "technician_applications_phone_check" CHECK (("char_length"(TRIM(BOTH FROM "phone")) > 0)),
    CONSTRAINT "technician_applications_specialty_check" CHECK (("char_length"(TRIM(BOTH FROM "specialty")) > 0)),
    CONSTRAINT "technician_applications_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."technician_applications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "document_type" "text" NOT NULL,
    "label" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "issuer_name" "text",
    "issued_at" "date",
    "version" integer DEFAULT 1 NOT NULL,
    "is_current" boolean DEFAULT true NOT NULL,
    "validation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "validation_notes" "text",
    "validated_at" timestamp with time zone,
    "validated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "technician_documents_document_type_check" CHECK (("document_type" = ANY (ARRAY['monotributo'::"text", 'identity'::"text", 'degree'::"text", 'certificate'::"text", 'license_support'::"text"]))),
    CONSTRAINT "technician_documents_validation_status_check" CHECK (("validation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'observed'::"text", 'replaced'::"text"]))),
    CONSTRAINT "technician_documents_version_check" CHECK (("version" > 0))
);


ALTER TABLE "public"."technician_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_enablement_checklist" (
    "technician_id" "uuid" NOT NULL,
    "profile_complete" boolean DEFAULT false NOT NULL,
    "identity_verified" boolean DEFAULT false NOT NULL,
    "tax_document_approved" boolean DEFAULT false NOT NULL,
    "payment_account_valid" boolean DEFAULT false NOT NULL,
    "professional_license_valid" boolean DEFAULT false NOT NULL,
    "is_ready" boolean DEFAULT false NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."technician_enablement_checklist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_goals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "goal_type" "text" NOT NULL,
    "target_amount" numeric(12,2),
    "target_count" integer,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "technician_goals_goal_type_check" CHECK (("goal_type" = ANY (ARRAY['monthly_earnings'::"text", 'monthly_jobs'::"text", 'weekly_jobs'::"text"]))),
    CONSTRAINT "technician_goals_target_amount_check" CHECK ((("target_amount" IS NULL) OR ("target_amount" > (0)::numeric))),
    CONSTRAINT "technician_goals_target_count_check" CHECK ((("target_count" IS NULL) OR ("target_count" > 0)))
);


ALTER TABLE "public"."technician_goals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_matriculas" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "issuing_entity" "text" NOT NULL,
    "license_number" "text" NOT NULL,
    "specialty" "text",
    "expires_at" "date",
    "validation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "validation_notes" "text",
    "validated_at" timestamp with time zone,
    "validated_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "technician_matriculas_validation_status_check" CHECK (("validation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'observed'::"text", 'expired'::"text"])))
);


ALTER TABLE "public"."technician_matriculas" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "kind" "text" DEFAULT 'info'::"text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "technician_notifications_kind_check" CHECK (("kind" = ANY (ARRAY['success'::"text", 'warning'::"text", 'error'::"text", 'info'::"text"])))
);


ALTER TABLE "public"."technician_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_payment_accounts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "account_holder" "text" NOT NULL,
    "cbu_cvu" "text" NOT NULL,
    "alias" "text",
    "provider" "text" DEFAULT 'bank'::"text" NOT NULL,
    "validation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "validation_notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "technician_payment_accounts_cbu_cvu_check" CHECK (("cbu_cvu" ~ '^[0-9]{22}$'::"text")),
    CONSTRAINT "technician_payment_accounts_provider_check" CHECK (("provider" = ANY (ARRAY['bank'::"text", 'mercadopago'::"text", 'other'::"text"]))),
    CONSTRAINT "technician_payment_accounts_validation_status_check" CHECK (("validation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'observed'::"text"])))
);


ALTER TABLE "public"."technician_payment_accounts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_payout_batches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "scheduled_date" timestamp with time zone,
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "total_amount" numeric(12,2) NOT NULL,
    "settlement_count" integer NOT NULL,
    "transfer_method" "text",
    "destination_last4" "text",
    "transfer_reference" "text",
    "receipt_url" "text",
    "receipt_uploaded_at" timestamp with time zone,
    "created_by" "uuid",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "admin_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "technician_payout_batches_settlement_count_check" CHECK (("settlement_count" > 0)),
    CONSTRAINT "technician_payout_batches_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'in_progress'::"text", 'completed'::"text", 'failed'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "technician_payout_batches_total_amount_check" CHECK (("total_amount" >= (0)::numeric)),
    CONSTRAINT "technician_payout_batches_transfer_method_check" CHECK (("transfer_method" = ANY (ARRAY['bank_transfer'::"text", 'mercadopago'::"text", 'cash'::"text"])))
);


ALTER TABLE "public"."technician_payout_batches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technicians" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "name" "text" NOT NULL,
    "specialty" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "email" "text" DEFAULT ''::"text" NOT NULL,
    "rating" numeric(3,2) DEFAULT 5.00 NOT NULL,
    "avatar_bg" "text" DEFAULT 'bg-sky-600'::"text" NOT NULL,
    "active_orders_count" integer DEFAULT 0 NOT NULL,
    "completed_orders_count" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "zone" "text" DEFAULT ''::"text" NOT NULL,
    "province" "text" DEFAULT ''::"text" NOT NULL,
    "work_phone" "text",
    "bio" "text",
    "education_level" "text",
    "degree_title" "text",
    "institution_name" "text",
    "public_avatar_path" "text",
    "validation_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "validation_notes" "text",
    "validated_at" timestamp with time zone,
    "validated_by" "uuid",
    "is_enabled" boolean DEFAULT false NOT NULL,
    "can_receive_orders" boolean DEFAULT false NOT NULL,
    "technician_number" integer NOT NULL,
    CONSTRAINT "technicians_education_level_check" CHECK ((("education_level" IS NULL) OR ("education_level" = ANY (ARRAY['idoneo'::"text", 'curso_certificado'::"text", 'tecnico'::"text", 'tecnico_superior'::"text", 'ingeniero'::"text", 'otro'::"text"])))),
    CONSTRAINT "technicians_rating_check" CHECK ((("rating" >= (0)::numeric) AND ("rating" <= (5)::numeric))),
    CONSTRAINT "technicians_validation_status_check" CHECK (("validation_status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'observed'::"text", 'suspended'::"text"])))
);


ALTER TABLE "public"."technicians" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."technician_public_view" WITH ("security_invoker"='false') AS
 SELECT "id",
    "name",
    "specialty",
    "rating",
    "completed_orders_count",
    "public_avatar_path",
    "bio",
    "education_level",
    "degree_title",
    "institution_name",
    "validation_status",
    COALESCE(( SELECT "jsonb_agg"("jsonb_build_object"('issuing_entity', "m"."issuing_entity", 'license_number', "m"."license_number", 'specialty', "m"."specialty") ORDER BY "m"."created_at" DESC) AS "jsonb_agg"
           FROM "public"."technician_matriculas" "m"
          WHERE (("m"."technician_id" = "t"."id") AND ("m"."validation_status" = 'approved'::"text"))), '[]'::"jsonb") AS "validated_licenses"
   FROM "public"."technicians" "t"
  WHERE (( SELECT "public"."is_admin"() AS "is_admin") OR ("id" IN ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))) OR (EXISTS ( SELECT 1
           FROM ("public"."service_orders" "o"
             JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
          WHERE (("o"."assigned_technician_id" = "t"."id") AND ("o"."customer_id" = "p"."customer_id")))));


ALTER VIEW "public"."technician_public_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_requirements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "requirement_type" "text" NOT NULL,
    "is_required" boolean DEFAULT true NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "review_notes" "text",
    "reviewed_at" timestamp with time zone,
    "reviewed_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "technician_requirements_requirement_type_check" CHECK (("requirement_type" = ANY (ARRAY['profile_complete'::"text", 'education_verified'::"text", 'matricula_validated'::"text", 'monotributo_approved'::"text", 'identity_verified'::"text", 'bank_account_valid'::"text"]))),
    CONSTRAINT "technician_requirements_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'approved'::"text", 'observed'::"text", 'not_required'::"text"])))
);


ALTER TABLE "public"."technician_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_review_history" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "requirement_type" "text",
    "action" "text" NOT NULL,
    "reason" "text",
    "reviewed_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "technician_review_history_action_check" CHECK (("action" = ANY (ARRAY['requirement_approved'::"text", 'requirement_observed'::"text", 'requirement_not_required'::"text", 'technician_approved'::"text", 'technician_observed'::"text", 'technician_suspended'::"text"])))
);


ALTER TABLE "public"."technician_review_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."technician_settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "technician_id" "uuid" NOT NULL,
    "payment_transaction_id" "uuid",
    "settlement_type" "text" NOT NULL,
    "gross_amount" numeric(12,2) NOT NULL,
    "platform_commission_amount" numeric(12,2) NOT NULL,
    "payment_fee_amount" numeric(12,2) NOT NULL,
    "net_amount" numeric(12,2) NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "release_at" timestamp with time zone,
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "release_date" timestamp with time zone,
    "released_at" timestamp with time zone,
    "scheduled_date" timestamp with time zone,
    "transfer_reference" "text",
    "receipt_url" "text",
    "admin_notes" "text",
    "dispute_reason" "text",
    "resolved_at" timestamp with time zone,
    "payout_batch_id" "uuid",
    CONSTRAINT "technician_settlements_gross_amount_check" CHECK (("gross_amount" >= (0)::numeric)),
    CONSTRAINT "technician_settlements_net_amount_check" CHECK (("net_amount" >= (0)::numeric)),
    CONSTRAINT "technician_settlements_payment_fee_amount_check" CHECK (("payment_fee_amount" >= (0)::numeric)),
    CONSTRAINT "technician_settlements_platform_commission_amount_check" CHECK (("platform_commission_amount" >= (0)::numeric)),
    CONSTRAINT "technician_settlements_settlement_type_check" CHECK (("settlement_type" = ANY (ARRAY['completed_work'::"text", 'rejected_visit'::"text"]))),
    CONSTRAINT "technician_settlements_status_check" CHECK (("status" = ANY (ARRAY['pending_release'::"text", 'released'::"text", 'scheduled'::"text", 'in_transit'::"text", 'paid'::"text", 'in_review'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."technician_settlements" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."technicians_technician_number_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."technicians_technician_number_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."technicians_technician_number_seq" OWNED BY "public"."technicians"."technician_number";



ALTER TABLE ONLY "public"."customers" ALTER COLUMN "customer_number" SET DEFAULT "nextval"('"public"."customers_customer_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."technicians" ALTER COLUMN "technician_number" SET DEFAULT "nextval"('"public"."technicians_technician_number_seq"'::"regclass");



ALTER TABLE ONLY "public"."account_invites"
    ADD CONSTRAINT "account_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."account_invites"
    ADD CONSTRAINT "account_invites_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."customer_addresses"
    ADD CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_admin_notes"
    ADD CONSTRAINT "customer_admin_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_customer_number_key" UNIQUE ("customer_number");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."guest_checkout_drafts"
    ADD CONSTRAINT "guest_checkout_drafts_guest_access_token_key" UNIQUE ("guest_access_token");



ALTER TABLE ONLY "public"."guest_checkout_drafts"
    ADD CONSTRAINT "guest_checkout_drafts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."materials"
    ADD CONSTRAINT "materials_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_checklist_items"
    ADD CONSTRAINT "order_checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_diagnosis_photos"
    ADD CONSTRAINT "order_diagnosis_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_events"
    ADD CONSTRAINT "order_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_materials_used"
    ADD CONSTRAINT "order_materials_used_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_notes"
    ADD CONSTRAINT "order_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_quote_items"
    ADD CONSTRAINT "order_quote_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_quotes"
    ADD CONSTRAINT "order_quotes_order_id_version_key" UNIQUE ("order_id", "version");



ALTER TABLE ONLY "public"."order_quotes"
    ADD CONSTRAINT "order_quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_signatures"
    ADD CONSTRAINT "order_signatures_order_id_key" UNIQUE ("order_id");



ALTER TABLE ONLY "public"."order_signatures"
    ADD CONSTRAINT "order_signatures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_time_logs"
    ADD CONSTRAINT "order_time_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_mp_payment_id_key" UNIQUE ("mp_payment_id");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_mp_preference_id_key" UNIQUE ("mp_preference_id");



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."price_adjustments_log"
    ADD CONSTRAINT "price_adjustments_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubro_matricula_config"
    ADD CONSTRAINT "rubro_matricula_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."rubro_matricula_config"
    ADD CONSTRAINT "rubro_matricula_config_rubro_key_key" UNIQUE ("rubro_key");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_rubro_id_slug_key" UNIQUE ("rubro_id", "slug");



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_guest_access_token_key" UNIQUE ("guest_access_token");



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_rubros"
    ADD CONSTRAINT "service_rubros_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."service_rubros"
    ADD CONSTRAINT "service_rubros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."service_rubros"
    ADD CONSTRAINT "service_rubros_slug_key" UNIQUE ("slug");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_category_id_name_key" UNIQUE ("category_id", "name");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."technician_applications"
    ADD CONSTRAINT "technician_applications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_documents"
    ADD CONSTRAINT "technician_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_documents"
    ADD CONSTRAINT "technician_documents_storage_path_key" UNIQUE ("storage_path");



ALTER TABLE ONLY "public"."technician_enablement_checklist"
    ADD CONSTRAINT "technician_enablement_checklist_pkey" PRIMARY KEY ("technician_id");



ALTER TABLE ONLY "public"."technician_goals"
    ADD CONSTRAINT "technician_goals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_matriculas"
    ADD CONSTRAINT "technician_matriculas_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_notifications"
    ADD CONSTRAINT "technician_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_payment_accounts"
    ADD CONSTRAINT "technician_payment_accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_payment_accounts"
    ADD CONSTRAINT "technician_payment_accounts_technician_id_key" UNIQUE ("technician_id");



ALTER TABLE ONLY "public"."technician_payout_batches"
    ADD CONSTRAINT "technician_payout_batches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_requirements"
    ADD CONSTRAINT "technician_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_requirements"
    ADD CONSTRAINT "technician_requirements_technician_id_requirement_type_key" UNIQUE ("technician_id", "requirement_type");



ALTER TABLE ONLY "public"."technician_review_history"
    ADD CONSTRAINT "technician_review_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technician_settlements"
    ADD CONSTRAINT "technician_settlements_payment_transaction_id_settlement_ty_key" UNIQUE ("payment_transaction_id", "settlement_type");



ALTER TABLE ONLY "public"."technician_settlements"
    ADD CONSTRAINT "technician_settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technicians"
    ADD CONSTRAINT "technicians_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."technicians"
    ADD CONSTRAINT "technicians_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."technicians"
    ADD CONSTRAINT "technicians_technician_number_key" UNIQUE ("technician_number");



CREATE INDEX "account_invites_target_idx" ON "public"."account_invites" USING "btree" ("kind", "target_id");



CREATE INDEX "account_invites_token_idx" ON "public"."account_invites" USING "btree" ("token");



CREATE INDEX "customer_addresses_customer_idx" ON "public"."customer_addresses" USING "btree" ("customer_id");



CREATE UNIQUE INDEX "customer_addresses_one_default_per_customer_idx" ON "public"."customer_addresses" USING "btree" ("customer_id") WHERE "is_default";



CREATE INDEX "customer_admin_notes_customer_idx" ON "public"."customer_admin_notes" USING "btree" ("customer_id", "created_at" DESC);



CREATE UNIQUE INDEX "customers_email_lower_uidx" ON "public"."customers" USING "btree" ("lower"("email")) WHERE (("email" IS NOT NULL) AND ("btrim"("email") <> ''::"text"));



CREATE INDEX "guest_checkout_drafts_created_at_idx" ON "public"."guest_checkout_drafts" USING "btree" ("created_at");



CREATE INDEX "idx_materials_category" ON "public"."materials" USING "btree" ("category");



CREATE INDEX "idx_order_events_order" ON "public"."order_events" USING "btree" ("order_id");



CREATE INDEX "idx_service_orders_admin_incident_status" ON "public"."service_orders" USING "btree" ("admin_incident_status") WHERE ("admin_incident_status" = 'open'::"text");



CREATE INDEX "idx_service_orders_customer" ON "public"."service_orders" USING "btree" ("customer_id");



CREATE INDEX "idx_service_orders_status" ON "public"."service_orders" USING "btree" ("status");



CREATE INDEX "idx_service_orders_technician" ON "public"."service_orders" USING "btree" ("assigned_technician_id");



CREATE INDEX "order_diagnosis_photos_order_idx" ON "public"."order_diagnosis_photos" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "order_quote_items_quote_sort_idx" ON "public"."order_quote_items" USING "btree" ("quote_id", "sort_order");



CREATE INDEX "order_quotes_order_version_idx" ON "public"."order_quotes" USING "btree" ("order_id", "version" DESC);



CREATE INDEX "payment_transactions_order_idx" ON "public"."payment_transactions" USING "btree" ("order_id", "created_at" DESC);



CREATE INDEX "service_categories_rubro_active_idx" ON "public"."service_categories" USING "btree" ("rubro_id", "is_active", "sort_order");



CREATE INDEX "service_orders_archived_at_idx" ON "public"."service_orders" USING "btree" ("archived_at");



CREATE INDEX "technician_documents_technician_idx" ON "public"."technician_documents" USING "btree" ("technician_id", "document_type", "is_current");



CREATE INDEX "technician_goals_technician_active_idx" ON "public"."technician_goals" USING "btree" ("technician_id", "is_active");



CREATE INDEX "technician_matriculas_technician_idx" ON "public"."technician_matriculas" USING "btree" ("technician_id", "validation_status");



CREATE INDEX "technician_payout_batches_technician_status_idx" ON "public"."technician_payout_batches" USING "btree" ("technician_id", "status", "scheduled_date" DESC);



CREATE INDEX "technician_settlements_status_release_idx" ON "public"."technician_settlements" USING "btree" ("status", "release_date");



CREATE INDEX "technician_settlements_technician_created_idx" ON "public"."technician_settlements" USING "btree" ("technician_id", "created_at" DESC);



CREATE INDEX "technician_settlements_technician_status_idx" ON "public"."technician_settlements" USING "btree" ("technician_id", "status", "release_at");



CREATE UNIQUE INDEX "technicians_email_lower_uidx" ON "public"."technicians" USING "btree" ("lower"("email")) WHERE (("email" IS NOT NULL) AND ("btrim"("email") <> ''::"text"));



CREATE OR REPLACE TRIGGER "lock_technician_admin_fields_before_update" BEFORE UPDATE ON "public"."technicians" FOR EACH ROW EXECUTE FUNCTION "public"."lock_technician_admin_fields"();



CREATE OR REPLACE TRIGGER "lock_technician_document_review" BEFORE INSERT OR UPDATE ON "public"."technician_documents" FOR EACH ROW EXECUTE FUNCTION "public"."lock_technician_review_fields"();



CREATE OR REPLACE TRIGGER "lock_technician_matricula_review" BEFORE INSERT OR UPDATE ON "public"."technician_matriculas" FOR EACH ROW EXECUTE FUNCTION "public"."lock_technician_review_fields"();



CREATE OR REPLACE TRIGGER "lock_technician_payment_review" BEFORE INSERT OR UPDATE ON "public"."technician_payment_accounts" FOR EACH ROW EXECUTE FUNCTION "public"."lock_technician_review_fields"();



CREATE OR REPLACE TRIGGER "materials_set_updated_at" BEFORE UPDATE ON "public"."materials" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "order_quote_items_apply_catalog_price" BEFORE INSERT OR UPDATE ON "public"."order_quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."apply_catalog_price_to_quote_item"();



CREATE OR REPLACE TRIGGER "order_quote_items_prevent_sent_change" BEFORE INSERT OR DELETE OR UPDATE ON "public"."order_quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_sent_quote_item_change"();



CREATE OR REPLACE TRIGGER "order_quote_items_sync_totals" AFTER INSERT OR DELETE OR UPDATE ON "public"."order_quote_items" FOR EACH ROW EXECUTE FUNCTION "public"."sync_quote_totals_from_items"();



CREATE OR REPLACE TRIGGER "order_quotes_prevent_content_change" BEFORE UPDATE ON "public"."order_quotes" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_sent_quote_content_change"();



CREATE OR REPLACE TRIGGER "order_quotes_sync_accepted_status" AFTER UPDATE OF "status" ON "public"."order_quotes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_accepted_quote_status"();



CREATE OR REPLACE TRIGGER "order_quotes_sync_order_status" AFTER INSERT OR UPDATE OF "status" ON "public"."order_quotes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_service_order_quote_status"();



CREATE OR REPLACE TRIGGER "order_quotes_sync_rejected_order_state" AFTER UPDATE OF "status" ON "public"."order_quotes" FOR EACH ROW EXECUTE FUNCTION "public"."sync_rejected_quote_order_state"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "protect_admin_order_control_fields" BEFORE UPDATE ON "public"."service_orders" FOR EACH ROW EXECUTE FUNCTION "public"."protect_admin_order_control_fields"();



CREATE OR REPLACE TRIGGER "require_eligible_technician_assignment" BEFORE UPDATE OF "assigned_technician_id" ON "public"."service_orders" FOR EACH ROW EXECUTE FUNCTION "public"."require_eligible_technician_assignment"();



CREATE OR REPLACE TRIGGER "service_orders_enforce_pricing" BEFORE INSERT ON "public"."service_orders" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_service_order_pricing"();



CREATE OR REPLACE TRIGGER "service_orders_prevent_unpaid_execution_timer" BEFORE INSERT OR UPDATE OF "status", "work_started_at" ON "public"."service_orders" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_unpaid_execution_timer"();



CREATE OR REPLACE TRIGGER "service_orders_start_execution_after_payment" AFTER UPDATE OF "payment_status", "quote_status", "assigned_technician_id" ON "public"."service_orders" FOR EACH ROW EXECUTE FUNCTION "public"."start_execution_after_payment_confirmation"();



ALTER TABLE ONLY "public"."account_invites"
    ADD CONSTRAINT "account_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_addresses"
    ADD CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_admin_notes"
    ADD CONSTRAINT "customer_admin_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."customer_admin_notes"
    ADD CONSTRAINT "customer_admin_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_checklist_items"
    ADD CONSTRAINT "order_checklist_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_diagnosis_photos"
    ADD CONSTRAINT "order_diagnosis_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_diagnosis_photos"
    ADD CONSTRAINT "order_diagnosis_photos_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."order_quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_diagnosis_photos"
    ADD CONSTRAINT "order_diagnosis_photos_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_events"
    ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_materials_used"
    ADD CONSTRAINT "order_materials_used_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_materials_used"
    ADD CONSTRAINT "order_materials_used_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_notes"
    ADD CONSTRAINT "order_notes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_quote_items"
    ADD CONSTRAINT "order_quote_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."order_quote_items"
    ADD CONSTRAINT "order_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."order_quotes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_quote_items"
    ADD CONSTRAINT "order_quote_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."order_quotes"
    ADD CONSTRAINT "order_quotes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."order_quotes"
    ADD CONSTRAINT "order_quotes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_signatures"
    ADD CONSTRAINT "order_signatures_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_time_logs"
    ADD CONSTRAINT "order_time_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payment_transactions"
    ADD CONSTRAINT "payment_transactions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."order_quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."price_adjustments_log"
    ADD CONSTRAINT "price_adjustments_log_applied_by_fkey" FOREIGN KEY ("applied_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_categories"
    ADD CONSTRAINT "service_categories_rubro_id_fkey" FOREIGN KEY ("rubro_id") REFERENCES "public"."service_rubros"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_admin_exception_closed_by_fkey" FOREIGN KEY ("admin_exception_closed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_admin_incident_opened_by_fkey" FOREIGN KEY ("admin_incident_opened_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_admin_incident_resolved_by_fkey" FOREIGN KEY ("admin_incident_resolved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "public"."technicians"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_orders"
    ADD CONSTRAINT "service_orders_fixed_price_service_id_fkey" FOREIGN KEY ("fixed_price_service_id") REFERENCES "public"."services"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."services"
    ADD CONSTRAINT "services_subcategory_id_fkey" FOREIGN KEY ("subcategory_id") REFERENCES "public"."subcategories"("id");



ALTER TABLE ONLY "public"."subcategories"
    ADD CONSTRAINT "subcategories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."system_settings"
    ADD CONSTRAINT "system_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."technician_applications"
    ADD CONSTRAINT "technician_applications_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."technician_documents"
    ADD CONSTRAINT "technician_documents_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_documents"
    ADD CONSTRAINT "technician_documents_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_enablement_checklist"
    ADD CONSTRAINT "technician_enablement_checklist_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_enablement_checklist"
    ADD CONSTRAINT "technician_enablement_checklist_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_goals"
    ADD CONSTRAINT "technician_goals_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_matriculas"
    ADD CONSTRAINT "technician_matriculas_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_matriculas"
    ADD CONSTRAINT "technician_matriculas_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_notifications"
    ADD CONSTRAINT "technician_notifications_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_payment_accounts"
    ADD CONSTRAINT "technician_payment_accounts_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_payout_batches"
    ADD CONSTRAINT "technician_payout_batches_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_payout_batches"
    ADD CONSTRAINT "technician_payout_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_payout_batches"
    ADD CONSTRAINT "technician_payout_batches_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."technician_requirements"
    ADD CONSTRAINT "technician_requirements_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_requirements"
    ADD CONSTRAINT "technician_requirements_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_review_history"
    ADD CONSTRAINT "technician_review_history_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_review_history"
    ADD CONSTRAINT "technician_review_history_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."technician_settlements"
    ADD CONSTRAINT "technician_settlements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."service_orders"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."technician_settlements"
    ADD CONSTRAINT "technician_settlements_payment_transaction_id_fkey" FOREIGN KEY ("payment_transaction_id") REFERENCES "public"."payment_transactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_settlements"
    ADD CONSTRAINT "technician_settlements_payout_batch_id_fkey" FOREIGN KEY ("payout_batch_id") REFERENCES "public"."technician_payout_batches"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technician_settlements"
    ADD CONSTRAINT "technician_settlements_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "public"."technicians"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."technicians"
    ADD CONSTRAINT "technicians_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."technicians"
    ADD CONSTRAINT "technicians_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE "public"."account_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "account_invites_admin" ON "public"."account_invites" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_select_anon" ON "public"."categories" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "categories_select_authenticated" ON "public"."categories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "categories_write_admin" ON "public"."categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."customer_addresses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_addresses_owner_or_admin" ON "public"."customer_addresses" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR (EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "customer_addresses"."customer_id") AND ("c"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))));



CREATE POLICY "customer_addresses_owner_write_or_admin" ON "public"."customer_addresses" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR (EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "customer_addresses"."customer_id") AND ("c"."profile_id" = ( SELECT "auth"."uid"() AS "uid"))))))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR (EXISTS ( SELECT 1
   FROM "public"."customers" "c"
  WHERE (("c"."id" = "customer_addresses"."customer_id") AND ("c"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))))));



ALTER TABLE "public"."customer_admin_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customer_admin_notes_admin_only" ON "public"."customer_admin_notes" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "customers_insert_self" ON "public"."customers" FOR INSERT TO "authenticated" WITH CHECK (("profile_id" = "auth"."uid"()));



CREATE POLICY "customers_select_own_or_staff" ON "public"."customers" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("profile_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "so"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("so"."customer_id" = "customers"."id") AND ("so"."assigned_technician_id" = "p"."technician_id"))))));



CREATE POLICY "customers_write_admin" ON "public"."customers" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."guest_checkout_drafts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."materials" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "materials_select_authenticated" ON "public"."materials" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "materials_write_admin" ON "public"."materials" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."order_checklist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_children_select" ON "public"."order_checklist_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_checklist_items"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))) OR ("o"."customer_id" = ( SELECT "profiles"."customer_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "order_children_write" ON "public"."order_checklist_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_checklist_items"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_checklist_items"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



ALTER TABLE "public"."order_diagnosis_photos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_diagnosis_photos_insert_assigned_technician" ON "public"."order_diagnosis_photos" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_diagnosis_photos"."order_id") AND ("o"."assigned_technician_id" = "p"."technician_id") AND ("o"."work_mode" = 'diagnosis'::"text") AND ("o"."payment_status" = 'deposit_paid'::"text")))));



CREATE POLICY "order_diagnosis_photos_select_stakeholders" ON "public"."order_diagnosis_photos" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_diagnosis_photos"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = "p"."technician_id") OR ("o"."customer_id" = "p"."customer_id"))))));



ALTER TABLE "public"."order_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_events_select" ON "public"."order_events" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_events"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))) OR ("o"."customer_id" = ( SELECT "profiles"."customer_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "order_events_write" ON "public"."order_events" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_events"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_events"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



ALTER TABLE "public"."order_materials_used" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_materials_used_select" ON "public"."order_materials_used" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_materials_used"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))) OR ("o"."customer_id" = ( SELECT "profiles"."customer_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "order_materials_used_write" ON "public"."order_materials_used" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_materials_used"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_materials_used"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



ALTER TABLE "public"."order_notes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_notes_select" ON "public"."order_notes" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_notes"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))) OR ("o"."customer_id" = ( SELECT "profiles"."customer_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "order_notes_write" ON "public"."order_notes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_notes"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_notes"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



ALTER TABLE "public"."order_quote_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_quote_items_select_stakeholders" ON "public"."order_quote_items" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."order_quotes" "q"
  WHERE ("q"."id" = "order_quote_items"."quote_id"))));



CREATE POLICY "order_quote_items_write_assigned_technician_draft" ON "public"."order_quote_items" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM (("public"."order_quotes" "q"
     JOIN "public"."service_orders" "o" ON (("o"."id" = "q"."order_id")))
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("q"."id" = "order_quote_items"."quote_id") AND ("q"."status" = 'draft'::"text") AND ("o"."assigned_technician_id" = "p"."technician_id"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."order_quotes" "q"
     JOIN "public"."service_orders" "o" ON (("o"."id" = "q"."order_id")))
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("q"."id" = "order_quote_items"."quote_id") AND ("q"."status" = 'draft'::"text") AND ("o"."assigned_technician_id" = "p"."technician_id")))));



ALTER TABLE "public"."order_quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_quotes_delete_technician_draft" ON "public"."order_quotes" FOR DELETE TO "authenticated" USING ((("status" = 'draft'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_quotes"."order_id") AND ("o"."assigned_technician_id" = "p"."technician_id"))))));



CREATE POLICY "order_quotes_insert_assigned_technician" ON "public"."order_quotes" FOR INSERT TO "authenticated" WITH CHECK ((("status" = 'draft'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_quotes"."order_id") AND ("o"."assigned_technician_id" = "p"."technician_id") AND ("o"."work_mode" = 'diagnosis'::"text") AND ("o"."payment_status" = 'deposit_paid'::"text"))))));



CREATE POLICY "order_quotes_select_stakeholders" ON "public"."order_quotes" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     LEFT JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_quotes"."order_id") AND (("o"."assigned_technician_id" = "p"."technician_id") OR ("o"."customer_id" = "p"."customer_id")))))));



CREATE POLICY "order_quotes_update_customer_decision" ON "public"."order_quotes" FOR UPDATE TO "authenticated" USING ((("status" = 'sent'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_quotes"."order_id") AND ("o"."customer_id" = "p"."customer_id")))))) WITH CHECK ((("status" = ANY (ARRAY['accepted'::"text", 'rejected'::"text"])) AND (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_quotes"."order_id") AND ("o"."customer_id" = "p"."customer_id"))))));



CREATE POLICY "order_quotes_update_technician_draft" ON "public"."order_quotes" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_quotes"."order_id") AND ("o"."assigned_technician_id" = "p"."technician_id") AND ("order_quotes"."status" = 'draft'::"text")))))) WITH CHECK (("public"."is_admin"() OR (("status" = ANY (ARRAY['draft'::"text", 'sent'::"text"])) AND (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."id" = "order_quotes"."order_id") AND ("o"."assigned_technician_id" = "p"."technician_id") AND ("o"."work_mode" = 'diagnosis'::"text") AND ("o"."payment_status" = 'deposit_paid'::"text")))))));



ALTER TABLE "public"."order_signatures" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_signatures_select" ON "public"."order_signatures" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_signatures"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))) OR ("o"."customer_id" = ( SELECT "profiles"."customer_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "order_signatures_write" ON "public"."order_signatures" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_signatures"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))) OR ("o"."customer_id" = ( SELECT "profiles"."customer_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_signatures"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))) OR ("o"."customer_id" = ( SELECT "profiles"."customer_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



ALTER TABLE "public"."order_time_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "order_time_logs_select" ON "public"."order_time_logs" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_time_logs"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))) OR ("o"."customer_id" = ( SELECT "profiles"."customer_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



CREATE POLICY "order_time_logs_write" ON "public"."order_time_logs" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_time_logs"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."service_orders" "o"
  WHERE (("o"."id" = "order_time_logs"."order_id") AND ("public"."is_admin"() OR ("o"."assigned_technician_id" = ( SELECT "profiles"."technician_id"
           FROM "public"."profiles"
          WHERE ("profiles"."id" = "auth"."uid"()))))))));



ALTER TABLE "public"."payment_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payment_transactions_select_admin_or_owner" ON "public"."payment_transactions" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "so"
     JOIN "public"."profiles" "p" ON (("p"."id" = "auth"."uid"())))
  WHERE (("so"."id" = "payment_transactions"."order_id") AND ("so"."customer_id" = "p"."customer_id"))))));



CREATE POLICY "payout_batches_admin_all" ON "public"."technician_payout_batches" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "payout_batches_technician_read" ON "public"."technician_payout_batches" FOR SELECT TO "authenticated" USING (("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."price_adjustments_log" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "price_adjustments_log_admin_all" ON "public"."price_adjustments_log" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_select_own_or_admin" ON "public"."profiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "profiles_update_own_or_admin" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."is_admin"())) WITH CHECK ((("id" = "auth"."uid"()) OR "public"."is_admin"()));



ALTER TABLE "public"."rubro_matricula_config" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "rubro_matricula_config_read" ON "public"."rubro_matricula_config" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."service_categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_categories_admin_write" ON "public"."service_categories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "service_categories_read_authenticated" ON "public"."service_categories" FOR SELECT TO "authenticated" USING ((("is_active" AND (EXISTS ( SELECT 1
   FROM "public"."service_rubros" "r"
  WHERE (("r"."id" = "service_categories"."rubro_id") AND "r"."is_active")))) OR "public"."is_admin"()));



ALTER TABLE "public"."service_orders" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_orders_delete_admin" ON "public"."service_orders" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "service_orders_delete_customer_cancelled" ON "public"."service_orders" FOR DELETE TO "authenticated" USING ((("status" = 'cancelled'::"public"."order_status") AND ("customer_id" = ( SELECT "profiles"."customer_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "service_orders_insert_admin" ON "public"."service_orders" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "service_orders_insert_customer_request" ON "public"."service_orders" FOR INSERT TO "authenticated" WITH CHECK ((("customer_id" IN ( SELECT "c"."id"
   FROM "public"."customers" "c"
  WHERE ("c"."profile_id" = ( SELECT "auth"."uid"() AS "uid")))) AND ("assigned_technician_id" IS NULL) AND ("assigned_technician_name" IS NULL) AND (("status")::"text" = 'assigned'::"text") AND ("service_status" = 'pending'::"text") AND ("quote_status" = 'none'::"text") AND ("payment_status" = 'pending'::"text") AND ("work_mode" = ANY (ARRAY['diagnosis'::"text", 'direct'::"text"])) AND (COALESCE("total_paid_amount", (0)::numeric) = (0)::numeric) AND (COALESCE("extra_amount", (0)::numeric) = (0)::numeric)));



CREATE POLICY "service_orders_select_scoped" ON "public"."service_orders" FOR SELECT TO "authenticated" USING (("public"."is_admin"() OR ("assigned_technician_id" = ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))) OR ("customer_id" = ( SELECT "profiles"."customer_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



CREATE POLICY "service_orders_update_admin_or_tech" ON "public"."service_orders" FOR UPDATE TO "authenticated" USING (("public"."is_admin"() OR ("assigned_technician_id" = ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))))) WITH CHECK (("public"."is_admin"() OR ("assigned_technician_id" = ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"())))));



ALTER TABLE "public"."service_rubros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "service_rubros_admin_write" ON "public"."service_rubros" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "service_rubros_read_authenticated" ON "public"."service_rubros" FOR SELECT TO "authenticated" USING (("is_active" OR "public"."is_admin"()));



ALTER TABLE "public"."services" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "services_select_anon" ON "public"."services" FOR SELECT TO "anon" USING (("active" = true));



CREATE POLICY "services_select_authenticated" ON "public"."services" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "services_write_admin" ON "public"."services" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."subcategories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subcategories_select_anon" ON "public"."subcategories" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "subcategories_select_authenticated" ON "public"."subcategories" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "subcategories_write_admin" ON "public"."subcategories" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."system_settings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "system_settings_select_authenticated" ON "public"."system_settings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "system_settings_write_admin" ON "public"."system_settings" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."technician_applications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_applications_admin_manage" ON "public"."technician_applications" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "technician_applications_insert_public" ON "public"."technician_applications" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("status" = 'pending'::"text") AND ("reviewed_at" IS NULL) AND ("reviewed_by" IS NULL)));



ALTER TABLE "public"."technician_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_documents_owner_or_admin" ON "public"."technician_documents" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "technician_enablement_admin_write" ON "public"."technician_enablement_checklist" FOR UPDATE TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



ALTER TABLE "public"."technician_enablement_checklist" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_enablement_owner_or_admin" ON "public"."technician_enablement_checklist" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."technician_goals" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_goals_admin_read" ON "public"."technician_goals" FOR SELECT TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "technician_goals_owner" ON "public"."technician_goals" TO "authenticated" USING (("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."technician_matriculas" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_matriculas_customer_assigned_approved" ON "public"."technician_matriculas" FOR SELECT TO "authenticated" USING ((("validation_status" = 'approved'::"text") AND (EXISTS ( SELECT 1
   FROM ("public"."service_orders" "o"
     JOIN "public"."profiles" "p" ON (("p"."id" = ( SELECT "auth"."uid"() AS "uid"))))
  WHERE (("o"."assigned_technician_id" = "technician_matriculas"."technician_id") AND ("o"."customer_id" = "p"."customer_id"))))));



CREATE POLICY "technician_matriculas_owner_or_admin" ON "public"."technician_matriculas" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."technician_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_notifications_admin_write" ON "public"."technician_notifications" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "technician_notifications_owner_or_admin" ON "public"."technician_notifications" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "technician_notifications_owner_read_update" ON "public"."technician_notifications" FOR UPDATE TO "authenticated" USING (("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))) WITH CHECK (("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."technician_payment_accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_payment_accounts_owner_or_admin" ON "public"."technician_payment_accounts" TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."technician_payout_batches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."technician_requirements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_requirements_admin_write" ON "public"."technician_requirements" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "technician_requirements_owner_or_admin" ON "public"."technician_requirements" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."technician_review_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_review_history_admin_write" ON "public"."technician_review_history" FOR INSERT TO "authenticated" WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "technician_review_history_owner_or_admin" ON "public"."technician_review_history" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."technician_settlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technician_settlements_admin_all" ON "public"."technician_settlements" TO "authenticated" USING (( SELECT "public"."is_admin"() AS "is_admin")) WITH CHECK (( SELECT "public"."is_admin"() AS "is_admin"));



CREATE POLICY "technician_settlements_own_read" ON "public"."technician_settlements" FOR SELECT TO "authenticated" USING (("technician_id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))));



ALTER TABLE "public"."technicians" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "technicians_select_authenticated" ON "public"."technicians" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "technicians_update_own_professional_profile" ON "public"."technicians" FOR UPDATE TO "authenticated" USING ((( SELECT "public"."is_admin"() AS "is_admin") OR ("id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((( SELECT "public"."is_admin"() AS "is_admin") OR ("id" IN ( SELECT "profiles"."technician_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "technicians_write_admin" ON "public"."technicians" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_catalog_price_to_quote_item"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_catalog_price_to_quote_item"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_catalog_price_to_quote_item"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."current_user_role"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_service_order_pricing"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_service_order_pricing"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_service_order_pricing"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_account_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_account_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_account_invite"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lock_technician_admin_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."lock_technician_admin_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lock_technician_admin_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."lock_technician_review_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."lock_technician_review_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."lock_technician_review_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_sent_quote_content_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_sent_quote_content_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_sent_quote_content_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_sent_quote_item_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_sent_quote_item_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_sent_quote_item_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_unpaid_execution_timer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."prevent_unpaid_execution_timer"() TO "service_role";



GRANT ALL ON FUNCTION "public"."protect_admin_order_control_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."protect_admin_order_control_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."protect_admin_order_control_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."redeem_account_invite"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."redeem_account_invite"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."redeem_account_invite"("p_token" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."release_due_technician_settlements"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."release_due_technician_settlements"() TO "service_role";



GRANT ALL ON FUNCTION "public"."require_eligible_technician_assignment"() TO "anon";
GRANT ALL ON FUNCTION "public"."require_eligible_technician_assignment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."require_eligible_technician_assignment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."start_execution_after_payment_confirmation"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."start_execution_after_payment_confirmation"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."sync_accepted_quote_status"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."sync_accepted_quote_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_quote_totals_from_items"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_quote_totals_from_items"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_quote_totals_from_items"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_rejected_quote_order_state"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_rejected_quote_order_state"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_rejected_quote_order_state"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_service_order_quote_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_service_order_quote_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_service_order_quote_status"() TO "service_role";



GRANT ALL ON TABLE "public"."account_invites" TO "anon";
GRANT ALL ON TABLE "public"."account_invites" TO "authenticated";
GRANT ALL ON TABLE "public"."account_invites" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."customer_addresses" TO "anon";
GRANT ALL ON TABLE "public"."customer_addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_addresses" TO "service_role";



GRANT ALL ON TABLE "public"."customer_admin_notes" TO "anon";
GRANT ALL ON TABLE "public"."customer_admin_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_admin_notes" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."service_orders" TO "anon";
GRANT ALL ON TABLE "public"."service_orders" TO "authenticated";
GRANT ALL ON TABLE "public"."service_orders" TO "service_role";



GRANT ALL ON TABLE "public"."customer_summary" TO "anon";
GRANT ALL ON TABLE "public"."customer_summary" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_summary" TO "service_role";



GRANT ALL ON SEQUENCE "public"."customers_customer_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."customers_customer_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."customers_customer_number_seq" TO "service_role";



GRANT ALL ON TABLE "public"."guest_checkout_drafts" TO "anon";
GRANT ALL ON TABLE "public"."guest_checkout_drafts" TO "authenticated";
GRANT ALL ON TABLE "public"."guest_checkout_drafts" TO "service_role";



GRANT ALL ON TABLE "public"."materials" TO "anon";
GRANT ALL ON TABLE "public"."materials" TO "authenticated";
GRANT ALL ON TABLE "public"."materials" TO "service_role";



GRANT ALL ON TABLE "public"."order_checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."order_checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_diagnosis_photos" TO "anon";
GRANT ALL ON TABLE "public"."order_diagnosis_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."order_diagnosis_photos" TO "service_role";



GRANT ALL ON TABLE "public"."order_events" TO "anon";
GRANT ALL ON TABLE "public"."order_events" TO "authenticated";
GRANT ALL ON TABLE "public"."order_events" TO "service_role";



GRANT ALL ON TABLE "public"."order_materials_used" TO "anon";
GRANT ALL ON TABLE "public"."order_materials_used" TO "authenticated";
GRANT ALL ON TABLE "public"."order_materials_used" TO "service_role";



GRANT ALL ON TABLE "public"."order_notes" TO "anon";
GRANT ALL ON TABLE "public"."order_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."order_notes" TO "service_role";



GRANT ALL ON TABLE "public"."order_quote_items" TO "anon";
GRANT ALL ON TABLE "public"."order_quote_items" TO "authenticated";
GRANT ALL ON TABLE "public"."order_quote_items" TO "service_role";



GRANT ALL ON TABLE "public"."order_quotes" TO "anon";
GRANT ALL ON TABLE "public"."order_quotes" TO "authenticated";
GRANT ALL ON TABLE "public"."order_quotes" TO "service_role";



GRANT ALL ON TABLE "public"."order_signatures" TO "anon";
GRANT ALL ON TABLE "public"."order_signatures" TO "authenticated";
GRANT ALL ON TABLE "public"."order_signatures" TO "service_role";



GRANT ALL ON TABLE "public"."order_time_logs" TO "anon";
GRANT ALL ON TABLE "public"."order_time_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."order_time_logs" TO "service_role";



GRANT ALL ON TABLE "public"."payment_transactions" TO "anon";
GRANT ALL ON TABLE "public"."payment_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."price_adjustments_log" TO "anon";
GRANT ALL ON TABLE "public"."price_adjustments_log" TO "authenticated";
GRANT ALL ON TABLE "public"."price_adjustments_log" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."rubro_matricula_config" TO "service_role";
GRANT SELECT ON TABLE "public"."rubro_matricula_config" TO "authenticated";



GRANT ALL ON TABLE "public"."service_categories" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."service_categories" TO "authenticated";



GRANT ALL ON TABLE "public"."service_rubros" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."service_rubros" TO "authenticated";



GRANT ALL ON TABLE "public"."services" TO "anon";
GRANT ALL ON TABLE "public"."services" TO "authenticated";
GRANT ALL ON TABLE "public"."services" TO "service_role";



GRANT ALL ON TABLE "public"."subcategories" TO "anon";
GRANT ALL ON TABLE "public"."subcategories" TO "authenticated";
GRANT ALL ON TABLE "public"."subcategories" TO "service_role";



GRANT ALL ON TABLE "public"."system_settings" TO "anon";
GRANT ALL ON TABLE "public"."system_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."system_settings" TO "service_role";



GRANT ALL ON TABLE "public"."technician_applications" TO "anon";
GRANT ALL ON TABLE "public"."technician_applications" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_applications" TO "service_role";



GRANT ALL ON TABLE "public"."technician_documents" TO "anon";
GRANT ALL ON TABLE "public"."technician_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_documents" TO "service_role";



GRANT ALL ON TABLE "public"."technician_enablement_checklist" TO "anon";
GRANT ALL ON TABLE "public"."technician_enablement_checklist" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_enablement_checklist" TO "service_role";



GRANT ALL ON TABLE "public"."technician_goals" TO "anon";
GRANT ALL ON TABLE "public"."technician_goals" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_goals" TO "service_role";



GRANT ALL ON TABLE "public"."technician_matriculas" TO "anon";
GRANT ALL ON TABLE "public"."technician_matriculas" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_matriculas" TO "service_role";



GRANT ALL ON TABLE "public"."technician_notifications" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_notifications" TO "authenticated";



GRANT ALL ON TABLE "public"."technician_payment_accounts" TO "anon";
GRANT ALL ON TABLE "public"."technician_payment_accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_payment_accounts" TO "service_role";



GRANT ALL ON TABLE "public"."technician_payout_batches" TO "anon";
GRANT ALL ON TABLE "public"."technician_payout_batches" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_payout_batches" TO "service_role";



GRANT ALL ON TABLE "public"."technicians" TO "anon";
GRANT ALL ON TABLE "public"."technicians" TO "authenticated";
GRANT ALL ON TABLE "public"."technicians" TO "service_role";



GRANT ALL ON TABLE "public"."technician_public_view" TO "anon";
GRANT ALL ON TABLE "public"."technician_public_view" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_public_view" TO "service_role";



GRANT ALL ON TABLE "public"."technician_requirements" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_requirements" TO "authenticated";



GRANT ALL ON TABLE "public"."technician_review_history" TO "service_role";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."technician_review_history" TO "authenticated";



GRANT ALL ON TABLE "public"."technician_settlements" TO "anon";
GRANT ALL ON TABLE "public"."technician_settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."technician_settlements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."technicians_technician_number_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."technicians_technician_number_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."technicians_technician_number_seq" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







