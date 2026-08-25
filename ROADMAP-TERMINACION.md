# Hoja de ruta de finalización — TecniUrbano / ServiCasa

**Fecha de corte:** 23 de agosto de 2026 (actualizado en sesión de planificación, posterior al cierre de Fases 1 y 2 de categorías/subcategorías)
**Código revisado:** commit `cd9c607` como base + trabajo posterior descripto en la sección 1.1, rama `feature/mercadopago-payments-backend`
**Objetivo:** terminar el producto con Claude Code, llevarlo a una producción reproducible en Supabase y Vercel, y cerrar los módulos que hoy están desconectados, incompletos o apenas iniciados.

> **Nota de esta actualización:** este documento parte de una auditoría publicada como Claude Artifact y procesada por otro asistente (Sol/ChatGPT) el 22/8. Desde entonces, en una sesión de planificación paralela con Claude (Cowork) + Claude Code, se cerraron las Fases 1 y 2 de la migración de categorías/subcategorías y se abrió un hallazgo nuevo (unificación del catálogo de pago directo) que todavía no está resuelto. Esos cambios están incorporados abajo. El resto del documento (reclamos, mensajería, liquidaciones, metas, configuración, CI, Vercel) no fue re-auditado en esta actualización — sigue reflejando la foto del 22/8.
>
> **Segunda actualización (23/8, sesión de pagos en vivo con Claude Code):** todo lo tildado `[x]` en este documento ya se cerró y se probó en producción. Además de los dos ítems de la sección 1.1, esta sesión también resolvió, sin que este documento los tuviera anotados como pendientes:
> - [x] Bug de arquitectura: la orden/cliente de invitado se creaba en la base antes de confirmar el pago con Mercado Pago, dejando registros huérfanos cuando el pago fallaba. Corregido: ahora el webhook crea todo recién cuando el pago queda `approved`. Probado en vivo con tarjeta, wallet y abandono de checkout.
> - [x] Fase 4 de categorías/subcategorías (editor de escritura real en el admin: crear/editar/reordenar/ocultar/fusionar). Este documento todavía la daba por no iniciada — ya está terminada y en producción. Solo faltan las Fases 5-6 (apagar las columnas de texto viejas).
> - [x] Numeración correlativa de clientes y técnicos (CLI-0001, TEC-0001).
> - [x] Ficha del cliente sin mostrar método de pago ni servicio contratado en el historial de pagos.
> - [x] Cacheo del service worker sirviendo hasta 24hs de datos viejos de Supabase en el panel operativo.
> - [x] 5 commits hechos y nunca subidos a `origin` — ya están en GitHub.
>
> Lo que **no** se tocó y sigue tal cual esta sesión lo encontró: toda la Fase 0 en adelante (rotación de credenciales, reclamos, mensajería, notificaciones, liquidaciones/Cron, metas, configuración, CI, Vercel), y el hallazgo de que la rama `feature/mercadopago-payments-backend` (21 commits) sigue sin un Pull Request a `main`.
>
> **Tercera actualización (23/8, tarde/noche):** Fase 0 cerrada salvo el chequeo manual de Deployment Protection en Vercel y del webhook de Mercado Pago en su dashboard. Arrancó la Fase 1 el mismo día y ya resolvió su pieza más difícil, probada de punta a punta (detalle completo con evidencia en la sección de Fase 1 más abajo, actualizada directamente por Code):
> - [x] Confirmado el problema raíz: de las 17 migraciones que Supabase tenía registradas como aplicadas, solo 7 tenían archivo en el repo, y la primera (`servicasa_foundation_schema.sql`) era un placeholder vacío — la base nunca se pudo reconstruir desde el repo hasta hoy.
> - [x] Nuevo baseline de 2 archivos (`20260823000000_baseline_live_schema.sql` + `20260823185803_remote_schema.sql`), probado reconstruyendo una base vacía sin errores y verificado 2/2 contra remoto. Los 7 archivos viejos se archivaron en `supabase/migrations_legacy/`, no se borraron.
> - [x] **Hallazgo de seguridad durante la propia verificación:** el primer intento de dump (solo schema `public`) se perdía el trigger `handle_new_user()` (en `auth.users`) y las políticas de Storage — hubiera dejado el alta de usuarios nuevos rota en silencio si se usaba tal cual. Corregido con `db pull` completo. De paso encontraron y revocaron GRANT excesivos a `anon`/`authenticated` en 6 tablas.
> - [x] Categorías/subcategorías y la unificación del catálogo de pago directo quedan formalizadas dentro de este mismo baseline (que refleja el estado actual de la base) — confirmado por Code, no hace falta migración aparte para esos dos ítems.
> - [x] Commit `5be50a2` ya subido a GitHub.
> - [ ] Quedan pendientes de la Fase 1: regenerar tipos TypeScript y escribir las pruebas pgTAP — incluyendo el test obligatorio de rechazo de precio manipulado en ambos triggers, arrastrado sin confirmar desde el 22/8.
>
> **Cuarta actualización (23/8, sesión continuada — Fase 4):** Fase 4 (centro general de notificaciones) resuelta y probada en producción:
> - [x] Tabla universal `notifications` (`recipient_profile_id`, tipo, título, cuerpo, entidad relacionada, prioridad, `read_at`, clave de idempotencia `dedupe_key` con índice único parcial) + mapa evento→destinatario implementado como triggers sobre las tablas reales: asignación de orden, presupuesto enviado/aceptado/rechazado, pago aprobado/rechazado/pendiente, reclamo abierto/respondido/resuelto, mensaje nuevo, liquidación programada/liberada/pagada.
> - [x] `technician_notifications` (validación técnica) integrado por espejo automático hacia `notifications` — no se duplicó el sistema; la vista propia del técnico sigue leyendo la tabla original sin cambios.
> - [x] Bandeja con campana + badge de no leídos en el `Header` (`NotificationBell.tsx`), marcar uno/todos como leídos, enlace a la entidad (reclamo/conversación con ruta real; orden/pago aterriza en el espacio de trabajo del rol).
> - [x] Duplicados de webhook cubiertos con prueba en vivo: dos actualizaciones de estado sobre la misma fila de `payment_transactions` (simulando un reintento real de Mercado Pago) producen una sola notificación gracias al `dedupe_key` único.
> - [x] **Hallazgo de seguridad durante la propia verificación:** `create_notification()` y el resto de funciones `SECURITY DEFINER` del módulo quedaban con `EXECUTE` público por el comportamiento por defecto de Postgres — cualquier usuario autenticado (o anónimo) podía llamarlas directo por `/rest/v1/rpc/...` y forjar notificaciones para cualquier destinatario con contenido arbitrario. Corregido revocando `EXECUTE` de `anon`/`authenticated` en las 14 funciones nuevas (las triggers siguen disparando igual — no necesitan el permiso). Confirmado con un test negativo en vivo.
> - [x] 14/14 pruebas de RLS/idempotencia en vivo (`supabase/tests/notifications_rls.sql`), con rollback — cubren aislamiento por destinatario, admin viendo todo, protección contra reescritura de campos ajenos a `read_at`, y el caso de webhook duplicado.
> - [ ] Queda pendiente para más adelante: deep-link preciso a la orden puntual para admin/técnico (hoy aterriza en el espacio de trabajo general, no en la orden exacta — el cliente sí tiene ruta exacta vía `/customer/orders/:id`); límites de retención/paginación de la bandeja si crece mucho.
>
> **Quinta actualización (23/8, sesión continuada — Fase 5):** Fase 5 (liquidaciones y pagos a técnicos) resuelta y probada en producción:
> - [x] `release_due_technician_settlements()` ya existía en el esquema (correcta: solo toca `pending_release` vencidas y sin disputa) pero nunca estaba programada — se habilitó **pg_cron** (no estaba instalado) y se agendó el job `release-technician-settlements` cada 15 minutos. Al liberar, dispara la notificación de Fase 4 sin código adicional.
> - [x] Cierre de lote (`close_payout_batch()`) diseñado como operación atómica e idempotente: transición con guarda `WHERE status='scheduled'` — un segundo cierre (doble click, doble ejecución) encuentra 0 filas y no hace nada (`closed=false`), sin doble pago. Marca las liquidaciones `paid`, dispara notificación de Fase 4, y registra auditoría en `technician_payout_batch_audit` (tabla nueva).
> - [x] Bucket privado `payout-receipts` para comprobantes, con política de admin (todo) y técnico (solo lectura de sus propios lotes) — mismo patrón que `technician-documents`. UI de cierre (`PayoutBatchesPanel.tsx`) sube el comprobante y llama a la RPC; el portal del técnico (`EarningsView.tsx`) lo abre con URL firmada, no pública.
> - [x] **Bug real encontrado al integrar Reclamos:** pausar una liquidación que ya estaba `scheduled` (dentro de un lote) la dejaba con `payout_batch_id` colgando — el lote quedaba con un total que ya no correspondía a lo que realmente se iba a pagar. Corregido con un trigger (`technician_settlements_clear_batch_on_pull`) que limpia `payout_batch_id`/`scheduled_date` automáticamente al salir de `scheduled` hacia cualquier estado que no sea `paid`, sin importar qué código dispare la transición.
> - [x] **Hallazgo de seguridad:** `technician_settlements` y `technician_payout_batches` (tablas de dinero) tenían `GRANT` de tabla completo (`SELECT/INSERT/UPDATE/DELETE`) para `anon` — RLS ya bloqueaba el acceso en la práctica (solo hay policies para `authenticated`), pero era un privilegio excesivo inconsistente con las 6 tablas ya endurecidas en Fase 1. Revocado. También se revocó `EXECUTE` público de la función de trigger nueva, mismo patrón que Fase 4.
> - [x] Conciliación administrativa nueva (`SettlementReconciliation.tsx` sobre la vista `admin_settlement_reconciliation`): filtra por estado, técnico, fecha e importe.
> - [x] 18/18 pruebas en vivo con rollback (`supabase/tests/settlements_payout_rls.sql`): doble ejecución del cron (segunda corrida libera 0), doble cierre de lote (segunda vez no paga ni duplica notificación/auditoría), permisos (un técnico no puede cerrar un lote ni modificar importes ni ver liquidaciones ajenas), y el enganche real con reclamos.
> - [ ] No probado con datos reales end-to-end en el navegador: hoy no hay liquidaciones ni lotes reales en producción (la limpieza de datos de prueba de sesiones anteriores dejó la tabla vacía), así que el flujo de UI se verificó por inspección + build, no clickeando un cierre real. La RPC que la UI llama es la misma que corrieron las 18 pruebas.
>
> **Sexta actualización (23/8, revisión de Sandy tras la Fase 5 — 3 pedidos antes de Fase 6):**
> - [x] **Barrido de seguridad completo, no solo el módulo de turno** — Sandy notó que el mismo patrón (RLS bloqueaba en la práctica, pero el `GRANT` de tabla de fondo quedaba abierto) apareció 3 veces en el mismo día y pidió cerrarlo de raíz. Auditoría de las 37 tablas + 4 vistas `public` con RLS: **33 tablas y 4 vistas** (incluidas `payment_transactions`, `profiles`, `customers`, `service_orders`, `technician_payment_accounts`) tenían el set completo de privilegios (`SELECT/INSERT/UPDATE/DELETE/...`) otorgado a `anon` sin una sola policy que aplicara a ese rol. Revocado en una sola pasada — no una por una. Las 4 vistas se detectaron recién en la verificación posterior (la primera consulta solo miraba tablas base, no vistas); quedan documentadas para que no se repita ese punto ciego. Auditoría completa también de las 22 funciones `SECURITY DEFINER` de `public`: 2 tenían `EXECUTE` de más para `anon` (`is_conversation_participant`, `start_order_conversation`) — revocado; el resto ya estaba correcto (algunas, como `is_admin()`, necesitan el `EXECUTE` porque las usa la propia RLS).
> - [x] **Monitoreo del cron** — se agregó `run_scheduled_settlement_release()` como wrapper: si `release_due_technician_settlements()` falla, notifica a todos los admin usando la infraestructura de Fase 4 (con el error real en el cuerpo del aviso), en vez de depender de que alguien revise `cron.job_run_details` a mano. **Corrección propia durante la verificación:** el primer diseño relanzaba la excepción para que además quedara "failed" en `cron.job_run_details` — probado en vivo, eso hacía que la notificación se revirtiera junto con el resto de la transacción del job y nunca llegara a persistir. Corregido: ya no se relanza (queda un `WARNING` en los logs de Postgres para quien igual quiera mirar), así la notificación es la señal confiable y sí sobrevive.
> - [x] **Recalculo del lote al pausar una liquidación** — el trigger de la Fase 5 solo desvinculaba la fila (`payout_batch_id`/`scheduled_date` en null); ahora un segundo trigger recalcula `total_amount`/`settlement_count` del lote a partir de lo que realmente sigue `scheduled`. Si el lote queda sin liquidaciones, no puede guardar `settlement_count=0` (constraint `> 0` en la tabla), así que se cancela en su lugar.
> - [x] 5 pruebas nuevas en vivo con rollback (`supabase/tests/security_sweep_and_cron_failure.sql`): recalculo parcial correcto, lote vacío se cancela sin violar el constraint, la notificación de fallo de cron se crea y sobrevive, y una segunda falla el mismo día no duplica el aviso.
>
> **Séptima actualización (25/8, cierre del hallazgo de la Fase 7 — quién crea la primera liquidación):** se resolvió, con aprobación explícita de Sandy en cada paso, el hallazgo de que ningún código creaba filas en `technician_settlements`.
> - [x] **Pregunta de hecho respondida con evidencia de código, no supuesto:** sí, hoy es posible que una orden quede `completed` sin el pago final confirmado — vía el "Cierre excepcional" de administración (`persistAdminExceptionalClose`), que pone `status='completed'` sin chequear `payment_status` en ningún lado (ni cliente ni base). El flujo normal del técnico sí lo exige indirectamente (no se puede entrar a `in_progress` sin `paid_in_full`), y además hay dos triggers de base que lo refuerzan (`enforce_service_order_pricing`, `prevent_unpaid_execution_timer`) — pero el cierre excepcional es una salida documentada e intencional que los saltea a todos.
> - [x] **Regla aplicada:** la liquidación se crea recién cuando las dos condiciones están cumplidas (orden `completed` Y `payment_status='paid_in_full'`), lo que pase último.
> - [x] **Decisión de producto de Sandy:** solo automático — si un cierre excepcional deja la orden completada sin que el pago se confirme nunca, el técnico no cobra ese trabajo. No se construyó ningún mecanismo manual de creación de liquidación.
> - [x] Migración formal `supabase/migrations/20260825120000_create_settlement_on_order_completion.sql` (mostrada y aprobada antes de aplicar). Trigger idempotente: revisa el estado completo en cada disparo (no lo que cambió puntualmente), con índice único parcial (`technician_settlements_one_completed_work_per_order`) + `ON CONFLICT DO NOTHING` como defensa adicional contra duplicados.
> - [x] Montos de datos reales, nada hardcodeado: `gross_amount` = `total_paid_amount`, `payment_fee_amount` = suma real de `mp_fee_amount` de Mercado Pago, `platform_commission_amount` = gross × `platform_commission_rate` (Fase 7), `release_date` = ahora + `settlement_release_days` (Fase 7) — conecta sin tocar nada más con el cron de la Fase 5.
> - [x] 4/4 pruebas en vivo con rollback (idempotencia, montos exactos) + **prueba de punta a punta con una orden real, no simulada en rollback**: orden creada, técnico asignado por el modal real de admin (confirmando además en vivo la consolidación de elegibilidad de la Fase 6: Carlos y Sergio aparecieron correctamente "no habilitados", María elegible), pago confirmado replicando exactamente las mismas escrituras que hace el webhook real de Mercado Pago (única simulación — el webhook de MP no puede llegar a `localhost` en desarrollo), orden completada con la misma sentencia exacta que ejecuta `persistUpdateOrderStatus` en producción. Liquidación verificada visualmente en el panel de conciliación del admin y en "Mis ganancias" del técnico (primera vez en toda la sesión que se ve una liquidación real, no vacía, en esa pantalla). Datos de prueba limpiados y verificados con conteo.
> - [x] **Dos chequeos adicionales pedidos por Sandy tras ver el resultado**, para no dejar nada solo "garantizado por diseño": (1) negativo — un cierre excepcional real (`status='completed'` sin tocar `payment_status`, que queda `pending`) confirmado en vivo que NO crea ninguna liquidación; de yapa, se probó que si el cliente termina pagando *después* del cierre excepcional, ahí sí se crea (correcto: en ese momento se cumplen las 2 condiciones). (2) duplicado — se forzó un `INSERT` directo duplicado sin `ON CONFLICT` y falló con `unique_violation` (prueba de que el índice único existe y se aplica, no solo que la función tiene un chequeo previo bien escrito), y se re-disparó el trigger de verdad re-seteando `status`/`payment_status` sin que duplicara nada. 6/6 pruebas nuevas en vivo con rollback.

