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
