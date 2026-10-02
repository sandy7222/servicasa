# Plan — Avisos por Telegram y chat de consultas web

**Creado:** 2 de octubre de 2026 (sesión con Claude Code).
**Objetivo:** (1) que el administrador reciba un aviso en el celular, sin abrir la app, cuando se paga una visita de presupuesto y hay que asignar técnico ya; (2) un chat de consultas generales en la web oficial, con respuesta desde Telegram o desde la consola de admin, y más adelante un contestador de IA.

> **Cómo retomar este plan en otra sesión:** leer la sección "Bitácora" (al final), mirar qué casillas están tildadas y correr `git log --oneline -15`. Cada fase termina con una "Definición de terminado" verificable: no se pasa a la siguiente sin cumplirla.

**Leyenda:** ✅ hecho · 🔄 en curso · ⏳ pendiente · 👤 lo hace Sandy · 🤖 lo hace Claude.

---

## Decisiones ya tomadas (no re-discutir)

| Tema | Decisión |
|---|---|
| Canal de aviso | **Telegram** (bot propio). Gratis, push al celular, sin aprobaciones. WhatsApp oficial se descartó: los mensajes que inicia el negocio se cobran. |
| Cuándo avisa | **Solo** cuando se confirma el pago de una **visita de presupuesto** (`work_mode = 'diagnosis'`). Nunca por pedidos armados y no pagados. |
| Dónde avisa | Telegram al celular **y** campanita del panel de admin. |
| Qué dice el aviso | Mínimo: título, rubro, localidad, fecha/franja, prioridad y botón "Abrir panel". **Sin teléfono ni dirección exacta** (Telegram no cifra de punta a punta). |
| **Orden del chat (decidido el 2/10)** | **Variante B: "IA primero".** Después de la Fase 1 se construye el widget con IA (Fase B), sin relevo humano ni tablas de chat. La variante A (relevo humano por Telegram/consola, Fases 3 a 5) queda **pospuesta**: se retoma solo si hace falta. |
| Chat web (variante A, pospuesta) | Interfaz propia (el visitante nunca ve Telegram). Base de datos = fuente de verdad; Telegram es solo canal móvil. Tablas nuevas, **sin tocar** `conversations`/`messages` ni sus RLS. |
| Respuesta al visitante (variante A) | Polling cada pocos segundos (más simple y seguro que dar acceso Realtime a usuarios anónimos). |
| Alternativa WhatsApp | Botón "Escribinos por WhatsApp" con link `wa.me` (gratis, sin API), atendido desde WhatsApp Business. |
| IA | Claude, **identificada como "Asistente virtual de TecniUrbano"** (nunca hacerse pasar por persona). Sin herramientas ni acceso a datos privados. Tope de gasto diario en código. |
| Límite de Vercel Hobby | 12 funciones máx. **Todo endpoint nuevo va por `api/gateway.ts`** (handler en `api/_lib/handlers/` + registro + rewrite en `vercel.json`). Hoy hay 8. Ver `memory/project_vercel_hobby_function_limit.md`. |
| Secretos | Tokens **solo** en variables de entorno de Vercel y `.env.local`. Nunca en el repo ni pegados en el chat. |

---

## Fase 0 — Cerrar el deploy (prerrequisito de todo)

**Meta:** producción desplegando de nuevo y con una sola rama de verdad.

