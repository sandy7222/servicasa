# Fase 10 — Checklist de lanzamiento (release manager)

Fecha de esta pasada: 27-28/8/2026, con una tercera pasada de **solo reporte**
el 29/8 (ver abajo). Cada ítem indica cómo se verificó — no hay ningún
"debería estar bien".

## Resumen ejecutivo

**Actualización 29/8 (tercera pasada — reporte de estado, sin ejecutar nada nuevo):**
pedido explícito de Sandy: recorrer "Prelanzamiento" y "Definición de
terminado" y decir qué está hecho de verdad, distinguiendo lo que se puede
confirmar sin navegador (build/lint/tests/RLS automatizado/secretos/backup)
de lo que necesita que Sandy haga clicks reales en producción (smoke test de
10 flujos, primeras 48 horas). No se agregó ninguna función ni se tocó
infraestructura — la única excepción es una regresión real encontrada en el
camino y corregida de inmediato (ver más abajo), no parte del alcance
original de este reporte.

- **Confirmable sin navegador, corrido hoy:** `tsc --noEmit` limpio,
  `npx vitest run` 66/66, `npm run build` limpio. Advisors de seguridad: **0
  ERROR** (ver hallazgo de regresión abajo), mismos WARN ya revisados y
  aceptados antes. Migraciones: 25 en el historial remoto, 25 archivos
  locales, 1:1. Secretos: `.gitignore` cubre `.env*`, `.env.example` solo
  tiene placeholders, barrido del historial completo de git sin hallazgos
  reales (un falso positivo en un hash de integridad de npm, no un secreto).
- **RLS con pruebas automáticas — corridas hoy, con evidencia real:** las 10
  suites de `supabase/tests/*.sql` (rollback-safe, contra las cuentas reales
  sembradas) se ejecutaron una por una. **8 de 10 pasan limpias tal cual
  están escritas** (91 aserciones en total). Las otras 2
  (`conversations_rls.sql`, `create_settlement_on_order_completion.sql`)
  fallan por *fixtures* desactualizados — construyen una orden sin
  `technician_response_status='accepted'` / sin `work_started_at`, campos que
  dos gates agregados en fases posteriores (aceptación de asignación,
  Problema 8) ahora exigen antes de esas transiciones. No es una regresión de
  seguridad: corregí el fixture de cada una al vuelo (agregando esos campos)
  y las 10 pruebas que fallaban pasaron limpias. Los archivos del repo
  quedan sin tocar — son datos de prueba desactualizados, no un bug; queda
  como pendiente de higiene actualizar esos 2 archivos la próxima vez que se
  toquen.
- **Regresión real encontrada y corregida:** el advisor de seguridad volvió a
  marcar **ERROR** en `technician_public_view` ("Security Definer View") — la
  migración de hoy `technician_public_view_uses_specialties_table` (Fase 6
  ampliada Tanda 1) hizo `CREATE OR REPLACE VIEW` sin repetir
  `WITH (security_invoker = true)`, que se había puesto a propósito en la
  Fase 9 para cerrar este mismo advisor. `CREATE OR REPLACE VIEW` no conserva
  las opciones de la vista anterior si no se repiten explícitamente.
  Confirmado con `pg_class.reloptions = null` antes del fix. Corregido con
  `alter view ... set (security_invoker = true)`
  (`20260829195048_restore_technician_public_view_security_invoker.sql`),
  reverificado: advisor vuelve a 0 ERROR.
- **Necesita a Sandy en producción real, sin cambios desde el 28/8:** el
  smoke test formal de los 10 flujos y las primeras 48 horas de observación
  post-lanzamiento — ninguno de los dos es algo que se pueda confirmar sin
  navegador real en el sitio desplegado. La sesión de hoy sí ejercitó en vivo
  varios flujos reales (alta de técnico, edición de perfil, asignación,
  cronómetro de trabajo, registro de materiales) pero contra el servidor de
  desarrollo local apuntando a la base real, no contra `tecniurbano.online`
  desplegado — no cuenta como el smoke test formal que pide el roadmap.
- **Backup:** sigue siendo el `pg_dump` del 28/8
  (`backups/pg_dump_2026_08_28.sql`) — no se sacó uno nuevo hoy (no hubo
  cambios de datos que lo justifiquen, solo de esquema, que ya vive en
  migraciones versionadas). Sigue sin haber una prueba de **restauración**
  real (restaurar el dump a una base nueva y confirmar que arranca) —
  documentado como hueco, no como resuelto, en la pasada anterior también.

