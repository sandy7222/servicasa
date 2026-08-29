-- Regresión encontrada durante el reporte de estado de Fase 10 (29/8):
-- technician_public_view_uses_specialties_table (Fase 6 ampliada Tanda 1,
-- hoy mismo) hizo CREATE OR REPLACE VIEW sin repetir
-- WITH (security_invoker = true), que se había puesto a propósito en la
-- Fase 9 para cerrar el advisor ERROR "Security Definer View" -- CREATE OR
-- REPLACE VIEW no conserva las opciones de la vista anterior si no se
-- repiten explícitamente. El advisor volvió a marcar ERROR; confirmado con
-- pg_class.reloptions = null antes de este fix.
alter view public.technician_public_view set (security_invoker = true);