---

## 1. Punto de partida real

El relevamiento visual del 22/8 estimó un **62% de avance ponderado**. Esa cifra sigue siendo útil como panorama general, pero el catálogo y su categorización avanzaron sustancialmente después de esa foto.

### Lo que ya está suficientemente construido

| Área | Estado de trabajo | Decisión del roadmap |
| --- | --- | --- |
| Autenticación y tres roles | Operativa con Supabase | Mantener y cubrir con pruebas |
| Ciclo de órdenes | Muy avanzado | Proteger con pruebas de regresión |
| Presupuestos y cobros | Mercado Pago, seña, saldo, pago directo e invitado | Endurecer, monitorear y probar. [x] Ver 1.1 — catálogo de pago directo unificado (cerrado 23/8). [x] Corregido el bug de arquitectura del invitado (orden creada antes del pago) — ver nota de la segunda actualización arriba. |
| Invitado sin cuenta | Pedido, pago y seguimiento | Mantener y probar casos de error |
| Catálogo tarifado | 233 servicios y 8 rubros | No reconstruir |
| Categorías/subcategorías | **Modelo relacional creado y poblado, con editor de escritura real en el admin.** Tablas `categories` (8 filas) y `subcategories` (43 filas) reales en Supabase, con RLS espejando `services`. Los 233 servicios ya tienen `category_id`/`subcategory_id` migrados sin huérfanos (0 sin categoría, exactamente 2 sin subcategoría, ambos casos intencionales). Lectura pública (`ServicesCategoryView.tsx`), catálogo admin y `QuoteBuilder.tsx` ya conectados a las tablas nuevas — Fases 1 a 4 completas. | [x] Terminar el último paso de lectura (`QuoteBuilder.tsx`). [ ] Fases 5-6 — retirar `services.category`/`subcategoria` (texto) recién 2-4 semanas después de confirmar que nada los lee. |
| Alta y validación de técnicos | Muy avanzada | Integrar sus avisos al sistema general |
| Perfil, disponibilidad e historial técnico | Operativos | Mantener y probar permisos |
| Portal del cliente | Operativo | Agregar reclamos, mensajes y avisos |
| Vinculación con Vercel | El proyecto local ya está vinculado a `tecniurbano` | Auditar el despliegue y formalizar producción |

### Sectores con poco uso real o cierre pendiente

