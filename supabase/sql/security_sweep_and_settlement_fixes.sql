-- Respuesta a los 3 pedidos de Sandy tras la Fase 5, antes de tocar Fase 6.
--
-- 1) Barrido sistemático de GRANT excesivos a anon (no solo el módulo de
--    turno) + EXECUTE de más en funciones SECURITY DEFINER.
-- 2) El cron de liberación ahora avisa a admin si falla (además de quedar
--    igual en cron.job_run_details).
-- 3) El trigger que saca una liquidación de un lote al pausarla ahora
--    también recalcula total_amount/settlement_count del lote.

-- ============================================================
-- 1a. GRANT de tabla excesivo a anon.
--
-- Auditoría: de las 37 tablas public con RLS, 33 tenían el set completo de
-- privilegios de tabla (SELECT/INSERT/UPDATE/DELETE/...) otorgado a `anon`
-- sin una sola policy que aplicara a ese rol — es decir, RLS bloqueaba en
-- la práctica, pero el GRANT de base quedaba abierto. Es el mismo patrón
-- que ya apareció 3 veces hoy (is_admin/current_user_role, las funciones
-- de notificaciones, las tablas de liquidaciones) — así que se cierra de
-- una sola vez en las 33, no una por una.
--
-- Las únicas 4 tablas con GRANT a anon que SÍ correspondía dejar intactas
-- son las que tienen una policy real para ese rol: `categories`,
-- `services`, `subcategories` (catálogo público) y `technician_applications`
-- (alta de "quiero ser técnico"). Esas no se tocan.
-- ============================================================
revoke all on
  public.account_invites,
  public.conversation_participants,
  public.conversations,
  public.customer_addresses,
  public.customer_admin_notes,
  public.customers,
  public.guest_checkout_drafts,
  public.materials,
  public.message_reads,
  public.messages,
  public.order_checklist_items,
  public.order_diagnosis_photos,
  public.order_events,
  public.order_materials_used,
  public.order_notes,
  public.order_quote_items,
  public.order_quotes,
  public.order_signatures,
  public.order_time_logs,
  public.payment_transactions,
  public.price_adjustments_log,
  public.profiles,
  public.service_orders,
  public.support_case_history,
  public.support_case_messages,
  public.support_cases,
  public.system_settings,
  public.technician_documents,
  public.technician_enablement_checklist,
  public.technician_goals,
  public.technician_matriculas,
  public.technician_payment_accounts,
  public.technicians
from anon;

-- ============================================================
-- 1b. EXECUTE de más en funciones SECURITY DEFINER.
--
-- Auditoría completa de las 22 funciones SECURITY DEFINER de public (no
-- solo las de hoy). La mayoría ya estaban bien: is_admin()/is_conversation_
-- participant() se usan DENTRO de policies de RLS y necesitan EXECUTE para
-- `authenticated` (si se les revoca, las consultas de esa tabla empiezan a
-- fallar con "permission denied for function" para cualquier usuario común
-- — no son falsos positivos del advisor). get_account_invite/
-- redeem_account_invite son correctas para anon (flujo de invitado sin
-- sesión). Los únicos dos casos reales de exceso:
--   - is_conversation_participant(): no necesita ser ejecutable por `anon`
--     porque las policies de conversaciones son todas `TO authenticated`.
--   - start_order_conversation(): pensada para cliente/técnico logueado
--     (resuelve auth.uid() internamente) — anon no tiene ningún uso
--     legítimo de esta RPC.
-- ============================================================
revoke execute on function public.is_conversation_participant(uuid) from anon;
revoke execute on function public.start_order_conversation(uuid, text) from anon;

-- ============================================================
-- 2. El cron de liberación notifica a admin si falla, además de quedar
-- igual en cron.job_run_details (no se reemplaza esa auditoría, se suma
-- una alerta activa usando la infraestructura de notificaciones de Fase 4).
-- ============================================================
alter table public.notifications drop constraint notifications_type_check;
alter table public.notifications add constraint notifications_type_check
  check (type = any (array[
    'order_assigned', 'quote_sent', 'quote_accepted', 'quote_rejected',
    'payment_approved', 'payment_rejected', 'payment_pending',
    'claim_opened', 'claim_message', 'claim_resolved', 'message_new',
    'settlement_scheduled', 'settlement_released', 'settlement_paid',
    'technician_validation', 'cron_failure'
  ]));

