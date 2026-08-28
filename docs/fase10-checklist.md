# Fase 10 — Checklist de lanzamiento (release manager)

Fecha de esta pasada: 27-28/8/2026. Cada ítem indica cómo se verificó — no hay ningún "debería estar bien".

## Resumen ejecutivo

**No listo para lanzar todavía.** Hay 2 bloqueantes reales (migraciones no reproducibles desde el repo, y dos ítems de Auth/MP que dependen de que Sandy confirme el dashboard) y 1 decisión pendiente (backup real vs. plan pago). El resto de lo auditado está en verde con evidencia.

---

## 1. Prelanzamiento

### Congelar funcionalidades nuevas
- **[x]** Esta sesión no agregó funciones nuevas de negocio — el único código nuevo (recuperación de contraseña) fue un hallazgo de seguridad de la Fase 9, no una función pedida para el lanzamiento. El rediseño de la pantalla de login está construido pero **deliberadamente sin commitear** — Sandy pidió revisar una captura antes de mergear, y esa captura sigue pendiente por una limitación del panel del navegador en esta sesión.

### Backup y comprobación de restauración
- **[ ] Bloqueante parcial.** Confirmado contra la documentación oficial de Supabase: **el plan Free no tiene ningún backup automático** (ni diario ni PITR — eso empieza en Pro). La recomendación oficial es `supabase db dump` manual.
- No tengo la contraseña directa de Postgres (solo las API keys), así que no pude correr un `pg_dump` real.
- Hice en su lugar una foto real de los datos de catálogo/cuentas (`profiles`, `customers`, `technicians`, `categories`, `subcategories`, `system_settings`, `account_invites`) vía SQL, guardada en `backups/snapshot-datos-2026-08-28.json` (fuera de git, en `.gitignore`). No es un backup de esquema completo, es una foto de los datos que hoy importan de verdad.
- **Conteos reales al momento de la foto:** `profiles: 9, customers: 14, technicians: 4, services: 233, categories: 8, subcategories: 46, system_settings: 8, account_invites: 7, service_orders: 0, payment_transactions: 0, settlements: 0`.
- **Decisión pendiente de Sandy:** conseguir la contraseña de Postgres para que pueda correr un `pg_dump` real periódico, o asumir el riesgo del plan Free por ahora dado que no hay actividad transaccional real todavía.

### Migraciones aplicadas primero en staging y luego en producción
- **[ ] BLOQUEANTE, hallazgo real.** `list_migrations` contra el proyecto real muestra **24 migraciones aplicadas**. El repo (`supabase/migrations/`) solo tiene **6 archivos**. Reconstruir el esquema desde el repo hoy **no reproduce el estado real** — contradice directamente el criterio de "Definición de terminado" del propio roadmap ("el esquema se reconstruye desde el repositorio").
- Migraciones aplicadas y confirmadas en la base, ausentes como archivo en el repo (18):
  `connect_support_cases_module`, `fix_support_case_history_insert_for_stakeholders`, `create_conversations_messaging_system`, `fix_conversation_participants_rls_recursion`, `fix_conversations_select_column_ambiguity`, `add_conversation_participant_display_name`, `add_conversation_unread_view`, `enable_realtime_for_messages`, `notifications_center`, `notifications_center_lock_internal_functions`, `settlements_payout_batches_cron`, `settlements_lock_internal_trigger_function`, `security_sweep_and_settlement_fixes`, `security_sweep_views_anon_grants`, `fix_cron_failure_notification_survives_transaction`, `system_settings_typed_and_audited`, `tighten_technician_assignment_eligibility`, `technician_goals_and_eligibility`.
- No hay "staging" real para probar el orden primero (ver Fase 9 — decisión explícita de Sandy de no separar Supabase). El flujo real de esta sesión fue "aplicar directo a producción con DDL mostrado y aprobado antes" — funcionó, pero no es lo mismo que "primero en staging".
- **Recomendación:** antes de declarar el lanzamiento listo, backfillear los 18 archivos faltantes (aunque sea como una única migración de reconciliación que documente el estado ya aplicado) — es trabajo real, no cosmético, y no lo hice en esta pasada por el volumen que implica hacerlo bien.