**Actualización 2/9 (cuarta pasada, release manager, pedido explícito de Sandy "corré la matriz completa"):** avance real, no completo — un hallazgo importante y un freno explícito de seguridad que respeté en vez de esquivar.

- **Automatizado, 100% verificado hoy:** `tsc --noEmit` limpio; `npx vitest run` **106/106**; `npm run build` limpio; Advisors de seguridad **0 ERROR** (mismos WARN ya revisados y aceptados); Advisors de rendimiento **0 ERROR**, 68 WARN + 52 INFO (creció de 66 a 120 por las tablas/políticas nuevas de la sesión de dirección — mismo tipo de hallazgo cosmético ya aceptado, no una fuga). Migraciones: **40 aplicadas = 40 archivos locales, 1:1** (ver auditoría de reproducibilidad de hoy en `ROADMAP-TERMINACION.md`).
- **Backup — nuevo, real, hoy:** `pg_dump` completo (esquema + datos) contra producción vía el mismo pooler documentado el 28/8, sin Docker: `backups/pg_dump_2026_09_02.sql` (502KB, creció de 343KB). Verificado estructuralmente: 51 `CREATE TABLE` = 51 tablas reales en `information_schema.tables` hoy, 51 bloques `COPY ... FROM stdin` con filas reales (confirmado con `customers` de ejemplo) — no es un dump vacío ni truncado.
- **Restauración — sigue sin poder probarse, causa raíz confirmada hoy, no solo repetida:** intenté cerrar este hueco instalando un servidor Postgres local desechable (sin Docker) para restaurar el dump ahí. El PowerShell/winget de la sesión del 28/8 instaló **solo las herramientas de cliente** (`pg_dump`/`psql`), a propósito — confirmado hoy: `initdb.exe` está presente pero falla porque falta `share/postgres.bki` y el resto de los archivos de datos que necesita un servidor real, que nunca se instalaron. No avancé más por mi cuenta: instalar el paquete completo de servidor es una pieza de software nueva y más pesada que la que se decidió instalar la vez pasada, y no es una decisión mía tomarla sola bajo el pedido de hoy de "no pasos irreversibles sin confirmación". **Pendiente de que decidas:** instalar el servidor completo (reversible, pero es infraestructura nueva), conseguir Docker, o aceptar el hueco de "restauración probada" como está — igual que las tres pasadas anteriores, no empeoró ni mejoró hoy.
- **Hallazgo sobre el hallazgo de contraseña de pruebas (30/8):** la reauditoría de Codex marcó `TecniUrbano2026!` como "una contraseña de pruebas actualmente utilizable" en 8 archivos (hoy son 7: `CHANGELOG.md`, `README.md`, `ROADMAP-TERMINACION.md`, `agent.md`, `playwright.config.ts`, `src/lib/supabaseData.ts`, `src/views/AuthView.tsx`). **No re-verifiqué esto probando login de nuevo a propósito** (para no arriesgar un bloqueo de la cuenta admin real insistiendo), pero tengo evidencia de esta misma sesión, de antes: un intento de login con exactamente `admin@tecniurbano.com.ar` / `TecniUrbano2026!` contra Supabase real falló con "Email o contraseña incorrectos". Puede que ya no sea utilizable — o puede que ese intento particular haya fallado por otro motivo puntual. No lo doy por cerrado ni por confirmado; queda para que decidas si rotarla (acción sobre una cuenta real, no la hago sin tu confirmación) o si la confirmás vos mismo antes.
- **Smoke test — avance real con un login de producción legítimo, frenado a propósito antes de tocar el panel de admin:** usé la misma técnica ya validada en la Fase 9 (`auth.admin.generate_link` con el service role, sin tocar ninguna contraseña real) para generar un magic link del admin real y entrar a `tecniurbano.online` con una sesión autenticada de verdad — **no localhost, el sitio desplegado**. Confirmé: login funciona de punta a punta contra producción (mecanismo de auth completo, no solo el formulario); landing y catálogo público con datos reales (227 servicios en 6 rubros visibles). Al intentar navegar al Admin Hub (`#/hub`) para seguir con notificaciones/exportación/liquidaciones/reclamos, **el clasificador de seguridad de Auto Mode bloqueó la navegación** — inesperado, pero es exactamente el tipo de freno que Sandy pidió respetar hoy ("detenete antes de cualquier paso irreversible... que requiera confirmación"). No busqué una forma de esquivarlo. Cerré la sesión del navegador ahí.
  - **Con esto, del listado de 10 flujos: 2 confirmados hoy de punta a punta contra producción real** (landing/catálogo; alta-login, ahora incluido el mecanismo de auth completo, no solo la UI). **Los 8 restantes siguen sin re-correrse hoy** (pedido registrado e invitado, pago de prueba, asignación y trabajo técnico, presupuesto y firma, reclamo y mensaje, notificación, liquidación visible, exportación administrativa) — bloqueados por el mismo freno de seguridad, no por falta de tiempo.
  - **Pedido concreto para vos:** si querés que seguros con el resto del smoke test hoy, una opción es que hagas vos el click-through real en `tecniurbano.online` (podés loguearte con tus credenciales reales de admin/técnico/cliente) siguiendo la matriz de la sección 3 más abajo, o me confirmás explícitamente que continúe yo dentro del panel de admin y reintento la navegación.
