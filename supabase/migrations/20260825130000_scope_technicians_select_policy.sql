-- Hallazgo de seguridad (Fase 8, 25/8): technicians_select_authenticated tenía
-- USING (true) — cualquier usuario autenticado podía leer la fila completa de
-- cualquier técnico (phone/email/work_phone personales, validation_notes
-- interna del admin), sin relación alguna con ese técnico. Inconsistente con
-- customers (ya restringida) y con technician_public_view, que ya tenía el
-- scoping correcto pero era saltable consultando la tabla base directo.
--
-- Esta política replica exactamente el WHERE que ya usaba technician_public_view:
-- admin, o la propia fila del técnico, o un cliente con una orden asignada a
-- ese técnico. auth.uid() va envuelto en (select ...) para evitar el warning
-- de rendimiento auth_rls_initplan (mismo patrón que technicians_update_own_professional_profile).
--
-- RLS filtra filas, no columnas: el control de columnas (nunca exponer
-- validation_notes/work_phone a quien no sea admin) se resolvió aparte, en el
-- código de la app (fetchCatalog en src/lib/supabaseData.ts).

drop policy if exists "technicians_select_authenticated" on "public"."technicians";

create policy "technicians_select_scoped" on "public"."technicians" for select to "authenticated" using (
  "public"."is_admin"()
  or ("id" in (select "profiles"."technician_id" from "public"."profiles" where "profiles"."id" = (select "auth"."uid"())))
  or (exists (
    select 1 from "public"."service_orders" "o"
    join "public"."profiles" "p" on "p"."id" = (select "auth"."uid"())
    where "o"."assigned_technician_id" = "technicians"."id" and "o"."customer_id" = "p"."customer_id"
  ))
);
