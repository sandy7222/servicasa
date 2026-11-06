# Guía portable: cobro repartido con reserva en Mercado Pago (Split 1:1 + `capture:false` + `application_fee`)

> **Para quién:** cualquier proyecto de Sandy (TecniUrbano, CapitanYA/GuiaYA, …) que necesite cobrar a un cliente
> con tarjeta, **retener** el pago hasta una condición (conformidad, fin del servicio) y que al cobrarlo Mercado Pago
> **reparta solo**: el neto al prestador y la comisión a la plataforma.
>
> **Estado:** validado en sandbox el **6/11/2026** en TecniUrbano (`scripts/mp-split-poc.mjs`, `plan-cobro-repartido.md`).
> Falta la verificación con cuentas reales y monto bajo (que la comisión llegue al saldo real de la plataforma).
>
> **No contiene secretos.** Las credenciales van siempre en `.env.local` (ignorado por git), nunca en el chat ni en el código.

---

## 1. Diagnóstico: qué fallaba y por qué

Durante semanas el sandbox falló con estos errores. Si vuelven a aparecer, esta es la causa de cada uno:

| Síntoma | Causa real | Solución |
|---|---|---|
| `POST /v1/payments` → **401, código 7, "Unauthorized use of live credentials"** | El token OAuth del vendedor de prueba se pidió con `test_token=false`: queda en contexto "live" y se mezcla con datos de prueba (tarjeta/comprador de prueba). | Canjear el `code` en `/oauth/token` con **`test_token=true`**. Devuelve un token que empieza con `TEST-`. **Esta era la llave.** |
| `/v1/payments` → **"Invalid users involved" (2034)** | La app con la que se hacía OAuth era la app **real** (de la cuenta real de Sandy), y los usuarios eran de prueba. | Crear una app **desde una cuenta de prueba tipo Marketplace** y hacer el OAuth con esa app. |
| `/oauth/token` con `test_token=true` → **"Test credentials are not supported"** | Se intentó con la app real. | Con la app creada desde la cuenta Marketplace de prueba sí funciona. |
| API de **Orders** (`/v1/orders`): reserva y captura OK, pero la comisión no se aplica | Orders **acepta e ignora** `marketplace_fee`; no tiene equivalente de `application_fee` (confirmado por soporte de MP). | Para comisión con Checkout API usar **`/v1/payments`** con `application_fee`. |
| El `code` del OAuth desaparece de la barra | La Redirect URL apunta a un callback real que redirige al instante. | Para pruebas, agregar a la app de prueba una Redirect URL que dé **404** a propósito (ej. `https://<dominio>/prueba-oauth`): el `code` queda visible para copiarlo. |

## 2. Resultados verificados (tarjeta de prueba Mastercard, $1000, comisión $170)

| Operación | Llamada | Resultado |
|---|---|---|
| Reservar | `POST /v1/payments` con `capture:false`, `application_fee:170` | `authorized / pending_capture`. **Mientras está reservado, `fee_details` viene vacío**: la comisión no se ve todavía. |
| Captura total | `PUT /v1/payments/{id}` `{capture:true}` | `approved / accredited`. `fee_details`: `mercadopago_fee` 41 + `application_fee` 170, **ambas a cargo del vendedor (`collector`)**. Neto del vendedor: 789. |
| Captura parcial (sin tocar la comisión) | `PUT {capture:true, transaction_amount:600}` | ⚠️ La comisión **queda fija en 170**, no se prorratea. Neto 405,40. |
| Captura parcial ajustando la comisión | `PUT {capture:true, transaction_amount:600, application_fee:102}` | Comisión 102. Neto 473,40. ✅ **Regla: si se captura menos, reenviar el `application_fee` recalculado en el mismo PUT.** |
| Cancelar | `PUT {status:'cancelled'}` | `cancelled / by_collector`. Nada cobrado. |

Otros datos:
- La reserva con tarjeta dura **7 días** en Argentina (Payments API); si no se captura, vence sola. Captura parcial solo con Visa, Mastercard, Cabal y Amex.
- `money_release_date` del vendedor (en la prueba, 18 días) depende de **la configuración de liberación del vendedor**, no de la plataforma.
- Mercado Pago descuenta primero su comisión y después la del marketplace.
- Reembolsos: se descuentan **proporcionalmente** del vendedor y del marketplace.

## 3. Cómo reproducirlo desde cero (paso a paso)

### 3.1 Cuentas de prueba (en el panel de la cuenta REAL → Tus integraciones → app → Cuentas de prueba)
Crear como mínimo:
- **Marketplace** → hace de la plataforma (dueña de la app de prueba y receptora de la comisión).
- **Vendedor** → hace del prestador (técnico, capitán, etc.).
- **Comprador** → hace del cliente.

Para entrar con una cuenta de prueba: usar el **Usuario** del panel (`TESTUSER…`) y su contraseña. Si pide código de verificación, figura en el panel (son los últimos 6 dígitos del User ID). Usar una ventana de **invitado** o **incógnito** por cuenta, porque las sesiones se pisan.