| Área | Qué existe hoy | Qué falta para considerarla terminada |
| --- | --- | --- |
| Reclamos y garantías | Tablas, biblioteca y componentes de administración | Navegación, detalle, acceso de cliente/técnico, RLS y flujo punta a punta |
| Comunicación | Mensajes dentro del módulo de reclamos | Bandeja y conversación entre admin, técnico y cliente |
| Notificaciones | Avisos de validación técnica | Centro general, no leídos, eventos de negocio y preferencias |
| Liquidaciones | Cálculo, estados y programación de lotes | Liberación automática, cierre atómico, comprobantes y conciliación |
| Metas del técnico | Tabla creada y pantalla placeholder | CRUD, cálculo de avance y visualización |
| Configuración | Importe de visita | Comisión, garantía, demora de pago, recargos, zonas y auditoría |
| Supabase reproducible | Producción tiene muchas piezas creadas con scripts auxiliares | Migraciones completas, tipos, tests RLS y comparación contra live |
| Calidad | TypeScript compila; hay un archivo de pruebas | Suite automática, CI y pruebas punta a punta |
| Operación en Vercel | Proyecto vinculado y funciones API | Ambientes, variables, observabilidad, checks, dominio y rollback |

### 1.1 Trabajo en curso — CERRADO 23/8

Los dos hilos de esta sección ya se cerraron en la sesión de pagos del 22-23/8.

**A) Fase 3 de categorías/subcategorías — 3 de 3, y Fase 4 también**

- [x] Vista pública del cliente agrupada por categoría → subcategoría.
- [x] Catálogo admin con secciones colapsables por categoría y subagrupación por subcategoría.
- [x] `QuoteBuilder.tsx` (selector del técnico al armar presupuestos) agrupado por `subcategory_id` real. Se revisó primero el trigger `apply_catalog_price_to_quote_item` como pedía este documento: solo lee `service_id`/`category_id`/`item_type`, nunca `subcategoria` — no necesitó cambios.
- [x] Bonus no pedido en esta sección pero cerrado igual: **Fase 4** (editor de escritura real en el admin para categorías/subcategorías — crear, editar, reordenar, ocultar, fusionar) — completa y verificada en vivo.

**B) Unificación del catálogo de pago directo — Ejecutado y verificado**

Al probar manualmente el flujo de "Sé qué trabajo necesito" (pago directo/invitado) se encontró que usaba una lista chica hardcodeada (`FIXED_PRICE_SERVICES`, 6 ítems) completamente desconectada del catálogo real de 233 servicios. Se reemplazó por el catálogo real, filtrado por el rubro que elige el cliente y agrupado por subcategoría (mismo patrón que ya usa el técnico). Código del frontend reemplazado en los dos formularios (cliente logueado e invitado).

`unify_direct_payment_catalog.sql` corrió en producción y se verificó cada paso:

- [x] Cambia `service_orders.fixed_price_service_id` de `text` a `uuid`, limpiando antes cualquier valor viejo no-uuid. Confirmado por consulta: la columna quedó `uuid`.
- [x] Elimina la tabla chica `fixed_price_services`. Confirmado: `to_regclass('public.fixed_price_services')` devuelve `null`.
- [x] Actualiza el trigger de seguridad anti-manipulación de precio para que valide contra el catálogo real `services`. Confirmado: el trigger sigue instalado y activo.

**Los cuatro chequeos pedidos antes de correrlo:**

- [x] Envolverlo en una transacción. Corrió dentro de `BEGIN`/`COMMIT`.
- [x] Contar filas no-uuid viejas y confirmar trazabilidad. Se limpiaron con un `update ... set fixed_price_service_id = null where ... !~* patrón-uuid` antes del cambio de tipo, para que no fallara el cast.
- [x] Confirmar que nada más dependa de `fixed_price_services`. Se comprobó antes de borrarla — RLS de lectura ya vivía en `services`.
- [ ] Probar explícitamente que el trigger siga rechazando un precio manipulado, contra el catálogo real, después de la migración. (Existe `test_pricing_trigger.sql` de un cambio anterior, pero no se re-corrió después de apuntar el trigger a `services` — vale la pena repetirlo para cerrar este punto del todo.)

Este mismo hallazgo fue evidencia concreta del punto 2 de "Hallazgos que cambian el orden" más abajo: estos archivos (`fase0_audit_category_subcategoria.sql`, `fase1_categorias_subcategorias_tablas.sql`, `unify_direct_payment_catalog.sql`, y varios más sumados el 23/8: `guest_checkout_deferred_orders.sql`, `add_customer_technician_numbers.sql`, `add_client_province.sql`, entre otros) son scripts sueltos, no migraciones versionadas de Supabase — el problema no se cerró, se agrandó un poco más hoy. Sigue siendo trabajo real de la Fase 1.

### Hallazgos que cambian el orden

- [ ] Hay configuraciones locales de MCP con credenciales de Supabase en texto plano. Están ignoradas por Git y no aparecen en el historial revisado, pero deben rotarse y reemplazarse por OAuth o variables locales antes de continuar. **Confirmado además en esta sesión:** se vio un token de Supabase (`sbp_...`) visible en una captura de pantalla del `.mcp.json` — motivo de más para rotarlo cuanto antes.
- [ ] Gran parte del esquema vive en `supabase/sql/` y no en `supabase/migrations/`. Una base nueva no se puede reconstruir fielmente solo con las migraciones actuales. Los scripts de categorías/subcategorías, unificación de pago directo, y los sumados el 23/8 son ejemplos nuevos de este mismo problema.
- [ ] El módulo de reclamos está escrito, pero `ClaimsTable` y `NewClaimModal` no están conectados a las vistas principales.
- [ ] Las políticas actuales de reclamos son solo para administración, aunque el producto necesita participación de cliente y técnico.
- [ ] `release_due_technician_settlements()` existe, pero no hay programación de Cron registrada en el repositorio.
- [ ] El administrador puede programar un lote de pago, pero todavía no hay un cierre transaccional que marque lote y liquidaciones como pagados.
- [ ] La pestaña Metas muestra un placeholder aunque `technician_goals` ya existe.
- [ ] No hay `vercel.json`, automatización de CI ni pruebas E2E. Solo existe una prueba TypeScript puntual.
- [ ] La documentación antigua todavía describe Node 18 y un lanzamiento no vinculado; la Fase 0 confirmó que la realidad en Vercel es **Node 24.x** — ninguna de las tres referencias (18 viejo, 22 de este roadmap, 24.x real) coincide. Hay que decidir a cuál normalizar, no asumir que 22 es la correcta solo porque este documento lo decía antes.
- [ ] **Nuevo (Fase 0, 23/8):** protección de contraseñas filtradas (HaveIBeenPwned) desactivada en Supabase Auth. Arreglo de un click en Authentication → Policies del dashboard — sin motivo para no hacerlo ya, no hace falta esperar a la Fase 1.
- [ ] **Nuevo (Fase 0, 23/8):** las funciones `current_user_role` e `is_admin` (pensadas como helpers internos para usarse dentro de políticas RLS) son invocables directamente por API para roles `anon`/`authenticated`. Revisar en la Fase 1 si conviene revocarles `EXECUTE` directo — no es una fuga confirmada, pero no deberían ser un endpoint público si nadie los necesita como tal.
- [x] El trigger de seguridad de precios del checkout de pago directo migró su fuente de verdad de una tabla chica (`fixed_price_services`) al catálogo real (`services`). Cerrado 23/8 — ver 1.1-B. El checkout de "Sé qué trabajo necesito" ya usa el catálogo real de 233 servicios, filtrado por rubro.
- [x] **Nuevo (23/8):** el checkout de invitado tenía un bug de arquitectura más serio que el de arriba: la orden y el cliente se creaban en la base *antes* de que Mercado Pago confirmara el pago, así que cualquier intento fallido dejaba clientes/órdenes huérfanas permanentes (probado en vivo: 19 en una sola tarde). Corregido — la orden ahora se crea recién cuando el webhook confirma `approved`, usando una tabla de borradores intermedia (`guest_checkout_drafts`).
- [ ] **Nuevo (23/8):** la rama `feature/mercadopago-payments-backend` tiene 21 commits y ningún Pull Request abierto contra `main` — todo el trabajo de las últimas sesiones vive únicamente en una rama.

> **Límite de esta auditoría:** el código local y el informe compartido sí fueron revisados. El proyecto Supabase live de TecniUrbano no estuvo visible en la conexión Supabase de esta sesión (ni en la sesión de planificación posterior). La Fase 0 obliga a auditar la base real antes de aplicar cualquier migración.

---

## 2. Orden obligatorio

```text
Cerrar trabajo en curso (1.1: Fase 3 categorías + unificación pago directo) — ✅ HECHO 23/8
        ↓
Seguridad y foto real
        ↓
Esquema reproducible
        ↓
Reclamos y garantías
        ↓
Mensajería de las tres partes
        ↓
Notificaciones generales
        ↓
Liquidaciones y Cron
        ↓
Metas y configuración
        ↓
Pruebas, staging y Vercel
        ↓
Lanzamiento y observación
```

No conviene empezar por mensajería o metas antes de cerrar la reproducibilidad de Supabase. La sección 1.1 ya está cerrada (23/8) — el siguiente paso real de este roadmap es abrir la **Fase 0**.

---

## 3. Cronograma recomendado

El cálculo usa sesiones enfocadas de Claude Code, de aproximadamente 60 a 120 minutos. La sección 1.1 ya cerró el 23/8, así que el cierre razonable desde acá es de **seis a siete semanas** contando desde ahora. Cada bloque debe terminar con un commit y una verificación.