- [x] 0.1 🤖 Consolidar endpoints chicos en `api/gateway.ts` (14 → 8 funciones). Commit `63e2526`. Verificado con un deploy Preview en **Ready** y los endpoints respondiendo por sus URLs de siempre.
- [x] 0.2 👤 OK para pushear (dado por Sandy el 2/10).
- [x] 0.3 🤖 Pusheado a `main` **y** a `master` el 2/10 (ambas en `fc11209`, avance limpio, sin `force`) (Vercel despliega desde `master`; el CI de GitHub corre solo en `main`). Esto lleva a producción lo del 23/9 (asistente multi-rubro, leads B2B, ranking, T&C de invitado), que nunca se vio online.
- [x] 0.4 🤖 Producción **Ready** el 2/10 (deploy de `fc11209`, el primero desde el 19/9) y `tecniurbano.online` apunta a él. Probados en el dominio real: `/api/health` 200, `guest-status` 404 con su mensaje, `pending-draft` 401, `gateway?action=nope` 404, `leads/business` con body vacío 400, cron sin secreto 401, `assetlinks.json` 200. La landing carga con los elementos nuevos del 23/9 (Política de Privacidad, T&C, "Solicitar propuesta" B2B).
- [ ] 0.5 👤 Vercel → Settings → Git → **Production Branch = `main`**. Recién después, 🤖 borrar `master` del remoto.
- [x] 0.6 `CRON_SECRET` cargado en Vercel el 2/10 (generado al azar, Production y Preview). Verificado en el dominio real: el cron sin secreto da 401, con el secreto da 200 `{"deleted":0}` (hoy no hay fotos). El borrado de fotos a los 30 días queda funcionando.

**Definición de terminado:** `vercel ls` muestra producción Ready con el último commit; `main` y `master` apuntan al mismo commit; `CRON_SECRET` cargado.

---

## Fase 0B — Higiene previa (recomendada antes de la Fase 3)

**Meta:** que el código nuevo aterrice con el CI en verde.

- [ ] 0B.1 🤖 Arreglar los 7 errores de `tsc` (`materialExpenses` faltante en `mockData.ts` ×5, `AppContext.tsx`, `QuoteViewer.test.tsx`).
- [ ] 0B.2 🤖 Arreglar los 2 tests rotos de `src/views/CustomerView.test.tsx` ("diagnóstico con presupuesto enviado…").
- [ ] 0B.3 🤖 Ver por qué falla el job `supabase-migrations-reproducible` del CI (las migraciones no se reproducen desde cero).
- [ ] 0B.4 🤖 Hacer que el CI corra también en `master` (o dejar de usar `master` tras 0.5).

**Definición de terminado:** `npm run lint` y `npx vitest run` en verde; el último push muestra CI verde en GitHub.

---

## Fase 1 — Aviso de visita pagada (Telegram + campanita)  ← **objetivo de hoy**

**Meta:** al confirmarse el pago de una visita, llega un mensaje al celular de Sandy y una notificación a la campanita del admin, en menos de ~10 segundos.

**Puntos de enchufe en `api/payments/webhook.ts`** (líneas del commit `63e2526`, pueden correrse):
- `createOrderFromApprovedGuestDraft` (~l.168): después de `linkDiagnosisPhotoToOrder` (~l.267).
- `createOrderFromApprovedCustomerDraft` (~l.300): después de `linkDiagnosisPhotoToOrder` (~l.362).
- `syncOrderAfterApprovedPayment` (~l.396), rama `visit_deposit` (~l.416), solo dentro del `if (claimed)` — cubre una orden que ya existía y recibe la seña.

Pasos:
- [x] 1.1 👤 Bot creado (**@TecniUrbanoYaBot**) el 2/10. Crear el bot: en Telegram buscar **@BotFather** → `/newbot` → nombre y usuario → copiar el **token**. Abrir el chat con el bot nuevo y mandarle cualquier mensaje (el bot no puede escribirte antes).
- [x] 1.2 🤖 `scripts/telegram-setup.mjs`: lee `TELEGRAM_BOT_TOKEN` de `.env.local` (sin imprimirlo), muestra el **chat id** (vía `getUpdates`) y con `--test` manda un mensaje de prueba. Así nadie pega URLs con el token.
  - ⚠️ `getUpdates` falla (409) si hay un webhook activo. Descubrir el chat id **antes** de la Fase 3.
