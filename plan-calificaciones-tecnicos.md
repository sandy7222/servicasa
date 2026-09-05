# Plan: Sistema de calificaciones de técnicos — TecniUrbano

Rama sugerida: `feature/calificaciones-tecnicos`, a partir de la rama principal activa.

## 1. Diagnóstico (estado actual, revisado en el repo)

- `technicians.rating` existe como columna numérica, pero es un valor **estático**: se fija en `5` por defecto al autoregistrarse el técnico (`supabaseMutations.ts` líneas 399 y 427, `AppContext.tsx` líneas 2094/2130) y nunca se recalcula.
- `technician_public_view` expone ese `rating` al cliente. `src/components/client/AssignedTechnicianCard.tsx` lo muestra como estrellas + `completed_orders_count`.
- **No existe ningún flujo para que el cliente califique un trabajo terminado** — no hay tabla, columna, endpoint ni UI para eso. Se confirmó por búsqueda en `src`, `supabase`, `api` (sin resultados para `order_review`, `service_rating`, `feedback`, etc.).
- El modal de asignar técnico (`AdminHubView.tsx`, ~línea 3703, componente del modal `ASSIGN TECHNICIAN`) **no muestra ni ordena por rating** — lista técnicos solo por nombre/especialidad/elegibilidad de requisitos. Las tarjetas del directorio de técnicos sí muestran `Rating {t.rating}` (~línea 2253), hoy el 5.00 estático.
- `technician_review_history` existe, pero es el historial de **validación admin de requisitos** (matrícula, monotributo, etc.), no estrellas de cliente. La firma de conformidad (`order_signatures`) tampoco es una calificación: es el requisito para pasar la orden a `completed`.
- Ya existe un sistema separado de **incidencias/reclamos** por orden (`reportOrderIncident`, modal `orderForIncident` en `AdminHubView.tsx`, con opción de pausar liquidación). Ese sistema queda **fuera de este plan** — es el canal correcto para hechos concretos (no-show, fraude, etc.), separado de la percepción subjetiva vía estrellas.

## 2. Objetivo

1. El cliente puede calificar (1–5 estrellas + comentario opcional) al técnico una vez cerrada la orden.
2. `technicians.rating` deja de ser un valor fijo y refleja el desempeño real, calculado para que:
   - un técnico sin trabajos no aparezca con una reputación "perfecta" falsa de cara al cliente,
   - una calificación aislada (un cliente de mal día) no hunda ni infle el número de un técnico con historial,
   - el promedio pueda **subir de nuevo** si el técnico sigue rindiendo bien después de una mala racha (no es un contador que solo resta).
3. El admin puede ver y ordenar por reputación al asignar un trabajo, sin que se le saque el criterio manual (zona, disponibilidad, especialidad).
4. El técnico puede ver su propia tendencia de calificación, no solo un número aislado.
5. Cero ruptura de lo ya probado (asignación, liquidación, incidencias).

## 3. Decisiones de producto — Fase 0 (CONFIRMADO)

