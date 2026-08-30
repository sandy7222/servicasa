# ADR — La seña de visita deja de descontarse del presupuesto; se liquida al técnico aparte

Estado: **implementado y verificado en producción (Supabase).**
Fecha: 2026-08-29 (propuesta) / 2026-08-30 (implementación).

## Decisiones cerradas por Sandy (aprobación del 2026-08-30)

1. Comisión de la liquidación de visita: **15%**, en una clave propia
   `system_settings.visit_settlement_commission_rate` — NO comparte
   `platform_commission_rate` (17%, sigue exclusiva de `completed_work`).
   Editable desde el mismo panel de admin que ya existía para el monto
   de la seña, con el mismo criterio de validación server-side y
   auditoría de quién/cuándo/valor anterior.
2. `create_settlement_on_order_completed_and_paid()` corregida: resta lo
   ya liquidado como `'visita'` (monto y fee de MP) antes de calcular
   `completed_work`. Caso de prueba permanente en
   `supabase/sql/test_visit_and_completed_work_settlements.sql`.
3. Disparador de la liquidación de visita: `service_orders.status` pasa
   a `'in_progress'` (propuesta de Claude, confirmada por Sandy por
   mejor cobertura que "quote sent").
4. Una orden cancelada después de `in_progress` (incluido admin
   emergency override) igual paga la seña al técnico — verificado con
   una orden de prueba en rollback.
5. Sin retroactividad: la única orden `in_progress` real (Carlos
   Méndez, Soldadura) queda sin tocar — confirmado, `technician_settlements`
   tiene 0 filas reales tras el deploy.

## Decisión de negocio (ya confirmada por Sebastián — no se reabre)

1. La seña de visita ($50.000 hoy) deja de descontarse del presupuesto
   final. El cliente paga la seña completa y, si acepta el presupuesto,
   paga el presupuesto completo aparte — sin descuento entre ambos.
2. La seña le corresponde 100% al técnico que hizo la visita, menos el
   15% de comisión de la plataforma. El técnico cobra esto **siempre**
   que haya hecho la visita, acepte o no el cliente el presupuesto
   después.
3. Aplica solo a pedidos nuevos de acá en adelante — no toca
   liquidaciones ni presupuestos ya cerrados.

## Lo que Sandy ya audita y confirma (no reabrir)

- El trigger `sync_quote_totals_from_items` sobre `order_quotes` calcula
  hoy `remaining_amount = greatest(0, total_amount - visit_deposit_credit)`.
- `technician_settlements.settlement_type` ya existe (hoy vacía) —
  agregar un valor nuevo es aditivo.

## Lo que audité yo

### 1. Cómo se crea hoy la liquidación de trabajo completado

Trigger `trg_create_settlement_on_completion` (`AFTER UPDATE OF status,
payment_status ON service_orders`, `WHEN new.status='completed' AND
new.payment_status='paid_in_full'`) → función
`create_settlement_on_order_completed_and_paid()` (`SECURITY DEFINER`):

```sql
v_gross := coalesce(new.total_paid_amount, 0);
select coalesce(value, 0.17) into v_commission_rate
  from system_settings where key = 'platform_commission_rate';
select coalesce(sum(mp_fee_amount), 0) into v_fee
  from payment_transactions
  where order_id = new.id and status = 'approved';  -- SUMA TODAS las transacciones de la orden
v_commission := round(v_gross * v_commission_rate, 2);
v_net := greatest(0, v_gross - v_commission - v_fee);
insert into technician_settlements (..., settlement_type, ...)
  values (..., 'completed_work', ...)
  on conflict (order_id) where settlement_type = 'completed_work' do nothing;
```

Es idempotente por diseño (`exists` check + índice único parcial
`technician_settlements_one_completed_work_per_order` en
`(order_id) WHERE settlement_type = 'completed_work'`) — probado hoy
mismo con transacciones de rollback como parte del reporte de Fase 10.

### 2. ⚠️ Hallazgo crítico: el patrón se puede reutilizar, pero `completed_work` necesita un ajuste — si no, se le paga la seña al técnico DOS VECES

