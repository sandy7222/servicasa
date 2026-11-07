# Plan: cobro repartido automático del trabajo (Mercado Pago Split 1:1)

> **Cómo retomar este plan en otra sesión (o con otro modelo):** leer este archivo completo, la "Bitácora" del final, `docs/borrador-clausula-cobros-tecnicos.md` y la memoria `project_mp_marketplace_split_research.md` / `project_commission_decisions.md`. Correr `git log --oneline -15`. Cada fase tiene una **definición de terminado**: no se pasa a la siguiente sin cumplirla. Las fases marcadas con 🔒 tienen una **compuerta** que depende de Sandy.

**Leyenda:** ✅ hecho · 🔄 en curso · ⏳ pendiente · 👤 Sandy · 🤖 Claude · 🔒 compuerta (no avanzar sin el OK explícito de Sandy).

## Objetivo y decisiones ya tomadas (no re-discutir)
- **Visita de Presupuesto:** sigue como hoy (modelo A). La cobra la cuenta de Sandy; la liquidación se genera al pasar la orden a `in_progress` (`create_visit_settlement_on_started`) y Sandy transfiere a mano desde `PayoutBatchesPanel`. **No se toca en este plan.**
- **Trabajo (presupuesto aceptado / precio fijo):** se cobra **repartido automáticamente**: el pago se crea con el token OAuth del técnico y `application_fee`; Mercado Pago acredita el neto al técnico y la comisión a Sandy.
- **Comisión:** **17%**, sin IVA (Sandy es monotributista). Leer siempre de `system_settings.platform_commission_rate`, **nunca hardcodear**. TecniUrbano puede modificarla con preaviso (cláusula X.5 del borrador).
- **Retención:** el pago del trabajo se **reserva** con tarjeta (`capture: false`, 7 días en Argentina) y se **captura** cuando el cliente firma la conformidad y el técnico cierra. Solo tarjeta en este flujo.
- **El cargo de Mercado Pago lo paga el técnico.**
- **Producción:** Vercel Hobby (máx. 12 funciones → todo endpoint nuevo va por `api/gateway.ts` con su rewrite en `vercel.json`; crons solo diarios), deploy desde `main`. Supabase proyecto `ayszrtieplmqscqtabsu` (ServiCasa).

## Qué está verificado y qué no (resumen de la investigación)
- ✅ OAuth de un vendedor de prueba con una app creada **desde la cuenta Marketplace de prueba** funciona (`scripts/mp-split-poc.mjs`, app `tecniurbano-prueba` 3283880377683720).
- ✅ Reserva y captura con tarjeta por API de **Orders** funcionan en sandbox, pero Orders **ignora** la comisión (`marketplace_fee`).
- ❌ **No verificado:** `/v1/payments` + `capture:false` + `application_fee` con token OAuth (en sandbox da "Unauthorized use of live credentials"). La doc de Split para Checkout API solo describe `application_fee` en `/v1/payments`.
- ❓ La doc de Split 1:1 dice "sólo permite pagos con dinero en cuenta": ambigua respecto a tarjetas.
- La app real `tecniurbano` (4873478128035371) ya tiene credenciales de producción, redirect `https://tecniurbano.online/oauth-callback` y `MP_APP_CLIENT_ID`/`MP_APP_CLIENT_SECRET` en `.env.local`.

## Riesgos técnicos que este plan tiene que resolver
1. **Doble pago al técnico:** `create_settlement_on_order_completed_and_paid()` genera una liquidación `completed_work` (que Sandy transfiere a mano) cuando la orden queda `completed` + `paid_in_full`. Con el cobro repartido el técnico **ya recibió su parte en su cuenta**: esa liquidación NO debe generarse (o debe quedar en 0 / tipo informativo) para pagos repartidos.
2. **CSP:** `vercel.json` tiene `script-src 'self'` y `connect-src` acotado. El formulario de tarjeta de Mercado Pago (SDK `https://sdk.mercadopago.com/js/v2`, Card Payment Brick o Secure Fields) necesita permitir sus dominios en `script-src`, `connect-src`, `frame-src` e `img-src`. Verificar en la doc oficial la lista exacta antes de tocarla.
3. **Webhook:** los pagos repartidos pertenecen a la cuenta del técnico; para consultarlos hay que usar **su** token. El webhook debe identificar al técnico (por `user_id`/`collector_id` o por `external_reference`) y usar su token, no el de la plataforma.
4. **Tokens de terceros:** el access/refresh token de cada técnico es dinero ajeno: guardarlos **cifrados en Vault** (mismo patrón que `ai_providers`), nunca en el navegador, nunca en logs.
5. **Vencimiento de la reserva:** 7 días; con cron diario hay margen. Qué hacer si vence sin conformidad es decisión de Sandy (cláusula X.6).