- [x] 1.3 Variables `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` cargadas el 2/10 en `.env.local` y en Vercel (Production + Preview, como secretas). Deploy de `ed22bde` hecho después, así que ya las toma.
- [x] 1.4 🤖 `api/_lib/telegram.ts`: `sendTelegramMessage(text, { buttonUrl })` con `fetch`, timeout de 5 s, **no hace nada si faltan las variables y nunca lanza** (el webhook de Mercado Pago jamás debe romperse por un aviso).
- [x] 1.5 🤖 `api/_lib/visitPaidAlert.ts`: arma el texto mínimo + botón "Abrir panel" (`https://tecniurbano.online/#/hub`) y crea la notificación para cada admin (service role), con `dedupe_key = visit_paid:{orderId}:{adminId}`.
- [x] 1.6 🤖 Migración SQL aditiva (**aplicada a producción el 2/10**, versión `20261002211003`; `NotificationBell` no necesitó cambios: muestra título/cuerpo genéricos y el link de una notificación de orden ya abre `#/hub?order=<id>`): agregar `'visit_paid'` al `CHECK` de `notifications.type` (hoy es una lista cerrada). Actualizar `NotificationType` en `src/types/index.ts` y ver cómo `NotificationBell.tsx` muestra cada tipo. (Detalle: la base ya acepta `cron_failure` y `technician_en_route`, que no están en el tipo de TypeScript.)
- [x] 1.7 🤖 Enchufar `notifyAdminsVisitPaid(...)` en los tres puntos de arriba, **envuelto en try/catch** y después de que la orden ya existe.
- [x] 1.8 🤖 Tests (23 nuevos, todos verdes): formato del mensaje; no-op sin variables; no lanza ante error de red; en `webhook.test.ts`, que la alerta salga **una sola vez** aunque la notificación de Mercado Pago llegue dos veces, y que **no** salga para `full_advance`/pago directo ni para pagos rechazados.
- [x] 1.9 🤖 `vercel build` OK (8 funciones, sin nuevas) y `node scripts/telegram-setup.mjs --test` probado: el mensaje de prueba con botón le llegó a Sandy al celular.
- [ ] 1.10 👤🤖 Prueba real en producción: pedir una visita con la cuenta cliente demo y pagar con tarjeta de prueba de Mercado Pago → debe llegar el Telegram **y** la campanita. (Verificar antes si el webhook se dispara con el checkout de prueba; el 23/8 se probó en vivo con tarjeta y wallet.)

**Definición de terminado:** una visita pagada de verdad (o de prueba) dispara exactamente un Telegram y una notificación por admin; un pago directo o rechazado no dispara nada; con las variables borradas el webhook sigue funcionando igual.
**Rollback:** borrar `TELEGRAM_BOT_TOKEN` (queda en no-op). La migración es aditiva, no hace falta revertirla.
**No suma funciones a Vercel** (va dentro del webhook).

---

## Fase 2 — Recordatorio "sigue sin técnico" (opcional, después de la 1)

**Meta:** si pasan ~20 minutos desde el pago y la orden sigue sin técnico, un segundo aviso.

**Restricción:** los crons de Vercel Hobby corren como máximo una vez por día, no sirven. Opciones:
- **A (recomendada):** cron de Supabase (`pg_cron`, ya instalado) cada 5–15 min + `pg_net` para llamar a un endpoint nuestro. **`pg_net` hoy NO está instalado**: habría que habilitarlo en una migración, y guardar el secreto en Supabase Vault (ya instalado) en vez de en el SQL.
- **B:** un cron externo gratuito (tipo cron-job.org) llamando a un endpoint protegido por secreto. Menos piezas, pero suma un tercero.

Pasos:
- [ ] 2.1 🤖 Decidir A o B con Sandy.
- [ ] 2.2 🤖 Migración: columna `visit_alert_escalated_at` en `service_orders` (para no repetir el recordatorio).
- [ ] 2.3 🤖 Handler en el gateway que busca órdenes `diagnosis` con `payment_status = 'deposit_paid'`, `assigned_technician_id is null`, pagadas hace más de N minutos y sin escalar; manda el Telegram y marca la columna.
- [ ] 2.4 🤖 Programar la llamada periódica según la opción elegida.
- [ ] 2.5 🤖 Tests y prueba real (dejar una orden sin asignar y esperar).

**Definición de terminado:** una orden de prueba sin técnico genera exactamente un recordatorio; al asignarle técnico, no genera ninguno.

---

## Fase B — IA primero: widget de consultas con contestador de IA  ← **elegida el 2/10, va después de la Fase 1**

