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
- [ ] 0.1 👤 Respuesta de soporte de MP a: (a) ¿`application_fee` funciona con `capture:false` y captura posterior?; (b) ¿Split 1:1 admite tarjeta?; (c) ¿hay que declarar algo para operar como marketplace?
- [ ] 0.2 👤 Confirmar que la cuenta de Sandy tiene identificación **KYC nivel 6**.
- [ ] 0.3 👤🤖 Si soporte no responde: **prueba real con monto bajo** (ej. $200) con OK explícito de Sandy: segunda cuenta REAL de MP como técnico (familiar), tarjeta de otra persona, `/v1/payments` con `capture:false` + `application_fee`, captura total y verificación de `fee_details` y saldos. Se puede hacer con el script de la Fase 1 + un comando nuevo en `scripts/mp-split-poc.mjs` apuntando a la app real (`MP_POC_APP=real`).
- **Terminado cuando:** está confirmado (por soporte o por la prueba real) que la comisión se descuenta en un pago reservado y capturado. **Si no se confirma, NO se hacen las Fases 2-5**; se evalúa alternativa (cobro sin reserva, o Variante B).

## Fase 1 — Vincular la cuenta de Mercado Pago del técnico (se puede hacer YA, no mueve dinero)
- [ ] 1.1 🤖 Migración `technician_mp_accounts`: `technician_id` (único), `mp_user_id`, `public_key`, `scope`, `access_secret_id` y `refresh_secret_id` (uuid de Vault), `expires_at`, `linked_at`, `revoked_at`. RLS sin políticas; funciones SECURITY DEFINER solo para `service_role` para guardar/leer/borrar (copiar el patrón de `20261004003541_ai_providers.sql`). Una vista o función que el técnico pueda leer solo con `linked`, `mp_user_id` y `expires_at` (nunca tokens).
- [ ] 1.2 🤖 Tabla `mp_oauth_states` (state aleatorio, `technician_id`, `created_at`, usado/no) para que el `state` del OAuth quede atado al técnico logueado y venza a los 10 minutos.
- [ ] 1.3 🤖 Endpoint `mp-oauth-start` (gateway, POST con sesión de técnico): crea el `state` y devuelve la URL `https://auth.mercadopago.com/authorization?client_id=…&response_type=code&platform_id=mp&state=…&redirect_uri=https%3A%2F%2Ftecniurbano.online%2Foauth-callback`.
- [ ] 1.4 🤖 Callback: rewrite en `vercel.json` `/oauth-callback` → `/api/gateway?action=mp-oauth-callback` (GET). Valida `state`, canjea el `code` en `/oauth/token` con `MP_APP_CLIENT_ID`/`MP_APP_CLIENT_SECRET` (cargarlas en Vercel), `test_token:'false'`, guarda tokens en Vault y redirige a `/#/technician/profile?mp=ok` (o `?mp=error`). Nunca mostrar ni loguear tokens.
- [ ] 1.5 🤖 Renovación: el cron diario existente (`/api/cron/cleanup-diagnosis-photos` o uno nuevo si entra en el límite de Hobby) renueva con `grant_type: refresh_token` los tokens que vencen en menos de 30 días. Si falla, avisar por la campanita al técnico y por Telegram a Sandy.
- [ ] 1.6 🤖 UI en el perfil del técnico (`ProfessionalProfile.tsx`): estado (vinculada / no vinculada / vence pronto), botón **"Vincular mi Mercado Pago"** con la casilla de autorización (texto en `docs/borrador-clausula-cobros-tecnicos.md`), y "Desvincular". La aceptación de la casilla se registra en `legal_acceptances` con un slug nuevo (`autorizacion_cobro_mp`) → requiere ampliar el CHECK de `document_slug` en una migración.
- [ ] 1.7 🤖 Admin: en la ficha del técnico, ver si tiene MP vinculado.
- [ ] 1.8 🤖 Tests (handler, states, refresh, UI) con mocks; nunca credenciales reales en tests.
- **Terminado cuando:** un técnico de prueba vincula su cuenta en producción, el estado aparece en su perfil y en el admin, y la renovación funciona (forzando un vencimiento cercano en un test).

## 🔒 Fase 2 — Cobrar el trabajo con reserva y comisión (requiere Fase 0)
- [ ] 2.1 🤖 Interruptor `system_settings.split_payments_enabled` (default `false`). Con `false` todo sigue como hoy (Checkout Pro a la cuenta de Sandy). Solo se usa el flujo nuevo si el interruptor está en `true` **y** el técnico asignado tiene MP vinculado.
- [ ] 2.2 🤖 CSP en `vercel.json` para el SDK de MP (ver riesgo 2). Probar en preview antes de producción.
- [ ] 2.3 🤖 Formulario de tarjeta (Card Payment Brick o Secure Fields) en `QuoteViewer.tsx` / pago del trabajo. Los datos de tarjeta nunca pasan por nuestro servidor: solo el token.
- [ ] 2.4 🤖 Endpoint `work-payment-reserve` (gateway, sesión de cliente): valida orden/presupuesto/monto en servidor, calcula `application_fee = round(monto × platform_commission_rate, 2)`, crea `/v1/payments` con el token del técnico, `capture:false`, `X-Idempotency-Key`, `external_reference` = id de `payment_transactions`, `notification_url`. Guarda `status='authorized'`, `mp_payment_id`, `collector_id`, `application_fee`, `split=true`.
- [ ] 2.5 🤖 Webhook: reconocer pagos repartidos (riesgo 3) y actualizar estados `authorized → approved/cancelled/refunded`.
- [ ] 2.6 🤖 Tests.
- **Terminado cuando:** con el interruptor encendido en una orden de prueba, una reserva real de monto bajo queda `authorized` y se ve en la cuenta del técnico.

## 🔒 Fase 3 — Captura, cancelación y vencimiento
- [ ] 3.1 🤖 Captura (`PUT /v1/payments/{id}` `{capture:true}` con token del técnico) disparada cuando se cumplen **las dos**: firma de conformidad del cliente y cierre del técnico. Idempotente.
- [ ] 3.2 🤖 Cancelación si la orden se cancela antes de capturar.
- [ ] 3.3 🤖 Cron diario: reservas con más de [6] días → aplicar la política que decida Sandy (cláusula X.6: capturar o cancelar) y avisar a Sandy por Telegram.
- [ ] 3.4 🤖 Tests.

## Fase 4 — Liquidaciones y contabilidad
- [ ] 4.1 🤖 Ajustar `create_settlement_on_order_completed_and_paid()` para **no generar transferencia manual** por los pagos repartidos (riesgo 1). Caso de prueba en `supabase/sql/` igual que el de visitas.
- [ ] 4.2 🤖 Vista en el admin: comisiones cobradas por reparto (para la facturación de Sandy al técnico).
- [ ] 4.3 🤖 Vista del técnico: lo cobrado por reparto (informativo; el dinero ya está en su MP).

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
