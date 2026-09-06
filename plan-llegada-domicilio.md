# Plan: Botón "Llegué al domicilio" — separar viaje de trabajo en sitio

Rama sugerida: `feature/llegada-domicilio`, a partir de la rama principal activa.

## 1. Diagnóstico (estado actual, verificado en el repo)

- Hoy no existe ningún evento de "llegada". El único botón entre "aceptar la visita" y "trabajar" es **"Salí hacia el domicilio"** (`src/views/TechnicianView.tsx` ~línea 419), que llama a `handleStartOrResumeService` → `updateOrderStatus(order.id, 'in_progress')`.
- Esa única llamada, en el mismo instante: (a) pone `status = 'in_progress'`, (b) arranca el cronómetro `workStartedAt` (`AppContext.tsx` ~línea 1075: `if (newStatus === 'in_progress') nextWorkStartedAt = transitionAtIso`), (c) hace aparecer los botones **Pausar/Finalizar** (`TechnicianView.tsx` ~línea 439, condicionado solo a `status === 'in_progress'`), y (d) persiste todo eso en Supabase vía `persistUpdateOrderStatus` (`src/lib/supabaseMutations.ts` ~línea 870, tabla `service_orders`, columnas `status` y `work_started_at`).
- **El panel de pestañas operativas (Checklist, Tiempo, Materiales, Notas, Presupuesto, Firma) no está condicionado por status en absoluto** — se verificó que ese bloque completo (`TechnicianView.tsx` ~línea 618 en adelante) se renderiza siempre que hay una orden activa, incluso antes de "Salí". Esto confirma lo que se ve en tu boceto (imagen 1): hoy el técnico ve todas las herramientas del servicio desde el primer momento, no solo desde que llega.
- La pestaña "Presupuesto" existe pero está **al final** de la barra de pestañas (después de Notas) y solo aparece si `workMode === 'diagnosis'` (~línea 668). La pestaña activa por defecto es `'checklist'` (`useState` en la línea 110).
- Conclusión: el sistema hoy fusiona en un solo click dos momentos que son distintos en la realidad — "salir a viajar" y "empezar a trabajar en el domicilio" — y por eso el cronómetro y Pausar/Finalizar aparecen mientras el técnico todavía está en la calle.

## 2. Objetivo

1. "Salí hacia el domicilio" pasa a significar solamente eso: el técnico está en viaje. No arranca cronómetro, no habilita Pausar/Finalizar, no expone las herramientas del servicio.
2. Se agrega el botón **"Llegué al domicilio"**. Recién ahí: arranca el cronómetro, aparecen Pausar/Finalizar, y se habilitan las pestañas operativas — con **Presupuesto como primera pestaña y activa por defecto** (vos ya presupuestás antes del checklist).
3. Antes de "Llegué", en el lugar de las pestañas se muestra un aviso simple ("Presioná 'Llegué al domicilio' para habilitar presupuesto, checklist y el resto de las herramientas del servicio").
4. Este mismo evento de "Llegué" queda como el gancho natural para que, más adelante, el ayudante dispare el mensaje "Llegaste a tiempo técnico, ahora debes presupuestar el trabajo a realizar" — no hace falta inventar un trigger nuevo para el ayudante, es el mismo.
5. Cero ruptura de lo ya probado: no se toca el enum `OrderStatus`, ni RLS, ni el trigger de liquidación (`create_settlement_on_order_completion`), ni las reglas STRICT COMPLETION de `updateOrderStatus` (checklist completo + firma + registro de tiempo para poder cerrar).

## 3. Diseño técnico