> **⚠️ Actualización del 2/10 (tarde): Sandy pidió que la IA sea GRATIS** (Claude le pareció caro). Lo de Claude/Anthropic de abajo (B.1, B.2, precios) queda como **alternativa de pago**, no como camino elegido. Se evalúan proveedores gratuitos, **sin decisión final todavía**:
> - **Groq** con `qwen/qwen3.8-27b` (preview): 30 consultas/min, 1.000/día, 8.000 tokens/min y **200.000 tokens/día** (≈ 70–130 consultas/día). No entrena con los datos por contrato. Riesgo: es "preview".
> - **Cloudflare Workers AI** con `Qwen3-30B-A3B`: 10.000 neuronas/día (≈ 500 consultas/día, estimado; falta confirmar que entre en el plan gratis). Cloudflare ya retiró modelos (mayo) y pasó otros al plan pago (28/7): hay que esperar cambios.
> - **Gemini Flash**: ≈ 1.000–1.500/día, pero en el plan gratis los mensajes pueden usarse para mejorar productos de Google.
> - Qwen 3.8 / DeepSeek V4 por las APIs oficiales **no son gratis permanentes** (créditos únicos: 1M tokens/90 días y 5M/30 días) y los datos viajarían a servidores de esas empresas.
> - Ninguna IA gratuita es "instalar y olvidar". **Diseño propuesto para minimizar mantenimiento:** (1) la IA es un extra: el chat arranca con botones de preguntas frecuentes y la IA solo responde texto libre; (2) cadena de proveedores configurable por variables de entorno (Groq → Cloudflare → botón de WhatsApp); (3) chequeo diario que avisa por Telegram si la IA falla. Integración con el asistente actual: **mismo botón y mismo panel, motores separados** (ver B.8).
> - Pendiente de Sandy: confirmar el diseño, crear cuenta gratuita en Groq (y luego Cloudflare) y pasar el número de WhatsApp.

**Meta:** un widget en la web oficial donde una IA contesta preguntas de interés general sobre TecniUrbano y el hogar, sin relevo humano. Si el visitante pide una persona, se le ofrece WhatsApp o dejar un contacto, y a Sandy le llega un aviso por Telegram.

**Diferencia con la variante A:** no hay tablas de chat ni consola ni webhook de Telegram entrante. El historial viaja desde el navegador en cada pedido (el servidor no lo guarda). Solo se necesita una tabla chica de contadores para el límite de uso.

- [ ] B.1 👤 Crear cuenta en la consola de Anthropic, cargar crédito prepago (la API se paga **aparte** de cualquier suscripción de Claude), fijar un tope de gasto y cargar `ANTHROPIC_API_KEY` en Vercel.
- [ ] B.2 👤🤖 Elegir modelo (precios de lista del 25/9: **Claude Haiku 4.5** `claude-haiku-4-5` US$1/US$5 por millón de tokens ≈ US$3–4 cada 1.000 mensajes, estimación; **Claude Sonnet 5.5** `claude-sonnet-5-5` US$2/US$10 ≈ US$7). Decide Sandy: el costo es suyo.
- [ ] B.3 👤 Escribir/revisar la base de conocimiento (qué servicios hay, zonas, garantía de 30 días, reclamo en 48 hs, cómo se pide la visita, preguntas típicas de electricidad y hogar). Como Sandy se recibe de electricista en ~2 meses, él es quien mejor puede corregirla. 🤖 Armar el borrador a partir del catálogo y los docs.
- [ ] B.4 🤖 Migración: tabla de contadores (`ai_chat_usage`: hash de IP/token, día, cantidad) con RLS cerrada (solo servidor).
- [ ] B.5 🤖 Handler `ai-chat` **dentro del gateway** (+ rewrite): valida Turnstile, aplica el límite por visitante/IP y el tope diario global, llama a Claude **sin herramientas**, `max_tokens` bajo y largo máximo de entrada, con *prompt caching* de la base de conocimiento.
- [ ] B.6 🤖 Reglas fijas que **no** pasan por la IA: palabras de seguridad ("olor a quemado", "chispas", "descarga") → texto fijo de corte de energía + Telegram prioritario; pedido de hablar con una persona → botón de WhatsApp (`wa.me`) y campo de contacto, con aviso por Telegram.
- [ ] B.7 🤖 Alcance: responde sobre TecniUrbano y el hogar; lo ajeno al negocio se redirige con amabilidad. En temas eléctricos aclara siempre que **no reemplaza a un técnico**. Etiqueta visible "Asistente virtual de TecniUrbano".
- [ ] B.8 🤖 Widget en la landing: **un solo lanzador** con dos opciones, "Armar mi pedido" (el asistente de diagnóstico actual, intacto) y "Hacer una consulta" (el nuevo). Cloudflare Turnstile (gratis).
- [ ] B.9 👤 Pasar el número de WhatsApp para el botón. 🤖 Agregarlo.
- [ ] B.10 🤖 Una línea en la Política de Privacidad: los mensajes se procesan a través del proveedor de IA (y de Telegram para los avisos).
- [ ] B.11 🤖 Evals antes de activar: 20–30 preguntas típicas y varios intentos de *prompt injection* (hay una skill para armarlos; cada corrida cuesta dinero real, hay que aprobarla).
- [ ] B.12 🤖 Test e2e de Playwright y prueba real en producción.