| Parámetro | Valor confirmado | Motivo |
| --- | --- | --- |
| Fórmula | Promedio ponderado bayesiano + ventana móvil | Ver fórmula abajo |
| `P` (peso del colchón inicial en 5★) | `4` | Con pocos trabajos reales, el colchón amortigua; con muchos, casi no pesa |
| `N` (ventana de trabajos recientes considerados) | últimos `25` | Un técnico que mejora sostenidamente puede recuperar reputación; una mala racha vieja no queda pegada para siempre |
| Umbral para mostrar estrellas reales | `≥ 3` trabajos calificados; antes se muestra badge "Nuevo" | Evita mostrar un número no confiable por poca muestra. El badge aplica a cliente, admin (directorio + modal asignar) y estadísticas del técnico: hasta la primera calificación `technicians.rating` sigue en 5.00 |
| ¿El cliente puede editar su calificación? | Sí, hasta 48 h después de enviarla | Cubre error de click sin abrir la puerta a revisiones eternas |
| Plazo para la *primera* calificación | 30 días desde `completed_at`; después no se inserta | Sin techo, un cliente podría calificar un trabajo viejo y entrar en la ventana de los últimos N. 30 días alinea con la garantía de la landing |
| ¿Calificar es obligatorio? | No — opcional, con un recordatorio (push/in-app) | Forzarlo genera calificaciones apuradas o de mala gana en el checkout |
| ¿Impacta la calificación baja en la elegibilidad del técnico automáticamente? | No — solo es un dato visible para el admin. Las consecuencias reales (suspensión, etc.) siguen pasando por el sistema de incidencias existente | Separa percepción subjetiva (ruidosa) de hechos verificados |
| Alcance del número | Un `technicians.rating` **global** por técnico, no por especialidad | `technician_specialties` es N:M; el rating es una sola columna. Per-rubro queda fuera de v1 |
| Órdenes calificables | Solo `status = 'completed'` (incluye cierre excepcional de admin). `cancelled` no se califica | La visita de diagnóstico con presupuesto rechazado queda `cancelled` y no entra. Sin técnico asignado, no se inserta |
| Borrado de cliente | `order_ratings.customer_id … ON DELETE RESTRICT` | Coherente con `service_orders.customer_id`. La estrella no desaparece. Una baja GDPR futura anonimiza (`customer_id` null + comentario vacío) y **conserva** `stars` |

**Fórmula confirmada:**

```
rating_actual = (P × 5 + Σ estrellas de los últimos N trabajos calificados)
                ────────────────────────────────────────────────────────────
                (P + cantidad de trabajos calificados considerados, hasta N)
```

Con P=4 y N=25. El recálculo usa los últimos N por `created_at` de `order_ratings`.

**Reglas de producto cerradas (casos borde, van a RLS/trigger en Fase 1):**

1. Una calificación por orden (`unique(order_id)`). El `technician_id` se snapshotea en el INSERT desde `assigned_technician_id`. Si una orden `completed` se reasigna y vuelve a `assigned`, no se califica hasta que vuelva a `completed`.
2. `completed_orders_count` no es el umbral de "Nuevo"; se usa `total_ratings_count`.
3. Una orden archivada (`hidden_from_customer_at`) sigue pudiendo calificarse/editarse dentro de ventana si cumple el resto de reglas.
4. No hay calificación por token de guest: al asignar técnico ya hay cuenta autenticada.
5. `lock_technician_admin_fields` hoy revertiría un recálculo disparado por el cliente: la función de recálculo de Fase 1 tiene que ser `SECURITY DEFINER` (o el lock tiene que dejar pasar ese update). `persistUpdateTechnician` debe dejar de escribir `rating` cuando el número pase a ser calculado.

## 4. Modelo de datos — Fase 1

```sql
create table order_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references service_orders(id) on delete restrict,
  technician_id uuid not null references technicians(id) on delete restrict,
  customer_id uuid not null references customers(id) on delete restrict,
  stars smallint not null check (stars between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  unique (order_id) -- una calificación por orden
);

-- RLS: solo el dueño (customer) de la orden puede insertar/editar.
-- INSERT: orden completed, con técnico asignado, dentro de 30 días
-- desde completed_at. UPDATE: solo dentro de 48h desde created_at.
```

- Trigger `after insert or update on order_ratings` → recalcula `technicians.rating` con la fórmula de la Fase 0 usando los últimos `N` registros de `order_ratings` de ese técnico.
- Agregar `total_ratings_count` a `technician_public_view` (para que el frontend sepa cuándo mostrar "Nuevo" vs estrellas reales).
- Test de RLS nuevo en `supabase/tests/`, mismo formato que `settlements_payout_rls.sql`.

## 5. Fases