- **No se toca `OrderStatus`** (`'assigned' | 'in_progress' | 'paused' | 'completed' | 'cancelled'`, `src/types/index.ts` línea 82). La orden sigue en `'assigned'` mientras viaja; pasa a `'in_progress'` recién con "Llegué". Esto evita tocar StatusBadge, RLS, y el trigger de liquidación, que ya filtran por estos 5 valores.
- Se agrega un campo nuevo y liviano, no destructivo: `travelStartedAt?: string` en `ServiceOrder` — informativo, no dispara ninguna regla de negocio (a diferencia de `workStartedAt`).
- Migración Supabase: una columna nueva `service_orders.travel_started_at timestamptz null` (nullable, sin default, no rompe filas existentes, no toca RLS ya definida sobre la tabla).
- **"Salí hacia el domicilio"**: en vez de llamar al motor de transición de estados, llama a una función nueva y simple — `markTravelStarted(orderId)` — que solo persiste `travel_started_at = now()` con un `update` directo (igual de simple que `persistAdminResolveIncident`, por ejemplo). La orden sigue en `'assigned'`.
- **Botón nuevo "Llegué al domicilio"**: visible cuando `status === 'assigned' && technicianResponseStatus === 'accepted' && travelStartedAt && isOrderPaymentSettled(order)`. Al presionarlo, llama exactamente a lo que hoy dispara "Salí" — `handleStartOrResumeService` → `updateOrderStatus(order.id, 'in_progress')` — reutilizando el 100% del motor de transición ya probado (cronómetro, reglas STRICT COMPLETION, evento `'started'`, persistencia). No se duplica lógica de negocio, solo se mueve el momento en que se dispara.
- En el mismo handler de "Llegué" se agrega `setActiveTab('quote')` para que Presupuesto quede activo al entrar.
- **Gating del panel operativo**: el bloque "Operational Tabs" completo pasa a estar envuelto en `{(activeOrder.status === 'in_progress' || activeOrder.status === 'paused' || activeOrder.status === 'completed') && ( ... )}` — es decir, visible desde que llegó, y se mantiene visible en pausa/cierre (para no perder acceso al historial de un trabajo ya iniciado). Antes de eso, se muestra el aviso mencionado en el punto 2.3.
- **Reordenar pestañas**: el botón "Presupuesto" pasa a ser el primero de la barra (hoy está al final, después de Notas). El `useState` de `activeTab` pasa de `'checklist'` a `'quote'` como valor inicial, para cubrir el caso de refrescar la página ya con la orden en curso.
- Nada de esto toca `isOrderPaymentSettled`, ni las validaciones de pago existentes, ni el flujo de presupuesto en sí (`QuoteBuilder.tsx`).

## 3.1 Hallazgo nuevo al revisar los triggers reales de `service_orders` (Fase 1)

Antes de tocar código, revisé todos los triggers reales sobre `service_orders` en Supabase para no romper nada oculto. Dos cosas relevantes:

- **`trg_notify_technician_en_route` (hay que tocarlo — si no, se rompe una notificación real al cliente).** Hoy este trigger dispara la notificación al cliente *"Tu técnico está en camino"* exactamente cuando `status` pasa de `'assigned'` a `'in_progress'` — es decir, hoy coincide con "Salí". Si muevo esa transición a "Llegué" sin tocar este trigger, el cliente recibiría *"tu técnico está en camino"* recién cuando el técnico **ya llegó** — quedaría al revés. Por eso la Fase 3 tiene que incluir un cambio chico en este trigger (en una migración aparte, aditiva): que dispare con `UPDATE OF travel_started_at` cuando `old.travel_started_at is null and new.travel_started_at is not null`, en vez de con el cambio de `status`. Es el mismo mensaje, solo cambia qué columna lo dispara.
- **`trg_create_visit_settlement_on_started`** (crea la liquidación de la seña de visita cuando `status = 'in_progress'`, solo para `work_mode = 'diagnosis'`) — con este cambio pasaría a crearse en "Llegué" en vez de en "Salí". No hace falta tocarlo: no depende de si el técnico viajó o no, y es más correcto que la liquidación de la visita se genere cuando el técnico efectivamente está en el domicilio, no antes.
- `prevent_unpaid_execution_timer` y `protect_admin_order_control_fields` no necesitan cambios: ninguno de los dos mira `travel_started_at`, y `markTravelStarted` no toca `status` ni `work_started_at`, así que ni siquiera se disparan con ese update.

## 4. Riesgo revisado — no hay regresión

`updateOrderStatus` exige, para poder pasar a `'completed'`, al menos un registro de tiempo (`hasTimeLog`), checklist completo y firma (`AppContext.tsx` ~línea 1035). Como el cronómetro ahora arranca en "Llegué" en vez de en "Salí", el tiempo registrado refleja *solo* el trabajo en el domicilio, no el viaje — esto es una mejora de precisión, no una regresión. Ningún test existente (`workTimer.test.ts`, etc.) depende de que el cronómetro arranque en "Salí".

## 5. Fases de implementación (mismo patrón que el plan de calificaciones)

