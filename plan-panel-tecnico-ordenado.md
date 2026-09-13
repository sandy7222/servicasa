# Plan: ordenar el panel principal del técnico ("Terminal de Campo")

## 1. Contexto

Charla con Sandy del 13/9/2026: pidió ordenar el aspecto visual de las cuentas, sobre
todo la del técnico, usando a María Rodríguez (la cuenta de prueba con más operaciones)
como caso real. Mirando juntos capturas de su panel en vivo, señaló el problema concreto:
un trabajo ya FINALIZADO/Cerrado hacía días seguía apareciendo como protagonista en el
panel principal ("ÓRDENES ASIGNADAS (1)"), y preguntó qué debería pasar con un evento que
ya pasó, para que el técnico pueda abrir el panel a la mañana y ver de un vistazo qué
tiene que hacer hoy.

## 2. Diagnóstico

`assignedOrders` en `TechnicianView.tsx` filtraba únicamente por
`assignedTechnicianId`, sin mirar el estado (`assigned` / `in_progress` / `paused` /
`completed` / `cancelled`). Esa misma lista alimentaba tanto el listado de la izquierda
como la selección automática del pedido activo (`selectedOrderId` por defecto = primer
elemento del array). Resultado: un trabajo cerrado podía quedar mezclado con lo
pendiente, e incluso ser el que se muestra por defecto al entrar.

Ya existía una página dedicada a lo histórico (`/technician/history`,
`WorkHistoryView.tsx`), con su propio filtro por estado y su propio detalle
(checklist, materiales, notas, firma) en un acordeón — ya enlazada tanto en el menú de
escritorio como en la barra de accesos rápidos de celular. No hacía falta construir
nada nuevo, solo dejar de duplicar esos datos en el panel principal.

Este comportamiento no era específico de la cuenta de María Rodríguez — es el mismo
componente para todos los técnicos, así que a cualquier técnico con al menos un trabajo
cerrado le pasaba (o le va a pasar) lo mismo.

## 3. Cambio

En `src/views/TechnicianView.tsx`:

- `allAssignedOrders`: todas las órdenes del técnico (como antes), sin filtrar.
- `assignedOrders`: ahora es `allAssignedOrders` filtrado a los estados activos
  (`assigned`, `in_progress`, `paused`). Esta es la lista que alimenta el listado de la
  izquierda y la selección automática del pedido activo — por lo tanto un trabajo
  finalizado o cancelado deja de aparecer ahí y de robar el foco por defecto.
- `hasFinishedOrders`: indica si el técnico tiene algo en su historial, para distinguir
  dos casos en el estado vacío del panel:
  - Sin nada asignado nunca → mensaje original ("¡Al día! No tenés órdenes pendientes",
    "Cuando te asignen una orden nueva, va a aparecer acá").
  - Sin nada activo pero con historial → "¡Todo al día! No tenés trabajos activos", con
    un botón "Ver historial de trabajos" que navega a `/technician/history`.

No se tocó nada de `WorkHistoryView.tsx` (ya cumplía su función) ni la lógica del panel
de detalle a la derecha (`activeOrder`), que sigue pudiendo mostrar una orden completada
cuando corresponde (por ejemplo, justo después de que el cliente firma la conformidad).

## 4. Alcance y lo que queda para después

- Este cambio resuelve puntualmente el "escritorio con papeles sueltos" que más ruido le
  hacía a Sandy: el trabajo cerrado que no se iba nunca del panel principal.
- Quedan pendientes, a definir con Sandy, otras mejoras visuales/de orden del panel del
  técnico (y después del cliente) que puedan surgir de seguir mirando el panel juntos.

## 5. Verificación

- `tsc --noEmit` limpio.
- `git diff --stat` confirmó que el único archivo tocado fue
  `src/views/TechnicianView.tsx`, sin arrastrar el ruido de CRLF/LF ni los cambios
  preexistentes sin commitear de otros archivos del repo.