---

## 🔒 Fase 0 — Validación con Mercado Pago (compuerta)
> ✅ **6/11/2026 — VALIDADO EN SANDBOX.** Clave (dato de soporte MP): el token OAuth del vendedor de prueba se pide con **`test_token=true`** en `/oauth/token`, desde la app creada en la cuenta Marketplace de prueba (`tecniurbano-prueba`, Redirect URL extra `https://tecniurbano.online/prueba-oauth` solo para el script). Con eso `/v1/payments` funciona. Resultados (`scripts/mp-split-poc.mjs pay-*`, tarjeta de prueba Mastercard, $1000, `application_fee` 170):
> - Reserva `capture:false` → `authorized / pending_capture`. Mientras está reservada, `fee_details` viene vacío (la comisión todavía no se ve).
> - **Captura total** → `approved / accredited`; `fee_details`: `mercadopago_fee` 41 + `application_fee` 170, ambas pagadas por el técnico (`collector`); neto del técnico **789**. ✅
> - **Captura parcial** de 600 sin tocar la comisión → la comisión queda en **170 fija** (no se prorratea); neto 405,40. ⚠️ Si se captura menos, hay que mandar el nuevo `application_fee` en el mismo `PUT`.
> - **Captura parcial con `application_fee` ajustado** (`PUT {capture:true, transaction_amount:600, application_fee:102}`) → comisión 102, neto 473,40. ✅
> - **Cancelación** (`PUT {status:'cancelled'}`) → `cancelled / by_collector`, nada cobrado. ✅
> - `money_release_date` = 18 días después: es la configuración de liberación del vendedor, no la nuestra.
> Falta solo lo que el sandbox no puede mostrar: que en una cuenta REAL la comisión llegue efectivamente al saldo de Sandy (se valida en 5.3 con monto bajo).
- [x] 0.1 👤 Respuesta de soporte de MP (6/11): `application_fee` es de `/v1/payments` (Orders no tiene equivalente); Split 1:1 admite tarjeta; no hay trámite obligatorio para el modelo estándar; el token de prueba se pide con `test_token=true`.
- [ ] 0.2 👤 Confirmar que la cuenta de Sandy tiene identificación **KYC nivel 6**.
- [ ] 0.3 👤🤖 Si soporte no responde: **prueba real con monto bajo** (ej. $200) con OK explícito de Sandy: segunda cuenta REAL de MP como técnico (familiar), tarjeta de otra persona, `/v1/payments` con `capture:false` + `application_fee`, captura total y verificación de `fee_details` y saldos. Se puede hacer con el script de la Fase 1 + un comando nuevo en `scripts/mp-split-poc.mjs` apuntando a la app real (`MP_POC_APP=real`).
- [x] 0.3 Reemplazado por la prueba en sandbox del 6/11 (ver recuadro). La prueba real de monto bajo queda para 5.3.
- **Terminado cuando:** está confirmado (por soporte o por la prueba real) que la comisión se descuenta en un pago reservado y capturado. **Si no se confirma, NO se hacen las Fases 2-5**; se evalúa alternativa (cobro sin reserva, o Variante B).
- **Estado:** ✅ terminado en sandbox (6/11/2026), salvo 0.2 (KYC 6 de Sandy), que hace falta antes de 5.3. **Implicancia para la Fase 3:** al capturar menos que lo reservado, recalcular `application_fee = round(monto_capturado × platform_commission_rate, 2)` y mandarlo en el mismo `PUT`.

