# ADR — Rediseño del dato "dirección"

Estado: **Fases 1, 2 y 3 implementadas y verificadas. Fases 4-6 pendientes, a confirmar antes de cada una.**
Fecha: 2026-08-30.
Origen: documento de Sandy ("Rediseño del dato 'dirección' — TecniUrbano"),
a partir de un reporte real de Marcos Abate (no pudo completar el campo de
localidad — terminó escribiendo la altura "547" en el campo de localidad y
dejando la localidad real vacía) + revisión directa de la base de producción.

## Diagnóstico (verificado contra la base y el código reales antes de tocar nada)

Todo lo que describe el documento original se confirmó exacto:

- `customer_addresses` existe con la forma correcta (`address_line`,
  `neighborhood`, `city`, `postal_code`, `lat`, `lng`, `is_default`,
  `label`) pero tenía **0 filas** — ningún flujo escribe ahí todavía.
- `service_orders` no tenía `client_city`, `client_postal_code`,
  `client_lat`, `client_lng` ni `client_address_id`.
- `client_neighborhood` hoy hace las veces de localidad por convención, sin
  estar rotulado ni validado como tal (mezclando barrio real de CABA con
  localidades del conurbano).
- Sin número de calle separado: cuando falla, la altura termina en el
  campo equivocado (el caso exacto de Marcos).

**Un detalle que el documento no mencionaba, encontrado al auditar:**
`technicians` ya tiene una columna `zone` (texto libre), cableada en el
modal de alta y edición de técnico (`AdminHubView.tsx`) — pero es
puramente decorativa: se muestra como label ("Zona, Provincia") y no se
usa para filtrar ni sugerir nada al asignar. No contradice el diagnóstico
("la asignación por zona es 100% manual"), pero había que decidir qué
hacer con ese campo al construir la cobertura estructurada.

## Decisiones confirmadas por Sandy (2026-08-30)

1. **Geocoding diferido.** Nada de Google Places Autocomplete en esta
   etapa — localidad/calle/número como inputs de texto validados (rechazar
   vacío o puramente numérico), sin lat/lng todavía. Se integra en una
   iteración futura si hace falta.
2. **`technicians.zone` se mantiene como label**, sin tocar; la cobertura
   real por localidad vive exclusivamente en la tabla nueva
   `technician_coverage_areas`. Cero riesgo de romper lo que ya funciona.
   **Agregado por Sandy:** cuando se construya el input de calle/localidad
   (Fase 2), debe auto-capitalizar cada palabra a medida que el cliente
   escribe (ej. "suipacha" → "Suipacha"), para que quede bien redactado
   aunque no haya autocompletado real de Google todavía.
3. **Alcance de esta sesión: Fase 1 sola** (migración de base). Fases 2-6
   (componente de dirección, direcciones guardadas, `formatAddress`
   centralizado, cobertura de técnicos en la UI, geocoding opcional) se
   confirman una por una antes de implementarse — mismo criterio que el
   resto de cambios grandes en este proyecto.

## Fase 1 — Implementada (commit `9c0d46f`)

Migración `20260830153351_address_redesign_phase1_service_orders_and_coverage_areas.sql`:

1. `service_orders` — agrega `client_city`, `client_postal_code`,
   `client_lat`, `client_lng`, `client_address_id` (FK a
   `customer_addresses.id`, `ON DELETE SET NULL` para que borrar una
   dirección guardada no bloquee ni arrastre el pedido histórico que la
   usó). `client_neighborhood` queda igual, ahora explícitamente opcional.
2. `technician_coverage_areas` — tabla nueva (`technician_id`, `province`,
   `city`, `UNIQUE(technician_id, province, city)`), RLS habilitada con el
   mismo patrón que `technician_requirements`: admin control total
   (`is_admin()`), el técnico solo puede `SELECT` sus propias filas.

**Verificado con transacciones de rollback contra la base real:**
- El `ALTER TABLE` y el `CREATE TABLE` corren limpio.
- Un técnico impersonado (`request.jwt.claim.sub`) solo ve su propia fila
  de cobertura, nunca la de otro técnico.