create or replace function public.run_scheduled_settlement_release() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid;
begin
  begin
    perform public.release_due_technician_settlements();
  exception when others then
    -- Un admin por fila (normalmente 1). dedupe_key por día: si el cron
    -- sigue fallando cada 15 minutos, no se manda una alerta por corrida —
    -- una por día hasta que se resuelva.
    for v_admin in select id from public.profiles where role = 'admin' loop
      perform public.create_notification(
        v_admin, 'cron_failure', 'Falló la liberación automática de liquidaciones',
        sqlerrm, null, null, 'high',
        'cron_failure:release_due_technician_settlements:' || to_char(now(), 'YYYY-MM-DD')
      );
    end loop;
    -- IMPORTANTE: no se relanza la excepción. Si lo hiciéramos, un error no
    -- atrapado en el nivel superior de la transacción del job de pg_cron
    -- revierte TODO lo hecho en ella — incluida la notificación recién
    -- insertada un momento antes. Confirmado con una prueba en vivo: con
    -- `raise;` la notificación nunca sobrevivía. La notificación (con
    -- sqlerrm en el cuerpo) es la señal confiable que se pidió; para quien
    -- igual quiera mirar el rastro crudo en Postgres, queda un WARNING
    -- (no aborta la transacción).
    raise warning 'release_due_technician_settlements() falló: %', sqlerrm;
  end;
end;
$$;

revoke all on function public.run_scheduled_settlement_release() from public, anon, authenticated;
grant execute on function public.run_scheduled_settlement_release() to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'release-technician-settlements') then
    perform cron.unschedule('release-technician-settlements');
  end if;
end $$;

select cron.schedule(
  'release-technician-settlements',
  '*/15 * * * *',
  $$select public.run_scheduled_settlement_release();$$
);

-- ============================================================
-- 3. El trigger que saca una liquidación de un lote al pausarla ahora
-- también recalcula total_amount/settlement_count del lote — no alcanza
-- con romper el vínculo si el número que ve el admin queda desactualizado.
--
-- technician_payout_batches_settlement_count_check exige settlement_count
-- > 0, así que un lote que se queda sin liquidaciones no puede guardar
-- count=0: se cancela en su lugar y se deja el último conteo/total como
-- registro histórico (un lote 'cancelled' no aparece en "lotes programados
-- a cerrar", así que ese número ya no importa operativamente).
-- ============================================================
create or replace function public.payout_batch_recalc_after_pull() returns trigger
language plpgsql security definer set search_path = '' as $$
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

drop trigger if exists trg_payout_batch_recalc_after_pull on public.technician_settlements;
create trigger trg_payout_batch_recalc_after_pull
  after update of status on public.technician_settlements
  for each row
  when (old.status = 'scheduled' and new.status is distinct from old.status and new.status not in ('scheduled', 'paid'))
  execute function public.payout_batch_recalc_after_pull();

revoke execute on function public.payout_batch_recalc_after_pull() from public, anon, authenticated;

-- ============================================================
-- 1c. La auditoría de 1a solo miró tablas base (relkind='r') y se salteó 4
-- VISTAS con el mismo patrón exacto — aplicado como migración separada
-- (security_sweep_views_anon_grants) pero documentado acá para que quede
-- todo junto:
--   - conversation_unread_counts, customer_summary, support_cases_summary:
--     security_invoker=true, ya protegidas por la RLS de las tablas de
--     base (anon no tiene policies ahí) — el GRANT era puro exceso.
--   - technician_public_view: SECURITY DEFINER (hallazgo ya documentado en
--     la auditoría de Fase 0), pero su propio WHERE usa auth.uid()/
--     is_admin() directamente — para anon, auth.uid() es null y la vista
--     devuelve 0 filas. No es explotable, y tampoco es una vista
--     actualizable (tiene una subquery con jsonb_agg), así que
--     INSERT/UPDATE/DELETE nunca funcionaron de todos modos. El GRANT
--     igual sobraba.
-- ============================================================
revoke all on
  public.conversation_unread_counts,
  public.customer_summary,
  public.support_cases_summary,
  public.technician_public_view
from anon;
