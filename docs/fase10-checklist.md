# Fase 10 — Checklist de lanzamiento (release manager)

Fecha de esta pasada: 27-28/8/2026. Cada ítem indica cómo se verificó — no hay ningún "debería estar bien".

## Resumen ejecutivo

**Actualización 28/8 (segunda pasada):** los cuatro bloqueantes originales quedaron cerrados: migraciones y backup con evidencia técnica real; Auth y Mercado Pago confirmados por Sandy en los dashboards (Site URL/Redirect URLs, webhook de MP probado con el simulador, `200 OK`). "Leaked Password Protection" se descarta por ahora — requiere plan Pro, decisión explícita de quedarse en Free. Lo que sigue abierto para Fase 10 no son bloqueantes de seguridad/infraestructura sino cobertura de pruebas: 8 de los 10 flujos del smoke test del roadmap no se re-corrieron en esta pasada (ver sección 3).

---

## 1. Prelanzamiento

### Congelar funcionalidades nuevas
- **[x]** Esta sesión no agregó funciones nuevas de negocio — el único código nuevo (recuperación de contraseña) fue un hallazgo de seguridad de la Fase 9, no una función pedida para el lanzamiento. El rediseño de la pantalla de login está construido pero **deliberadamente sin commitear** — Sandy pidió revisar una captura antes de mergear, y esa captura sigue pendiente por una limitación del panel del navegador en esta sesión.

### Backup y comprobación de restauración
- **[x] Resuelto — backup real, no la foto manual como sustituto.** Confirmado contra la documentación oficial de Supabase: **el plan Free no tiene ningún backup automático** (ni diario ni PITR — eso empieza en Pro), así que esto dependía de un `pg_dump` manual.
- Conexión directa (`db.<ref>.supabase.co`) no es alcanzable desde este entorno (solo IPv6, sin salida IPv6 acá) — se resolvió usando el **connection pooler** de Supabase (`aws-0-us-east-2.pooler.supabase.com`, usuario `postgres.<project-ref>`), que sí tiene IPv4.
- `supabase db dump` (el de la CLI de Supabase) necesita Docker Desktop local, que no estaba instalado/andando y además tiró un error propio no relacionado (falla de su "Inference manager"). Se instalaron las herramientas de línea de comandos de PostgreSQL 17 directas vía `winget` (**sin** instalar ni arrancar un servidor Postgres local — solo el cliente, verificado que no quedó ningún servicio corriendo) y se corrió `pg_dump` real apuntando al pooler.
- **Resultado real**: `backups/pg_dump_2026_08_28.sql` (343KB, 48 tablas, esquema + datos completos del schema `public`), fuera de git. Reemplaza la foto manual anterior (`backups/snapshot-datos-2026-08-28.json`) como evidencia principal — esa queda como respaldo adicional, no como sustituto.
- Pendiente para más adelante (no bloqueante para lanzar): automatizar este `pg_dump` en un cron/GitHub Action en vez de correrlo a mano, antes del primer pedido con pago real.

### Migraciones aplicadas primero en staging y luego en producción
- **[x] Resuelto — reconciliado con evidencia real, no solo "debería estar bien".** `list_migrations` contra el proyecto real mostraba **24 migraciones aplicadas** en el historial remoto contra solo **6 archivos** en el repo. Se resolvió con una migración de línea base única, tal como decidió Sandy.
- **Detalle completo de las 22 versiones reconciliadas** (no 18, no "18 y pico" — el número exacto, cruzado con `list_migrations`):
  - **18 sin archivo local en ningún momento** (contenido real, nunca commiteado): `connect_support_cases_module` (20260823193334), `fix_support_case_history_insert_for_stakeholders` (20260823195308), `create_conversations_messaging_system` (20260823203049), `fix_conversation_participants_rls_recursion` (20260823203251), `fix_conversations_select_column_ambiguity` (20260823203436), `add_conversation_participant_display_name` (20260823203618), `add_conversation_unread_view` (20260823203721), `enable_realtime_for_messages` (20260823205523), `notifications_center` (20260823213704), `notifications_center_lock_internal_functions` (20260823213742), `settlements_payout_batches_cron` (20260824224417), `settlements_lock_internal_trigger_function` (20260824224445), `security_sweep_and_settlement_fixes` (20260824230347), `security_sweep_views_anon_grants` (20260824230503), `fix_cron_failure_notification_survives_transaction` (20260824230800), `system_settings_typed_and_audited` (20260825014523), `tighten_technician_assignment_eligibility` (20260825130211), `technician_goals_and_eligibility` (20260825130355).
  - **4 con archivo local, pero con timestamp distinto al que Supabase registró de verdad al aplicarlas** (contenido ya documentado, solo el número de versión era "de mentira" — tipeado a mano en vez de copiar el real): `create_settlement_on_order_completion` (real: 20260825140321, archivo tenía: 20260825140000), `scope_technicians_select_policy` (real: 20260825233531, archivo tenía: 20260825130000), `technician_public_view_security_invoker` (real: 20260826001800, archivo tenía: 20260825140000), `fix_stale_settings_descriptions` (real: 20260826003814, archivo tenía: 20260825150000).
  - Más las 2 versiones de baseline previas (`20260823000000`, `20260823185803`) que sí tenían archivo y coincidían, pero quedaron subsumidas en la nueva línea base consolidada.