### Advisors, lint, build, tests y checklist manual completos
- **[x] Advisors de seguridad**, corridos ahora mismo: **0 ítems ERROR** (el único que había — `technician_public_view` SECURITY DEFINER — se cerró en la Fase 9). Quedan WARN ya revisados y aceptados en sesiones anteriores (`get_account_invite`/`redeem_account_invite`, `is_admin`/`current_user_role`, funciones RPC con auth interna) más **uno nuevo, real y accionable: "Leaked Password Protection" está desactivada** — HaveIBeenPwned no filtra contraseñas comprometidas al registrarse o cambiarla. Es un toggle de un click en el dashboard (Authentication → Policies) que no puedo activar por API — se lo dejo pendiente a Sandy.
- **[x] `npm run lint`** (tsc --noEmit): limpio, corrido en esta sesión.
- **[x] `npm run build`**: limpio, corrido en esta sesión (dos veces, incluida la verificación del fix de `DEMO_MODE`).
- **[x] `npx vitest run`**: 67/67 tests pasando, corrido en esta sesión.
- **[ ] Checklist manual completo**: parcial — ver sección de Smoke test más abajo.

### Verificar dominio, TLS, Auth, Mercado Pago y correo de recuperación
- **[x] Dominio y TLS**: `tecniurbano.online` responde `200` con `Strict-Transport-Security` y certificado válido (confirmado en cada `curl` de esta sesión).
- **[ ] Auth (Site URL / Redirect URLs)**: **pendiente de que Sandy confirme el dashboard** (Authentication → URL Configuration) — no hay forma de leerlo por API, ya lo probamos en la Fase 9. Evidencia indirecta a favor: un link de recuperación real, generado hoy, redirigió correctamente a `https://tecniurbano.online` con los tokens — eso prueba que ese dominio específico está permitido, pero no cubre el resto de la configuración (Site URL exacto, wildcard de previews).
- **[ ] Mercado Pago (webhook, credenciales test/producción)**: **pendiente de que Sandy confirme el panel de MP** — mismo motivo, sin API de lectura. Confirmado en sesiones anteriores: credenciales hoy son TEST/sandbox en Production y Preview por igual (sin riesgo real porque no hubo lanzamiento con plata real todavía); URLs de retorno y webhook se arman dinámicamente en el código, sin dominio hardcodeado.
- **[x] Correo de recuperación**: probado de punta a punta hoy, dos veces — una con la cuenta de prueba de Julián (local) y una con la cuenta real de admin (producción). Sandy confirmó que entró y cambió la contraseña con éxito.

### Crear cuentas de prueba controladas para cada rol
- **[x]** Ya existen y se usaron durante toda la sesión: admin, María y Carlos (técnicos), Julián (cliente) — todas reales en Supabase Auth, no simuladas.

---

## 2. Hallazgo de seguridad puntual — panel de "Cuentas de prueba"

- **[x] Corregido y verificado en producción real.** `DEMO_MODE` (en `src/lib/featureFlags.ts`) ahora requiere `import.meta.env.DEV` además de la variable de entorno — Vite lo fija en build time según el modo, no se puede pisar con una variable mal configurada en Vercel.
- **Verificación real, no bundle-grep**: abrí `https://tecniurbano.online/#/auth` con `localStorage`/`sessionStorage`/Service Worker limpiados a mano (simulando un visitante sin sesión), y leí el DOM renderizado. Resultado: sin panel de cuentas de prueba, sin "Contraseña de prueba" en texto plano, campos de email/contraseña vacíos (sin `admin@tecniurbano.com.ar` prellenado).
- **Nota metodológica propia, para que quede escrita**: en el camino comparé el hash del bundle desplegado contra un build local y creí por un rato que había un problema de caché de CDN. Era un error mío — comparé contra un build local que tenía mezclado el rediseño de login todavía sin commitear. Reconstruí desde el HEAD real de `main` y el hash coincidió exactamente con producción. No hubo ningún problema de caché real.
- **Captura pendiente**: no pude generar la captura de pantalla pedida — el panel del navegador de esta sesión no está compositando frames ahora mismo (limitación del entorno, no del sitio). La verificación por DOM de arriba es completa y equivalente en cuanto a evidencia, pero si Sandy necesita la imagen específicamente, hace falta reabrir el panel del navegador y reintentar.