**Definición de terminado:** la IA responde bien las preguntas frecuentes, deriva lo que no sabe, no promete precios ni plazos, resiste los intentos de inyección del set de evals, y el límite de uso corta a un visitante abusivo sin afectar a los demás.
**Rollback:** sacar el lanzador del widget y borrar `ANTHROPIC_API_KEY`; la tabla de contadores es aditiva.
**No suma funciones a Vercel** (va por el gateway).

---

## Fase C (futura, después de la B) — Centro de ayuda: estado de visitas, reclamos y garantía

**Idea de Sandy (2/10):** usar la IA como centro de ayuda ubicado en una página enlazada desde el **pie** de la web y de la app, que ubique el estado de las visitas, tome reclamos y gestione problemas de garantía. Telegram queda solo para emergencias (visita pagada sin técnico).

**Principio de diseño: la IA orienta; el sistema decide y ejecuta.** La IA nunca escribe en la base por su cuenta ni decide reembolsos o compensaciones.

- [ ] C.1 Página **Centro de ayuda** (`#/ayuda`), enlazada desde el pie de la landing y de la app: preguntas frecuentes + consultas con la IA de la Fase B + accesos directos a "Mis visitas" y "Abrir reclamo". Sin datos privados (funciona sin iniciar sesión).
- [ ] C.2 **Estado de visitas para clientes con sesión**: el servidor lee SUS órdenes con la sesión del usuario (nunca por un id que mande la IA); herramientas de solo lectura. Ojo: la app ya muestra el estado de las órdenes; la IA solo lo resume, así que se puede dejar sin IA si el cupo gratis no alcanza (cada herramienta suma tokens).
- [ ] C.3 **Reclamos y garantía**: la IA orienta y prepara un borrador; el reclamo lo crea el cliente con el flujo existente (`NewClaimModal`, ya en `MyClaimsPanel`) **después de confirmar**. Si corresponde (30 días de garantía / 48 hs para reclamar) lo calcula el código con `completed_at`, no la IA.
- [ ] C.4 **Invitados** (sin cuenta): estado solo con el link de seguimiento (`#/pedido/<token>`); nunca por nombre o teléfono.
- [ ] C.5 **Avisos**: un reclamo abierto ya genera notificación al admin (`claim_opened`); decidir con Sandy si también va por Telegram (el plazo de 48 hs es sensible).
- [ ] C.7 ⚠️ **Vocabulario: "seña" → "Visita de Presupuesto"** (hallado el 2/10). **Término exacto definido por Sandy: "Visita de Presupuesto"** (con esas mayúsculas; nunca "seña", "anticipo", "depósito" ni "adelanto"). Política confirmada: la Visita de Presupuesto no es una seña, es un cobro por adelantado para que un técnico pueda visitar; el trabajo (reparación, instalación) es un cobro distinto y aparte.
  - **Textos propuestos (sin aplicar todavía):** cobro en Mercado Pago `Visita de Presupuesto — {título}`; botón del invitado "Pedir Visita de Presupuesto y pagar" (hoy: "Pedir diagnóstico y pagar seña"; el del cliente logueado dice "Solicitar diagnóstico": unificar); etiqueta "Visita de Presupuesto pendiente" (hoy "Seña pendiente"); tarjeta del formulario: hoy dice "Visita de presupuesto: $X" (con "p" minúscula) → "Visita de Presupuesto: $X".
  - **Dos textos que NO se tocan sin decisión de Sandy:** el diálogo de rechazo del presupuesto (hay que definir qué pasa con la visita) y los T&C (legal + versión).
  - Hoy la app todavía dice "seña" en estos lugares:
  - **Lo que lee el cliente:** título del cobro en Mercado Pago `Seña de visita — …` (`api/orders/guest-checkout.ts:217`, `api/orders/request-service.ts:182`, `api/payments/create.ts:50`, `api/_lib/handlers/retry-draft.ts:60`); botón del invitado "Pedir diagnóstico y pagar seña" (`GuestServiceRequestForm.tsx:277`); aviso al rechazar un presupuesto "La seña se gestionará según las condiciones…" (`QuoteViewer.tsx:19`); etiqueta "Seña pendiente" (`Badge.tsx:199`).
  - **Texto legal:** `src/lib/legalTerms.ts:42` (T&C del cliente, cancelaciones/reembolsos: "si ya se abonó una seña de visita de diagnóstico"). Los términos están **versionados por fecha** (`TERMS_CLIENTE_VERSION = '2026-09-12'`) y cada aceptación se guarda con su versión: si se cambia el texto hay que subir la versión y la fecha de "Última actualización"; conviene que lo revise un abogado, y verificar si la app obliga a aceptar de nuevo.
  - **Interno (admin/técnico):** toasts y etiquetas en `AppContext.tsx`, `AdminHubView.tsx`, `TechnicianView.tsx`, `VisitFeeSettings.tsx`, `SystemSettingsPanel.tsx`, `QuoteBuilder.tsx`. Los nombres técnicos (`visit_deposit`, `deposit_paid`, `visit_deposit_amount`) **no se renombran**: son internos y cambiarlos en la base es riesgoso sin ningún beneficio para el cliente.
  - Antes de tocar el título de Mercado Pago o el diálogo de rechazo hay que definir con Sandy qué pasa con la visita cuando el cliente rechaza el presupuesto (pregunta 5 del documento de base de conocimiento).