## Fase 1 — Vincular la cuenta de Mercado Pago del técnico (se puede hacer YA, no mueve dinero)
- [x] 1.1 🤖 Migración `technician_mp_accounts`: `technician_id` (único), `mp_user_id`, `public_key`, `scope`, `access_secret_id` y `refresh_secret_id` (uuid de Vault), `expires_at`, `linked_at`, `revoked_at`. RLS sin políticas; funciones SECURITY DEFINER solo para `service_role` para guardar/leer/borrar (copiar el patrón de `20261004003541_ai_providers.sql`). Una vista o función que el técnico pueda leer solo con `linked`, `mp_user_id` y `expires_at` (nunca tokens).
- [x] 1.2 🤖 Tabla `mp_oauth_states` (state aleatorio, `technician_id`, `created_at`, usado/no) para que el `state` del OAuth quede atado al técnico logueado y venza a los 10 minutos.
- [x] 1.3 🤖 Endpoint `mp-oauth-start` (gateway, POST con sesión de técnico): crea el `state` y devuelve la URL `https://auth.mercadopago.com/authorization?client_id=…&response_type=code&platform_id=mp&state=…&redirect_uri=https%3A%2F%2Ftecniurbano.online%2Foauth-callback`.
- [x] 1.4 🤖 Callback: rewrite en `vercel.json` `/oauth-callback` → `/api/gateway?action=mp-oauth-callback` (GET). Valida `state`, canjea el `code` en `/oauth/token` con `MP_APP_CLIENT_ID`/`MP_APP_CLIENT_SECRET` (cargarlas en Vercel), `test_token:'false'`, guarda tokens en Vault y redirige a `/#/technician/profile?mp=ok` (o `?mp=error`). Nunca mostrar ni loguear tokens.
- [x] 1.5 🤖 Renovación: el cron diario existente (`/api/cron/cleanup-diagnosis-photos` o uno nuevo si entra en el límite de Hobby) renueva con `grant_type: refresh_token` los tokens que vencen en menos de 30 días. Si falla, avisar por la campanita al técnico y por Telegram a Sandy.
- [x] 1.6 🤖 UI en el perfil del técnico (`ProfessionalProfile.tsx`): estado (vinculada / no vinculada / vence pronto), botón **"Vincular mi Mercado Pago"** con la casilla de autorización (texto en `docs/borrador-clausula-cobros-tecnicos.md`), y "Desvincular". La aceptación de la casilla se registra en `legal_acceptances` con un slug nuevo (`autorizacion_cobro_mp`) → requiere ampliar el CHECK de `document_slug` en una migración.
- [x] 1.7 🤖 Admin: en la ficha del técnico, ver si tiene MP vinculado.
- [x] 1.8 🤖 Tests (handler, states, refresh, UI) con mocks; nunca credenciales reales en tests.
- **Estado:** código y migración (`20261105120000_technician_mp_accounts.sql`) en producción desde el 5/11/2026; `MP_APP_CLIENT_ID`/`MP_APP_CLIENT_SECRET` cargadas en Vercel; endpoints verificados (callback redirige, start/unlink piden sesión). **FALTA la prueba con una cuenta real de Mercado Pago.**
- **Terminado cuando:** un técnico de prueba vincula su cuenta en producción, el estado aparece en su perfil y en el admin, y la renovación funciona (forzando un vencimiento cercano en un test).

## 🔒 Fase 2 — Cobrar el trabajo con reserva y comisión (requiere Fase 0)
- [x] 2.1 🤖 Interruptor `system_settings.split_payments_enabled` (default `false`) en la migración `20261106120000_split_work_payments.sql`. Con `false` todo sigue como hoy. Solo se usa el flujo nuevo si está en `true` **y** el técnico asignado tiene MP vinculado (con public key).
- [x] 2.2 🤖 CSP en `vercel.json`: se agregaron dominios de Mercado Pago (`*.mercadopago.com`, `*.mlstatic.com`, `*.mercadolibre.com`) a script/style/font/img/connect y un `frame-src` nuevo. **Probado el 6/11** en un banco local con la misma CSP: el Card Payment Brick carga, tokeniza la tarjeta de prueba y la reserva queda `authorized` en sandbox. Solo quedó bloqueado un script inline del SDK, sin efecto en el flujo (no se agregó `'unsafe-inline'`).
- [x] 2.3 🤖 `CardReservationForm.tsx` (Card Payment Brick cargado bajo demanda) abierto desde `QuoteViewer.tsx`. **Solo tarjeta de crédito** (se excluyen débito y prepaga: la reserva con débito no está documentada) y **1 pago** (ofrecer cuotas obliga a mostrar CFT/TEA, Res. E 51/2017). Si la consulta del cobro repartido falla, el botón paga como siempre.
- [x] 2.4 🤖 Endpoint `work-payment` (gateway, `/api/payments/work`): GET dice si aplica y da la public key del técnico; POST valida orden/presupuesto/monto en servidor, calcula `application_fee`, crea `/v1/payments` con el token del técnico, `capture:false`, `binary_mode:true`, idempotencia = id de la transacción. Columnas nuevas en `payment_transactions`: `split`, `split_technician_id`, `collector_mp_user_id`, `application_fee`, `authorized_at`, `captured_at`; estado nuevo `authorized`; índice único "un pago repartido vigente por presupuesto" (si se cuela una segunda reserva, se cancela en MP).
- [x] 2.5 🤖 Webhook: si el id es de un pago repartido lo consulta con el token del técnico (`api/_lib/splitPayment.ts`), verifica `external_reference` y aplica el estado. La lógica de "pago confirmado → orden" se movió sin cambios a `api/_lib/orderPaymentSync.ts` y la usan los dos circuitos.
- [x] 2.6 🤖 Tests: `work-payment.test.ts` (19) + `QuoteViewer.test.tsx` (2 nuevos).
- [x] 4.1 adelantado: `create_settlement_on_order_completed_and_paid()` ya excluye los montos y cargos de pagos repartidos (sin pagos repartidos, el resultado es idéntico al de antes).
- **Decisión de diseño:** una reserva `authorized` cuenta como pago confirmado para la orden (presupuesto aceptado, `paid_in_full`, el trabajo puede empezar), porque el dinero ya está garantizado. La captura llega en la Fase 3; si la reserva se cancela o vence antes, la Fase 3 tiene que revertir la orden.
- **Estado:** código listo y probado; **falta aplicar la migración en Supabase y desplegar** (con OK de Sandy). Sin encender el interruptor no cambia nada para los clientes.
- **Terminado cuando:** con el interruptor encendido en una orden de prueba, una reserva real de monto bajo queda `authorized` y se ve en la cuenta del técnico.

