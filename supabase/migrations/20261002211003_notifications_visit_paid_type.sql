-- Plan avisos Telegram (Fase 1): tipo de notificación para "visita de presupuesto pagada".
-- Aditiva: mantiene los 18 tipos existentes y suma 'visit_paid'.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type = any (array[
    'order_assigned','quote_sent','quote_accepted','quote_rejected',
    'payment_approved','payment_rejected','payment_pending',
    'claim_opened','claim_message','claim_resolved',
    'message_new','settlement_scheduled','settlement_released','settlement_paid',
    'technician_validation','cron_failure','technician_en_route','business_lead',
    'visit_paid'
  ]));
