# Changelog

Registro de cambios funcionales relevantes de TecniUrbano. No reemplaza `git log`
(los detalles de implementación están en los commits y las migraciones) — es un
resumen de qué cambió para el negocio y qué evidencia lo respalda.

## 2026-08-30 (tarde) — Bug real: clientes autorregistrados no podían pedir servicio, aunque la ficha de admin ya los mostrara con cuenta

**Reportado por Sandy**: Marcos Abate (cliente ya cargado en la planilla,
`CLI-0018`) llenaba el formulario de diagnóstico logueado y, al enviarlo,
recibía "Tu cuenta todavía no tiene un perfil de cliente vinculado" — pese a
que la ficha de admin ya lo mostraba con "Ya tiene cuenta".

**Causa real:** hay dos columnas que deberían mantenerse sincronizadas —
`customers.profile_id` (usada por la ficha de admin y por el gate de
asignación de técnico) y `profiles.customer_id` (usada por
`currentUser.customerId`, lo que efectivamente gatea `ServiceRequestForm.tsx`
y cualquier pantalla de cliente logueado). `redeem_account_invite()`
(alta vía invitación del admin) las actualiza a las dos en la misma
transacción. Pero `persistCreateCustomerSelf()` (alta por **autorregistro**,
sin invitación — `registerCustomer()` en `AppContext.tsx:811`) solo
escribía `customers.profile_id` — nunca `profiles.customer_id` — y no hay
ningún trigger en la base que las mantenga sincronizadas solo. El resultado:
cualquier cliente que se haya dado de alta por su cuenta (no por invitación)
queda con `profiles.customer_id` en `NULL` para siempre, invisible desde la
ficha de admin (que solo mira el otro lado del vínculo).

**Alcance real, no solo Marcos:** de los 7 clientes con cuenta vinculada en
la base, **3 estaban rotos** por este mismo motivo — Marcos Abate, Juan
Carlos Muccela, Rebeca Ardiles. Los otros 4 (incluida una cuenta de prueba)
entraron por invitación del admin y estaban bien.

**Corregido:**
1. `persistCreateCustomerSelf()` ahora también actualiza
   `profiles.customer_id` después de crear el cliente, en la misma llamada
   — probado el `UPDATE` bajo RLS impersonando el perfil real de Marcos en
   una transacción de rollback, confirmando que el policy
   `profiles_update_own_or_admin` lo permite tal cual lo ejecutaría el
   cliente real.
2. Backfill de una sola vez para los 3 perfiles ya rotos
   (`profiles.customer_id = customers.id` donde `customers.profile_id`
   apunta a ese perfil y `profiles.customer_id` estaba en `NULL`) —
   verificado después: los 7 clientes con cuenta quedan con las dos
   columnas correctamente cruzadas.

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build` sin
errores. `get_advisors` (security) sin hallazgos nuevos.

## 2026-08-30 (noche, cont.) — "Generar enlace de cuenta" también donde ya se está mirando a la persona

Pedido de Sandy: duplicar la acción de invitación (mismo backend
`account_invites`/`createAccountInviteLink`, sin tocar nada de eso) a los
lugares donde un admin ya está viendo a un técnico o cliente puntual, en
vez de obligarlo a ir a la planilla de Clientes.

**Auditado primero:** en la pestaña Técnicos, la "Cuadrilla de Técnicos"
ya es una grilla de tarjetas (no una planilla) y cada tarjeta ya tenía el
menú de tres puntos con "Generar enlace de cuenta" desde una sesión
anterior — nada que agregar ahí.

**Agregado:**
- `ClientFicha.tsx` (la ficha completa del cliente, `#/admin/clientes/<id>`):
  antes no tenía ninguna acción de cuenta. Se agregó el mismo menú de tres
  puntos junto a las métricas del encabezado, mismo criterio de
  habilitación (`disabled` si ya tiene `profileId` o falta el email) y el
  mismo modal de copiar enlace, implementado localmente en el componente
  (no se tocó el modal ni el estado que ya usa `AdminHubView.tsx`).