- [x] **Fase 1** — Migración Supabase: columna `service_orders.travel_started_at timestamptz null` (aditiva, sin default). Aplicada y verificada directamente contra el proyecto real (`information_schema.columns` confirma tipo/nullabilidad; `get_advisors` no reporta ninguna alerta nueva).
- [x] **Fase 2** — Completa. Incluye, además de lo previsto, el ajuste de DB encontrado en la Fase 1:
  - Migración: nuevo valor `'travel_started'` en el enum `order_event_type` (aditivo).
  - Migración: `trg_notify_technician_en_route` reescrito para disparar con `travel_started_at` (`old is null and new is not null`) en vez del cambio de `status` — verificado con `pg_get_triggerdef` contra el proyecto real.
  - `src/types/index.ts`: campo `travelStartedAt?: string` en `ServiceOrder`, valor `'travel_started'` agregado a `OrderEventType`.
  - `src/lib/supabase.ts`: campo `travel_started_at: string | null` en `DbServiceOrder`.
  - `src/lib/supabaseData.ts`: mapeo `travelStartedAt: row.travel_started_at ?? undefined`.
  - `src/lib/supabaseMutations.ts`: `persistMarkTravelStarted({ orderId, author })` — persiste la columna y registra el evento `travel_started` en `order_events`.
  - `src/context/AppContext.tsx`: `markTravelStarted(orderId)` (mismo patrón que `respondToAssignment`: guard de seguridad, no-op si ya se registró, `refreshRemoteData`, toast), expuesta en `AppContextType` y en el value del provider.
  - `src/types/database.types.ts`: regenerado desde el proyecto real (`generate_typescript_types`) para incluir la columna nueva.
  - Verificado con `npx tsc --noEmit` (limpio) directamente en el repo real. Los tests (`vitest`) no se pudieron correr en esta VM por el bug conocido de `@rollup/rollup-linux-x64-gnu` (no relacionado a este cambio) — quedan para la Fase 4, corridos por vos/Cursor en el entorno Windows real.
- [x] **Fase 3** — Completa, en `src/views/TechnicianView.tsx`:
  - "Salí hacia el domicilio" ahora llama a `markTravelStarted(orderId)` (Fase 2) en vez de `updateOrderStatus(..., 'in_progress')`. La orden sigue `'assigned'`; no arranca cronómetro ni muestra Pausar/Finalizar. El botón desaparece una vez que ya se registró la salida (`!activeOrder.travelStartedAt`).
  - Botón nuevo "Llegué al domicilio" (visible solo cuando `travelStartedAt` ya está seteado): llama a `handleArrival`, que dispara la transición real (`handleStartOrResumeService` → `updateOrderStatus(..., 'in_progress')`, la misma que ya usa "Reanudar") y además fuerza `setActiveTab('quote')` — pero solo para `workMode === 'diagnosis'`, para no dejar en blanco el panel de un trabajo directo que no tiene pestaña de Presupuesto. "Reanudar" (retomar tras una pausa) no se tocó: sigue sin resetear la pestaña activa.
  - Se sacó el `useState` de `activeTab` de la lista de cambios: en vez de cambiar el default global (que rompería el caso de trabajos `direct`, sin pestaña Presupuesto), el salto a Presupuesto se hace puntualmente en `handleArrival`.
  - Pestaña "Presupuesto" reordenada: ahora es la primera de la barra (antes del Checklist), en vez de estar al final después de Notas.
  - Todo el panel operativo (Checklist/Tiempo/Materiales/Notas/Presupuesto/Firma) quedó envuelto en `{(status === 'in_progress' || 'paused' || 'completed') ? (...) : (aviso)}` — antes de "Llegué" se ve un cartel: *"Presioná 'Llegué al domicilio' para habilitar presupuesto, checklist y el resto de las herramientas del servicio."*
  - Verificado con `npx tsc --noEmit` sobre el repo real (limpio) y revisión manual del diff completo del archivo, línea por línea, contra lo planeado.