### Fase 0 — Decisiones de producto
- [x] Confirmar P=4, N=25, umbral "Nuevo"=3, edición 48h, primera calificación 30 días, opcional, rating global, solo `completed` (tabla de la sección 3)

### Fase 1 — Modelo de datos y backend (CERRADA 5/9/2026)
- [x] Migración: tabla `order_ratings` + RLS (`supabase/migrations/20260905180041_add_order_ratings_and_technician_rating_recalc.sql`)
- [x] Función/trigger de recálculo de `technicians.rating`
- [x] `total_ratings_count` en `technician_public_view`
- [x] Test RLS (`supabase/tests/order_ratings_rls.sql`) — 15/15 OK, corrido contra el proyecto dev
- [x] Fix de `lock_technician_admin_fields` (ver punto 10 de los casos borde, abajo) + migración de higiene `20260905180200_revoke_public_execute_order_ratings_triggers.sql`
- [x] Frontend: `persistCreateTechnician`/`persistUpdateTechnician` (`src/lib/supabaseMutations.ts`) dejan de escribir `rating` — lo hacía el form de alta/edición del admin, que no tiene campo de rating, así que `input.rating` siempre era `undefined` y cada edición de perfil pisaba el rating real calculado con 5.00. `src/types/database.types.ts` regenerado (incluye `order_ratings` y `total_ratings_count`).

**Hallazgo real durante la implementación (no era solo teórico):** el punto 10 de los
casos borde decía "SECURITY DEFINER" como posible arreglo para que el recálculo no
se revierta. Se verificó en el código real de `lock_technician_admin_fields()` que
esto NO alcanza: `is_admin()` depende de `auth.uid()`, que viaja con la sesión (el
JWT), no con el `SECURITY DEFINER` de la función que ejecuta el UPDATE. Sin fix
adicional, el INSERT del cliente se guardaba en `order_ratings` pero
`technicians.rating` quedaba pisado en silencio, sin ningún error. Fix real: una
bandera de transacción (`set_config('app.rating_recalc', 'on', true)`) que
`lock_technician_admin_fields` respeta. Verificado end-to-end con RLS real
(no como superusuario) en el test: María pasó de 5.00 a 4.17 tras dos
calificaciones reales de cliente.

**Bug de frontend encontrado al cerrar Fase 1:** ningún componente de UI del admin tiene un campo para editar `rating` a mano, pero `persistCreateTechnician`/`persistUpdateTechnician` igual mandaban `rating: input.rating ?? 5` en el `insert`/`update`. Como `input.rating` nunca lo llena el form, cada vez que el admin editaba nombre/teléfono/zona de un técnico, el `update` reescribía `rating` a `5` — pisando en silencio cualquier valor ya calculado por el trigger de Fase 1. Corregido: ambas funciones dejan de tocar `rating`. Verificado con `tsc --noEmit` limpio; `npx vitest run` no se pudo correr en el sandbox de este agente por un problema ajeno (`@rollup/rollup-linux-x64-gnu` no resuelve en este entorno) — recomendable correrlo en un entorno normal (Windows/CI) antes de dar por cerrado del todo.

### Fase 2 — Flujo del cliente (CERRADA 5/9/2026, commit `7703b62`)
- [x] Disparo del pedido de calificación: sin sistema de notificaciones nuevo (no existía) — el widget aparece directo al abrir el detalle de una orden `completed` (`src/views/CustomerView.tsx`)
- [x] `src/lib/orderRatings.ts` + `src/components/client/OrderRatingCard.tsx`: estrellas + comentario opcional (alta hasta 30 días post-cierre; edición dentro de 48h; solo lectura después), ventanas replicadas del lado del cliente para no ofrecer un submit que la RLS va a rechazar
- [x] `AssignedTechnicianCard.tsx`: badge "Nuevo" para técnicos con `total_ratings_count < 3`

