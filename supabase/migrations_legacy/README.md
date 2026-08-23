# Migraciones legacy

Estos 7 archivos representaban el intento original de tracking incremental
de Supabase, pero **no reconstruyen la base correctamente**: al intentar un
`supabase db pull` desde cero (23/8/2026, Fase 1 de `ROADMAP-TERMINACION.md`),
falló en el segundo archivo con `function is_admin() does not exist`, porque
`20260816204200_servicasa_foundation_schema.sql` nunca tuvo el esquema real
adentro (quedó como placeholder de una sesión anterior).

Se reemplazaron por un único baseline real, volcado directo desde la base de
producción con `supabase db dump`:
[`../migrations/20260823000000_baseline_live_schema.sql`](../migrations/20260823000000_baseline_live_schema.sql)
(38 tablas, 80 políticas RLS, todas las funciones — verificado que incluye
`is_admin()` de verdad).

Se dejan acá como referencia histórica de qué se intentó y cuándo, no para
volver a aplicarlos. Cualquier reconstrucción nueva parte del baseline.