- [x] **Fase 4** — completa (verificación a nivel de base de datos + verificación real de código y UI) — Verificación end-to-end real contra el proyecto Supabase, usando una orden real ya asignada (`23bda5b4-967d-495c-8bed-eac2f251bef9`) dentro de una transacción `begin; ... rollback;` (cero impacto en datos reales, confirmado después: `status`, `travel_started_at`, `work_started_at` y las notificaciones quedaron exactamente como estaban):
  - Simulé la sesión de la técnica asignada (`set local role authenticated` + `request.jwt.claim.sub`) y repetí la secuencia real: "Salí" (`travel_started_at = now()`, sin tocar `status`) → "Llegué" (`status = 'in_progress'`, `work_started_at = now()`).
  - RLS permite ambas escrituras a la técnica sobre su propia orden (`service_orders_update_admin_or_tech` y `order_events_write` son políticas por fila, no por columna — no hacía falta ninguna política nueva).
  - **Encontré una falsa alarma en el camino, vale la pena dejarla anotada**: mi primer intento de verificar la notificación al cliente dio 0 resultados y por un momento pensé que el trigger nuevo no disparaba. No era eso — la política de `SELECT` de `notifications` solo deja ver a cada usuario las notificaciones dirigidas a él, y la notificación "Tu técnico está en camino" va al **cliente**, no a la técnica que yo estaba simulando. Leyendo sin esa restricción (`reset role` antes del `select`, sin tocar la escritura) confirmé que la notificación sí se crea, dirigida al cliente correcto.
  - Resultado final verificado en una sola pasada: `status` termina en `in_progress`, `travel_started_at` y `work_started_at` quedan seteados correctamente, se crea **exactamente una** notificación `technician_en_route` (no se duplica al llegar, ya que `travel_started_at` no vuelve a cambiar en ese paso) y **exactamente un** evento `travel_started` en `order_events`.
  - **Completado por vos/Cursor en el entorno Windows real:**
    - `npx tsc --noEmit`: limpio (exit 0).
    - `npm run test:unit` (vitest): **10 archivos, 100 tests, todos pasaron** — incluye `workTimer.test.ts`.
    - `npm run build`: compiló sin errores (único warning preexistente de tamaño de chunk, no relacionado).
    - Click-through real contra Supabase, orden `c9d9d945-c86e-4aec-a432-28866836cfa7` (diagnóstico, técnico Carlos Méndez): confirmado paso a paso — antes de aceptar: sin botones de acción, cartel visible, sin pestañas; al aceptar: aparece "Salí hacia el domicilio", sigue `assigned`; al salir: pasa a "Llegué al domicilio", sigue `assigned` (`travel_started_at` seteado, `work_started_at` null), sin Pausar/Finalizar, cartel persiste; al llegar: toast a `IN_PROGRESS`, aparecen Pausar/Finalizar, cartel desaparece, panel de pestañas con Presupuesto primera y activa, cronómetro arranca. Coincide exactamente con el diseño.
  - **Dos observaciones que salieron de la prueba, ninguna es una regresión de este cambio:**
    1. El header del cronómetro muestra "PAUSADO" mientras la orden está `assigned` (viajando) — la etiqueta es binaria (`in_progress` → "EN CURSO", cualquier otra cosa → "PAUSADO") y ya existía antes; con "Llegué al domicilio" esa ventana de "asignada pero todavía no en curso" dura más tiempo (mientras viaja) que antes, así que la etiqueta engañosa se nota más. Posible mejora futura, fuera de este plan.
    2. En la pestaña Presupuesto de esa orden se lee "Esperando la seña de visita..." aunque en la base esa orden ya está `paid_in_full`. Esto es un comportamiento de `QuoteBuilder.tsx`, componente que este plan no tocó — antes pasaba desapercibido porque Presupuesto era la última pestaña y casi no se abría en ese momento; ahora, al ser la primera y quedar activa automáticamente, se nota. Posible bug preexistente a investigar aparte.
- [x] **Fase 5** — Cierre: plan cerrado y commiteado junto con el código, en un solo commit acotado a este cambio.

## 6. Nota sobre el ayudante

Este plan no incluye construir el ayudante todavía — solo dejar el evento correcto (el nuevo "Llegué al domicilio") como el punto de enganche para cuando lo diseñemos. Una vez que definamos el personaje/estilo del ayudante técnico, el mensaje "Llegaste a tiempo técnico, ahora debes presupuestar el trabajo a realizar" se dispara en el mismo handler que ya vamos a tocar acá.

---

# Ampliación: el cronómetro arranca con el pago del presupuesto (solo `work_mode = 'diagnosis'`)

## 7. Diagnóstico (por qué ampliar el plan ya cerrado)