| Semana | Fases | Sesiones estimadas | Resultado esperado |
| --- | --- | ---: | --- |
| ~~Previa~~ | ~~1.1~~ | ~~1–2~~ | [x] `QuoteBuilder.tsx` conectado y catálogo de pago directo unificado — **Hecho 23/8**, salvo la re-prueba puntual del trigger (ver 1.1-B) |
| Preparación | 0 | 2 | [ ] Credenciales saneadas y foto real de Supabase/Vercel |
| 1 | 1 | 4–6 | [ ] Base reconstruible, migraciones y tipos al día (incluye formalizar los scripts de categorías y pago directo) |
| 2 | 2 | 4–5 | [ ] Reclamos utilizables por las tres partes |
| 3 | 3 | 5–7 | [ ] Mensajería con permisos, Realtime y no leídos |
| 4 | 4 y 5 | 5–7 | [ ] Centro de avisos y circuito de pagos técnicos cerrado |
| 5 | 6 y 7 | 3–5 | [ ] Metas reales y configuración centralizada |
| 6 | 8 y 9 | 5–7 | [ ] Pruebas, CI, staging y Vercel endurecido |
| 7 | 10 | 2–3 | [ ] Lanzamiento controlado y monitoreo inicial |

**Total estimado:** 31–44 sesiones cortas. No es recomendable pedirle a Claude Code que haga varias fases grandes en una sola conversación.

---

## 4. Protocolo de trabajo con Claude Code

### Antes de cada fase

1. Confirmar que el árbol de Git está limpio y que los cambios anteriores están publicados.
2. Crear una rama con nombre descriptivo, por ejemplo `feature/fase-02-reclamos-conectados`.
3. Pedirle a Claude que lea este archivo, `README.md`, `agent.md`, el código afectado y las migraciones existentes.
4. Pedir primero un diagnóstico y una lista de archivos; recién después autorizar la implementación.
5. Para Supabase, inspeccionar live antes de escribir. Nunca ejecutar un SQL auxiliar "porque parece faltar" sin comprobar si ya se aplicó.

### Al cerrar cada sesión

Claude Code debe entregar siempre:

- archivos modificados;
- migraciones creadas;
- permisos RLS agregados o modificados;
- pruebas ejecutadas y resultado;
- riesgos pendientes;
- pasos manuales en Supabase o Vercel;
- commit sugerido.

### Controles mínimos antes de un commit

```bash
npm run lint
npm run build
```

Cuando la fase tenga base de datos también deben pasar:

```bash
supabase migration list --local
supabase test db
```

Los comandos exactos de Supabase deben confirmarse con `supabase --help`, porque la CLI cambia con frecuencia.

### Reglas permanentes

- No commitear `.env*`, tokens, claves privadas ni configuraciones MCP con credenciales.
- No exponer `SUPABASE_SERVICE_ROLE_KEY`, secretos de Mercado Pago o secretos de Cron en variables `VITE_*`.
- Todo cambio estructural de Supabase debe terminar en una migración reproducible.
- Toda tabla pública debe tener RLS y permisos mínimos explícitos.
- Las vistas accesibles desde el navegador deben usar `security_invoker = true`.
- Cada UPDATE con RLS debe tener políticas de SELECT, `USING` y `WITH CHECK` coherentes.
- Cada fase se prueba con admin, técnico, cliente y, cuando corresponda, invitado.
- Cualquier cambio a un trigger de seguridad de precios (ya sea `apply_catalog_price_to_quote_item` o el de pago directo) se prueba explícitamente intentando manipular el precio, no solo con el camino feliz.
- Primero Preview; producción solo cuando los criterios de aceptación estén completos.

---

## 5. Fases detalladas

## Fase 0 — Seguridad y foto real

**Duración:** 2 sesiones.
**Meta:** saber exactamente qué hay en producción antes de cambiarlo.

### Trabajo

- [x] Rotar los tokens personales de Supabase usados por MCP. Hecho 23/8 — token viejo ("claude code", ya figuraba como `Expired`) borrado, uno nuevo (30 días, es el máximo que permite el plan Free) generado y actualizado en `.mcp.json` y `.cursor/mcp.json`.
- [x] Conectar Claude Code al proyecto correcto mediante el flujo OAuth oficial de Supabase MCP. **Resuelto 23/8** — reconectaste el conector de cuenta con `sandy722sandy@hotmail.com`; confirmado por `list_projects` viendo `ayszrtieplmqscqtabsu` directo.
- [x] Confirmar que ningún secreto aparece en Git, ramas remotas, logs o artefactos. Auditado 23/8 — limpio, ver `docs/audits/2026-08-23-baseline.md`.
- [x] Inventariar en Supabase live — primero a mano (vos corriendo SQL), completado con la conexión MCP directa una vez reconectada:
   - [x] tablas, columnas, claves e índices — 38 tablas, todas con RLS activado;
   - [x] vistas y si usan `security_invoker` — hallazgo real: `technician_public_view` es `SECURITY DEFINER` (único ERROR del Security Advisor), revisar en Fase 1;
   - [x] funciones, triggers y privilegios de ejecución — 21 funciones, 5 `SECURITY DEFINER`;
   - [x] políticas RLS por rol — 0 tablas sin RLS; Advisor marca 30 casos de `multiple_permissive_policies` y 20 de `auth_rls_initplan` para revisar en Fase 1;
   - [x] buckets y políticas de Storage — 4 buckets;
   - [x] extensiones — `pg_cron` **no instalada** (bloquea Fase 5);
   - [x] migraciones registradas — solo 17, ninguna del 22-23/8;
   - [x] Cron jobs y sus últimas ejecuciones — no aplica, `pg_cron` no instalado;
   - [x] advertencias de seguridad y rendimiento (Supabase Advisors) — completo, ver `docs/audits/2026-08-23-baseline.md`. Destacan: 1 ERROR (vista `SECURITY DEFINER`), 4 funciones `SECURITY DEFINER` invocables por API, protección de contraseñas filtradas desactivada, y 91 hallazgos de performance (37 FK sin índice, 30 políticas permisivas múltiples, 20 `auth_rls_initplan`, 4 índices sin uso).
- [x] Inventariar Vercel:
   - [x] último deploy de producción y previews;
   - [x] rama de producción;
   - [x] versión de Node — **24.x** (ni 18 ni 22);
   - [x] variables por ambiente, sin mostrar valores — 8 vars, iguales en Preview y Production;
   - [ ] dominio, protección, logs y webhook de Mercado Pago — dominio confirmado; protección y webhook de MP requieren chequeo manual en los dashboards respectivos.
- [x] Crear `docs/audits/2026-08-23-baseline.md` sin datos secretos.

### Criterio de aceptación

- [x] Las credenciales anteriores están revocadas. Token "claude code" borrado, reemplazado 23/8.
- [x] Claude se conecta a `ayszrtieplmqscqtabsu` sin un token guardado en el repositorio. Resuelto 23/8 vía conector de cuenta reconectado.
- [x] Existe una lista comprobable de diferencias entre Supabase live y `supabase/migrations/` — ver `docs/audits/2026-08-23-baseline.md`, sección 8. Incluye un hallazgo nuevo: las tablas de Reclamos y Garantías no existen en producción, contra lo que decía el "Estado de Obra" anterior.
- [x] No se hizo ninguna modificación funcional.

### Pedido para Claude Code

> Leé `ROADMAP-TERMINACION.md` completo (incluida la sección 1.1) y ejecutá únicamente la Fase 0. No cambies funcionalidades ni apliques migraciones. Auditá Git, Supabase live y Vercel; ocultá todos los secretos; creá el informe baseline y detenete con una lista priorizada de diferencias.

---

## Fase 1 — Supabase reproducible y seguro

**Duración:** 4 a 6 sesiones.
**Meta:** poder crear una base nueva y obtener el mismo esquema que producción.

### Trabajo

- [x] Comparar producción, migraciones y scripts auxiliares. Hecho 23/8: de las **17 migraciones que Supabase registraba como aplicadas, solo 7 tenían archivo en el repo** — las otras 10 (`harden_security_definer_grants`, `handle_new_user_link_operational_rows`, `technicians_zone_and_province`, `account_invites_and_redeem`, `seed_initial_services`, `services_anon_read`, `cleanup_orphaned_test_order` ×3, `cleanup_test_technician_application`) no existían en ningún lado del código — rastreadas por fecha, corresponden a sesiones de trabajo reales de mediados de agosto, nada sospechoso.
- [x] **Prueba concreta de que el repo no reconstruía la base**: al reproducir los 7 archivos locales desde cero (`supabase db pull`), falló en el segundo con `function is_admin() does not exist` — `servicasa_foundation_schema.sql` era un placeholder vacío de una sesión anterior, nunca tuvo el esquema real.
- [x] Generar una migración baseline o pull limpio desde live. Hecho 23/8 con `supabase db pull` (necesitó Docker Desktop, instalado esta sesión): **2 migraciones nuevas** (`20260823000000_baseline_live_schema.sql` — 38 tablas, 80 políticas RLS, todas las funciones incl. `is_admin()`; `20260823185803_remote_schema.sql` — lo que un dump solo de `public` se perdía: el trigger `on_auth_user_created` en `auth.users` que dispara `handle_new_user()`, todas las políticas de Storage, y varios GRANT excesivos a `anon`/`authenticated` en 6 tablas que quedaron revocados). Los 7 archivos viejos se archivaron en `supabase/migrations_legacy/` con una nota explicando por qué. **Verificado de punta a punta**: `supabase migration list` muestra local y remoto coincidiendo exactamente (2/2), y el propio proceso de `db pull` reconstruyó una base desde cero sin errores usando solo estos 2 archivos — no es una afirmación, se probó.
- [ ] Incorporar al historial reproducible el resto de lo aplicado como scripts sueltos (categorías/subcategorías, pago directo, borradores de invitado, numeración, provincia, etc.) — el baseline de arriba ya los incluye porque refleja el estado *actual* de la base, pero conviene revisar si alguno merece quedar documentado como migración incremental aparte en vez de sepultado dentro del baseline.
- [ ] Separar datos semilla de estructura. Los tarifarios deben poder cargarse de manera idempotente.
- [ ] Regenerar tipos TypeScript de Supabase y reemplazar gradualmente tipos manuales inseguros.
- [ ] Crear pruebas pgTAP para:
   - separación entre clientes;
   - separación entre técnicos;
   - acceso administrativo;
   - acceso anónimo exclusivo al catálogo público;
   - bloqueo de escrituras anónimas;
   - protección de pagos, invitaciones y datos personales;
   - **rechazo de precio manipulado en ambos triggers de precio (presupuesto y pago directo).**
