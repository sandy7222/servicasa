-- Bug de prioridad alta (Sandy, confirmado contra la base): el camino
-- "No sé exactamente qué necesito" para un visitante SIN CUENTA
-- (GuestServiceRequestForm.tsx) mostraba $30.000 en vez de los $50.000
-- reales. Causa real: visit_deposit_amount tenía visibility='authenticated'
-- -- fetchVisitDepositAmount() (cliente, sujeto a RLS) no podía leerlo para
-- el rol anon y caía al fallback hardcodeado VISIT_DEPOSIT_FALLBACK=30000
-- (en src/lib/supabaseData.ts). El monto REALMENTE cobrado ya era correcto
-- (api/orders/guest-checkout.ts usa supabaseAdmin, que evita RLS, y ya
-- recalculaba $50.000 desde system_settings) -- esto era puramente un bug
-- de visualización para el visitante antes de pagar, no un cobro
-- incorrecto. No es información sensible -- ya se muestra como texto
-- público en el propio formulario de invitado -- así que visibility='public'
-- es correcto, no un debilitamiento de seguridad.
update system_settings
set visibility = 'public'
where key = 'visit_deposit_amount';
