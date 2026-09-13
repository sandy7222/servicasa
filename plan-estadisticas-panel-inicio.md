# Plan: Estadísticas como panel de presentación del día a día

## 1. Contexto

Cerrando el ciclo de "cómo empieza el técnico su mañana" (charla del 13/9):
una vez que el panel principal deja de mostrar trabajos ya cerrados (ver
`plan-panel-tecnico-ordenado.md`), Sandy propuso que el estado "no tengo nada
pendiente" no sea solo un cartel vacío, sino que directamente muestre "Mis
estadísticas" (trabajos completados/activos, tasa de finalización, tiempo
promedio, calificación, tasa de aceptación, comentarios recientes) como forma
de que el técnico vea todos los días cómo viene — y que si tiene una
propuesta de servicio esperando aprobación, esa siga apareciendo primero.

Esto último ya queda garantizado por el filtro que se hizo antes: una orden
`assigned` pendiente de aceptar sigue contando como "activa", así que
`assignedOrders` no está vacío mientras haya algo así, y el panel operativo
(no las estadísticas) sigue siendo lo que se ve.

## 2. Cambio

- Se extrajo el contenido de "Mis estadísticas" (grilla de métricas +
  calificación + tasa de aceptación + comentarios recientes) a un componente
  nuevo y reusable, `src/components/technician/TechnicianStatsSummary.tsx`
  — mismo código y mismos textos que ya existían en
  `TechnicianStatisticsView.tsx`, sin el layout de página (eso lo decide
  quien lo use).
- `TechnicianStatisticsView.tsx` (la pantalla dedicada, en
  `/technician/statistics`) ahora es solo el header con el botón de volver +
  `<TechnicianStatsSummary />` — sigue existiendo igual que antes para cuando
  el técnico quiere consultarla sin perder el contexto de un trabajo activo.
- `TechnicianView.tsx`: cuando `assignedOrders.length === 0` **y** el técnico
  ya tiene historial (`hasFinishedOrders`), debajo del cartel "¡Todo al día!"
  se muestra `<TechnicianStatsSummary />` — el panel principal pasa a ser
  la foto del día. Si el técnico es nuevo y todavía no tuvo ninguna orden,
  se deja el cartel simple como estaba (no hay estadísticas significativas
  que mostrar todavía).

## 3. Alcance

- No se duplicó ningún cálculo ni texto — es el mismo componente en los dos
  lugares.
- No se tocó la pantalla `/technician/statistics` en su función, solo se
  reorganizó internamente.

## 4. Verificación

- `tsc --noEmit` limpio en todo el proyecto.
- `git diff` revisado a mano: el contenido de
  `TechnicianStatisticsView.tsx` se movió tal cual a
  `TechnicianStatsSummary.tsx` (mismo JSX, mismos textos), sin cambios de
  comportamiento.
- No se pudo correr la suite de vitest en este entorno (falta el binario
  nativo de rollup para Linux en el `node_modules` instalado desde Windows —
  limitación preexistente del entorno, no de este cambio); el test existente
  `TechnicianStatisticsView.test.tsx` sigue mockeando los mismos módulos con
  las mismas rutas relativas, así que debería seguir pasando igual al
  correrlo desde Windows.