## 🔒 Fase 3 — Captura, cancelación y vencimiento
> **Reglas decididas por Sandy (6/11/2026):** solo se cobra o cancela el **total** (no hay cobro parcial en pantalla). Si el técnico trabajó, cobra, salvo un reclamo abierto ("reclamo duro"). Cancelar o cobrar a mano: solo admin, con motivo. El cron corre una vez por día, así que el aviso es al **día 4** y la acción automática al **día 5** (margen de 1-2 días antes del vencimiento de MP al día 7).
- [x] 3.1 🤖 Captura (`PUT {capture:true}` con token del técnico) cuando la orden pasa a `completed`. La app no deja cerrar sin la firma de conformidad, así que `completed` = firma + cierre. Trigger `split_payment_order_status` → `notify_admin_event('split_capture')` → `captureSplitForOrder`. Con un reclamo abierto (`support_cases` no resuelto) NO se cobra solo: aviso por Telegram. Idempotente.
- [x] 3.2 🤖 Cancelación cuando la orden pasa a `cancelled` (`split_cancel`). Si una reserva se cae después de confirmar la orden (cancelada, vencida, devuelta), la orden se revierte una sola vez: resta lo acreditado, queda `balance_pending` y se avisa a Sandy (con alerta especial si la orden ya estaba completada).
- [x] 3.3 🤖 Cron diario (paso aislado en `cron/cleanup-diagnosis-photos`): respaldo de cobro/cancelación si se perdió el aviso; día 4 aviso único por Telegram; día 5: con reclamo → aviso y decide Sandy; trabajo iniciado (`in_progress`/`paused`) → cobra; sin empezar (`assigned`) → cancela. No depende del interruptor.
- [x] 3.4 🤖 Panel de admin: tarjeta `SplitReservationCard` en la ficha de la orden (estado, comisión, vencimiento, "Cobrar ahora" / "Cancelar reserva" con motivo obligatorio, queda en `order_events`). Endpoint `split-admin` (solo admin).
- [x] 3.5 🤖 Tests: 14 de Fase 3 en `work-payment.test.ts` + 4 de `SplitReservationCard.test.tsx`.
- [x] 3.7 🤖 Lecciones del manual de Capitán YA (`C:\CapitanYA\capitan11.5.2026\docs\MANUAL_MERCADOPAGO_PARA_OTRA_IA.md`, 7/11/2026): (a) se guarda el detalle del error de MP (estado, mensaje, códigos de `cause`, sin tokens) en la transacción; (b) la clave de idempotencia de cobrar/cancelar cambia por día, para que un fallo de MP no se repita en todos los reintentos; (c) un técnico con una reserva abierta no puede desvincular su MP; (d) el servidor rechaza tarjetas de débito/prepagas aunque el formulario las deje pasar. Tests vistos en rojo con el código anterior y en verde después. Su trampa 4.4 (MP no informa la comisión mientras está reservado) ya estaba contemplada acá. No se adoptó la verificación de firma del aviso: acá cada aviso se reconsulta con el token del técnico y se compara `external_reference`.
- [ ] 3.6 Migración `20261106160000_split_capture_cancel.sql` (trigger + columnas `split_alerted_at`, `split_action_reason`, `cancelled_at`): **pendiente de aplicar** (el conector de Supabase perdió el permiso el 6/11). Aplicar antes de encender el interruptor.