- Con el plan de arriba (Fases 1–5, ya en producción), "Llegué al domicilio" dispara **siempre** `updateOrderStatus(order.id, 'in_progress')` — cronómetro arranca, Pausar/Finalizar aparecen, y **todas** las pestañas operativas (Checklist, Tiempo, Materiales, Notas, Firma) quedan visibles de una, incluida Presupuesto activa por defecto.
- Para `work_mode === 'diagnosis'` eso no refleja el proceso real: el técnico llega, **presupuesta**, y recién si el cliente acepta y paga el presupuesto empieza a trabajar. Cronometrar el trabajo desde la llegada (mientras todavía se está armando/negociando el presupuesto) ensucia la métrica de tiempo trabajado y habilita Checklist/Materiales/Notas/Firma antes de que exista un presupuesto pagado.
- Para `work_mode === 'direct'` no hay presupuesto de por medio — la orden ya se acordó de antemano — así que "llegué → in_progress" ya es correcto y no se toca.
- Hallazgo en el historial del repo (migración `20260829041551_technician_acceptance_and_overlap_and_manual_departure.sql`, "Decisión 4"): este mecanismo **ya existió** — un trigger `service_orders_start_execution_after_payment` que arrancaba `in_progress` automáticamente al pagarse el presupuesto — y fue retirado a propósito en favor del arranque manual único ("Salí"). La función que quedó huérfana, `public.start_execution_after_payment_confirmation()`, sigue viva en la base pero sin ningún trigger enganchado (confirmado contra la base real: `pg_trigger` no tiene ninguna fila con `tgfoid` apuntando a esa función). Es decir, el mecanismo de origen sigue disponible para adaptar, no hay que inventarlo de cero.
- El trigger de liquidación (`create_visit_settlement_on_started`) ya exige `status = 'in_progress' AND payment_status = 'paid_in_full'` en su condición `WHEN` — o sea que ya asume implícitamente que para cuando la orden pasa a `in_progress`, el pago está confirmado. Mover el disparo de `in_progress` desde "llegada" hacia "pago del presupuesto" en diagnóstico **lo alinea mejor**, no lo rompe.
- El trigger `prevent_unpaid_execution_timer` (vigente) ya prohíbe `in_progress` en diagnóstico sin `payment_status IN ('deposit_paid','paid_in_full')` — sigue siendo una red de seguridad válida y no hace falta tocarlo.

## 8. Objetivo de esta ampliación

1. Para `work_mode === 'diagnosis'`: "Llegué al domicilio" deja de disparar `in_progress`. Solo registra la llegada (`arrived_at`) y habilita **únicamente** la pestaña Presupuesto (con el resto del panel operativo oculto y un aviso: "Presupuestá el trabajo. El checklist y las demás herramientas se habilitan cuando el cliente acepta y paga el presupuesto").
2. Cuando el cliente acepta y paga el presupuesto (`order_quotes.status = 'accepted'` y `service_orders.payment_status = 'paid_in_full'`, que ya es el flujo existente vía `api/payments/webhook.ts`), un trigger de base de datos —scopeado a diagnóstico— pasa la orden a `in_progress` y arranca `work_started_at` automáticamente, sin que el técnico tenga que tocar nada. En ese momento se habilita el resto del panel (Checklist, Tiempo, Materiales, Notas, Firma).
3. Para `work_mode === 'direct'`: cero cambios. "Llegué" sigue disparando `in_progress` tal cual quedó en la Fase 3.
4. Se preserva el 100% de lo ya probado: `prevent_unpaid_execution_timer`, `create_visit_settlement_on_started`, STRICT COMPLETION de `updateOrderStatus`, RLS.
5. El nuevo evento "llegada en modo diagnóstico" (`arrived_at`) queda como el gancho para el mensaje del ayudante "Llegaste a tiempo técnico, ahora debes presupuestar el trabajo a realizar" (sin cambios respecto a la Nota del punto 6 — sigue siendo el mismo momento conceptual, solo que ahora ya no coincide con el arranque del cronómetro en diagnóstico).

## 9. Diseño técnico