- [ ] Ejecutar los advisors de seguridad y rendimiento y resolver los errores de prioridad alta.
- [ ] Confirmar los GRANT de tablas nuevas frente al cambio actual de Data API; RLS y GRANT son controles distintos.
- [ ] **Nuevo (hallazgo Fase 0):** revisar `current_user_role` e `is_admin` — hoy son invocables directo por API para `anon`/`authenticated`; decidir si revocarles `EXECUTE` directo o si de verdad hace falta que sean callable así.
- [ ] **Nuevo (hallazgo Fase 0):** firma formal de la vista `technician_public_view` (`SECURITY DEFINER`) — confirmar con un test explícito que no expone más columnas/filas de las necesarias para el listado público de técnicos, y dejar la evidencia documentada acá.
- [ ] Decidir a qué versión de Node normalizar (18 viejo en docs / 22 en este roadmap / 24.x real en Vercel confirmado en Fase 0) y aplicar esa decisión en documentación, desarrollo y Vercel.

### Criterio de aceptación

- [ ] Una base local o de staging vacía se reconstruye solo con migraciones y seeds documentados.
- [ ] `supabase migration list --local` coincide con la estrategia adoptada.
- [ ] Los tests RLS positivos y negativos pasan.
- [ ] Los tipos generados están versionados.
- [ ] Ya no existen objetos de producción importantes que vivan únicamente en `supabase/sql/`.

### Pedido para Claude Code

> Ejecutá la Fase 1 de `ROADMAP-TERMINACION.md`. Empezá mostrando la diferencia entre live, migrations y sql; no reapliques scripts a ciegas. Proponé el baseline, pedime aprobación antes de DDL, verificá la reconstrucción en staging/local y agregá pruebas RLS.

---

## Fase 2 — Conectar Reclamos y Garantías

**Duración:** 4 a 5 sesiones.
**Meta:** convertir el código existente en un flujo realmente utilizable.

> **Ejecutada 23/8 — casi completa.** Corrección de la Fase 0 confirmada y resuelta: las tablas no existían en producción, se crearon en esta misma sesión.

- [x] Auditar `enable_support_cases.sql` y correrlo contra producción — hecho vía migración real (`connect_support_cases_module`, aplicada con el MCP de Supabase ya reconectado), no como script suelto.

### Trabajo de interfaz

- [x] Agregar "Reclamos y garantías" a la navegación administrativa — botón en `AdminHubView`, ruta `/admin/reclamos`.
- [x] Integrar `ClaimsTable` y `NewClaimModal` en `AdminHubView` (vía ruta dedicada, mismo patrón que `ClientsTable`/`ClientFicha`).
- [x] Crear detalle de caso (`ClaimDetail.tsx`, componente único compartido por los 3 roles — no se duplicó el módulo) con:
   - [x] datos de orden, cliente y técnico;
   - [x] estado y prioridad;
   - [x] hilo de mensajes (con notas internas visualmente distinguidas, solo visibles para admin);
   - [x] historial auditable;
   - [x] resolución y efecto sobre liquidación.
- [x] Agregar al portal del cliente:
   - [x] "Abrir reclamo" solo sobre una orden propia válida (`NewClaimModal` en modo `customer`, reutilizado — no duplicado);
   - [x] listado de casos propios (`MyClaimsPanel`);
   - [x] detalle y respuesta.
- [x] Agregar al portal técnico (`/technician/reclamos`):
   - [x] casos asociados a sus trabajos;
   - [x] respuesta;
   - [ ] evidencia (adjuntar fotos) y visibilidad detallada de la liquidación en revisión — no se hizo en esta pasada.

### Trabajo de Supabase

- [x] Reemplazar el acceso "solo admin" por políticas separadas — admin (total), cliente (`customer_id` propio), técnico (`technician_id` propio), notas internas (únicamente admin, verificado en vivo), historial (lectura + inserción para el propio caso — ver nota abajo).
- [x] Validar que el usuario no pueda cambiar IDs para acceder a otro caso — **probado en vivo con dos clientes reales** (Julián/Gonzalo): ver `supabase/tests/support_cases_rls.sql`, 7/7 casos pasaron.
- [ ] Hacer atómica la apertura/resolución cuando pausa o libera una liquidación — **no se hizo.** `createCase`/`resolveCase` siguen encadenando llamadas separadas (insert caso → insert historial → update orden → update liquidación); si un paso falla a mitad de camino, el caso queda creado igual (probado: pasó de verdad durante el testing de esta sesión, generó un caso duplicado). Requiere una función RPC transaccional — queda pendiente para no bloquear el resto de la fase.
- [ ] Definir ventana de garantía en configuración, no hardcodeada — no se tocó en esta pasada.

**Hallazgo durante el testing en vivo (no estaba en el plan original):** la política de `support_case_history` solo permitía INSERT a admin, pero el código (`addCaseMessage`) escribe ahí como efecto secundario de *cualquier* mensaje — sin la política agregada (`support_case_history_insert_stakeholder`), un cliente no podía enviar ni un mensaje propio. Corregido y re-probado.

### Criterio de aceptación

- [x] Un cliente abre un caso desde una orden propia — probado en vivo (Julián, cuenta real).
- [x] El técnico asociado puede verlo y responder — estructura probada (sin un caso real asignado a un técnico en esta sesión, pero la política y la UI son las mismas que para cliente).
- [x] El admin puede gestionar y resolver — probado en vivo (mensaje, nota interna, historial).
- [x] Un cliente o técnico ajeno recibe cero filas y no puede escribir — 5 pruebas negativas, todas pasaron.
- [ ] La resolución actualiza de manera consistente el caso, la orden y la liquidación — funciona en el camino feliz, pero no es atómica (ver arriba).
- [x] El flujo queda cubierto por RLS tests (`supabase/tests/support_cases_rls.sql`, específico de `support_cases` — no reemplaza el checklist pgTAP más amplio de la Fase 1, ver nota abajo) y una prueba E2E manual real (no automatizada) a través del navegador, con los 3 roles.

> **Aclaración para no mezclar con el seguimiento de la Fase 1:** las 7 pruebas de RLS de hoy son puntuales del módulo de Reclamos (`support_cases`/`support_case_messages`/`support_case_history`). El ítem pendiente de la Fase 1 — "Crear pruebas pgTAP" (separación cliente/técnico/admin en general, acceso anónimo al catálogo, y el rechazo de precio manipulado en los dos triggers de precio) — sigue sin marcar. Son cosas distintas: esto no lo cierra.
>
> **Verificado 23/8 tras el testing en vivo:** se limpiaron todos los datos de prueba y se confirmó con un conteo (no solo un DELETE sin verificar): 0 casos, 0 mensajes, 0 historial, 0 órdenes de prueba, 0 liquidaciones en revisión. El bug de `settlement_paused=true` en modo cliente no llegó a afectar `technician_settlements` en ningún momento — `persistAdminIncident()` rechaza su primera escritura (admin-only) antes de llegar a la lógica de pausa, así que la cadena se corta ahí tanto en el intento con el bug como en el corregido. Tampoco pudo haber afectado a un cliente real antes de hoy: `support_cases` no existía en producción hasta la migración de esta sesión, y todo el flujo de autoservicio del cliente es código nuevo de hoy.

### Pedido para Claude Code

> Ejecutá solo la Fase 2. Reutilizá `ClaimsTable`, `NewClaimModal`, `supportCases.ts` y el SQL existente. No dupliques el módulo. Primero presentá la matriz de permisos admin/cliente/técnico y después conectá navegación, detalle, mensajes, resolución y tests negativos de RLS.

---

## Fase 3 — Comunicación admin ↔ técnico ↔ cliente

**Duración:** 5 a 7 sesiones.
**Meta:** ofrecer conversaciones seguras y trazables dentro de la plataforma.

### Decisión de arquitectura previa

Antes de programar, Claude debe presentar una ADR corta comparando:

1. extender `support_case_messages` para todos los usos; o
2. crear un sistema general con `conversations`, `conversation_participants`, `messages` y `message_reads`.

**Ejecutada 23/8. ADR aprobada por Sandy en [`docs/adr/0001-mensajeria-tres-partes.md`](../docs/adr/0001-mensajeria-tres-partes.md): Alternativa B (sistema general), con dos decisiones de producto de Sandy incorporadas — (1) `support_cases`/`support_case_messages` no se tocan en esta fase; (2) admin tiene acceso de **datos** a todas las conversaciones (vía `is_admin()`, sin ser participante listado) pero no aparece como tercero visible en la UI de una charla cliente↔técnico — la fricción de tener un tercero en cada "llego en 10" no vale la pena.**

La recomendación inicial es el sistema general, con conversaciones asociadas a una orden, un reclamo o un contacto directo. Así se evita que toda comunicación normal parezca un reclamo.

### Trabajo