- [ ] C.6 ⚠️ **Texto vs. realidad del seguimiento** (hallado el 2/10): en el código **no hay ubicación GPS en vivo del técnico** (no se usa `navigator.geolocation` ni existe una tabla de ubicaciones; las únicas coordenadas son estáticas: zona de trabajo del técnico y domicilio del cliente). Lo que sí hay es seguimiento **por estados** en tiempo real: `travel_started_at` (salió), `arrived_at` (llegó), `work_started_at`, `order_events`, con Supabase Realtime y el aviso `technician_en_route` al cliente. Pero la landing dice "Ves el estado del servicio y la ubicación del técnico" y "Seguí al técnico en tiempo real". Decidir con Sandy: (a) ajustar el texto de la landing a lo que existe, o (b) construir ubicación en vivo (proyecto grande, con consentimiento del técnico y datos sensibles). La IA y las FAQ **no deben prometer ubicación**: solo "te avisamos cuando sale, llega y termina".

**Reglas:** datos personales solo con sesión o token; no inventar plazos ni promesas; siempre ofrecer hablar con una persona (WhatsApp); la IA identificada como asistente virtual.

---

## Variante A (pospuesta) — chat con relevo humano

Las Fases 3, 4 y 5 de abajo describen el chat completo con tablas, consola de admin, relevo por Telegram y, al final, la IA. **No se construyen ahora** (decisión del 2/10). Si se retoman, la IA de la Fase B se reutiliza tal cual.

## Fase 3 (variante A) — Chat de visitantes: base de datos, backend y consola de admin