## Fase 4 — Liquidaciones y contabilidad
- [x] 4.1 🤖 Ajustar `create_settlement_on_order_completed_and_paid()` para **no generar transferencia manual** por los pagos repartidos (riesgo 1). Hecho en la migración de la Fase 2. Falta el caso de prueba en `supabase/sql/` igual que el de visitas.
- [x] 4.2 🤖 Vista en el admin (Liquidaciones, debajo de lo de siempre): informe mensual `SplitEarningsReport` con totales (cobrado, comisión, cargo MP, neto técnicos), **subtotal por técnico = comisión a facturar**, detalle por trabajo y descarga CSV (";" y coma decimal, abre bien en Excel). Endpoint `split-report` (gateway): cuenta los `approved` del mes por fecha de cobro en hora argentina; los `refunded` se muestran pero no suman.
- [x] 4.3 🤖 Vista del técnico (Mis ganancias → Resumen): lo cobrado directo en su MP (informativo). Si no tiene cobros repartidos no ve nada. El servidor filtra siempre por su propio id.
- [x] 4.4 🤖 Tests: `split-report.test.ts` (4) + `SplitEarningsReport.test.tsx` (4).

## 🔒 Fase 5 — Legal y puesta en marcha
- [ ] 5.1 👤 Revisión del borrador de cláusula por un abogado; definir los [corchetes].
- [ ] 5.2 🤖 Publicar la cláusula en `TERMS_TECNICO_TEXT`, subir `TERMS_TECNICO_VERSION`, y construir la **re-aceptación** de términos para técnicos existentes (hoy no existe).
- [ ] 5.3 👤🤖 Prueba real completa con monto bajo (reserva → conformidad → captura → reparto) con el interruptor encendido solo para un técnico de confianza.
- [ ] 5.4 👤 Avisar a MP que se opera como marketplace (recomendado, no obligatorio).
- [ ] 5.5 👤 Encender el interruptor.

## Bitácora
| Fecha | Qué se hizo | Commit |
|---|---|---|
| 4/11/2026 | Plan escrito. Decisiones: visita como hoy, trabajo con reparto, 17% sin IVA, reserva hasta conformidad. Borrador de cláusula en `docs/`. Fase 0 pendiente de soporte MP. | (este commit) |
| 5/11/2026 | Fase 1 implementada por un asistente (Sonnet) en una copia aparte, revisada por Claude, migración aplicada a mano en Supabase, variables en Vercel, desplegada (`295e2ee`). Pendiente: vincular una cuenta real de MP para cerrar la fase. Fase 0 sigue esperando a soporte MP. | `295e2ee` |
| 6/11/2026 | **Fase 0 validada en sandbox** con el dato de soporte MP (`test_token=true`): reserva + captura total/parcial + cancelación con `application_fee` por `/v1/payments`. La comisión se descuenta al capturar; en captura parcial hay que reenviar el `application_fee`. Script `mp-split-poc.mjs` ampliado (`exchange --test`, `pay-reserve/show/capture/cancel`). | `be75735` |
| 6/11/2026 | **Fase 2 implementada** detrás del interruptor apagado: migración, endpoint `work-payment`, formulario de tarjeta, webhook, CSP (probada con el Brick real en sandbox) y 4.1 adelantado. Falta aplicar la migración y desplegar. | `899530c` |
| 6/11/2026 | **Fase 3 implementada:** cobro al completar, cancelación al cancelar, control diario (día 4 aviso, día 5 acción), reclamo abierto bloquea el cobro automático, panel de admin con motivo. Migración de Fase 2 aplicada; la de Fase 3 pendiente (conector sin permiso). | `ab1a278`, `020d638` (publicados 7/11) |
| 7/11/2026 | **Fase 4 implementada:** informe mensual de cobros repartidos para el admin (comisión a facturar por técnico, planilla CSV) y para el técnico (informativo). | (este commit) |