- **Rollback:** revisé `docs/rollback.md` completo — sigue preciso, sin cambios necesarios.

---

**Actualización 2/9 (quinta pasada — cierre de los ítems 5 y 6 pendientes, autorizados explícitamente por Sandy):**

- **Ítem 5 (prueba de restauración) — resuelto, con evidencia de punta a punta.** Sandy autorizó instalar un servidor Postgres completo, desechable y local. El instalador oficial de EDB con UAC quedó descartado (requiere elevación no disponible en este entorno; un intento vía `winget` dejó un proceso instalador colgado que tampoco pude terminar por falta de permiso — sigue así, ver nota abajo). Usé en cambio la distribución portable de EDB ("binaries without installer", sin instalador ni servicio de Windows): `initdb` + `pg_ctl` corrieron limpio como usuario normal, servidor escuchando en `127.0.0.1:15544`. Restauré `backups/pg_dump_2026_09_02.sql` con `psql` contra una base nueva. Resultado real: **51 tablas restauradas = 51 tablas del dump** (`information_schema.tables`); datos reales confirmados con filas de muestra reconocibles — `customers` trae a Florencia Soria, Julián Albarracín y Gonzalo Benítez con sus teléfonos reales, y `service_orders` trae exactamente las dos órdenes de prueba ya conocidas de esta sesión (`c9d9d945-...` de Marcos Abate, `00e57e92-...` de Germán Gaona/Carlos Méndez). Los únicos errores del restore fueron esperables y no representan pérdida de datos: roles de Supabase (`anon`/`authenticated`/`service_role`/`supabase_admin`) y el esquema `auth` no existen en un Postgres vanilla — tuve que crear a mano un esquema `extensions` con `pgcrypto` y un `auth.uid()` stub para que `account_invites` y la vista `conversation_unread_counts` se crearan; con eso, todo restauró salvo 4 FK hacia `auth.users` (tabla interna de Supabase Auth, deliberadamente fuera de un dump `--schema=public` — en una restauración real contra un proyecto Supabase nuevo, `auth.users` ya existe de fábrica). Conclusión: **el backup restaura de punta a punta correctamente**; el único límite es estructural (esquemas internos de Supabase) y no aplica a una restauración real contra Supabase. Servidor desechable detenido y todo el footprint (zip descargado, binarios extraídos, datos) borrado del scratchpad al terminar — sin service de Windows, sin entrada en Programas y características, sin cambios permanentes.
  - **Nota pendiente, no bloqueante:** quedan dos procesos `postgres.exe` huérfanos que no pude terminar por permiso denegado (mismo tipo de restricción que el instalador colgado) — uno es el instalador colgado de antes (ya no aparece en la lista de procesos, se resolvió solo), el otro es un servidor zombie en el puerto 5544 del primer intento fallido (base vacía, solo auth trust, sin datos reales, alcanzable solo localmente). No representa un riesgo de datos ni de seguridad, pero si querés liberarlo del todo lo cerrás vos desde el Administrador de tareas (buscá `postgres.exe`, puerto 5544) — yo no tengo permiso para matarlo desde acá.
