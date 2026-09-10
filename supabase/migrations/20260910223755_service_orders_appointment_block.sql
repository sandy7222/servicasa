-- Bloque horario real del turno de una orden (ver plan-zona-trabajo-agenda.md,
-- Fase 4): hasta ahora "appointmentWindow" era el texto que el cliente elige
-- en el selector "Franja para este pedido" de ServiceRequestForm.tsx /
-- GuestServiceRequestForm.tsx, pero solo quedaba pegado como texto libre
-- dentro de la descripción ("Disponibilidad solicitada: Mañana (08–12 h)") —
-- nunca se guardaba en una columna propia, así que nada podía compararlo
-- programáticamente contra la agenda del técnico (technician_working_hours /
-- technician_availability_exceptions, Fase 3). Esta columna estructurada
-- reproduce las mismas 4 opciones que ya ofrece ese selector, sin cambiar el
-- texto libre existente (queda igual en description, por compatibilidad con
-- lo que ya lee el técnico/admin).
-- 'unscheduled' = "A coordinar": sin horario fijo, nunca genera un aviso de
-- conflicto por sí solo (ver src/lib/technicianSchedule.ts). Default
-- 'unscheduled' para no romper la creación manual de órdenes del admin
-- (persistCreateOrder() en supabaseMutations.ts), que hoy no manda este campo.
alter table public.service_orders
  add column appointment_block text not null default 'unscheduled',
  add constraint service_orders_appointment_block_check
    check (appointment_block in ('unscheduled', 'morning', 'midday', 'afternoon'));