- [x] Modelo de conversaciones, participantes, mensajes y lecturas (`conversations`, `conversation_participants`, `messages`, `message_reads`).
- [x] Matriz de acceso por participante y rol — administración no depende de IDs del navegador: `start_order_conversation()` es una función `SECURITY DEFINER` que resuelve ella misma quién es "la otra parte" a partir de la orden real, en vez de confiar en un `profile_id` mandado por el cliente.
- [x] Bandeja — `ConversationsPanel.tsx`, reusada tal cual en admin (`/admin/conversaciones`, ve todas), cliente (dashboard) y técnico (`/technician/conversaciones`).
- [x] Hilo Realtime — `ConversationThread.tsx`, canal de Supabase Realtime **por conversación** (no se sumó a la suscripción global de `AppContext.tsx`, que hubiera recargado todo el catálogo por cada mensaje de chat). Probado en vivo con dos cuentas reales en simultáneo: un mensaje de un lado aparece del otro sin recargar.
- [x] Contador de no leídos — vista `conversation_unread_counts` (`security_invoker`) + badge en el Header (con polling cada 30s) y en cada tarjeta de la bandeja. Probado en vivo: el badge muestra "2", desaparece al abrir la conversación (`markConversationRead`).
- [x] Diferenciar mensajes visibles de notas internas — mismo patrón que Reclamos (`is_internal`), aunque en esta fase no se expone ningún control de UI para que admin escriba notas internas en una conversación (solo se migró la restricción de RLS; la UI de "nota interna" queda para cuando admin realmente participe de una charla).
- [x] Vincular desde orden — botón "Escribir al técnico"/"Escribir al cliente" en `CustomerView.tsx`/`TechnicianView.tsx`. **No se hizo:** vínculo desde ficha de cliente/técnico ni desde un reclamo (ver alcance acordado arriba).
- [ ] Limitar tamaño, tipos de contenido y frecuencia de envío — no se implementó (sin límite de longitud de mensaje ni rate limiting).
- [x] No incluir archivos adjuntos en la primera entrega — cumplido, no se tocó.

**Bugs reales encontrados y corregidos probando en vivo (no hubiera aparecido ninguno con una revisión de código sola):**
1. `conversation_participants_select_own` causaba **recursión infinita** (42P17) al referenciarse a sí misma en su propio `USING` — se resolvió con una función `SECURITY DEFINER` (`is_conversation_participant()`), mismo patrón que `is_admin()`.
2. `conversations_select_participant` comparaba `cp.conversation_id = cp.id` en vez de `cp.conversation_id = conversations.id` — el `id` sin calificar se resolvía contra la tabla equivocada porque `conversation_participants` también tiene su propia columna `id`. El cliente nunca podía ver su propia conversación recién creada.
3. Las tablas nuevas nunca se agregaron a la publicación `supabase_realtime` — sin eso, ningún `postgres_changes` dispara, sin importar que el código de suscripción esté perfecto. Un mensaje se guardaba bien pero no aparecía del otro lado sin recargar.

### Criterio de aceptación

- [x] Las tres partes intercambian mensajes dentro de una orden — probado en vivo (Julián↔Carlos, ambas direcciones, en tiempo real).
- [ ] Reclamos pueden usar la misma experiencia sin perder su auditoría — **decisión deliberada de no hacerlo en esta fase** (ver alcance acordado).
- [x] Los no participantes no pueden leer ni insertar — probado con 5 casos negativos reales (otro cliente, otro técnico) en `supabase/tests/conversations_rls.sql`.
- [x] Los no leídos se actualizan correctamente — probado en vivo.
- [ ] Realtime se recupera después de desconexión sin duplicar mensajes — no se probó explícitamente el caso de reconexión tras corte de red.

### Pedido para Claude Code

> Ejecutá la Fase 3. Antes de tocar código, escribí una ADR con las dos alternativas y una matriz RLS. Esperá aprobación. Después implementá la alternativa elegida por etapas: esquema y tests, biblioteca de datos, bandeja, hilo Realtime y contadores.

---

## Fase 4 — Centro general de notificaciones

**Duración:** 3 a 4 sesiones.
**Meta:** que cada usuario sepa qué requiere su atención.

### Trabajo

- [x] Crear una tabla general `notifications` ligada a `recipient_profile_id`.
- [x] Campos mínimos: tipo, título, cuerpo breve, entidad relacionada, fecha, `read_at`, prioridad y clave idempotente.
- [x] Migrar o encapsular `technician_notifications` para evitar dos sistemas permanentes (espejo automático vía trigger, sin tocar la tabla ni la vista original).
- [x] Generar avisos para:
   - [x] nueva orden y asignación;
   - [x] presupuesto enviado, aceptado o rechazado;
   - [x] pago aprobado, rechazado o pendiente;
   - [x] reclamo abierto, respondido o resuelto;
   - [x] mensaje nuevo;
   - [x] liquidación liberada, programada o pagada;
   - [x] validación técnica.
- [x] Agregar campana, badge, centro de avisos, marcar uno/todos como leídos y enlace a la entidad.
- [x] En esta fase se priorizó in-app. Email y push quedan afuera, sin lógica mezclada.

### Criterio de aceptación

- [x] Cada evento crítico crea un solo aviso, aun si un webhook se repite — probado en vivo simulando un reintento real de Mercado Pago sobre la misma fila de `payment_transactions`.
- [x] El destinatario ve únicamente sus notificaciones (admin ve todas, por diseño — acceso de backend, mismo criterio que Reclamos y Conversaciones).
- [x] Marcar como leído funciona y el contador no queda desactualizado (optimista en el cliente + persistido).
- [x] El enlace abre la orden, reclamo, pago o conversación correcta — exacto para reclamo/conversación; para orden/presupuesto/pago aterriza en el espacio de trabajo del rol (admin/técnico no tienen ruta por id todavía; el cliente sí, vía `/customer/orders/:id`).

### Pedido para Claude Code

> Ejecutá la Fase 4. Diseñá primero una tabla universal e idempotente y un mapa evento→destinatario. Integrá los avisos existentes de validación técnica, implementá bandeja/no leídos y cubrí duplicados de webhooks con pruebas.

---

## Fase 5 — Cerrar liquidaciones y pagos a técnicos

**Duración:** 3 a 4 sesiones.
**Meta:** que una liquidación llegue de manera segura desde "en garantía" hasta "pagada".

### Trabajo

- [x] Programar `release_due_technician_settlements()` mediante **Supabase Cron** (la función ya existía en el esquema; pg_cron no estaba instalado — se habilitó). Job `release-technician-settlements`, cada 15 minutos.
- [x] Versionado en `supabase/sql/settlements_payout_batches_cron.sql` (migración `settlements_payout_batches_cron`). Verificar con `select * from cron.job;` y `select * from cron.job_run_details order by start_time desc;`.
- [x] Operación atómica para cerrar un lote (`close_payout_batch()`):
   - [x] valida que sea pagable (guarda `WHERE status='scheduled'`, admin-only);
   - [x] guarda método, referencia y fecha;
   - [x] marca el lote `completed`;
   - [x] marca sus liquidaciones `paid` (solo las que siguen `scheduled` — honesto si alguna se pausó en el medio);
   - [x] registra auditoría (`technician_payout_batch_audit`, tabla nueva);
   - [x] emite notificación al técnico (reutiliza el trigger de Fase 4, sin código nuevo).
- [x] Doble cierre y doble pago evitados por diseño: transición con guarda de estado (no por un constraint separado) — un segundo llamado no encuentra filas y no hace nada.
- [x] Comprobante en bucket privado `payout-receipts`, políticas de admin (todo) y técnico propietario (solo lectura, por carpeta `{technician_id}/{batch_id}/...`).
- [x] Reclamos abiertos: pausar/retener/liberar/cancelar ya existían (Fase 2) — se corrigió un bug real de acoplamiento (ver quinta actualización arriba) para que pausar una liquidación ya programada la saque limpiamente del lote.
- [x] Conciliación administrativa (`SettlementReconciliation.tsx` + vista `admin_settlement_reconciliation`) por estado, fecha, técnico e importe.

### Criterio de aceptación

- [x] Cron libera solo liquidaciones vencidas sin disputa — probado en vivo con una vencida y una futura en la misma corrida.
- [x] Dos ejecuciones producen el mismo resultado — probado en vivo (segunda corrida libera 0).
- [x] El admin puede completar un lote una sola vez — probado en vivo (segundo cierre no paga de nuevo, no duplica notificación ni auditoría).
- [x] El técnico ve fecha, referencia y comprobante propios — comprobante vía URL firmada (bucket privado), no URL pública.
- [x] Un técnico no puede modificar importes ni consultar pagos ajenos — probado en vivo (RLS filtra ambos casos).

### Pedido para Claude Code

> Ejecutá la Fase 5. Usá Supabase Cron para la liberación, no un temporizador del navegador. Diseñá el cierre del lote como una operación atómica e idempotente, integrá reclamos y notificaciones, y agregá pruebas de doble ejecución y permisos.

---

## Fase 6 — Metas y elegibilidad técnica

**Duración:** 2 sesiones.
**Meta:** terminar los dos cabos sueltos visibles del portal técnico.

### Trabajo

- [x] Reemplazar `Goals` placeholder por CRUD sobre `technician_goals`. **Bug encontrado de paso**: la pestaña Metas era inalcanzable en producción — `EarningsView.tsx` mostraba el placeholder `Empty` para CUALQUIER pestaña (incluida Metas) cuando el técnico no tenía liquidaciones, y hoy ningún técnico tiene liquidaciones reales (ver hallazgo de Fase 7 sobre `technician_settlements` sin productor). Corregido para que Metas se renderice siempre, independiente de si hay liquidaciones.
- [x] Permitir una meta activa por tipo y período — índice único parcial (`technician_goals_one_active_per_type`) + RPC `set_technician_goal()` que reemplaza atómicamente. `goal_type` ya encodifica el período (semanal vs. mensual), así que no hizo falta agregar columnas de fecha.
- [x] Calcular avance desde liquidaciones reales (`monthly_earnings`) y órdenes completadas (`monthly_jobs`/`weekly_jobs`) del período vigente — nunca un valor guardado a mano (la tabla no tiene columna de progreso).
- [x] Mostrar porcentaje, faltante, período y cumplimiento — barra de progreso + badge "Meta cumplida".
- [x] `technicianEligibility.ts`: se decidió la opción A (única fuente de reglas). **Hallazgo real**: había 3 implementaciones con criterios DISTINTOS, no solo duplicadas — el trigger de la base de datos (la barrera real) era MÁS LAXO que el chequeo completo (solo miraba `validation_status`/`can_receive_orders`, no los requisitos obligatorios pendientes uno por uno). Se corrigió el trigger para que exija lo mismo que `canTechnicianReceiveOrders()`, y se reemplazó el chequeo duplicado inline en `AdminHubView.tsx` por una llamada a esa misma función.
- [x] Tests para elegibilidad (el trigger ahora rechaza asignar a un técnico con un requisito obligatorio pendiente, antes lo permitía) y para metas (RPC atómica, índice único, RLS).

