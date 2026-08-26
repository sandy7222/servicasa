-- Las descripciones de platform_commission_rate y settlement_release_days
-- decian "hoy ningun codigo crea filas en technician_settlements... este
-- valor todavia no tiene consumidor real" -- cierto cuando se escribieron
-- (Fase 7), pero ya no: la migracion 20260825120000_create_settlement_on_order_completion.sql
-- conecto ambos valores al trigger real que crea la liquidacion. Solo texto,
-- ningun value cambia.

update public.system_settings
set description = 'Porcentaje que retiene la plataforma sobre cada liquidacion (0.17 = 17%). Usado por el trigger que crea la liquidacion al completar una orden con pago confirmado (platform_commission_amount = gross_amount * este valor).'
where key = 'platform_commission_rate';

update public.system_settings
set description = 'Dias desde que una liquidacion queda pending_release hasta que se libera automaticamente. Usado por el trigger de liquidacion (release_date = ahora + este valor) y por el cron de liberacion de la Fase 5.'
where key = 'settlement_release_days';