- **Causa raíz identificada** (no solo el síntoma): al aplicar DDL a producción vía la herramienta MCP de Supabase, el timestamp real que queda registrado en `supabase_migrations.schema_migrations` lo genera la propia herramienta en el momento — y el archivo local se escribía después, a mano, con un timestamp elegido por Claude en vez del real. Esto ya había pasado una vez antes (la baseline del 23/8, `20260823000000_baseline_live_schema.sql`) y volvió a pasar 20 migraciones después — confirmando que es un patrón, no un hecho aislado.
- **Regla concreta para que no se repita** (verificable, no una promesa vaga): todo cambio de esquema aplicado a producción se commitea a `supabase/migrations/` **en el mismo momento**, usando el timestamp de versión **exacto que Supabase generó al aplicarlo** — nunca uno elegido a mano. Y antes de cerrar cualquier tarea que haya tocado el esquema, se corre `list_migrations` (o `supabase db pull`) para confirmar 1:1 entre archivo local e historial remoto, sin asumir que coincide.
- **Ejecución real de la reconciliación (28/8):**
  1. `supabase migration repair --status reverted` sobre las 24 versiones del historial viejo (comando único, confirmado con salida real: `Repaired migration history: [...] => reverted`).
  2. Se borraron del repo los 6 archivos viejos ya subsumidos (`20260823000000_baseline_live_schema.sql`, `20260823185803_remote_schema.sql`, y las 4 con timestamp incorrecto).
  3. Se generó `supabase/migrations/20260828000000_baseline_reconciliation.sql` con `pg_dump --schema-only` real contra la base en vivo (vía el pooler, sin Docker — ver nota de backup).
  4. `supabase migration repair --status applied 20260828000000` (confirmado: `Repaired migration history: [20260828000000] => applied`).
  5. **Verificación pedida explícitamente por Sandy con la salida cruda, no un resumen:** `supabase db pull` ya no reportó el error de historial no coincidente (esa parte quedó resuelta), pero se frenó en el paso siguiente (generar shadow database para diff de esquema) porque ese paso requiere Docker, que no está disponible en este entorno — salida real: `failed to inspect docker image: ... Docker Desktop is a prerequisite for local development`. Como verificación equivalente sin Docker, se corrió un `pg_dump --schema-only` nuevo contra la base real y se comparó línea por línea contra el archivo commiteado: **0 diferencias en las 5805 líneas.** Confirma que el repo es fiel al estado real, aunque no fue el comando `db pull` completo el que lo confirmó.
- No hay "staging" real para probar el orden primero (ver Fase 9 — decisión explícita de Sandy de no separar Supabase). El flujo real de esta sesión fue "aplicar directo a producción con DDL mostrado y aprobado antes" — funcionó, pero no es lo mismo que "primero en staging".