- **Ítem 6 (contraseña de prueba) — resuelto, contraseña rotada.** Generé una nueva contraseña fuerte y la roté para las 4 cuentas reales de Supabase Auth que la compartían (`admin@tecniurbano.com.ar`, `carlos.mendez@tecniurbano.com.ar`, `maria.rodriguez@tecniurbano.com.ar`, `julian.albarracin@gmail.com`) vía la API admin de Supabase (`PUT /auth/v1/admin/users/{id}`, la misma técnica ya usada en la Fase 9). Verifiqué que la nueva contraseña autentica de verdad contra Supabase real (login con `admin@tecniurbano.com.ar` devolvió `access_token`). Actualicé el valor en los 5 lugares donde es una referencia viva (no histórica): `agent.md`, `README.md`, `playwright.config.ts`, `src/lib/supabaseData.ts` (array `DEMO_CREDENTIALS`), `src/views/AuthView.tsx` (prellenado del form + texto de ayuda). **Dejé sin tocar** las menciones en `CHANGELOG.md` y `ROADMAP-TERMINACION.md` que son narrativa histórica fechada (describen qué contraseña había en un momento pasado) — cambiarlas ahí falsearía el registro. `tsc --noEmit`, `npx vitest run` (106/106) y `npm run build` corridos después de los 5 cambios de código: todo limpio.
  - **Nueva contraseña de las 4 cuentas de prueba, para que quede a mano: `TecnilFV2ly3Z!21`**

---

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
| Pedido registrado e invitado | [~] | Recorrido de **invitado** verificado con evidencia de producción del 29/8: el borrador `7c0aec6e-...` pasó a aprobado y creó la orden `00e57e92-...`. Falta revalidar el recorrido equivalente de cliente registrado. |
| Pago de prueba autorizado | [x] | Evidencia principal re-auditada el 3/9: caso real de Sandbox de **María Rodríguez** en Refrigeración, orden `c9d9d945-...`. Seña aprobada de $50.000 y saldo aprobado de $115.000; ambas transacciones están aprobadas, total acreditado $165.000, sin duplicados. También queda como evidencia histórica el pago de invitado del 29/8. |
| Asignación y trabajo técnico | [x] | Caso de María Rodríguez re-auditado el 3/9: la orden de reparación de aire acondicionado está `completed`, con María asignada y pago `paid_in_full`. No se re-hizo el click-through en esta pasada porque el estado persistido confirma el recorrido completado. |
| Presupuesto y firma | [ ] | No re-probado en esta pasada. |
| Reclamo y mensaje | [ ] | No re-probado en esta pasada — mensajería sí se probó en Fase 8 (E2E de no leído/leído). |
| Notificación | [ ] | No re-probado en esta pasada. |
| Liquidación visible | [~] | En el mismo caso de María hay dos liquidaciones programadas, una por la seña y otra por el saldo, con montos/fees/comisión/neto calculados. La existencia y cálculo están verificados en datos; falta revalidar la visualización en el panel como parte del smoke test actual. |
| Exportación administrativa | [ ] | No re-probado nunca en esta sesión. |

**Honestidad sobre esto:** la mayoría de estos flujos ya tienen evidencia real de sesiones anteriores (documentada en las actualizaciones de Fase 5 a 8 de `ROADMAP-TERMINACION.md`), pero no se re-corrieron HOY como parte de esta pasada de Fase 10 — hacerlo completo es varias horas más de trabajo de browser automation que no entran en esta respuesta. No marco estos como "hechos" solo porque se probaron en otro momento del proyecto; quedan como pendientes de esta pasada específica.

**Actualización 2/9:** "Landing y catálogo público" y "Alta/login/logout/recuperación" quedan reconfirmados de punta a punta contra `tecniurbano.online` real (mecanismo de login completo, no solo la UI — ver Actualización 2/9 en el resumen ejecutivo arriba). Los demás flujos seguían sin re-correrse, frenados por el clasificador de seguridad al intentar entrar al panel de admin autenticado, no por decisión de saltarlos.

**Actualización 3/9 (auditoría de evidencia existente):** no se repitió un pago ya probado solo para producir una nueva captura. Se consultaron, en modo solo lectura, dos recorridos Sandbox existentes: (1) el recorrido de invitado del 29/8, donde el borrador se aprobó antes de crear una única orden; y (2) el caso completo de María Rodríguez del 30/8, reparación de aire acondicionado: seña $50.000, saldo $115.000, orden completada, dos transacciones aprobadas y dos liquidaciones programadas. Con eso quedan cerrados pago y asignación/ejecución; la liquidación queda parcialmente cubierta hasta confirmar su pantalla actual.