- Modal de **Detalle de una orden** (`selectedOrder`, bloque "Cliente &
  Contacto"): es el otro lugar real donde un admin mira a un cliente
  puntual sin pasar por la planilla — y es justo el flujo donde más
  importa, porque es ahí donde se topa con el gate duro de asignación de
  técnico si el cliente no tiene cuenta. Reusa el `handleGenerateInvite` y
  el `inviteLinkModal` que ya existían en `AdminHubView.tsx`, sin
  duplicar ese estado.

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build`
sin errores. No hubo click-through en navegador — mismo motivo que el
cambio anterior (sin credenciales reales de admin para autenticar contra
el Supabase conectado).

Commit: `9d3e6db`.

## 2026-08-30 (noche) — Gate duro: sin cuenta vinculada no hay técnico asignado; invitación automática al crear la orden

**Pedido de Sandy, prioridad alta, cerrado en la misma sesión.** Dos cambios
en el mismo espíritu de las invitaciones existentes (`account_invites`,
`redeem_account_invite()`, `get_account_invite()`).

**1. Cuarta condición en `require_eligible_technician_assignment()`**
(mismo trigger que ya valida técnico habilitado, requisitos pendientes y
superposición de horario): si `customers.profile_id` del cliente de la
orden es `NULL`, no se puede asignar ningún técnico —
`raise exception 'El cliente todavía no tiene una cuenta vinculada. Generá
y enviale el enlace de invitación antes de asignar un técnico.'`. El pago
de la seña y la creación de la orden siguen sin cambios — un cliente sin
cuenta puede pagar y pedir el servicio sin problema.

**Hallazgo de la auditoría, no opcional:** el trigger era
`BEFORE UPDATE OF assigned_technician_id` — no cubría el `INSERT`. El modal
"Crear Nueva Orden de Servicio" del admin permite elegir técnico en el
mismo paso en que se crea la orden (`assigned_technician_id` va poblado
directo en el INSERT), así que ese camino se salteaba las 4 condiciones
por completo. Se extendió el trigger a
`BEFORE INSERT OR UPDATE OF assigned_technician_id`, manejando `tg_op`
para no referenciar `OLD` en el caso INSERT.

**Sin retroactividad, confirmado:** la orden de Carlos Méndez/German Gauna
sigue con su técnico ya asignado desde antes — el trigger solo evalúa
asignaciones *nuevas* (`INSERT` con técnico, o `UPDATE` que cambia el
valor), nunca datos ya existentes. Verificado con un intento real contra
esa misma orden (`3ef1ee15-...`, cliente German Gauna, sin canjear su
invitación): crear una segunda orden para él con técnico asignado en el
mismo INSERT fue bloqueado con el mensaje esperado, en una transacción de
rollback sin residuo. Caso de prueba permanente:
`supabase/sql/test_require_customer_account_for_technician_assignment.sql`
(5 casos: INSERT bloqueado, INSERT sin técnico permitido, UPDATE
bloqueado, cliente con cuenta sin problema, regresión de técnico no
habilitado).

**2. Invitación automática al crear la orden desde el admin** (el camino
real de "atiendo un llamado y cargo la orden a mano" — confirmado
auditando `AdminHubView.tsx`: el checkout de invitado online ya le
entrega el link al propio cliente después de pagar, ese camino no
necesitaba nada nuevo). En el modal "Crear Nueva Orden de Servicio":
si el cliente elegido no tiene cuenta (`profileId` null), el selector de
"Asignar Técnico" se deshabilita con una nota explicando por qué, y al
crear la orden se genera automáticamente la invitación — mismo backend
que ya usa el botón "Generar enlace de cuenta" de la planilla de Clientes
(`createAccountInviteLink` / `persistCreateAccountInvite`, sin tocar
`account_invites` ni las funciones de canje) — y se muestra de entrada el
mismo modal de "copiar enlace" que ya existía, sin que el admin tenga que
navegar a otro lado.

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build`
sin errores. `get_advisors` (security) sin hallazgos nuevos. No pude
completar un click-through en el navegador del modal de creación de
orden — el login de demo (`admin@tecniurbano.com.ar` /
`TecniUrbano2026!`) que muestra la propia UI no es una cuenta real contra
la base de Supabase conectada, así que no hay forma de autenticarse sin
tus credenciales reales de admin. El gate en sí está probado exhaustivamente
contra la base real (arriba); lo que falta es la comprobación visual del
modal, que dejo para que la hagas vos con las instrucciones del reporte.

Commit: `846429f`.

## 2026-08-30 — La seña de visita deja de descontarse del presupuesto; se liquida al técnico aparte

**Cambio de negocio aprobado por Sandy tras ADR** (`docs/adr-liquidacion-visita.md`):
la seña de $50.000 deja de restarse del presupuesto final — el cliente paga
ambos montos completos y por separado — y el técnico cobra la seña como una
liquidación propia (`technician_settlements.settlement_type = 'visita'`),
neta de una comisión propia del 15% y del fee de Mercado Pago, apenas la
orden pasa a `in_progress` (no cuando se envía o acepta el presupuesto —
cubre el caso de una visita hecha y una orden cancelada después, admin
emergency override incluido).

**Comisión propia, no reutilizada:** nueva clave
`system_settings.visit_settlement_commission_rate` (default 0.15),
completamente separada de `platform_commission_rate` (17%, sigue exclusiva
de `completed_work`). Mismo panel de admin (`VisitFeeSettings.tsx`), mismo
criterio de validación server-side y auditoría de quién/cuándo/valor
anterior que el resto de Fase 7 — la validación de rango (0 a 1) del
trigger genérico `system_settings_audit()` ahora aplica a cualquier clave
`%_commission_rate`, protegiendo retroactivamente también a
`platform_commission_rate`, que no tenía ese chequeo antes.

**Corregido para que no se duplique el pago:** `total_paid_amount` ahora
incluye la seña completa (ya no está descontada del saldo), así que
`create_settlement_on_order_completed_and_paid()` restaba de más si no se
tocaba — se corrigió para restar lo ya liquidado como `'visita'` (monto y
fee de MP) antes de calcular la comisión y el neto de `completed_work`.
Caso de prueba permanente:
`supabase/sql/test_visit_and_completed_work_settlements.sql` — dispara
ambas liquidaciones sobre la misma orden y confirma que la suma coincide
exactamente con lo pagado por el cliente, en bruto y reconstruida
(neto + comisión + fee), sin faltantes ni duplicados.

**También corregido (encontrado auditando el pedido, no parte de lo
pedido inicialmente pero necesario para que el cambio sea consistente):**
el trigger `sync_quote_totals_from_items` seguía calculando
`remaining_amount = total_amount - visit_deposit_credit` — sin este fix,
"Total a pagar" en las pantallas de cliente/técnico hubiera seguido
mostrando el presupuesto con la seña ya descontada. Ahora
`remaining_amount = total_amount`, sin resta. Solo afecta presupuestos en
`draft` — uno ya `sent`/`accepted` está protegido por
`prevent_sent_quote_content_change` y nunca se recalcula, así que no toca
presupuestos ya cerrados. `ensureDraft` en `QuoteBuilder.tsx` deja de
escribir `visit_deposit_credit: order.visitDepositAmount` en presupuestos
nuevos (queda en 0 — la columna no se borra, solo deja de usarse).

**Pantallas corregidas:** `QuoteViewer.tsx` y `QuoteBuilder.tsx` sacan la
línea de "Seña acreditada: -$X" y muestran el total del presupuesto sin
descuento, con una nota aclaratoria de que la visita ya pagada es aparte.
`RejectedVisitReceipt.tsx` renombra el label "Seña de visita registrada" a
"Visita de presupuesto registrada" (misma lógica, sin cambios). `ClientFicha.tsx`
sin cambios de código — ya leía `remaining_amount` directo, ahora correcto
por el fix del trigger.

**Sin retroactividad, confirmado:** la única orden `in_progress` real de la
base (Carlos Méndez, Soldadura) quedó sin tocar — el trigger nuevo es
`AFTER UPDATE` y no se dispara solo. `technician_settlements` tiene 0 filas
reales tras el deploy.

**Hallazgo de seguridad post-deploy, corregido en el momento:** la nueva
función de trigger `create_visit_settlement_on_started()` quedó exponible
vía `/rest/v1/rpc/create_visit_settlement_on_started` para `anon` y
`authenticated` (`get_advisors` WARN) — a diferencia de
`create_settlement_on_order_completed_and_paid()`, que ya tenía `PUBLIC`
revocado. Se revocó `EXECUTE` para igualar el criterio existente; el
advisor de seguridad quedó limpio de hallazgos nuevos.

**Verificado con transacciones de rollback contra la base real:** doble
liquidación exacta, cancelación posterior a `in_progress` conserva el pago
de la seña, sin backfill sobre la orden real en curso, validación de rango
0–1 rechaza `5.0` y acepta `0.2`. `tsc --noEmit`, `vitest run` (84/84),
`npm run build` sin errores.

Commit: `fdaccc8`.

## 2026-08-30 (madrugada) — Bug de prioridad alta: seña de $30.000 en el camino del asistente de diagnóstico

**Diagnóstico real, no el sospechado.** No era un valor hardcodeado en
`diagnosisAssistant.ts`/`diagnosisDraft.ts` (esos archivos no tocan montos en
absoluto) ni un monto mal calculado server-side. Eran dos problemas de
permisos encadenados, ambos en `system_settings`:

1. `visit_deposit_amount` tenía `visibility='authenticated'`. Para un
   visitante SIN cuenta (el único que realmente pasa por
   `GuestServiceRequestForm.tsx` — un cliente logueado usa `ServiceRequestForm.tsx`,
   ya autenticado), `fetchVisitDepositAmount()` (cliente, sujeto a RLS)
   no podía leer la fila real y caía al fallback hardcodeado de
   `src/lib/supabaseData.ts` (`VISIT_DEPOSIT_FALLBACK = 30000`) — un
   valor de una tanda de precios vieja que nunca se actualizó porque nada
   dependía de él hasta que existió el checkout de invitado.
2. Incluso corrigiendo la visibilidad, el rol `anon` **nunca tuvo el GRANT
   de tabla base** sobre `system_settings` (`permission denied`, no un
   simple 0 filas) — la política `system_settings_select_public` que ya
   incluía `anon` en sus roles nunca pudo aplicarse en la práctica, para
   ningún setting `public`, desde que se creó. No es un problema nuevo de
   este bug, es un hallazgo aparte que salió al verificar el fix.

**El monto realmente cobrado ya era correcto** —
`api/orders/guest-checkout.ts`/`api/orders/request-service.ts` usan
`supabaseAdmin` (service role, sin RLS) y ya recalculaban $50.000 desde
`system_settings` antes de armar la preferencia de Mercado Pago, ignorando
cualquier monto que mandara el cliente (que para modo diagnóstico ni
siquiera envía uno). Era un bug de visualización pre-pago para el
visitante, no un cobro incorrecto — confirmado leyendo el código completo
de ambos endpoints, no solo el síntoma.

**Corregido:** `visit_deposit_amount` pasa a `visibility='public'` (no es
sensible — ya se muestra como texto público en el propio formulario) +
`GRANT SELECT ON system_settings TO anon`, verificado que RLS sigue
acotando a `anon` solo a las filas `public` (`enabled_provinces` y
`visit_deposit_amount` — nada de comisión ni nada admin).

**Defensa en profundidad agregada, como pidió Sandy:** `customer_order_drafts`
(la tabla que arma el borrador y dispara el cobro de MP antes de que exista
la orden) no tenía ningún trigger que revalidara `amount` — a diferencia de
`service_orders`, protegido por `enforce_service_order_pricing`. Hoy la
tabla tiene RLS con **cero políticas** (default-deny total, ya señalado
como INFO en los advisors), así que solo el service role puede escribir
ahí y ninguno de los dos endpoints confía en un monto del cliente para la
seña — pero se agregó `enforce_customer_order_draft_pricing()`
(`BEFORE INSERT`, mismo patrón que el trigger de `service_orders`) para
que ningún camino futuro (una policy nueva, un dashboard, un bug de
migración) pueda saltarse el recálculo. Alcance: solo `payment_type='visit_deposit'`,
tal como se pidió — `full_advance` (precio fijo) sigue igual, ya se
recalcula server-side contra el catálogo real.

**Verificado con transacciones de rollback contra la base real**
(`supabase/sql/test_customer_order_draft_pricing_trigger.sql`, mismo
criterio que `test_pricing_trigger.sql`): un borrador `visit_deposit` con
`amount=1` manipulado se corrige a $50.000; un borrador `full_advance` con
`amount=8000` queda sin tocar. Cero residuo en la base (`customer_order_drafts`
en 0 filas antes y después, tal como confirmó Sandy).

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build`.

Commit: `5686ddc`.

## 2026-08-29 (madrugada) — Problema 6 (mobile) investigado, no reproducido; Fase 10 tercera pasada

**Problema 6 — panel de admin desbordado en mobile.** Los tres elementos que
Sandy reportó desde su celular (fila de chips del Admin Hub, desplegable de
"Asignar técnico", panel de notificaciones) ya habían sido arreglados en un
commit previo de esta misma sesión (`c1e05a6`, ya en producción). Probé los
tres en vivo contra `https://tecniurbano.online` real, logueado como admin,
en viewport de 375px y 360px: ningún elemento se corta, `document.documentElement.scrollWidth`
coincide exactamente con `innerWidth` (sin overflow horizontal de página), y
las tres capturas confirman texto completo sin truncar. No encontré nada
para arreglar. Hipótesis más probable de por qué Sandy lo seguía viendo: el
sitio es una PWA con service worker activo (`registerType: 'autoUpdate'`,
confirmado registrado en el navegador) — si tenía la app abierta o instalada
desde antes del deploy del fix, una navegación puramente interna (hash-route)
nunca dispara la verificación de actualización del service worker; hace
falta cerrar la app del todo y volver a abrirla (o un hard refresh) para que
tome el bundle nuevo. Sin código para commitear en este punto — quedo a la
espera de que Sandy confirme si un cierre completo de la app resolvió lo que
veía.

**Fase 10 — tercera pasada, reporte de estado (sin ejecutar nada nuevo).**
Detalle completo en `docs/fase10-checklist.md` (secciones "Resumen
ejecutivo" del 29/8, y nuevas secciones 5 "Primeras 48 horas" y 6
"Definición de terminado"). Resumen: `tsc`/`vitest` (66/66)/`build` limpios;
25 migraciones remoto=local; secretos limpios en todo el historial de git;
**las 10 suites de `supabase/tests/*.sql` corridas hoy por primera vez todas
juntas** (91 aserciones) — 8/10 pasan tal cual están escritas, 2 fallan por
fixtures desactualizados (les falta un campo que un gate de una fase
posterior ahora exige) y se confirmó que las 10 pasan corrigiendo el fixture
al vuelo, sin tocar los archivos del repo. **Regresión real encontrada y
corregida en el camino:** el advisor de seguridad volvió a marcar ERROR en
`technician_public_view` (`CREATE OR REPLACE VIEW` de esta misma sesión,
antes de este reporte, había pisado el `security_invoker=true` puesto en la
Fase 9 sin volver a declararlo) — corregido con
`alter view ... set (security_invoker = true)`
(`20260829195048_restore_technician_public_view_security_invoker.sql`),
advisor reverificado en 0 ERROR. Smoke test de 10 flujos en producción real
y primeras 48 horas post-lanzamiento siguen necesitando a Sandy con
navegador — no son ejecutables desde acá.

## 2026-08-29 (más noche) — Problema 8: gate de "salió hacia el domicilio" y stock de materiales

**"Salí hacia el domicilio" nunca se podía usar en un pedido de diagnóstico.**
El botón, el handler y la persistencia ya existían (Fase 3 Tanda 2, commit
`a00897e`) y funcionaban bien para `work_mode='direct'`. El gate
(`canExecutePaidWork`) exigía para diagnóstico presupuesto aceptado + saldo
pagado — imposible de cumplir en el primer viaje, porque ese viaje es
justamente para diagnosticar, antes de que exista ningún presupuesto. Cambiado
el gate (en el botón, en `updateOrderStatus`, y en el aviso de "esperando
pago") a `isOrderPaymentSettled`, que para diagnóstico alcanza con la seña.
`canExecutePaidWork` quedó sin ningún llamador — se eliminó (ya no es "dejarlo
por las dudas", es código muerto real) y sus tests se consolidaron dentro de
los de `isOrderPaymentSettled`, actualizados para documentar la regla nueva.
No se tocó `assignTechnician` ni el gate de asignación (ya usaban
`isOrderPaymentSettled`) ni el bloqueo de superposición horaria.

**El cambio del lado del cliente no alcanzaba solo.** Probando el flujo real
en el navegador (login como Carlos, orden de diagnóstico con solo la seña
pagada) el click en "Salí hacia el domicilio" seguía devolviendo 400 —
`prevent_unpaid_execution_timer`, un trigger de `service_orders` que nunca
había mirado en la investigación original, duplicaba server-side la regla
vieja exacta (`quote_status='accepted' AND payment_status='paid_in_full'`
para diagnóstico) como defensa en profundidad, independiente del gate de
React. Corregido para espejar `isOrderPaymentSettled`: diagnóstico alcanza
con la seña, sin mirar `quote_status`; `direct` sigue exigiendo todo pagado.
Re-probado en el navegador con una orden real: `PATCH` a `service_orders`
devuelve 204, el estado sobrevive un reload duro, `work_started_at` queda
seteado, el cronómetro corre en pantalla, y `notify_technician_en_route`
disparó la notificación al cliente por primera vez en todo el proyecto.

**"Inventario descontado" no descontaba nada.** El código sí intentaba
restar `materials.stock` — pero `materials_write_admin` es la única política
de escritura de esa tabla y exige `is_admin()`, así que el `UPDATE` de un
técnico quedaba bloqueado por RLS en silencio (sin `.select()`, 0 filas
afectadas no tira error) mientras el estado optimista de React ya mostraba el
descuento — eso también explicaba el "Stock: 118" visto en pantalla con
`materials.stock` real en 120: quedó pegado del intento anterior, nunca
confirmado contra la base. Arreglado con `register_material_usage`
(`SECURITY DEFINER`, mismo patrón que `self_register_technician`): inserta en
`order_materials_used` y descuenta `materials.stock` en un solo paso atómico,
validando adentro que el llamador sea el técnico asignado a esa orden (o
admin) — sin abrir `materials` a escritura general. De paso, `addUsedMaterial`
ahora revierte el descuento optimista de stock y la fila de material
agregada si el guardado remoto falla, para que la pantalla nunca vuelva a
mostrar un número que la base no tiene.

Verificado con transacciones de impersonación con rollback (orden de prueba
efímera, borrada dentro de la misma transacción): técnico asignado descuenta
bien (120→118, fila insertada); técnico no asignado a esa orden, rechazado;
admin puede registrar igual sin estar asignado; orden `completed` rechaza el
registro aunque sea el técnico asignado.

**Verificación:** `tsc --noEmit`, `vitest run` (66/66, 3 tests consolidados
sin perder cobertura), `npm run build`, más la prueba en vivo en el navegador
descripta arriba. Orden de prueba y su notificación/evento borrados al
terminar — 0 `service_orders` reales en la base.

## 2026-08-29 (noche) — Problema 7: remaining_amount y sync de documentos/requisitos

Dos de los tres temas reales que Sandy armó en el "Problema 7" de su tablero
(el tercero, chequeo de rama sin PR a `main`, se descartó: era un dato viejo
del 23/8 nunca reconfirmado — `feature/mercadopago-payments-backend` ya tiene
su PR #1 mergeada y la otra rama está a 0 commits sobre `main`).

**`remaining_amount` no baja tras pagar el saldo.** Diagnóstico de Sandy,
confirmado leyendo el trigger completo: `prevent_sent_quote_content_change`
congela `remaining_amount` (entre otros campos) apenas el presupuesto sale de
`draft` — a propósito, para que no se pueda manipular un presupuesto ya
enviado — pero nada lo recalcula cuando el pago se confirma después. Antes de
tocar nada, rastreé cada lectura de `remaining_amount`/`remainingAmount` en
todo el repo: `QuoteViewer.tsx` (cliente) y `ClientFicha.tsx` (admin) ya
esconden el valor congelado detrás de "Pagado" en cuanto `quote.status ===
'accepted'`, así que ahí no había ningún bug visible hoy. El único lugar sin
ese resguardo era `QuoteBuilder.tsx` (vista del técnico) — mostraba
"Restante: $X" para siempre, incluso con el presupuesto ya aceptado y
cobrado. Corregido con el mismo patrón que ya usan las otras dos pantallas.
El endpoint que cobra el saldo (`api/payments/create.ts`) ya estaba a salvo:
rechaza con 409 si `quote.status !== 'sent'`, así que nunca puede recobrar
usando un `remaining_amount` viejo de un presupuesto ya aceptado.

**Sync `technician_documents`/`technician_matriculas` → `technician_requirements`.**
Mismo patrón de diagnóstico que el bug de la CBU (Fase 6 Tanda 1), pero
causa distinta: acá `lock_technician_review_fields()` ya tenía
`SECURITY DEFINER` (confirmado, no faltaba eso) — el gap real era que las
ramas de `technician_matriculas` y `technician_documents` solo reseteaban los
campos del documento/matrícula mismo, nunca hacían el UPDATE cruzado a
`technician_requirements` que sí tiene la rama de `technician_payment_accounts`.
Mapeo documento→requisito confirmado contra el código real (no supuesto):
`TechnicianReviewCard.renderRequirementEvidence` solo usa `document_type`
`'monotributo'`→`monotributo_approved` e `'identity'`→`identity_verified`.
`'degree'` se sube (`ProfessionalProfile`, "Título o certificación") pero
`education_verified` nunca lo mira — su evidencia en la revisión del admin es
el texto libre de `technicians.degree_title`/`education_level`/`institution_name`,
no el PDF. Esa desconexión queda como hallazgo aparte, sin tocar. `'certificate'`
y `'license_support'` están permitidos por el CHECK de la columna pero no los
produce ninguna pantalla — vestigiales. Agregado también el reset para
`technician_matriculas` → `matricula_validated` (mismo bug, mismo lugar,
no pedido explícitamente pero es el mismo gap de al lado en la misma función).

Verificado con transacciones de impersonación con rollback contra datos
reales (Carlos Méndez, con los 6 requisitos ya aprobados): nueva identidad →
`identity_verified` vuelve a `pending`; nuevo monotributo → `monotributo_approved`
vuelve a `pending`; nueva matrícula → `matricula_validated` vuelve a `pending`;
nuevo `degree` → nada cambia (correcto, no está mapeado); admin subiendo en
nombre del técnico → no dispara ningún reset (mismo comportamiento que ya
tenía el fix de la CBU).

**Verificación:** `tsc --noEmit`, `vitest run` (69/69).

## 2026-08-29 — Fase 6 ampliada: alta y perfil de técnico, Tanda 2 (flujo visible)

Segunda tanda, sobre el schema/backend de la Tanda 1. Esta es la que cambia el
flujo real que usan técnicos y admin.

**"Ser técnico" ahora es un alta real** — pide contraseña y rubros (checkboxes
de categorías reales, no un `<select>` de un solo valor) y crea la cuenta +
ficha del técnico al enviar el formulario (`self_register_technician`), sin
esperar ningún paso de admin. Se loguea al toque en `/technician`. Si Supabase
pide confirmar el email antes de dar sesión, se avisa igual que en el alta de
cliente (mismo patrón que `registerCustomer`).

**"Mi perfil profesional" ahora es editable** — teléfono laboral, formación,
título, institución, presentación, dirección y email pasan de ser de solo
lectura a editables por el propio técnico. La contrapartida: "Editar Técnico"
(admin) dejó de exponer esos mismos campos — ya no hay dos pantallas
escribiendo el mismo dato, que era justo el bug que motivó que antes fueran
de solo lectura para el técnico. CBU sigue en su propia sección (ya era
editable desde la Tanda 1's fix).

**Panel "Solicitudes 'Ser técnico'" pasa a ser bitácora de solo lectura** — sin
botones de Aprobar/Rechazar (ya no hace falta: la cuenta ya existe para
cuando el admin ve la fila). La aprobación real del perfil sigue pasando por
"Validación de técnicos", sin cambios ahí.

**Verificado de punta a punta con una cuenta de prueba real** (creada por el
formulario público real, no simulada): alta con rubro "Plomería" → ficha
`technicians` creada con `validation_status='pending'`, 6 requisitos
sembrados, `technician_specialties` correcto, redirigido a `/technician`
automáticamente; edité "Mi perfil profesional" (teléfono laboral, dirección,
formación, título, institución, presentación) y confirmé cada campo escrito
en la base; confirmé desde el admin que "Solicitudes" la muestra sin botones
de acción, "Validación de técnicos" la lista como pendiente, y "Editar
Técnico" ya no tiene los campos removidos. Cuenta de prueba (`auth.users`
incluido) borrada al terminar — 4 técnicos reales sin residuo.

Código removido en el proceso (quedaba muerto tras el cambio de flujo):
`submitTechnicianApplication`/`persistCreateTechnicianApplication`,
`reviewTechnicianApplication`/`persistReviewTechnicianApplication`,
`TechnicianApplicationInput`, `handleApproveApplication`, los 5 campos de
"perfil profesional" en `TechnicianInput` y en el UPDATE de
`persistUpdateTechnician`.

**Verificación:** `tsc --noEmit`, `vitest run` (69/69), `npm run build`.

## 2026-08-29 — Fase 6 ampliada: alta y perfil de técnico, Tanda 1 (schema y backend)

Primera de dos tandas del rediseño de alta y perfil de técnico, a partir de una
auditoría que encontró aprobaciones de requisitos sin datos reales detrás
(`education_verified` aprobado con `education_level`/`degree_title`/`institution_name`
en `null`). Esta tanda es toda de base y backend — sin cambios de flujo visibles
todavía (eso es la Tanda 2: alta automática de cuenta, "Mi perfil profesional"
editable, panel de solicitudes de solo lectura).

**Múltiples rubros por técnico**
- Tabla nueva `technician_specialties(technician_id, category_id)` (no array de
  texto) + RLS (`technician_specialties_select_scoped`, `technician_specialties_write_admin`).
- Backfill de los 4 técnicos existentes por coincidencia de nombre de categoría
  contra el texto libre de `technicians.specialty` (un caso, "Pintor", no
  matcheaba ninguna categoría por texto y se corrigió a mano a "Reparaciones del
  hogar" — verificado registro por registro contra la base real).
- `technicians.specialty` queda como columna de compatibilidad (ya no se
  escribe) — el código ahora arma ese string uniendo los nombres reales de
  `technician_specialties` con `, `.
- Migrados a la tabla nueva: alta y edición de técnico (Admin Hub), matching de
  elegibilidad para reasignación automática (`offer_to_next_eligible_technician`),
  `technician_public_view` (ficha pública que ve el cliente), y las listas de
  `TechnicianValidation`/`TechnicianReviewCard`.
- Verificado en vivo: edité a Carlos Méndez desde el Admin Hub agregándole
  "Cerrajería" y confirmé el cambio contra la base real antes de revertirlo.

**Columna `technicians.address`** — nueva, para la dirección propia del técnico
(hasta ahora no existía; solo había `zone`/`province`). Se llena desde la Tanda 2
(alta automática y "Mi perfil profesional"); el formulario de admin no la toca.

**Bug real corregido: CBU editado no volvía a pending**
- `lock_technician_review_fields` solo reseteaba `validation_status` a
  `pending` en INSERT, nunca en UPDATE — un técnico ya aprobado podía cambiar su
  CBU sin que nadie lo revisara de nuevo.
- Ahora un UPDATE no-admin en `technician_payment_accounts` fuerza
  `validation_status` a `pending` y además resetea el requisito puntual
  (`technician_requirements.status = 'bank_account_valid'`) — no toca
  `is_enabled` ni el resto del perfil, tal como se pidió.
- La función necesitó `SECURITY DEFINER` para poder escribir esa segunda tabla
  bajo el rol del propio técnico — se detectó con una prueba con rollback que
  falló antes de agregarlo (el UPDATE cruzado quedaba bloqueado por RLS, sin
  error visible) y se volvió a probar después, confirmando el fix real.
- Verificado con dos pruebas con rollback contra Carlos Méndez: (1) admin
  aprueba CBU → técnico edita CBU → ambos estados vuelven a `pending`; (2)
  admin edita un dato no sensible (alias) → el estado aprobado no se toca.

**Alta automática (backend, todavía sin UI)** — `self_register_technician(...)`
(`SECURITY DEFINER`): crea `technicians` + `technician_specialties` + siembra
`technician_requirements` + promueve el perfil a `role='technician'`, en un
solo paso atómico. Probado con rollback: alta completa de un usuario existente
(Julián, cliente) con doble rol preservado (mantiene su ficha de cliente),
rubro múltiple con matrícula requerida detectada correctamente, y los dos
guardas de seguridad (una cuenta admin no puede autoconvertirse; una cuenta que
ya tiene ficha de técnico no puede duplicarla).

**Bucket `technician-documents` acepta imágenes** — sumados `image/jpeg` e
`image/png` a `allowed_mime_types` (antes solo `application/pdf`), mismo
criterio que `technician-avatars`. Se actualizaron los dos checks del lado del
cliente que rechazaban no-PDF antes de llegar a Storage
(`ProfessionalProfile.tsx`, `TechnicianReviewCard.tsx`).

**Migraciones aplicadas** (`ayszrtieplmqscqtabsu`): `create_technician_specialties`,
`add_technicians_address_column`, `fix_payment_account_edit_resets_requirement`,
`fix_lock_technician_review_fields_security_definer`, `create_self_register_technician`,
`allow_image_uploads_technician_documents_bucket`, `backfill_technician_specialties`,
`reoffer_uses_technician_specialties`, `technician_public_view_uses_specialties_table`.

**Verificación:** `tsc --noEmit`, `vitest run` (69/69), `npm run build`, todos
en verde. Commit `d4037f7`.
