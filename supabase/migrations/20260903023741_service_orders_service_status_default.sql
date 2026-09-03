-- Bug bloqueante: "Nueva Orden" del Admin Hub (persistCreateOrder) inserta en
-- service_orders sin mandar service_status, que es NOT NULL sin default.
-- Falla con "null value in column service_status violates not-null constraint".
-- El flujo de checkout (api/payments/webhook.ts) sí lo manda explícitamente
-- ('pending'), por eso nunca se había visto ahí.
alter table public.service_orders alter column service_status set default 'pending';