**Meta:** el motor del chat funcionando de punta a punta **sin** widget público todavía (se prueba desde Telegram y la consola).

- [ ] 3.1 🤖 Migración: `visitor_chats` (id, hash del token de sesión, contacto opcional, estado, `human_mode`, `last_message_at`, `created_at`) y `visitor_messages` (chat_id, sender: `visitor|admin|ai|system`, body, `telegram_message_id`, `created_at`). RLS: solo admin; el visitante accede únicamente a través del servidor validando su token.
- [ ] 3.2 🤖 Handlers nuevos **dentro del gateway** (cero funciones nuevas), con sus rewrites:
  - `chat-send` — el visitante manda un mensaje: se guarda y se avisa por Telegram.
  - `chat-poll` — el visitante pide mensajes nuevos, con su token.
  - `telegram-webhook` — Telegram entrega tu respuesta (usando "Responder" sobre el mensaje, campo `reply_to_message`); se valida el header `X-Telegram-Bot-Api-Secret-Token`.
- [ ] 3.3 🤖 Script para registrar el webhook (`setWebhook` con `secret_token`).
- [ ] 3.4 🤖 Consola de admin: pestaña "Chats web" reutilizando el diseño de `ConversationThread`; contador de no leídos; responder desde la pantalla.
- [ ] 3.5 🤖 Tests (envío, polling, validación del secreto, una respuesta de admin llega al visitante).

**Definición de terminado:** simulando a un visitante por la API, el mensaje llega a Telegram y a la consola; respondiendo desde cualquiera de los dos, el visitante lo recibe por polling.

---

## Fase 4 — Widget público + WhatsApp + antispam

- [ ] 4.1 🤖 Resolver la ubicación: ya existe el botón flotante del asistente de diagnóstico (abajo a la derecha). Propuesta: **un solo lanzador** con dos opciones, "Armar mi pedido" (asistente actual, intacto) y "Hacer una consulta" (chat nuevo).
- [ ] 4.2 🤖 Componente del chat: token de sesión en el navegador para retomar la charla, campo opcional "dejanos tu teléfono o mail por si te respondemos más tarde" (única forma de alcanzarlo si cierra la pestaña).
- [ ] 4.3 🤖 Antispam: límite de mensajes por visitante/IP y **Cloudflare Turnstile** (gratis).
- [ ] 4.4 👤 Pasar el número de WhatsApp para el botón "Escribinos por WhatsApp" (`wa.me`). 🤖 Agregarlo.
- [ ] 4.5 🤖 Una línea en la Política de Privacidad: los mensajes se procesan a través de Telegram (y, en la Fase 5, del proveedor de IA).
- [ ] 4.6 🤖 Un test e2e de Playwright (la infraestructura ya existe en `e2e/`).

**Definición de terminado:** un visitante real escribe desde la web, vos respondés desde Telegram y él lo ve sin recargar; el spam básico queda frenado.

---

## Fase 5 — Contestador de IA

- [ ] 5.1 👤 Crear cuenta y cargar crédito prepago en Anthropic, fijar un tope de gasto, y cargar `ANTHROPIC_API_KEY` en Vercel.
- [ ] 5.2 👤🤖 Elegir modelo. Referencia de precios de lista (cache del 25/9): **Claude Haiku 4.5** (`claude-haiku-4-5`) US$1 / US$5 por millón de tokens (entrada/salida), ≈ US$3–4 cada 1.000 mensajes (estimación); **Claude Sonnet 5.5** (`claude-sonnet-5-5`) US$2 / US$10, ≈ US$7 cada 1.000. Decide Sandy: el costo es suyo.
- [ ] 5.3 🤖 Base de conocimiento en el prompt de sistema (zonas, garantía de 30 días, reclamo en 48 hs, cómo se pide una visita, catálogo público), con *prompt caching*.
- [ ] 5.4 🤖 Handler en el gateway: responde solo si el chat **no** está en `human_mode`; sin herramientas; `max_tokens` bajo; tope diario de mensajes.
- [ ] 5.5 🤖 Reglas fijas que **no** pasan por la IA: palabras de seguridad ("olor a quemado", "chispas", "descarga") → texto fijo de corte de energía + Telegram prioritario; "hablar con una persona" → pase a humano.
- [ ] 5.6 🤖 Cuando Sandy responde en una conversación, se activa `human_mode` y la IA deja de contestar ahí.
- [ ] 5.7 🤖 Etiqueta visible "Asistente virtual de TecniUrbano".
- [ ] 5.8 🤖 Evals antes de activar: 20–30 preguntas típicas y varios intentos de *prompt injection* (hay una skill para armarlos; cada corrida cuesta dinero real, hay que aprobarla).