- **Nueva columna** `service_orders.arrived_at timestamptz null` — informativa, igual que `travel_started_at`, no dispara reglas de negocio por sí sola.
- **`src/types/index.ts`**: `arrivedAt?: string` en `ServiceOrder`, junto a `travelStartedAt`.
- **`src/lib/supabase.ts`** / **`database.types.ts`**: `arrived_at: string | null` en `DbServiceOrder` (regenerar tipos vía `mcp__Supabase__generate_typescript_types` igual que se hizo con `travel_started_at`).
- **`src/lib/supabaseData.ts`**: `arrivedAt: row.arrived_at ?? undefined` en `mapOrder()`.
- **`src/lib/supabaseMutations.ts`**: nueva función `persistMarkArrived({ orderId, author })`, calcada de `persistMarkTravelStarted` — solo `update service_orders set arrived_at = now()`.
- **`AppContext.tsx`**: nueva función `markArrived(orderId)` en el context, calcada de `markTravelStarted`.
- **`TechnicianView.tsx` — `handleArrival` pasa a bifurcar por `workMode`**:
  - `workMode === 'direct'` (o `undefined`): comportamiento actual sin cambios — llama a `handleStartOrResumeService` (→ `in_progress`, cronómetro arranca).
  - `workMode === 'diagnosis'`: llama a `markArrived(order.id)` en vez de cambiar status, y hace `setActiveTab('quote')`. La orden queda en `'assigned'` con `arrived_at` seteado.
- **Gating del panel operativo — pasa a tener tres estados** (hoy son dos: antes/después de `in_progress`):
  1. **Aún no llegó** (`!arrivedAt` en diagnóstico, o `!travelStartedAt`/`status==='assigned'` sin llegar en directo): cartel pre-llegada actual, sin pestañas.
  2. **Llegó, diagnóstico, esperando pago** (`workMode==='diagnosis' && arrivedAt && status==='assigned'`): panel reducido — **solo la pestaña Presupuesto**, visible y activa. Debajo o al lado, un aviso: "Checklist, materiales, notas y firma se habilitan cuando el cliente acepta y paga el presupuesto."
  3. **En curso / pausado / completado** (`status IN ('in_progress','paused','completed')`): panel completo actual, sin cambios — Presupuesto sigue siendo la primera pestaña.
  - Para `direct`, el estado 2 nunca aplica (no hay `arrivedAt` sin pasar directo a `in_progress`), así que su recorrido es idéntico al actual: estado 1 → estado 3.
  - Se agrega un `useEffect` que fuerza `activeTab` a `'quote'` mientras se está en el estado 2, para cubrir el caso de refrescar la página con la orden ya en ese estado intermedio (mismo motivo por el que hoy el `useState` inicial ya contempla esto, pero acá hace falta el efecto porque la orden puede *entrar* a este estado sin remount del componente).
- **Nuevo trigger DB, scopeado a diagnóstico** (adaptando la intención de `start_execution_after_payment_confirmation`, sin revivir el trigger viejo genérico):
  - Nombre propuesto: `start_diagnosis_execution_after_payment`.
  - Se dispara `AFTER UPDATE OF payment_status, quote_status ON service_orders`.
  - Condición `WHEN`: `NEW.work_mode = 'diagnosis' AND NEW.status = 'assigned' AND NEW.work_started_at IS NULL AND NEW.quote_status = 'accepted' AND NEW.payment_status = 'paid_in_full'`.
  - Acción: `UPDATE service_orders SET status = 'in_progress', work_started_at = now() WHERE id = NEW.id` (respetando `prevent_unpaid_execution_timer`, que a esta altura ya no objeta nada porque `payment_status = 'paid_in_full'`).
  - Se inserta también un `order_events` con `event_type = 'started'` y autor "sistema" (patrón ya usado en otros triggers automáticos del repo, p. ej. liquidaciones) para que el historial de la orden quede consistente con lo que ve un técnico que dispara `in_progress` a mano.
  - Este trigger es nuevo (nombre y condición propios), no una restauración literal del viejo — el viejo no distinguía `work_mode` y por eso interfería con `direct`; este sí lo distingue, por lo que `direct` sigue sin verse afectado nunca.
- **Nada de esto toca**: `prevent_unpaid_execution_timer`, `create_visit_settlement_on_started`, `isOrderPaymentSettled`, el flujo de pago (`QuoteViewer.tsx`, `paymentClient.ts`, `api/payments/webhook.ts`), ni las reglas STRICT COMPLETION de cierre.

## 10. Riesgo revisado