### Fase 3 — Vista del admin (CERRADA 5/9/2026)
- [x] `total_ratings_count` en el catálogo admin (`fetchCatalog` pide a `technician_public_view` solo si `isAdmin`, merge sin tocar `TECHNICIAN_COLUMNS_*`)
- [x] Modal de asignar técnico y directorio: badge "Nuevo" o `rating · N calificaciones` (`TechnicianRatingBadge`)
- [x] Orden "Mejor rating" (nuevos al final, después rating desc, empate por nombre — así un 5.00 sin reseñas no le gana a un 4.7 con historial) + filtro "Solo con calificación real", default Nombre al abrir el modal. Sin auto-asignación: `assignTechnician` y la elegibilidad no cambiaron

### Fase 4 — Vista del técnico (CERRADA 5/9/2026)
- [x] `TechnicianStatisticsView.tsx`: badge "Nuevo" bajo 3 calificaciones; con 3+, rating público + cantidad
- [x] Sparkline de las últimas 25 estrellas crudas (sin el colchón bayesiano) + tendencia Mejorando/En baja/Estable comparando promedio de las últimas 5 vs. las 5 anteriores — solo con 10 calificaciones reales o más (bug encontrado y corregido antes del commit: el guard inicial dejaba comparar con una ventana "anterior" incompleta de 1 a 4 calificaciones entre 6 y 9 totales, dando una tendencia engañosa con muy poca muestra)
- [x] Comentarios recientes (hasta 8, más nuevos primero, sin nombre del cliente)

### Fase 5 — Anti-abuso / QA (CERRADA 5/9/2026)
- [x] TEST 16 agregado a `supabase/tests/order_ratings_rls.sql`: un segundo `INSERT` del dueño real sobre una orden ya calificada falla por `unique_violation` (23505), no por RLS — confirma que la constraint de tabla es la última línea de defensa, no solo la policy
- [x] Re-corrida completa contra el proyecto dev en un solo `BEGIN…ROLLBACK`: 16/16 OK (nada persistido)
- [x] `npx vitest run` completo: 143/143. `npm run build`: OK (Vite 6.4.3, único warning preexistente de tamaño de chunk, no nuevo)
- [x] `get_advisors` security y performance: 0 ERROR. Hallazgos nuevos atados a `order_ratings` (ninguno bloqueante): 2 INFO por FKs sin índice de cobertura (`customer_id`, `technician_id`) y 3 WARN `auth_rls_initplan` (las policies de `order_ratings` re-evalúan `auth.uid()`/`current_setting()` por fila en vez de `(select auth.uid())`) — queda pendiente para una fase de performance futura, no bloquea v1

## 6. Fuera de alcance (v1)

- Detección automática de patrones de calificación sospechosos (mismo cliente calificando siempre igual, etc.) — paranoia prematura para el volumen actual; queda para si aparece un caso real.
- Auto-asignación de trabajos por reputación sin intervención del admin.
- Rating por especialidad (un número por rubro).
- Calificar visitas de diagnóstico cuyo presupuesto fue rechazado (orden `cancelled`).
- Calificación por token de guest checkout.
- Baja GDPR / anonimizado de `customer_id` (v1 deja `ON DELETE RESTRICT`).
- Cualquier acción automática (suspensión, alerta) disparada solo por rating bajo — eso sigue siendo dominio del sistema de incidencias existente.

## 7. Seguimiento

| Campo | Valor |
| --- | --- |
| Fase activa | **Ninguna — plan v1 completo.** Fases 0 a 5 cerradas y verificadas el 5/9/2026 contra el proyecto dev `ayszrtieplmqscqtabsu` |
| Bloqueador principal | Ninguno. Pendiente no bloqueante: 3 policies de `order_ratings` con `auth_rls_initplan` (WARN de performance, ver Fase 5) |
| Sistemas relacionados (no tocar en este plan) | Incidencias/reclamos (`reportOrderIncident`), liquidaciones |
