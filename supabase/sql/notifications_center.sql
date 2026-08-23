-- Fase 4: Centro general de notificaciones
-- Tabla universal e idempotente + mapa evento->destinatario + integracion de
-- avisos de validacion tecnica existentes (technician_notifications).
-- Aplicado en vivo via apply_migration con el mismo nombre de archivo.

-- ============================================================
-- 1. Tabla universal
-- ============================================================
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_profile_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'order_assigned',
    'quote_sent', 'quote_accepted', 'quote_rejected',
    'payment_approved', 'payment_rejected', 'payment_pending',
    'claim_opened', 'claim_message', 'claim_resolved',
    'message_new',
    'settlement_scheduled', 'settlement_released', 'settlement_paid',
    'technician_validation'
  )),
  title text not null,
  body text,
  entity_type text check (entity_type in ('order', 'quote', 'payment', 'claim', 'conversation', 'settlement', 'technician_validation')),
  entity_id uuid,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  -- Clave de idempotencia: dos eventos con la misma clave nunca generan dos
  -- filas, aunque el disparador (p.ej. un webhook de Mercado Pago) se repita.
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index notifications_dedupe_key_uidx on public.notifications (dedupe_key) where dedupe_key is not null;
create index notifications_recipient_created_idx on public.notifications (recipient_profile_id, created_at desc);
create index notifications_recipient_unread_idx on public.notifications (recipient_profile_id) where read_at is null;

alter table public.notifications enable row level security;
revoke all on public.notifications from anon, authenticated;
grant select, update on public.notifications to authenticated;

create policy notifications_admin_all on public.notifications
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (recipient_profile_id = (select auth.uid()));

create policy notifications_update_own on public.notifications
  for update to authenticated
  using (recipient_profile_id = (select auth.uid()))
  with check (recipient_profile_id = (select auth.uid()));

-- Solo se puede tocar read_at desde el cliente; todo lo demas es de solo
-- lectura para el destinatario (evita que alguien reescriba su propio aviso).
create or replace function public.notifications_protect_immutable() returns trigger
language plpgsql security definer set search_path = '' as $$
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

create trigger trg_notifications_protect_immutable
  before update on public.notifications
  for each row execute function public.notifications_protect_immutable();

-- ============================================================
-- 2. Helpers (creacion idempotente + resolucion de perfiles)
-- ============================================================
create or replace function public.create_notification(
  p_recipient_profile_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_entity_type text,
  p_entity_id uuid,
  p_priority text,
  p_dedupe_key text
) returns uuid
language plpgsql security definer set search_path = '' as $$
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