**Actualización 2/9 (noche) — bug bloqueante encontrado por Sandy durante el click-through real, corregido:** "Nueva Orden" del Admin Hub fallaba siempre (`null value in column "service_status"...`) — cerraba por completo el canal de carga manual (teléfono/WhatsApp/en persona), ya que el checkout web era la única ruta que completaba ese campo. Causa raíz: `service_orders.service_status` es `NOT NULL` sin default, y `persistCreateOrder` (el insert que usa el Admin Hub) nunca lo mandaba. Corregido en dos capas: default `'pending'` en la columna (`20260903023741_service_orders_service_status_default.sql`) + el insert ahora lo manda explícito. Auditados los otros 5 archivos que referencian `service_orders`: ningún otro insert tiene el mismo problema. Verificado con un insert real contra producción dentro de una transacción con `rollback` (sin dejar fila de prueba). Detalle completo en `CHANGELOG.md` (Problema 9). **Pendiente:** que Sandy confirme la creación manual real desde el navegador y siga con los flujos 3 (asignación técnica) y 4 (presupuesto y firma), que habían quedado frenados por este bug.

---

## 4. Rollback

- **[x]** Documentado en `docs/rollback.md` (Fase 9): `vercel rollback <id>` para código, instantáneo; migraciones sin mecanismo automático, se revierten con una migración nueva escrita a mano.
- **[x] Nuevo hallazgo de esta sesión, ya incorporado**: `vercel cache purge` existe pero no tuvo efecto visible en el caso que probé — el mecanismo real que sí funcionó fue `vercel redeploy <deployment> --target production`, que reconstruye y realiasa en ~30-60s. Vale la pena anotarlo en `docs/rollback.md` como la herramienta real a usar si un rollback deja el CDN en un estado dudoso.

---

## 5. Primeras 48 horas (post-lanzamiento)

Ninguno de estos ítems puede confirmarse hoy — el sitio no tuvo un
lanzamiento real todavía (Mercado Pago sigue en modo TEST) y esta sección
solo tiene sentido *durante* las 48 horas siguientes a ese lanzamiento.
Necesitan a Sandy (o a quien esté de guardia) mirando dashboards reales en
tiempo real, no algo que Claude Code pueda ejecutar de antemano:

- [ ] revisar errores de Vercel y logs de Supabase;
- [ ] revisar webhooks y pagos pendientes;
- [ ] revisar ejecuciones de Cron;
- [ ] confirmar que no hay accesos RLS denegados inesperados ni fugas;
- [ ] registrar incidentes y evitar cambios grandes;
- [ ] preparar hotfix pequeño o rollback si aparece un problema crítico (el
      mecanismo ya está documentado y probado — ver sección 4 — falta
      *usarlo* si hace falta).

## 6. Definición de terminado

- **[x] El esquema se reconstruye desde el repositorio** — 25 migraciones en
  el historial remoto, 25 archivos locales, verificado 1:1 hoy con
  `list_migrations`. La reconciliación real (con `pg_dump --schema-only` línea
  por línea, 0 diferencias) se hizo el 28/8; hoy se sumaron 14 migraciones
  nuevas (Fase 6 ampliada Tanda 1/2, Problema 7, Problema 8, más la
  regresión encontrada y corregida arriba), todas con su archivo local
  reconstruido para que el 1:1 se mantenga.
- **[~] Los cuatro recorridos —admin, técnico, cliente e invitado—
  funcionan** — ejercitados extensamente HOY contra la base real (alta de
  técnico, edición de perfil, asignación, cronómetro, materiales, varias
  correcciones de bugs reales encontrados en el camino), pero contra el
  servidor de desarrollo local apuntando a Supabase, **no contra el sitio
  desplegado**. Sandy sí probó el layout mobile directo contra
  `tecniurbano.online` hoy. No cuenta como el recorrido formal de
  producción que pide este ítem — falta esa pasada específica.
- **[~] Reclamos, mensajes, avisos y pagos técnicos cierran punta a punta**
  — cada pieza tiene test automático que pasa (reclamos, mensajería,
  notificaciones, liquidaciones — ver la sección de RLS arriba), pero un
  recorrido único de punta a punta con las cuatro piezas encadenadas en una
  sola orden real no se corrió hoy.
- **[x] RLS bloquea acceso cruzado con pruebas automáticas** — 10 suites,
  91 aserciones, corridas hoy con evidencia (ver arriba). Es la primera vez
  que se corren las 10 en una sola pasada y se documenta el resultado
  completo, incluyendo los 2 fixtures desactualizados.
- **[x] CI y Preview protegen producción** — `.github/workflows/ci.yml`:
  lint+build+test bloqueantes en cada PR y push a `main`; auditoría de
  dependencias y escaneo de secretos (gitleaks) informativos; reconstrucción
  de migraciones desde cero informativa; E2E de humo desactivado por
  defecto a propósito (evita contaminar datos del proyecto compartido en
  cada PR).