**Definición de terminado:** la IA responde bien las preguntas frecuentes, deriva lo que no sabe, no promete precios ni plazos, y no cae en los intentos de inyección del set de evals.

---

## Riesgos y cosas a no olvidar

- **Un aviso nunca puede romper el webhook de pago.** Siempre try/catch y timeout corto.
- **Telegram no cifra de punta a punta** y la IA sumaría otro proveedor: avisar a los visitantes que no manden datos sensibles (CBU, claves).
- **Contar funciones** antes de crear cualquier archivo bajo `api/` (`vercel build` y contar `.func`).
- **Convenciones del proyecto:** dos commits por cambio (principal + `docs(changelog)` con el hash), entradas del CHANGELOG solo al final, `tsc` + tests + build antes de cada commit, preguntar antes de cada `git push`, respuestas en español. El CHANGELOG está sin entradas desde el 3/9: ponerlo al día.

## Backlog del diagnóstico del 2/10 (fuera de este plan, pendiente)

**CSP bloquea el script inline del tema oscuro** (hallado el 2/10 en la consola de producción: "Executing inline script violates … script-src 'self'"). El script de `index.html` que aplica la clase `dark` antes de pintar no corre, así que puede haber un parpadeo de tema claro al cargar. No es una regresión de hoy (ya estaba en el deploy del 19/9). Arreglo chico: moverlo a un archivo externo en `public/` (`script-src 'self'` lo permite) o agregar su hash al CSP de `vercel.json`. Monitoreo mínimo (alerta de deploy fallido, Sentry gratis + `ErrorBoundary`, chequeo externo a `/api/health`); revocar `EXECUTE` a usuarios sin sesión en funciones `SECURITY DEFINER` que no lo necesitan (ej. `offer_to_next_eligible_technician`); activar la protección de contraseñas filtradas; `npm audit fix`; backups automáticos (el último dump manual es del 2/9); `robots.txt`, `sitemap.xml` y metadatos; partir el bundle de 2,1 MB; smoke test real en producción y piloto con usuarios reales.

---

## Bitácora

| Fecha | Qué se hizo | Commit |
|---|---|---|
| 2/10/2026 | Diagnóstico de madurez. Fase 0.1 hecha: consolidación en `api/gateway.ts`, 14 → 8 funciones, Preview Ready. Creado este plan. | `63e2526` |
| 2/10/2026 | Sandy elige la **variante B** (IA primero) y da el OK para pushear a `main` y `master`. Se agrega la Fase B y la variante A queda pospuesta. | `fc11209` |
| 2/10/2026 | Fase 1, parte de código lista (1.2, 1.4 a 1.8): módulo de Telegram, aviso, migración aplicada, enchufe en el webhook en 3 puntos, 23 tests. Sin variables de Telegram el aviso es no-op. Faltan 1.1 y 1.3 (bot y variables, de Sandy), 1.9 (prueba) y 1.10 (prueba real). | `4aaf180` |
| 2/10/2026 | Bot creado, variables cargadas en `.env.local` y Vercel (incluida `CRON_SECRET`), push de `ed22bde` a `main` y `master`, producción Ready. Mensaje de prueba recibido en el celular. Cron verificado (401 sin secreto, 200 con secreto). Falta solo 1.10 (prueba real de una visita pagada). | `ed22bde` |
| 2/10/2026 | Fase 0.3 y 0.4 hechas: push a `main` y `master`, producción Ready y verificada en el dominio real. Quedan 0.5 y 0.6 (acciones de Sandy en Vercel). | (sin commit todavía) |