- Un admin impersonado ve todas las filas y puede insertar/editar/borrar.
- Después de aplicar en real: 0 filas en `technician_coverage_areas`
  (tabla nueva, sin residuo de las pruebas), la única orden real existente
  quedó con `client_city` en `NULL` (sin backfill, como corresponde —
  nada la escribe todavía).
- `get_advisors` (security): sin hallazgos nuevos.

## Fase 2 — Implementada

Componente de dirección compartido `src/components/common/AddressFields.tsx`
+ utilidades en `src/lib/address.ts` (`capitalizeWords`, `validateAddressDraft`).

Antes de esta fase, `ServiceRequestForm.tsx` (cliente logueado) y
`GuestServiceRequestForm.tsx` (invitado) tenían el bloque de dirección
duplicado byte a byte — exactamente el patrón de bug que ya había aparecido
con `profiles.customer_id`. Ahora los dos usan el mismo componente:

- **Calle** y **Número** como inputs separados (opción principal del
  documento original, en vez de un input único con regex).
- **Localidad** (antes mezclada con "barrio") con la validación pedida:
  rechaza vacío o puramente numérico — reproduce y bloquea exactamente el
  caso de Marcos ("547" en el campo de localidad).
- **Barrio** ahora explícitamente opcional, separado de localidad.
- Auto-capitalización en calle/localidad/barrio mientras se escribe
  (pedido explícito de Sandy), simple (cada palabra, sin excepciones de
  preposiciones en español).
- La validación del cliente se reproduce tal cual en el servidor
  (`api/orders/request-service.ts`, `api/orders/guest-checkout.ts`) — nunca
  se confía en que el chequeo del formulario haya corrido.

**`city` conectado de punta a punta**, no solo en el formulario: se agregó
al tipo `CustomerServiceRequestInput`/`GuestServiceRequestInput`, viaja en
el `payload` de `customer_order_drafts`/`guest_checkout_drafts`, y
`api/payments/webhook.ts` lo escribe en `service_orders.client_city` al
crear la orden real (una vez confirmado el pago) — la columna que la Fase 1
dejó lista pero que nadie escribía todavía.

**Hallazgo no pedido pero necesario, corregido en la misma pasada:** separar
`neighborhood` de `city` significaba que dos pantallas del técnico
(`TechnicianView.tsx`: el link de "Cómo llegar" a Google Maps y el resumen
de la orden activa; `WorkHistoryView.tsx`: el historial de trabajos)
armaban la dirección combinando `clientAddress` + `clientNeighborhood`
únicamente — con `neighborhood` ahora opcional y vacío en pedidos nuevos,
esas pantallas iban a mostrar la dirección incompleta o con paréntesis
vacíos. Se agregó `clientCity` al tipo `ServiceOrder` y al mapeo de
Supabase, y se sumó a esos 3 lugares puntuales — sin adelantar la
centralización completa de `formatAddress()`, que sigue siendo Fase 4.

**Verificación:** probado en el navegador contra el formulario de invitado
real (dev server local, conectado a la base de producción): tipear
"suipacha" se ve "Suipacha" al instante; tipear "547" en Localidad y enviar
el formulario dispara el toast exacto y **no genera ningún request de red**
(confirmado con `read_network_requests` — cero llamadas a
`/api/orders/guest-checkout`). No se completó un envío válido real para no
crear un draft de verdad ni tocar la API de Mercado Pago en vivo sin
necesidad — la ruta ya quedó revisada de punta a punta por código. `tsc
--noEmit`, `vitest run` (84/84), `npm run build` sin errores.

## Fase 3 — Implementada

Alcance definido por Sandy en su propio documento de la Fase 3, con una
nota de prioridad explícita: no bloquea la prueba de cobro con tarjeta
(el formulario ya se podía enviar desde Fase 2) — es mejora de UX.

**Gap encontrado al re-verificar el estado de la base antes de tocar
nada** (Sandy había marcado "no requiere cambios"): `customer_addresses`
**no tiene columna de provincia**. Confirmado directo contra
`information_schema.columns`. Esto significa que una dirección guardada no
puede recordar la provincia — al elegirla en un pedido nuevo, el cliente
igual tiene que confirmar la provincia (no volver a *tipear* nada, pero sí
un clic más). Dado que Sandy pidió explícitamente "Fase 3 sin migraciones
nuevas", se implementó así — con este trade-off declarado en vez de
agregar la columna por mi cuenta. Si se prefiere resolverlo del todo, hace
falta una migración de una sola columna (`customer_addresses.province`),
trivial de agregar después.