- **Condición de carrera técnico-vs-cliente**: si el cliente paga *antes* de que el técnico presione "Llegué" (pago adelantado/remoto), el trigger nuevo no dispara nada porque su `WHEN` exige `status='assigned'` — pero también exige que ya no se dispare dos veces: una vez que pasa a `in_progress` por el trigger, `work_started_at` deja de ser `NULL`, así que un segundo `UPDATE` de `payment_status`/`quote_status` (p. ej. reintentos de webhook) no lo vuelve a disparar. Igualmente, si el pago llega antes que la llegada del técnico, no hay ningún problema: el trigger igual pasa la orden a `in_progress` en cuanto se cumplen las condiciones, sin depender de `arrived_at`; el panel del técnico simplemente mostrará el estado 3 (completo) apenas entre, sin pasar por el estado 2. Esto es deseable, no un bug: si ya está todo pagado, no tiene sentido bloquear el checklist esperando un click de "llegué".
- **Reintentos de webhook / updates redundantes**: el trigger es `AFTER UPDATE`, así que un `UPDATE` que no cambie `payment_status` ni `quote_status` ni dispara el trigger; y si los cambia pero la fila ya está en `in_progress`, el `WHEN` (`status='assigned'`) ya lo filtra. No hace falta lógica adicional de idempotencia.
- **Órdenes `direct` no se ven afectadas en ningún escenario**: el `WHEN` filtra por `work_mode='diagnosis'` explícitamente.
- **Tests existentes**: `workTimer.test.ts` y similares no asumen que el cronómetro arranque en un click específico del técnico — ya probamos esto en la Fase 4 original al mover "Salí"→"Llegué"; el mismo razonamiento aplica acá.

## 11. Fases de implementación

- [x] **Fase 6.1** — Migración Supabase: columna `service_orders.arrived_at` (timestamptz, nullable, sin default) aplicada y verificada contra el proyecto real (`ayszrtieplmqscqtabsu`). Las 3 órdenes existentes quedaron con `arrived_at = null`, sin romper nada.
- [x] **Fase 6.2** — Migración Supabase: función + trigger `trg_start_diagnosis_execution_after_payment` (`AFTER UPDATE OF payment_status, quote_status`) aplicados y verificados con `begin;...;rollback;` contra una orden real:
  - Test A (diagnóstico): `assigned`/`deposit_paid`/`sent` → al simular `quote_status='accepted'` + `payment_status='paid_in_full'`, pasó sola a `in_progress` con `work_started_at` seteado, y se insertó 1 evento `order_events` (`type='started'`, `author='Sistema'`).
  - Idempotencia: un update redundante de `payment_status` después de la transición no volvió a disparar el trigger (`status` ya no es `assigned`) — se mantuvo en 1 solo evento del sistema.
  - Test B (directo): la misma orden con `work_mode='direct'` y el mismo tipo de update (`quote_status`/`payment_status`) NO se vio afectada — quedó en `assigned`, `work_started_at` en `null`, 0 eventos del sistema. Confirma que el filtro por `work_mode` aísla correctamente a `direct`.
  - Confirmado el `rollback`: la orden real quedó intacta (`cancelled`/`diagnosis`/`deposit_paid`/`sent`) y 0 eventos `author='Sistema'` reales en la base — ninguna prueba tocó producción.
  - Hallazgo menor: el `WHEN` real de `trg_create_visit_settlement_on_started` es solo `new.status = 'in_progress'` (no exige también `payment_status='paid_in_full'` como decía el resumen previo) — no cambia nada del diseño, porque tanto diagnóstico como directo ya exigen el pago confirmado antes de llegar a `in_progress` vía `prevent_unpaid_execution_timer`.
- [x] **Fase 6.3** — Código implementado y verificado:
  - `src/types/index.ts`: `arrivedAt?: string` en `ServiceOrder`.
  - `src/lib/supabase.ts` + `src/types/database.types.ts`: `arrived_at: string | null` (tipos regenerados desde Supabase live y verificados por hash contra el archivo escrito en el repo).
  - `src/lib/supabaseData.ts`: mapeo `arrivedAt: row.arrived_at ?? undefined` en `mapOrder()`.
  - `src/lib/supabaseMutations.ts`: `persistMarkArrived({ orderId, author })` — solo persiste `arrived_at = now()`, sin evento (a diferencia de `persistMarkTravelStarted`, que sí inserta uno — decisión consciente para no requerir un nuevo valor de enum `order_event_type`).
  - `AppContext.tsx`: `markArrived(orderId)` — con guardas de seguridad (`requireTechnician`), de duplicado (`order.arrivedAt` ya seteado) y de modo (`order.workMode !== 'diagnosis'` corta silenciosamente, ya que esta función es exclusiva de diagnóstico).
  - Verificación: `git diff --ignore-space-at-eol --stat` confirma 61 líneas insertadas, 0 borradas/modificadas en los 6 archivos tocados. `npx tsc --noEmit` sin errores.