### Advisors, lint, build, tests y checklist manual completos
- **[x] Advisors de seguridad**, corridos ahora mismo: **0 ítems ERROR** (el único que había — `technician_public_view` SECURITY DEFINER — se cerró en la Fase 9). Quedan WARN ya revisados y aceptados en sesiones anteriores (`get_account_invite`/`redeem_account_invite`, `is_admin`/`current_user_role`, funciones RPC con auth interna) más un ítem revisado y descartado por decisión de Sandy: **"Leaked Password Protection" está desactivada, pero activarla requiere plan Pro ($25/mes)** — no es un toggle gratis como se pensó inicialmente. Evaluado junto con el backup automático (otro beneficio de Pro), Sandy decidió quedarse en Free por costo. Este ítem queda descartado, no pendiente, hasta que se justifique el upgrade.
- **[x] `npm run lint`** (tsc --noEmit): limpio, corrido en esta sesión.
- **[x] `npm run build`**: limpio, corrido en esta sesión (dos veces, incluida la verificación del fix de `DEMO_MODE`).
- **[x] `npx vitest run`**: 67/67 tests pasando, corrido en esta sesión.
- **[ ] Checklist manual completo**: parcial — ver sección de Smoke test más abajo.

### Verificar dominio, TLS, Auth, Mercado Pago y correo de recuperación
- **[x] Dominio y TLS**: `tecniurbano.online` responde `200` con `Strict-Transport-Security` y certificado válido (confirmado en cada `curl` de esta sesión).
- **[x] Auth (Site URL / Redirect URLs)**: **confirmado por Sandy (28/8).** Site URL corregido a `https://tecniurbano.online`, 2 Redirect URLs guardadas en el dashboard.
- **[x] Mercado Pago (webhook, credenciales test/producción)**: **confirmado por Sandy (28/8).** Webhook configurado en Modo de prueba y Modo productivo, URL `https://tecniurbano-plum.vercel.app/api/payments/webhook`, solo evento "Pagos (legacy)" tildado. Probado con el simulador de MP contra producción: respuesta `200 OK` sin desafío de autenticación.
- **[x] Correo de recuperación**: probado de punta a punta hoy, dos veces — una con la cuenta de prueba de Julián (local) y una con la cuenta real de admin (producción). Sandy confirmó que entró y cambió la contraseña con éxito.

### Crear cuentas de prueba controladas para cada rol
- **[x]** Ya existen y se usaron durante toda la sesión: admin, María y Carlos (técnicos), Julián (cliente) — todas reales en Supabase Auth, no simuladas.

---

## 2. Hallazgo de seguridad puntual — panel de "Cuentas de prueba"

- **[x] Corregido y verificado en producción real.** `DEMO_MODE` (en `src/lib/featureFlags.ts`) ahora requiere `import.meta.env.DEV` además de la variable de entorno — Vite lo fija en build time según el modo, no se puede pisar con una variable mal configurada en Vercel.
- **Verificación real, no bundle-grep**: abrí `https://tecniurbano.online/#/auth` con `localStorage`/`sessionStorage`/Service Worker limpiados a mano (simulando un visitante sin sesión), y leí el DOM renderizado. Resultado: sin panel de cuentas de prueba, sin "Contraseña de prueba" en texto plano, campos de email/contraseña vacíos (sin `admin@tecniurbano.com.ar` prellenado).
- **Nota metodológica propia, para que quede escrita**: en el camino comparé el hash del bundle desplegado contra un build local y creí por un rato que había un problema de caché de CDN. Era un error mío — comparé contra un build local que tenía mezclado el rediseño de login todavía sin commitear. Reconstruí desde el HEAD real de `main` y el hash coincidió exactamente con producción. No hubo ningún problema de caché real.
- **[x] Evidencia aceptada por Sandy sin captura de imagen**: la verificación por DOM de arriba (página real, sesión limpia, panel ausente del árbol renderizado) se considera evidencia suficiente — si el panel no está en el DOM, no hay forma de que un visitante lo vea, tenga o no screenshot. No se insiste con la captura.

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

1. ~~**Migraciones**~~ — resuelto 28/8: línea base única + historial reconciliado, verificado con `pg_dump` en vivo (0 diferencias).
2. ~~**Backup**~~ — resuelto 28/8: `pg_dump` real contra producción, guardado en `backups/pg_dump_2026_08_28.sql`.
3. ~~**Auth/MP**~~ — confirmado por Sandy 28/8: Site URL + 2 Redirect URLs en Supabase, webhook de MP (test y producción) probado con el simulador, `200 OK` sin desafío de auth.
4. ~~**Leaked Password Protection**~~ — descartado (no pendiente): requiere plan Pro ($25/mes), no es gratis como se pensaba. Decisión de Sandy: seguir en Free por ahora.

No toqué nada irreversible ni ningún pago real en esta pasada — todo lo de arriba es lectura, o cambios ya mostrados/aprobados en mensajes anteriores.