### 3.2 App de prueba
1. Entrar a `mercadopago.com.ar/developers/panel/app` **con la cuenta de prueba Marketplace** (no con la real).
2. Crear aplicación → Pagos online → **Checkout API** → modelo **Marketplace** (API Pagos).
3. Configuración de la aplicación → Configuración avanzada → **Agregar nueva URL** de redireccionamiento: `https://<dominio>/prueba-oauth` (que dé 404). Permisos: read, offline access, write.
4. Copiar `client_id` y `client_secret` de esa app a `.env.local` (ej. `MP_TEST_APP_CLIENT_ID`, `MP_TEST_APP_CLIENT_SECRET`).

> ⚠️ No tocar la Redirect URL de la app **real**: es la que usan los prestadores de verdad.

### 3.3 Vincular al vendedor de prueba (OAuth)
1. Generar el enlace:
   `https://auth.mercadopago.com/authorization?client_id=<APP_ID_PRUEBA>&response_type=code&platform_id=mp&state=<aleatorio>&redirect_uri=<URL_404_codificada>`
2. Abrirlo en incógnito, entrar con el **vendedor de prueba** y tocar **Autorizar**.
3. Llega al 404: copiar el valor de `code=` de la barra (vale **10 minutos**, un solo uso).
4. Canjearlo:
```js
POST https://api.mercadopago.com/oauth/token
{ client_id, client_secret, grant_type: 'authorization_code', code, redirect_uri, test_token: 'true' }
// → access_token 'TEST-…', public_key, refresh_token, user_id (= collector_id), expires_in 180 días
```

### 3.4 Reservar, capturar, cancelar
```js
// 1) Token de la tarjeta (con la public_key del VENDEDOR obtenida por OAuth)
POST /v1/card_tokens?public_key=<public_key_vendedor>
{ card_number: '5031755734530604', security_code: '123', expiration_month: 11, expiration_year: 2030,
  cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } } }

// 2) Reserva con comisión (Authorization: Bearer <access_token del vendedor>, X-Idempotency-Key: uuid)
POST /v1/payments
{ transaction_amount: 1000, token: '<card_token>', installments: 1, payment_method_id: 'master',
  description: '…', payer: { email: '<email distinto al del vendedor>' },
  capture: false, application_fee: 170, external_reference: '<id interno>' }

// 3a) Captura total
PUT /v1/payments/{id}  { capture: true }
// 3b) Captura parcial (recalcular la comisión)
PUT /v1/payments/{id}  { capture: true, transaction_amount: 600, application_fee: 102 }
// 3c) Cancelar
PUT /v1/payments/{id}  { status: 'cancelled' }

// Ver comisiones: GET /v1/payments/{id} → fee_details, transaction_details.net_received_amount
```
Tarjetas de prueba oficiales (Argentina, titular `APRO` = aprobado): Mastercard `5031 7557 3453 0604`, Visa `4509 9535 6623 3704`, CVV `123`.

Implementación de referencia completa: `scripts/mp-split-poc.mjs` del repo de TecniUrbano (comandos `auth-url`, `exchange <code> --test`, `pay-reserve`, `pay-show`, `pay-capture [monto]`, `pay-cancel`). No imprime tokens; guarda el estado en `.mp-poc-state.json` (ignorado por git).

## 4. Pasar a producción (lo que cambia)
- Usar la app **real** y `test_token=false` (o no mandarlo). Redirect URL = el callback real del sitio.
- Requisitos: cuenta de la plataforma con **KYC nivel 6**; cada prestador autoriza por OAuth.
- Guardar access/refresh token de cada prestador **cifrados** (en TecniUrbano: Supabase Vault), nunca en el navegador ni en logs. Renovar con `grant_type: refresh_token` antes de los 180 días.
- La comisión **nunca hardcodeada**: leerla de la configuración (en TecniUrbano, `system_settings.platform_commission_rate` = 0,17) y calcular `application_fee = round(monto × tasa, 2)` en el servidor.
- El formulario de tarjeta (Card Payment Brick / Secure Fields) va en el navegador: los datos de la tarjeta **nunca** pasan por nuestro servidor, solo el token. Ajustar la CSP para los dominios del SDK de MP.
- El webhook tiene que consultar el pago con el **token del vendedor** (el pago es de su cuenta), no con el de la plataforma.
- Si la plataforma ya liquidaba a mano a los prestadores, **no generar esa liquidación** para pagos repartidos (el prestador ya cobró).
- Antes de encenderlo para todos: una prueba real de monto bajo con un prestador de confianza, verificando que la comisión llega al saldo de la plataforma.

## 5. Límites conocidos
- La reserva es **solo con tarjeta** (no dinero en cuenta ni efectivo), y dura 7 días.
- Split 1:1 = un vendedor por pago. Repartir entre varios vendedores (1:N) requiere ser "cartera asesorada" de MP.
- Un pago que se cobra **antes** de saber quién es el prestador (en TecniUrbano, la Visita de Presupuesto) **no** se puede repartir así: entra entero a la cuenta de la plataforma y se liquida aparte.