---

## 3. Smoke test de producción (roadmap)

Estado real, sin inflar:

| Ítem | Estado | Evidencia |
| --- | --- | --- |
| Landing y catálogo público | [x] | Confirmado en vivo esta sesión y en pasadas anteriores — 233 servicios, 8 categorías reales. |
| Alta/login/logout/recuperación | [x] | Login/logout probados hoy en producción real (admin). Recuperación probada de punta a punta dos veces hoy. Alta de cliente no se re-probó hoy específicamente. |
| Pedido registrado e invitado | [ ] | No re-probado en esta pasada — sí se probó en sesiones anteriores (guest checkout, ver Fase 1.1 del roadmap). |
| Pago de prueba autorizado | [ ] | No re-probado en esta pasada. MP sigue en modo TEST. |
| Asignación y trabajo técnico | [ ] | No re-probado en esta pasada — sí se probó en la Fase 6-7 (asignación, elegibilidad). |
| Presupuesto y firma | [ ] | No re-probado en esta pasada. |
| Reclamo y mensaje | [ ] | No re-probado en esta pasada — mensajería sí se probó en Fase 8 (E2E de no leído/leído). |
| Notificación | [ ] | No re-probado en esta pasada. |
| Liquidación visible | [ ] | No re-probado en esta pasada — sí se probó de punta a punta en la Séptima actualización de la Fase 7-8. |
| Exportación administrativa | [ ] | No re-probado nunca en esta sesión. |

**Honestidad sobre esto:** la mayoría de estos flujos ya tienen evidencia real de sesiones anteriores (documentada en las actualizaciones de Fase 5 a 8 de `ROADMAP-TERMINACION.md`), pero no se re-corrieron HOY como parte de esta pasada de Fase 10 — hacerlo completo es varias horas más de trabajo de browser automation que no entran en esta respuesta. No marco estos como "hechos" solo porque se probaron en otro momento del proyecto; quedan como pendientes de esta pasada específica.

---

## 4. Rollback

- **[x]** Documentado en `docs/rollback.md` (Fase 9): `vercel rollback <id>` para código, instantáneo; migraciones sin mecanismo automático, se revierten con una migración nueva escrita a mano.
- **[x] Nuevo hallazgo de esta sesión, ya incorporado**: `vercel cache purge` existe pero no tuvo efecto visible en el caso que probé — el mecanismo real que sí funcionó fue `vercel redeploy <deployment> --target production`, que reconstruye y realiasa en ~30-60s. Vale la pena anotarlo en `docs/rollback.md` como la herramienta real a usar si un rollback deja el CDN en un estado dudoso.

---

## 5. Pendientes explícitos para que Sandy decida, antes de dar luz verde

1. **Migraciones**: ¿backfillear los 18 archivos faltantes ahora, o aceptar el riesgo documentado y hacerlo después del lanzamiento?
2. **Backup**: ¿conseguir la contraseña de Postgres para un `pg_dump` real, o upgradear a Pro (que de paso destraba lo de branching de la Fase 9)?
3. **Auth/MP**: confirmar Site URL + Redirect URLs de Supabase, y URL/eventos del webhook de MP — sigue pendiente desde la Fase 9.
4. **Leaked Password Protection**: activarla en el dashboard (1 click, sin costo).
5. **Captura del panel de login**: reabrir el panel del navegador para que pueda generarla, si la necesitás con imagen y no solo con la verificación por DOM de arriba.

No toqué nada irreversible ni ningún pago real en esta pasada — todo lo de arriba es lectura, o cambios ya mostrados/aprobados en mensajes anteriores.