### Criterio de aceptación

- [x] El técnico crea, edita y desactiva sus metas — probado en vivo con María Rodríguez (crear, ver progreso 0/4, desactivar).
- [x] El progreso coincide con los datos reales — hoy da 0 en todos los tipos porque no hay liquidaciones ni órdenes completadas reales en el sistema (limpieza de datos de sesiones anteriores), no por un error de cálculo.
- [x] No quedan tres implementaciones distintas de elegibilidad — DB, `AdminHubView.tsx` y `technicianEligibility.ts` ahora exigen exactamente lo mismo.

### Pedido para Claude Code

> Ejecutá la Fase 6. Conectá la pestaña Metas a `technician_goals`, calculá avance desde datos reales y consolidá la lógica duplicada de elegibilidad en una única función con tests.

---

## Fase 7 — Configuración central y auditoría

**Duración:** 2 a 3 sesiones.
**Meta:** retirar valores de negocio dispersos por el código.

### Parámetros iniciales

- [x] seña de visita — ya vivía en `system_settings` (30000), formalizada con tipo/descripción/visibilidad.
- [x] porcentaje de comisión — nuevo, `0.17`. **Sin consumidor real hoy**: ningún código crea filas en `technician_settlements` (ver hallazgo abajo).
- [x] días de garantía — extraído de un `30 days` hardcodeado dentro de la vista SQL `customer_summary` (que además no tenía consumidor en el frontend).
- [x] días hasta liberar liquidación — nuevo, `7`. Sin consumidor real hoy (mismo motivo que la comisión).
- [x] recargo urgente — nuevo, `0` (igual al comportamiento actual: sin recargo). Sin consumidor real hoy.
- [x] límites de pedido y mensaje — `message_max_length` (2000) con validación real en servidor (trigger en `messages` y `support_case_messages`). El límite de "pedido" (máx. de órdenes activas por cliente) quedó identificado pero no se implementó — necesita una decisión de producto sobre el número, no estaba especificado.
- [x] zonas/provincias habilitadas — nuevo, las 24 provincias habilitadas (igual al comportamiento actual, que acepta pedidos de cualquiera). Reservado: todavía no hay validación que filtre por esta lista en la creación de órdenes.
- [x] banderas de funciones sensibles — contenedor `feature_flags` reservado, vacío (no había ninguna bandera concreta que migrar).

### Trabajo

- [x] Extender `system_settings` con tipos (`value_type`), validación (trigger que rechaza value/tipo inconsistentes), descripción y versión.
- [x] Crear `system_settings_history` para auditoría — se llena sola por trigger, no depende de que el código de la app se acuerde de loguearlo.
- [x] Restringir escritura a admin (ya estaba); lectura segmentada por `visibility` (`public`/`authenticated`/`admin`) en vez de "cualquier autenticado ve todo" — antes un técnico o cliente podía leer la comisión de la plataforma vía REST.
- [x] `api/orders/guest-checkout.ts` ya cargaba `visit_deposit_amount` en servidor (no confía en el frontend) — reverificado que sigue funcionando igual tras el cambio de esquema.
- [x] Panel administrativo (`SystemSettingsPanel.tsx`) con confirmación explícita para los cambios que tocan cálculos de dinero (comisión, días de liberación).
- [x] Defaults seguros si Supabase no responde (`DEFAULT_SETTINGS` en `src/lib/settings.ts`, espejo de los valores reales).

### Hallazgos del inventario (no eran bugs de esta fase, quedan anotados)

- `VISIT_DEPOSIT_AMOUNT = 6000` y `PLATFORM_COMMISSION_RATE = 0.17` en `src/lib/pricing.ts` nunca se importaban en ningún lado — muertos, y el primero además desactualizado (el valor real era 30000). Borrados.
- **No existe ningún código (frontend, API o trigger SQL) que cree filas en `technician_settlements`.** Todo lo construido en la Fase 5 (cron, cierre de lote, conciliación) es correcto y está probado, pero hoy no tiene quién dé de alta la primera liquidación `pending_release` cuando un técnico termina un trabajo. No se resolvió acá — no estaba pedido y necesita una decisión de producto (¿se genera al completar la orden? ¿al confirmarse el pago final?) antes de escribir el código.

### Criterio de aceptación

- [x] Los valores críticos no están duplicados en React, API y SQL — los duplicados muertos de `pricing.ts` se borraron; `visit_deposit_amount` tiene una sola fuente de verdad.
- [x] Cada cambio registra quién, cuándo, valor anterior y nuevo — probado en vivo con la comisión y los días de garantía (incluye `updated_by`, que antes ni se guardaba).
- [x] Un cliente o técnico no puede modificar configuración — probado en vivo (RLS filtra la fila, 0 afectadas) y no puede leer settings `visibility=admin` ni el historial.

### Pedido para Claude Code

> Ejecutá la Fase 7. Inventariá primero los valores hardcodeados. Diseñá settings tipados y auditables, migrá un parámetro por vez y verificá que pagos y precios sigan validándose en servidor.

---

## Fase 8 — Calidad, seguridad y CI

**Duración:** 3 a 4 sesiones.
**Meta:** impedir que una mejora rompa órdenes, permisos o dinero.

### Pirámide de pruebas

- [ ] **Unitarias:** precios, estados, elegibilidad, liquidaciones, categorías y validaciones.
- [ ] **Componentes:** formularios, permisos visuales, estados de carga y error.
- [ ] **Supabase/pgTAP:** RLS, funciones, triggers, constraints e idempotencia.
- [ ] **API:** autorización, validación de monto, webhook repetido y errores de proveedor.
- [ ] **E2E:** admin, técnico, cliente e invitado.

### Flujos E2E obligatorios

- [ ] Cliente registrado → pedido diagnóstico → seña → técnico → presupuesto → saldo → ejecución → firma.
- [ ] Invitado → catálogo → pago → orden creada únicamente tras aprobación → seguimiento.
- [ ] Precio fijo → pago completo → asignación → cierre.
- [ ] Reclamo → pausa de liquidación → resolución → liberación o cancelación.
- [ ] Conversación → no leído → lectura.
- [ ] Lote técnico → programación → pago → comprobante.
- [ ] Intentos cruzados de cliente y técnico sobre datos ajenos.

### CI

Crear GitHub Actions para ejecutar en cada pull request:

- [ ] instalación reproducible;
- [ ] lint TypeScript;
- [ ] build;
- [ ] tests unitarios;
- [ ] tests de base local cuando sea viable;
- [ ] chequeo de secretos y dependencias.

### Endurecimiento adicional

- [ ] revisar rate limiting en endpoints públicos;
- [ ] evitar que `/api/health` revele configuración innecesaria en producción;
- [ ] limpiar PII y payloads de pago de logs;
- [ ] agregar headers de seguridad y CSP compatibles con Mercado Pago y Supabase;
- [x] revisar Service Worker para no cachear respuestas privadas o API — se sacó el cacheo de `*.supabase.co/rest/v1/*` el 23/8 (era `NetworkFirst` con hasta 24hs de `maxAgeSeconds`, causaba datos viejos en el panel operativo).
- [ ] ejecutar advisors de Supabase al cierre.

### Criterio de aceptación

- [ ] CI bloquea una rama que rompe lint, build o pruebas.
- [ ] Los flujos críticos tienen pruebas repetibles.
- [ ] No hay advertencias de seguridad Supabase de prioridad alta sin decisión documentada.

### Pedido para Claude Code

> Ejecutá la Fase 8 por capas. Primero instalá y configurá la base de tests, luego cubrí dinero/permisos, después componentes y E2E. Agregá CI al final y no cambies reglas de negocio solo para hacer pasar una prueba.

---

## Fase 9 — Staging y Vercel

**Duración:** 2 a 3 sesiones.
**Meta:** separar desarrollo de producción y hacer cada despliegue verificable.

### Trabajo

- [ ] Definir ramas:
   - `main`: producción;
   - ramas `feature/*`: previews;
   - staging mediante Supabase Branch o proyecto separado, según costo disponible.
- [ ] Separar variables Vercel de Development, Preview y Production.
- [ ] Confirmar Node 22 para funciones y build.
- [ ] Crear `vercel.json` solo con lo necesario:
   - headers de seguridad;
   - configuración de funciones;
   - Cron únicamente si queda algún trabajo HTTP fuera de Supabase;
   - nunca duplicar el Cron de liquidaciones en dos plataformas.
- [ ] Verificar Auth de Supabase:
   - Site URL de producción;
   - URLs permitidas de preview y producción;
   - recuperación de contraseña.
- [ ] Verificar Mercado Pago:
   - credenciales test/producción separadas;
   - URLs de retorno;
   - webhook;
   - protección sin impedir llamados legítimos;
   - idempotencia y logs.
- [ ] Configurar checks de despliegue, logs y alertas básicas.
- [ ] Agregar smoke test automático contra Preview.
- [ ] Documentar rollback de Vercel y rollback de migraciones compatibles.

### Criterio de aceptación

- [ ] Preview no usa datos ni credenciales de producción.
- [ ] Producción tiene todas las variables necesarias y ninguna variable servidor expuesta al navegador.
- [ ] Un deploy fallido no se promociona.
- [ ] Existe rollback probado y documentado.

### Pedido para Claude Code

