-- Recuperada el 8/11/2026 de supabase_migrations.schema_migrations (producción): se aplicó en su
-- momento directo en Supabase y nunca se había guardado el archivo en el repo. Texto tal cual.

create or replace function public.start_diagnosis_execution_after_payment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.work_mode = 'diagnosis'
     and new.status = 'assigned'
     and new.work_started_at is null
     and new.quote_status = 'accepted'
     and new.payment_status = 'paid_in_full' then

    update public.service_orders
    set status = 'in_progress',
        work_started_at = now()
    where id = new.id;

    insert into public.order_events (order_id, type, description, author)
    values (
      new.id,
      'started',
      'Trabajo iniciado automáticamente al confirmarse el pago del presupuesto.',
      'Sistema'
    );
  end if;
  return new;
end;
$function$;

comment on function public.start_diagnosis_execution_after_payment() is
  'Para work_mode=diagnosis: cuando el cliente acepta y paga el presupuesto (quote_status=accepted, payment_status=paid_in_full) mientras la orden sigue en assigned sin haber arrancado el trabajo, pasa la orden a in_progress y arranca work_started_at automáticamente, sin intervención del técnico. No afecta work_mode=direct.';

create trigger trg_start_diagnosis_execution_after_payment
after update of payment_status, quote_status on public.service_orders
for each row
execute function public.start_diagnosis_execution_after_payment();