`v_gross` usa `new.total_paid_amount`, que es un acumulador que suma
**todos** los pagos de la orden (`api/payments/webhook.ts`:
`total_paid_amount: current + amount` en cada pago). Hoy eso da el
mismo número que el presupuesto porque la seña ya está descontada del
saldo — `total_paid_amount` termina siendo, por construcción,
`seña + (total − seña) = total`.

**Con el descuento sacado, `total_paid_amount` va a ser `seña + total`
completo**, no solo `total`. Si agrego una liquidación `'visita'` nueva
Y dejo `create_settlement_on_order_completed_and_paid` sin tocar, el
técnico cobra la seña **dos veces**: una vez en `'visita'`, y otra vez
mezclada adentro del `gross_amount` de `'completed_work'` (que ahora
incluiría la seña sin querer). Mismo problema con `v_fee`: hoy suma el
`mp_fee_amount` de **todas** las transacciones aprobadas de la orden — si
la liquidación `'visita'` ya descuenta el fee de MP de la seña, y
`completed_work` lo vuelve a sumar (porque suma todas las transacciones,
incluida la de la seña), se descuenta el fee de la seña dos veces.

**Esto no es algo que pediste auditar, pero es una consecuencia directa
del cambio que sí pediste — no es opcional, hay que tocarlo para que no
haya doble pago.** Propuesta: para `work_mode='diagnosis'`, calcular
`v_gross` como `new.total_paid_amount - coalesce(new.visit_deposit_amount, 0)`
(equivale a `total_quoted_amount`) y `v_fee` sumando `mp_fee_amount` solo
de transacciones `payment_type <> 'visit_deposit'`. Para `work_mode='direct'`
no cambia nada (no hay seña separada ahí).

### 3. El fee de Mercado Pago de la seña — confirmado, ya está registrado

`payment_transactions.mp_fee_amount` se graba en cada transacción,
incluida la de tipo `visit_deposit` (`api/payments/webhook.ts` líneas
226/308). No hay que volver a calcularlo ni estimarlo: la liquidación
`'visita'` puede leer directamente el `mp_fee_amount` de esa transacción
puntual (`payment_type = 'visit_deposit' AND status = 'approved'` para
esa orden — hay como máximo una por orden).

**Detalle de diseño que encontré:** `technician_settlements` ya tiene
una columna `payment_transaction_id` (nullable, sin usar hoy —
`completed_work` nunca la completa) con un índice único en
`(payment_transaction_id, settlement_type)`. Para `'visita'` sí la
llenaría con el id de esa transacción de seña — le da trazabilidad 1:1
real (qué pago de Mercado Pago originó esta liquidación puntual) y de
paso funciona como segunda guarda de idempotencia, además del índice
único parcial que hay que crear para `'visita'` (ver propuesta).

