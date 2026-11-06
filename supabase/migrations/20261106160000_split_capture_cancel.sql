-- Cobro repartido, Fase 3 (plan-cobro-repartido.md): cobrar (capturar) o cancelar la reserva del trabajo.
-- Requiere 20261106054542_split_work_payments.sql.
--
-- Reglas acordadas con Sandy (6/11/2026):
-- - La orden pasa a 'completed' (el técnico no puede cerrar sin la firma de conformidad del cliente) → se cobra.
-- - La orden pasa a 'cancelled' → se cancela la reserva (el cliente no paga el trabajo).
-- - Cron diario: día 4 aviso a Sandy; día 5 acción automática (cobrar si el técnico ya trabajó y no hay reclamo
--   abierto; cancelar si el trabajo ni empezó; con reclamo abierto, decide Sandy). Mercado Pago la vence al día 7.
-- - Cancelar o cobrar a mano: solo admin, con motivo.
--
-- Mientras `split_payments_enabled` siga en false no existen pagos repartidos, así que nada de esto se dispara.

alter table public.payment_transactions
  add column if not exists split_alerted_at timestamptz,
  add column if not exists split_action_reason text,
  add column if not exists cancelled_at timestamptz;

-- Avisa al servidor (pg_net → /api/gateway?action=admin-event) cuando una orden con reserva vigente se completa
-- o se cancela. Reutiliza notify_admin_event y sus secretos de Vault. Nunca frena el cambio de estado de la orden:
-- si el aviso se pierde, el cron diario lo resuelve igual.
create or replace function public.trg_split_payment_order_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status is distinct from old.status
     and new.status in ('completed', 'cancelled')
     and exists (
       select 1 from public.payment_transactions
       where order_id = new.id and split and status = 'authorized'
     ) then
    perform public.notify_admin_event(
      case when new.status = 'completed' then 'split_capture' else 'split_cancel' end,
      new.id
    );
  end if;
  return new;
exception when others then
  raise warning 'trg_split_payment_order_status: %', sqlerrm;
  return new;
end;
$function$;
revoke all on function public.trg_split_payment_order_status() from public, anon, authenticated;

drop trigger if exists split_payment_order_status on public.service_orders;
create trigger split_payment_order_status after update of status on public.service_orders
  for each row execute function public.trg_split_payment_order_status();
