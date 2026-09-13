# Plan: reorganizar la navegación del técnico (Ajustes = "mi cuenta")

## 1. Contexto

Siguiendo la limpieza visual del panel del técnico (charla del 13/9), al sacar
"Apariencia" de Ajustes quedó casi vacío, y Sandy preguntó qué más podía ir
ahí — propuso "Mi perfil", "Zona de trabajo" y "Disponibilidad", que hoy viven
sueltos como 3 de los 8 botones amontonados en la fila propia de la pantalla
"Técnico" (Terminal de Campo).

Revisando esa fila de 8 botones (Mi perfil, Mis ganancias, Historial,
Estadísticas, Zona de trabajo, Disponibilidad, Reclamos, Conversaciones) se
encontró además que "Conversaciones" es un duplicado exacto de "Mensajes" del
menú de arriba (mismo destino, `/technician/conversaciones`) — doble
navegación para llegar al mismo lugar.

## 2. Cambio

**`src/views/SettingsView.tsx`**: se saca la tarjeta "Apariencia" (ver
`plan-header-avatar.md` / commit `ae3b87b` — quedó redundante desde que el
toggle de tema vive siempre visible en el header). En su lugar, solo para
`currentUser.role === 'technician'`, una tarjeta nueva "Mi cuenta" con 3 filas
clickeables que llevan a las mismas pantallas de siempre (no se tocó ninguna
de esas 3 pantallas, solo el acceso): Mi perfil, Zona de trabajo,
Disponibilidad.

**`src/views/TechnicianView.tsx`**: de la fila propia de la Terminal de Campo
(botones de escritorio y la tira de accesos rápidos de celular) se sacan Mi
perfil, Zona de trabajo, Disponibilidad (se mudan a Ajustes) y Conversaciones
(duplicado de Mensajes). Queda con 4: Mis ganancias, Historial, Estadísticas,
Reclamos — los que tienen que ver con el trabajo en sí, no con la cuenta.

## 3. Alcance

- No se tocó ninguna de las pantallas de destino (`ProfessionalProfile`,
  zona de trabajo, disponibilidad, reclamos, etc.) — solo desde dónde se
  accede a ellas.
- Cambio pensado para técnico; no afecta la navegación de cliente ni admin
  más que la desaparición de "Apariencia" (que para ellos tampoco tenía
  reemplazo, sigue en el header).

## 4. Verificación

- `tsc --noEmit` limpio.
- `git diff` revisado a mano: los 8 botones/entradas quedaron en 4 en
  `TechnicianView.tsx`, y `SettingsView.tsx` sumó la tarjeta nueva
  gateada por rol sin tocar el resto de la pantalla.