- [x] **Fase 6.4** — `TechnicianView.tsx` implementado y verificado:
  - `handleArrival` bifurca por `workMode`: `diagnosis` llama a `markArrived(order.id)` + `setActiveTab('quote')` sin tocar status; `direct` (o sin definir) sigue llamando a `handleStartOrResumeService` sin cambios.
  - Nuevo estado derivado `isDiagnosisAwaitingPayment` (`workMode==='diagnosis' && arrivedAt && status==='assigned'`) + `useEffect` que fuerza `activeTab` a `'quote'` mientras se está en ese estado, para cubrir el caso de que la orden entre a él sin remount (ej. refresh remoto).
  - Panel operativo con gating de tres estados: completo (`in_progress\|paused\|completed`, sin cambios) → reducido (`isDiagnosisAwaitingPayment`: solo pestaña Presupuesto + aviso "Checklist, materiales, notas y firma se habilitan cuando el cliente acepta y paga el presupuesto") → cartel pre-llegada (sin cambios, para el resto de los casos).
  - Confirmado que `QuoteBuilder` no depende de `order.status` (no hay ninguna referencia en el componente), por lo que renderizarlo con la orden todavía en `assigned` es seguro.
  - Botones "Salí"/"Llegué" sin cambios — `isOrderPaymentSettled` en diagnóstico solo exige la seña (`deposit_paid`), que es un concepto distinto del pago completo del presupuesto que dispara el trigger de la Fase 6.2.
  - Verificación: `git diff --ignore-space-at-eol` muestra solo el diff esperado (bifurcación de `handleArrival`, el nuevo estado/efecto, y el nuevo bloque `else if` del panel — nada del resto del archivo tocado). `npx tsc --noEmit` sin errores.
- [x] **Fase 6.5** — Completa. Base de datos + tsc por mí, código/UI/tests reales por Cursor:
  - **Mío**: ciclo completo de una orden de diagnóstico simulado con `begin;...;rollback;` contra una orden real (pre-visita → "Llegué" → pago del presupuesto → auto `in_progress` → checklist/firma/tiempo → `completed`), sin errores, `rollback` confirmado sin dejar rastro. `tsc --noEmit` limpio.
  - **Cursor, contra la app real corriendo**: `tsc --noEmit` limpio; `npm run test` — **143 tests pasados (19 archivos)**, incluye `workTimer.test.ts`; `npm run build` compiló sin errores (solo el aviso preexistente de chunk >500kB). Click-through completo en una orden de diagnóstico real: "Salí" sin cronómetro ni Pausar/Finalizar → "Llegué" (`arrived_at` seteado, sigue `assigned`, panel reducido con solo Presupuesto y el aviso exacto) → presupuestó y envió → simuló el pago (sin sandbox de Mercado Pago local) → el trigger pasó la orden sola a `in_progress` con cronómetro corriendo → panel completo habilitado, aviso de espera desaparecido → checklist + firma + cierre sin error. Repitió el ciclo corto en una orden `direct`: recorrido idéntico al de antes de esta fase, `arrived_at` nunca se setea (no usa `markArrived`), sin pestaña Presupuesto ni aviso.
  - **Bug real encontrado y corregido**: el botón "Llegué al domicilio" no miraba `arrivedAt` en su condición, así que quedaba visible y clickeable durante toda la espera del pago (en diagnóstico). Aunque `markArrived` en `AppContext.tsx` ya es idempotente (corta si `order.arrivedAt` ya está seteado, así que no rompía nada a nivel de datos), era un bug de UX real. Se agregó `&& !activeOrder.arrivedAt` a la condición del botón en `TechnicianView.tsx`. Verificado con `tsc --noEmit` (limpio) y `git diff --stat` (solo +1/-1 en esa línea, nada más tocado). No afecta a `direct` (nunca setea `arrivedAt`, así que la condición se comporta igual que antes).
- [x] **Fase 6.6** — Cierre: ampliación completa, verificada de punta a punta (base de datos, tipos, código, tests, build y click-through real) y commiteada junto con el código en un solo commit acotado a este cambio.