**Implementado:**

1. Hook único `src/lib/useCustomerAddresses.ts` — todo el CRUD contra
   `customer_addresses` en un solo lugar (list/create/update/delete/set
   default), usado tanto por `ServiceRequestForm.tsx` como por el nuevo
   `CustomerAddressesPanel.tsx` — mismo criterio que `AddressFields.tsx`
   en la Fase 2: nunca dos caminos que escriban lo mismo por separado.
2. `ServiceRequestForm.tsx`: si el cliente tiene direcciones guardadas,
   selector "Dirección" arriba de `AddressFields` (con la default
   preseleccionada) + opción "+ Agregar nueva dirección". Elegir una
   guardada precarga calle/número/barrio/localidad en los campos —
   **editables**, no de solo lectura (decisión mía, el documento lo dejaba
   "a definir"): si el cliente ajusta algo para este pedido puntual, no
   modifica la dirección guardada — el pedido siempre guarda su propia
   copia, nunca una referencia viva.
3. Checkbox "Guardar esta dirección para próximos pedidos", visible solo
   en modo "nueva dirección" (como pedía el documento) — la primera
   dirección de un cliente queda automáticamente `is_default = true`.
4. `service_orders.client_address_id` se completa de punta a punta: viaja
   como `addressId` en `CustomerServiceRequestInput` →
   `api/orders/request-service.ts` (que **verifica server-side que la
   dirección sea realmente del caller** antes de confiarla — la ruta corre
   con `supabaseAdmin`, sin RLS, así que un id ajeno se descarta en
   silencio en vez de confiar en lo que mande el cliente) → payload del
   draft → `api/payments/webhook.ts` lo escribe al crear la orden real.
5. `CustomerAddressesPanel.tsx` ("Mi perfil", `#/customer`): listar,
   crear, editar, eliminar y marcar predeterminada — resuelve el reclamo
   original de Marcos de no poder actualizar su dirección desde su cuenta.
   Reusa `AddressFields` con `showProvince={false}` (nuevo prop) ya que
   acá no aplica.
6. Guardado de dirección **best-effort**: si falla (ver
   `ServiceRequestForm.tsx`, bloque `try/catch` alrededor de
   `createSavedAddress`), el pedido se envía igual con los datos tipeados
   — nunca bloquea llegar al pago.
7. `splitAddressLine()` en `src/lib/address.ts`: separa el
   `address_line` combinado guardado ("Calle Número") en calle/número al
   precargar una dirección guardada — sin agregar columnas nuevas, en
   línea con la restricción de Sandy. Best-effort (último token = altura);
   si el split queda raro, el cliente lo corrige a mano en el campo.

**Fuera de alcance, como pedía el documento:** `GuestServiceRequestForm.tsx`
sin cambios (no tiene `customer_id`); `formatAddress()` centralizado sigue
en Fase 4.

**Verificado con transacciones de rollback contra la base real** (primera
vez que se escribe de verdad en `customer_addresses` — antes tenía 0
filas): ciclo completo insert x2 → select → cambiar default → update →
delete, con un cliente real impersonado. Aislamiento confirmado aparte: un
segundo cliente impersonado no puede ver, actualizar (`GET DIAGNOSTICS
row_count = 0`) ni borrar una dirección ajena. Persistido como
`supabase/sql/test_customer_addresses_rls.sql`. Cero residuo confirmado
después (`select count(*) from customer_addresses` → 0). `tsc --noEmit`,
`vitest run` (84/84), `npm run build` sin errores. No hubo click-through en
navegador de las pantallas nuevas (selector, checkbox, panel de "Mi
perfil") — requieren una sesión de cliente real autenticada, que no tengo.

## Fases pendientes (orden sugerido por el documento original, sin confirmar todavía)

4. Centralizar `formatAddress()` y reemplazar el armado manual de
   dirección en admin, exports, PDFs y notificaciones.
5. Gestión de `technician_coverage_areas` en la ficha de técnico del
   admin, usada como filtro/sugerencia al asignar.
6. (Opcional, iteración futura) Geocoding para lat/lng automático.