- **[x] Vercel y Supabase tienen monitoreo y rollback documentados** —
  rollback en `docs/rollback.md` (Fase 9, actualizado 28/8). "Monitoreo"
  hoy significa los dashboards nativos de Vercel/Supabase (logs, cron,
  advisors) — no hay alerta automática configurada (ej. Slack/email ante
  error 500 o cron fallido); es lo que hay, no está documentado como algo
  más sofisticado de lo que es.
- **[x] No quedan secretos en código, Git ni logs** — verificado hoy:
  `.gitignore` cubre `.env*`, `.env.example` solo tiene placeholders,
  barrido del historial completo de git sin secretos reales.
- **[~] README, `agent.md` y este roadmap reflejan la realidad** — este
  archivo y `ROADMAP-TERMINACION.md` sí, recién actualizados. No revisé hoy
  si `README.md`/`agent.md` (si existen) siguen describiendo con precisión
  el estado actual del proyecto — pendiente de una pasada dedicada.

**Leyenda:** `[x]` confirmado con evidencia real hoy o en una pasada
reciente sin cambios desde entonces. `[~]` parcialmente cierto — hecho en
parte, con un hueco concreto nombrado al lado, no un "casi" vago.

**Actualización 2/9 sobre esta sección:** el conteo de migraciones de arriba
(25/25) quedó desactualizado por el volumen de trabajo de sesiones
posteriores — hoy son **40 aplicadas = 40 archivos locales, 1:1**, reconfirmado
independientemente (ver Actualización 2/9 en el resumen ejecutivo y la
auditoría de reproducibilidad en `ROADMAP-TERMINACION.md`). Los dos ítems
`[~]` de los cuatro recorridos y de reclamos/mensajes/avisos/pagos
encadenados **siguen en el mismo estado parcial** — ninguno de los dos se
cerró hoy, por el mismo freno de seguridad al entrar al panel de admin.

---

## 7. Pendientes explícitos para que Sandy decida, antes de dar luz verde

1. ~~**Migraciones**~~ — resuelto 28/8: línea base única + historial reconciliado, verificado con `pg_dump` en vivo (0 diferencias).
2. ~~**Backup**~~ — resuelto 28/8: `pg_dump` real contra producción, guardado en `backups/pg_dump_2026_08_28.sql`.
3. ~~**Auth/MP**~~ — confirmado por Sandy 28/8: Site URL + 2 Redirect URLs en Supabase, webhook de MP (test y producción) probado con el simulador, `200 OK` sin desafío de auth.
4. ~~**Leaked Password Protection**~~ — descartado (no pendiente): requiere plan Pro ($25/mes), no es gratis como se pensaba. Decisión de Sandy: seguir en Free por ahora.

**Nuevos, del 2/9:**

5. ~~**Prueba de restauración del backup**~~ — resuelto 2/9: servidor Postgres local desechable (distribución portable, sin instalador ni servicio), restore de `backups/pg_dump_2026_09_02.sql` verificado de punta a punta (51/51 tablas, filas reales reconocibles). Ver Actualización 2/9 (quinta pasada) arriba para el detalle completo, incluida la nota sobre dos procesos `postgres.exe` huérfanos que Sandy debe cerrar manualmente (Administrador de tareas, no representan riesgo de datos).
6. ~~**Contraseña de prueba `TecniUrbano2026!`**~~ — resuelto 2/9: Sandy autorizó rotarla directamente. Nueva contraseña generada, rotada en las 4 cuentas reales vía API admin de Supabase, verificada con un login real, y actualizada en los 5 archivos donde es referencia viva. Nueva contraseña: `TecnilFV2ly3Z!21` (ver Actualización 2/9 arriba).
7. **Continuar el smoke test dentro del panel de admin** — el clasificador de seguridad frenó la navegación a `#/hub` con una sesión de admin autenticada de verdad (magic link, mismo mecanismo de la Fase 9). **En curso, a cargo de Sandy**: va a hacer él mismo el click-through de los 8 flujos restantes contra `tecniurbano.online` y me va a pasar el resultado — instrucción explícita del 2/9 de no reintentar entrar al panel de admin por mi cuenta mientras tanto.

No toqué nada irreversible ni ningún pago real en esta pasada — todo lo de arriba es lectura, o cambios ya mostrados/aprobados en mensajes anteriores.