> Ejecutá la Fase 9. Auditá primero la configuración actual de Vercel y Supabase Auth sin imprimir valores secretos. Proponé separación de ambientes, agregá solo la configuración necesaria y verificá un Preview completo antes de tocar producción.

---

## Fase 10 — Lanzamiento controlado

**Duración:** 2 a 3 sesiones más 48 horas de observación.
**Meta:** publicar sin perder trazabilidad ni capacidad de volver atrás.

### Prelanzamiento

- [ ] Congelar funcionalidades nuevas.
- [ ] Backup y comprobación de restauración.
- [ ] Migraciones aplicadas primero en staging y luego en producción.
- [ ] Advisors, lint, build, tests y checklist manual completos.
- [ ] Verificar dominio, TLS, Auth, Mercado Pago y correo de recuperación.
- [ ] Crear cuentas de prueba controladas para cada rol.

### Smoke test de producción

- [ ] landing y catálogo público;
- [ ] alta/login/logout/recuperación;
- [ ] pedido registrado e invitado;
- [ ] pago de prueba autorizado;
- [ ] asignación y trabajo técnico;
- [ ] presupuesto y firma;
- [ ] reclamo y mensaje;
- [ ] notificación;
- [ ] liquidación visible;
- [ ] exportación administrativa.

### Primeras 48 horas

- [ ] revisar errores Vercel y logs de Supabase;
- [ ] revisar webhooks y pagos pendientes;
- [ ] revisar ejecuciones de Cron;
- [ ] confirmar que no hay accesos RLS denegados inesperados ni fugas;
- [ ] registrar incidentes y evitar cambios grandes;
- [ ] preparar hotfix pequeño o rollback si aparece un problema crítico.

### Definición de terminado

TecniUrbano v1 se considera terminado cuando:

- [ ] el esquema se reconstruye desde el repositorio;
- [ ] los cuatro recorridos —admin, técnico, cliente e invitado— funcionan;
- [ ] reclamos, mensajes, avisos y pagos técnicos cierran punta a punta;
- [ ] RLS bloquea acceso cruzado con pruebas automáticas;
- [ ] CI y Preview protegen producción;
- [ ] Vercel y Supabase tienen monitoreo y rollback documentados;
- [ ] no quedan secretos en código, Git o logs;
- [ ] README, `agent.md` y este roadmap reflejan la realidad.

### Pedido para Claude Code

> Ejecutá la Fase 10 como release manager. No agregues funciones. Corré la matriz completa, prepará backup y rollback, generá el checklist de lanzamiento y detenete antes de cualquier paso irreversible o pago real que requiera mi confirmación.

---

## 6. Después de la v1

Estos trabajos no deben retrasar el lanzamiento estable:

- [ ] adjuntos y fotos de trabajo con Storage privado;
- [ ] email y push configurables;
- [ ] app móvil nativa;
- [ ] optimización de asignación por zona/disponibilidad;
- [ ] reportes financieros avanzados;
- [ ] SLA y métricas de soporte;
- [ ] retiro de columnas antiguas `services.category` y `services.subcategoria` después de 2–4 semanas sin lectores;
- [ ] limpieza final de compatibilidad con el catálogo anterior;
- [ ] decidir si `service_orders.service_type` (el "Rubro" que elige el cliente al crear la orden, confirmado como columna distinta de `services.category`) sigue siendo necesario tal cual, o si conviene alimentarlo también desde las categorías reales.

---

## 7. Tablero de seguimiento

Actualizar esta tabla al cerrar cada fase.

| Fase | Estado | Inicio | Cierre | Rama/commit | Evidencia |
| --- | --- | --- | --- | --- | --- |
| 1.1. Cerrar trabajo en curso (QuoteBuilder + catálogo pago directo) | ✅ Hecho | 22/8/2026 | 23/8/2026 | `feature/mercadopago-payments-backend` | `unify_direct_payment_catalog.sql` corrido y verificado; `QuoteBuilder.tsx` agrupa por `subcategory_id`; falta re-probar el trigger anti-manipulación puntualmente (ver 1.1-B) |
| 1.1-extra. Bug de orden de invitado creada antes del pago | ✅ Hecho | 23/8/2026 | 23/8/2026 | commits `21d1ff3`, `d185b2b` | Probado en vivo con tarjeta, wallet y abandono de checkout; 19 órdenes huérfanas viejas limpiadas |
| 1.1-extra. Fase 4 categorías (editor admin) | ✅ Hecho | 22/8/2026 | 22/8/2026 | commit `9361e6d` | Verificado en vivo: 8 categorías, conteos reales de subcategorías |
| 0. Seguridad y foto real | 🟡 Casi cerrada — solo falta el chequeo manual de Deployment Protection/webhook MP en los dashboards | 23/8/2026 | 23/8/2026 | `feature/mercadopago-payments-backend` | `docs/audits/2026-08-23-baseline.md` — inventario completo de Supabase/Vercel + Advisors; MCP reconectado al proyecto real; halló que Reclamos y Garantías no tiene tablas en producción y que `technician_public_view` es `SECURITY DEFINER` |
| 1. Supabase reproducible | 🟡 En curso — baseline reconstruible ya probado, faltan tipos TS y pruebas pgTAP | 23/8/2026 |  | `feature/mercadopago-payments-backend` | `supabase/migrations/20260823000000_baseline_live_schema.sql` + `20260823185803_remote_schema.sql`, verificados con `supabase migration list` (2/2) y una reconstrucción real desde cero |
| 2. Reclamos y garantías | 🟡 Casi — falta atomicidad en resolución, ventana de garantía y evidencia técnica | 23/8/2026 |  | `feature/mercadopago-payments-backend` | Migración `connect_support_cases_module`; `ClaimDetail.tsx`, `MyClaimsPanel.tsx`; `supabase/tests/support_cases_rls.sql` (7/7 OK); probado en vivo con 3 cuentas reales (admin, Julián, Carlos) |
| 3. Comunicación | 🟡 Casi — falta límites de contenido/frecuencia, y no se probó reconexión de Realtime | 23/8/2026 |  | `feature/mercadopago-payments-backend` | ADR aprobada; migraciones `create_conversations_messaging_system` + 3 fixes; `supabase/tests/conversations_rls.sql` (11/11 OK); probado en vivo con Realtime bidireccional real entre Julián y Carlos |
| 4. Notificaciones | 🟡 Casi — falta deep-link exacto de orden para admin/técnico y paginación de la bandeja | 23/8/2026 | 23/8/2026 | `feature/mercadopago-payments-backend` | Migraciones `notifications_center` + `notifications_center_lock_internal_functions`; `NotificationBell.tsx`; `supabase/tests/notifications_rls.sql` (14/14 OK); probado en vivo con admin y Julián |
| 5. Liquidaciones | ✅ Hecho, incluida la revisión post-cierre de Sandy | 23/8/2026 | 23/8/2026 | `feature/mercadopago-payments-backend` | Migraciones `settlements_payout_batches_cron` + `settlements_lock_internal_trigger_function` + `security_sweep_and_settlement_fixes` + `security_sweep_views_anon_grants` + `fix_cron_failure_notification_survives_transaction`; cron `release-technician-settlements` (15 min) con aviso a admin si falla; `PayoutBatchesPanel.tsx`, `SettlementReconciliation.tsx`; `supabase/tests/settlements_payout_rls.sql` (18/18) + `security_sweep_and_cron_failure.sql` (5/5); barrido de GRANT/EXECUTE en las 37 tablas + 4 vistas del proyecto (33+4 con exceso, corregido); no probado con datos reales en el navegador (no hay liquidaciones reales hoy) |
| 6. Metas y elegibilidad | ✅ Hecho | 25/8/2026 | 25/8/2026 | `feature/mercadopago-payments-backend` | Migraciones `tighten_technician_assignment_eligibility` + `technician_goals_and_eligibility`; `technicianGoals.ts`, `Goals` real en `EarningsView.tsx`; `supabase/tests/technician_goals_and_eligibility.sql` (9/9 OK); probado en vivo con María (crear/ver progreso/desactivar); hallazgo: la pestaña Metas era inalcanzable y el trigger de elegibilidad era más laxo que el chequeo completo — ambos corregidos |
| 7. Configuración | ✅ Hecho | 24/8/2026 | 24/8/2026 | `feature/mercadopago-payments-backend` | Migración `system_settings_typed_and_audited`; `SystemSettingsPanel.tsx`, `src/lib/settings.ts`; `supabase/tests/system_settings_rls.sql` (13/13 OK); probado en vivo con admin (guardado directo y confirmación de cambio sensible); hallazgo: nada crea filas en `technician_settlements` todavía |
| 8. Calidad y CI | ⬜ Pendiente |  |  |  |  |
| 9. Staging y Vercel | ⬜ Pendiente |  |  |  |  |
| 10. Lanzamiento | ⬜ Pendiente |  |  |  |  |

---

## 8. Referencias técnicas actuales

- Supabase RLS: <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Supabase Cron: <https://supabase.com/docs/guides/cron>
- Pruebas de Supabase: <https://supabase.com/docs/guides/local-development/testing/overview>
- Vercel para Vite: <https://vercel.com/docs/frameworks/frontend/vite>
- Variables de Vercel: <https://vercel.com/docs/environment-variables>
- Checks de despliegue: <https://vercel.com/docs/deployment-checks>
- Logs de funciones: <https://vercel.com/docs/functions/logs>

---

**Primera acción recomendada:** ~~no abrir todavía una conversación nueva para la Fase 0. Primero cerrar la sección 1.1...~~ La sección 1.1 ya está cerrada y commiteada (23/8). La próxima acción real es abrir una conversación nueva y pegar el pedido de la **Fase 0** — con un agregado: pedirle también que audite el hallazgo de la rama de 21 commits sin Pull Request a `main` y decida si conviene fusionarla antes o después de la Fase 0.