**⚠️ Discrepancia de tasa que necesito que confirmes:** dijiste 15% de
comisión. El valor real hoy en `system_settings.platform_commission_rate`
es **0.17 (17%)** — el mismo que usa `completed_work`. ¿Querés que
`'visita'` use ese mismo 17% compartido ("misma lógica de comisión que ya
existe"), o específicamente 15% distinto solo para la seña? Lo dejo
como pregunta abierta, no asumo ninguna de las dos.

### 4. Qué evento marca "el técnico ya hizo la visita" — cuestiono la propuesta de quote-sent

Auditando `QuoteBuilder.tsx` encontré dos cosas que cambian la
recomendación:

- **El envío del presupuesto NO depende de que el técnico haya iniciado
  la visita en la app.** El botón de armar/enviar presupuesto solo
  chequea `order.paymentStatus === 'deposit_paid'`
  (`canDiagnose`, `QuoteBuilder.tsx:37`) — no `order.status === 'in_progress'`.
  Técnicamente se puede enviar un presupuesto sin haber tocado nunca
  "Salí hacia el domicilio". `quote.status = 'sent'` no es una garantía
  más fuerte de que la visita ocurrió que la alternativa de abajo.
- **Sí hay un caso real donde la visita ocurre y nunca hay presupuesto
  enviado:** `updateOrderStatus` permite `in_progress → cancelled`
  ("admin emergency override", ya está en el código). Un admin puede
  cancelar una orden después de que el técnico ya salió/llegó — la
  visita pasó, pero `order_quotes.status` nunca llega a `'sent'`. Bajo
  `quote-sent` como disparador, ese técnico nunca cobraría la seña, lo
  cual contradice tu regla de "siempre que haya hecho la visita".

**Propuesta:** disparar la liquidación `'visita'` cuando
`service_orders.status` pasa a `'in_progress'` por primera vez en una
orden `work_mode='diagnosis'` (el mismo evento que ya activa
`notify_technician_en_route`, arreglado hoy en Problema 8 para que
alcance con la seña pagada, sin esperar presupuesto). Es estrictamente
más temprano y cubre más casos reales que `quote-sent`, incluido el de
cancelación posterior. Idempotente con el mismo patrón que
`completed_work` (chequeo `exists` + índice único parcial), así que
pausar/reanudar no dispara una segunda liquidación.

**Pregunta abierta para vos:** ¿una visita que termina en orden
**cancelada** (no rechazada por el cliente — cancelada del todo, ej. por
un problema del lado del cliente o un desacuerdo) también debería
pagarle la seña al técnico? Asumo que sí por el espíritu de tu regla
("siempre que haya hecho la visita"), pero es una situación que no
nombraste explícitamente y prefiero que la confirmes antes de
implementar un trigger que paga automáticamente ni bien arranca el
cronómetro.

### 5. Pantallas que muestran "Restante a pagar" con descuento de seña

| Archivo | Estado hoy | Cambio necesario |
| --- | --- | --- |
| `src/components/client/QuoteViewer.tsx:50` | Muestra `Total` / `Seña ya acreditada: -$X` / `Restante a pagar` como resta | Sacar la línea de resta de seña; mostrar el total del presupuesto como monto plano, sin desglose de crédito |
| `src/components/technician/QuoteBuilder.tsx:~256` | Mismo patrón (`Mano de obra` / `Repuestos` / `Seña acreditada: -$X` / `Restante`) — ya lo toqué hoy para Problema 8 (mostrar "Pagado" si `accepted`), sin tocar esta lógica | Mismo ajuste que QuoteViewer |
| `src/components/admin/ClientFicha.tsx:77` | Ya muestra `quote.remainingAmount` directo, sin línea de resta | **Ningún cambio de código** — al arreglar el trigger, `remainingAmount` pasa a ser el total sin descuento automáticamente |
| `src/components/client/RejectedVisitReceipt.tsx` | Muestra "Seña de visita registrada: $X" como línea informativa aparte (no es una resta), con texto ya deliberadamente no comprometido sobre qué pasa con ella ("queda en revisión según las condiciones aceptadas") | Cambio menor: renombrar "seña" → "visita de presupuesto" en el label, sin tocar la lógica (ya es compatible con la regla nueva tal como está escrita) |

`api/payments/create.ts` (cobro del saldo) y `ClientFicha.tsx` **no
necesitan ningún cambio de código** — ambos ya leen `remaining_amount`
directo de la base; al corregir el trigger, se corrigen solos.

## Propuesta concreta (para aprobar, no implementada todavía)

1. **`sync_quote_totals_from_items`**: `remaining_amount = total_amount`
   (sacar `- q.visit_deposit_credit`). Solo afecta presupuestos que
   todavía estén en `draft` — uno ya `sent`/`accepted` está protegido por
   `prevent_sent_quote_content_change` y no se recalcula nunca más, así
   que esto no toca presupuestos ya cerrados sin que haga falta ningún
   filtro extra.
2. **`QuoteBuilder.tsx` (`ensureDraft`)**: escribir `visit_deposit_credit: 0`
   en presupuestos nuevos en vez de `order.visitDepositAmount` — la
   columna sigue en el esquema (no se borra, como pediste), pero deja de
   tener un valor no-cero engañoso en presupuestos donde ya no se usa
   para nada. Los presupuestos viejos conservan su valor histórico sin
   tocar.
3. **Nuevo trigger** `trg_create_visit_settlement` sobre `service_orders`
   (`AFTER UPDATE OF status`, `WHEN new.status = 'in_progress' AND
   new.work_mode = 'diagnosis'`), mismo patrón que
   `create_settlement_on_order_completed_and_paid`:
   `gross = visit_deposit_amount`, `fee = mp_fee_amount` de la
   transacción `visit_deposit` de esa orden, `commission_rate` = a
   confirmar (17% compartido o 15% propio — ver punto 3 arriba),
   `settlement_type = 'visita'`, completa `payment_transaction_id` con
   el id de esa transacción. Necesita un índice único parcial nuevo,
   `technician_settlements_one_visita_per_order` en
   `(order_id) WHERE settlement_type = 'visita'`, para que el
   `on conflict` tenga con qué emparejar.
4. **Ajustar `create_settlement_on_order_completed_and_paid`** (punto 2
   del diagnóstico) para que, en `work_mode='diagnosis'`, no vuelva a
   contar la seña ni su fee — obligatorio para que no haya doble pago,
   no opcional.
5. **Frontend**: `QuoteViewer.tsx` y `QuoteBuilder.tsx` sacan la línea de
   "seña acreditada" del desglose y muestran el total del presupuesto
   sin descuento; `RejectedVisitReceipt.tsx` renombra el label de
   "seña" a "visita de presupuesto"; `ClientFicha.tsx` sin cambios.

## Preguntas abiertas — resueltas (ver decisiones cerradas arriba)

1. 15% específico para `'visita'`, no compartido con `platform_commission_rate`.
2. Sí — una visita que termina en orden cancelada también paga la seña.
3. Sin retroactividad — el trigger `AFTER UPDATE` no toca la orden
   `in_progress` existente por diseño, confirmado sin backfill.

## Implementación (2026-08-30)

Migraciones aplicadas en orden (`supabase/migrations/`):

1. `20260830011955_create_visit_settlement_commission_rate_setting.sql`
2. `20260830012057_fix_completed_work_settlement_excludes_visit_settlement.sql`
3. `20260830012118_create_visit_settlement_on_started.sql`
4. `20260830012228_allow_visita_settlement_type.sql`
5. `20260830012436_system_settings_validate_commission_rate_range.sql`
6. `20260830013220_fix_quote_remaining_amount_no_deposit_discount.sql`
7. `20260830013951_revoke_public_execute_create_visit_settlement_on_started.sql`
   (hallazgo del advisor de seguridad tras el deploy: la nueva función de
   trigger quedó exponible vía `/rest/v1/rpc/...` para `anon`/`authenticated`,
   a diferencia de `create_settlement_on_order_completed_and_paid` que ya
   tenía `PUBLIC` revocado — corregido para igualar el criterio existente).

Frontend:

- `src/lib/supabaseData.ts` / `supabaseMutations.ts` / `context/AppContext.tsx`:
  wiring de `visitSettlementCommissionRate` (fetch + update), mismo patrón
  que `visitDepositAmount`.
- `src/components/admin/VisitFeeSettings.tsx`: nuevo editor de comisión (%),
  junto al editor de monto ya existente.
- `src/components/client/QuoteViewer.tsx` y
  `src/components/technician/QuoteBuilder.tsx`: sacada la línea de resta de
  seña; muestran el total del presupuesto sin descuento, con nota
  aclaratoria de que la visita ya pagada es aparte.
- `src/components/technician/QuoteBuilder.tsx` (`ensureDraft`): nuevos
  presupuestos escriben `visit_deposit_credit: 0` en vez de
  `order.visitDepositAmount`.
- `src/components/client/RejectedVisitReceipt.tsx`: renombrado el label de
  "Seña de visita registrada" a "Visita de presupuesto registrada".
- `src/components/admin/ClientFicha.tsx`: sin cambios (confirmado — ya leía
  `remaining_amount` directo, que ahora es correcto por la corrección del
  trigger `sync_quote_totals_from_items`).

Verificación (todo con transacciones `begin; ... rollback;`, sin residuo):

- Doble liquidación sobre la misma orden: `visita` + `completed_work`
  suman exactamente `total_paid_amount`, en bruto y reconstruido
  (neto + comisión + fee) — persistido como
  `supabase/sql/test_visit_and_completed_work_settlements.sql`.
- Cancelación después de `in_progress`: la liquidación `'visita'` sobrevive
  sin cambios.
- Sin backfill: única orden `in_progress` real intacta, 0 liquidaciones
  reales en la base tras el deploy.
- Validación de rango 0–1 en claves `%_commission_rate`: rechaza `5.0`,
  acepta `0.2`.
- `get_advisors` (security): sin hallazgos nuevos tras el fix del punto 7.