create or replace function public.profile_id_for_technician(p_technician_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles where technician_id = p_technician_id limit 1;
$$;

create or replace function public.profile_id_for_customer(p_customer_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from public.profiles where customer_id = p_customer_id limit 1;
$$;

-- Notifica a todos los interesados de un reclamo (admin + cliente + tecnico
-- del caso) excepto al que disparo el evento.
create or replace function public.notify_case_stakeholders(
  p_case_id uuid, p_type text, p_title text, p_body text, p_priority text,
  p_dedupe_prefix text, p_exclude_profile uuid
) returns void
language plpgsql security definer set search_path = '' as $$
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

-- ============================================================
-- 3. Mapa evento -> destinatario (triggers)
-- ============================================================

-- Nueva orden asignada a un tecnico
create or replace function public.notify_order_assigned() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.create_notification(
    public.profile_id_for_technician(new.assigned_technician_id),
    'order_assigned', 'Nueva orden asignada', new.title, 'order', new.id, 'high',
    'order_assigned:' || new.id::text || ':' || new.assigned_technician_id::text
  );
  return new;
end;
$$;

create trigger trg_notify_order_assigned
  after update of assigned_technician_id on public.service_orders
  for each row
  when (new.assigned_technician_id is not null and new.assigned_technician_id is distinct from old.assigned_technician_id)
  execute function public.notify_order_assigned();

-- Presupuesto enviado / aceptado / rechazado
create or replace function public.notify_quote_status() returns trigger
language plpgsql security definer set search_path = '' as $$
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

create trigger trg_notify_quote_status
  after update of status on public.order_quotes
  for each row
  when (new.status is distinct from old.status and new.status in ('sent', 'accepted', 'rejected'))
  execute function public.notify_quote_status();

-- Pago aprobado / rechazado / pendiente. Cubre duplicados de webhook: dos
-- llamadas del mismo evento de Mercado Pago comparten dedupe_key
-- (payment_<status>:<payment_transactions.id>), asi que la segunda insercion
-- siempre resuelve en "do nothing".
create or replace function public.notify_payment_status() returns trigger
language plpgsql security definer set search_path = '' as $$
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

create trigger trg_notify_payment_insert
  after insert on public.payment_transactions
  for each row
  when (new.status in ('approved', 'rejected', 'pending'))
  execute function public.notify_payment_status();

create trigger trg_notify_payment_update
  after update of status on public.payment_transactions
  for each row
  when (new.status in ('approved', 'rejected', 'pending') and new.status is distinct from old.status)
  execute function public.notify_payment_status();

-- Reclamo abierto
create or replace function public.notify_claim_opened() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_case_stakeholders(
    new.id, 'claim_opened', 'Reclamo abierto: ' || new.subject, new.description, 'high',
    'claim_opened:' || new.id::text, new.opened_by
  );
  return new;
end;
$$;

create trigger trg_notify_claim_opened
  after insert on public.support_cases
  for each row execute function public.notify_claim_opened();

-- Reclamo resuelto
create or replace function public.notify_claim_resolved() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.notify_case_stakeholders(
    new.id, 'claim_resolved', 'Reclamo resuelto: ' || new.subject, new.resolution_notes, 'normal',
    'claim_resolved:' || new.id::text, new.resolved_by
  );
  return new;
end;
$$;

create trigger trg_notify_claim_resolved
  after update of status on public.support_cases
  for each row
  when (new.status = 'resolved' and old.status is distinct from 'resolved')
  execute function public.notify_claim_resolved();

-- Mensaje nuevo en un reclamo (no interno)
create or replace function public.notify_claim_message() returns trigger
language plpgsql security definer set search_path = '' as $$
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

create trigger trg_notify_claim_message
  after insert on public.support_case_messages
  for each row
  when (new.is_internal = false)
  execute function public.notify_claim_message();

-- Mensaje nuevo en una conversacion general
create or replace function public.notify_new_message() returns trigger
language plpgsql security definer set search_path = '' as $$
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

create trigger trg_notify_new_message
  after insert on public.messages
  for each row
  when (new.is_internal = false)
  execute function public.notify_new_message();

-- Liquidacion programada / liberada / pagada
create or replace function public.notify_settlement_status() returns trigger
language plpgsql security definer set search_path = '' as $$
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
$$;

create trigger trg_notify_settlement_status
  after update of status on public.technician_settlements
  for each row
  when (new.status is distinct from old.status and new.status in ('scheduled', 'released', 'paid'))
  execute function public.notify_settlement_status();

-- Validacion tecnica: se integra el sistema existente (technician_notifications)
-- en vez de duplicarlo. Cada insercion ahi genera un espejo en notifications
-- para que aparezca en la bandeja general; la vista propia del tecnico
-- (ValidationStatusView) sigue leyendo technician_notifications sin cambios.
create or replace function public.notify_technician_validation_mirror() returns trigger
language plpgsql security definer set search_path = '' as $$
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

create trigger trg_notify_technician_validation
  after insert on public.technician_notifications
  for each row execute function public.notify_technician_validation_mirror();

-- ============================================================
-- 4. Realtime (para futuro empuje en vivo; hoy el badge usa polling)
-- ============================================================
alter publication supabase_realtime add table public.notifications;
