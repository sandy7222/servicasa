-- Hallazgo de seguridad (advisor, nivel ERROR): technician_public_view era
-- SECURITY DEFINER (security_invoker='false') -- corria con los privilegios
-- del dueno (postgres), saltando el RLS real de technicians/technician_matriculas
-- y replicando el scoping a mano en su propio WHERE. Funcionaba, pero la
-- logica de acceso vivia duplicada en la vista en vez de en el RLS real.
--
-- Ahora que technicians tiene el RLS correcto (migracion
-- 20260825130000_scope_technicians_select_policy) y technician_matriculas ya
-- tenia las policies correctas desde antes (technician_matriculas_owner_or_admin
-- + technician_matriculas_customer_assigned_approved, misma logica exacta),
-- la vista puede depender del RLS real en vez de duplicarlo.

alter view "public"."technician_public_view" set (security_invoker = true);
