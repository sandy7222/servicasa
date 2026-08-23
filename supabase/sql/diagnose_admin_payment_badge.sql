-- Diagnóstico: por qué el modal del admin no muestra el badge de "Estado de
-- Pago" en la orden be4ee8d7-77f6-45ad-b478-a232a59c406f, y si algún intento
-- de pago fallido de hoy terminó creando una orden igual (no debería).
-- Solo lectura, no modifica nada.

-- 1) Los datos reales de la orden en cuestión.
select id, title, work_mode, payment_status, fixed_price_service_id, total_quoted_amount, created_at
from public.service_orders
where id = 'be4ee8d7-77f6-45ad-b478-a232a59c406f';

-- 2) Cualquier orden creada en la última hora (para ver si algún intento
-- fallido de hoy, después del último deploy, coló una orden igual).
select id, title, work_mode, payment_status, client_name, created_at
from public.service_orders
where created_at > now() - interval '3 hours'
order by created_at desc;

-- 3) Estado de los borradores de invitado de hoy: cuántos quedaron
-- pending/rejected/cancelled/approved (pending+rejected+cancelled = intentos
-- que NO deberían haber creado ninguna orden).
select status, count(*)
from public.guest_checkout_drafts
where created_at > now() - interval '3 hours'
group by status;
