# Plan: Ayudante técnico (mascota guía en la Terminal de Campo)

> **Estado: en pausa.** Quedó de lado la idea de video por instancia (ver charla) a favor de imagen
> + texto. Antes de retomar la implementación, falta que reúnas las 8-10 poses/momentos del
> personaje a lo largo de la visita del técnico (asignación, viaje, llegada, presupuesto, pago,
> trabajo, pausa, firma, etc.). Con esa lista completa se arma un roadmap nuevo con todos los
> escenarios de una — este documento (pensado solo para un escenario suelto) queda como referencia
> de las decisiones técnicas ya tomadas (secciones 2, 4 y 5), no como el plan final de fases.

## 1. Qué es

Personaje animado (mascota TecniUrbano, gorra con logo casa+llave, ropa de trabajo) que aparece en
la esquina inferior derecha de la Terminal del Técnico, dice un mensaje corto y se desvanece solo,
sin bloquear la operación. Nunca queda fijo en pantalla tapando algo.

Es un componente distinto y separado del "Asistente de diagnóstico" (`DiagnosisAssistant.tsx`), que
ya existe hoy pero es para el **cliente** (arma el pedido de servicio). Personaje, componente y
assets propios — no se comparte nada entre los dos para no mezclar roles ni marcas visuales.

## 2. Decisiones tomadas (para no frenar el arranque)

- **Imagen estática + globo de texto, no video embebido.** Cada mp4 pesa ~5.7 MB; con 9-10 poses a
  lo largo de toda la visita serían 50+ MB para una app que el técnico abre en el celular con datos
  móviles — no es viable. Con imagen (PNG) + texto, cada pose pesa unos KB, se puede seguir
  animando (aparece/se desvanece) con CSS, y el mensaje se ajusta sin regrabar nada.
- **Sin audio**, por ahora: mantiene consistencia entre poses (no todas tendrían audio grabado) y
  evita problemas de autoplay de audio en navegadores móviles.
- **Ciclo**: aparece → se mantiene visible mientras "habla" (~7s) → se desvanece solo. Tocarlo lo
  cierra antes. `pointer-events` solo en el propio globo/avatar, nunca tapa clicks reales.
- **Interruptor on/off para el técnico**: preferencia local por dispositivo, mismo patrón que ya usa
  el tema claro/oscuro (`localStorage`, ver `src/lib/theme.ts`) — no hace falta columna nueva en la
  base ni sincronizar entre dispositivos. El técnico lo prende/apaga desde su perfil. Por defecto:
  activado.
- **Arte**: arranca con un recorte placeholder de tu primer video (fondo blanquecino, no
  transparente) solo para poder armar y probar la mecánica. En cuanto pases el PNG con fondo
  transparente, se reemplaza el archivo — no hay que tocar lógica.

## 3. Alcance de esta fase vs. lo que queda para después

Lo que describiste es una mascota que acompaña las ~9-10 instancias de toda la visita (asignación,
viaje, llegada, presupuesto, pago, trabajo, pausa, firma...). Esa es la visión completa, pero
definir cada mensaje y el momento exacto de cada disparo es diseño de producto que conviene hacer
con vos escenario por escenario, no de una sola vez.

Por eso esta Fase 1 construye la **mecánica general** (componente reutilizable, arquitectura de
"escenarios" con pose + mensaje + condición de disparo, toggle on/off) y la aplica a **un solo
escenario ya acordado**: recordatorio de aceptar/rechazar una orden pendiente, al entrar a la
Terminal. Las fases siguientes suman escenarios nuevos (viaje, llegada, presupuesto enviado, pago
confirmado, etc.) reusando la misma mecánica, cada uno confirmado con vos antes de escribirlo —
ahí es donde probablemente entren tus otras poses.

## 4. Diseño técnico

### 4.1 Componente nuevo

- `src/components/technician/AyudanteTecnico.tsx` — mascota + globo, `fixed bottom-4 right-4`.
- Props: `message: string`, `visible: boolean`, `onDismiss: () => void` (más adelante, si hace falta
  variar la pose, se agrega `pose?: string`).
- Wrapper: `fixed bottom-4 right-4 z-[60] pointer-events-none` (por debajo del `z-[70]` del
  Asistente de diagnóstico, como red de seguridad si alguna vez coincidieran en pantalla — en la
  práctica no debería pasar porque uno es para clientes y el otro para técnicos).
- Imagen: `src/assets/technician/ayudante-placeholder.png` (a reemplazar cuando llegue el arte
  final).
- Animación: transición CSS de opacity/transform (fade + slide-up al aparecer, fade-out al
  desvanecer), sin librería nueva.
- Auto-dismiss: `setTimeout` de 7000ms → `onDismiss`; tap en el globo llama `onDismiss` antes.

### 4.2 Arquitectura de "escenarios" (pensada para extenderse)

`src/lib/ayudanteTecnico.ts`:

- `getAyudanteEnabled(): boolean` / `setAyudanteEnabled(value: boolean): void` — `localStorage`,
  clave `tecnicourbano_ayudante_enabled`, default `true` si no hay valor guardado (mismo patrón que
  `theme.ts`).
- Escenario 1, ya definido: `getPendingResponseMessage(assignedOrders): string | null` — devuelve el
  texto si hay alguna orden con `technicianResponseStatus === 'pending'`, o `null` si no.
- Queda comentado en el archivo que los próximos escenarios se suman como funciones hermanas de
  `getPendingResponseMessage`; con uno solo no hace falta todavía un sistema de prioridades.

### 4.3 Disparo en `TechnicianView.tsx`

- `hasShownEntryReminderRef = useRef(false)` + `const [ayudanteMessage, setAyudanteMessage] =
  useState<string | null>(null)`, declarados junto al resto de los hooks del componente (después de
  los `return` tempranos de las sub-rutas de perfil/ganancias/historial/etc., mismo lugar que el
  resto del estado).
- `useEffect` guardado por el ref (dispara una sola vez por entrada real a esta vista): si
  `getAyudanteEnabled()` y hay una orden con `technicianResponseStatus === 'pending'` en
  `assignedOrders`, arma el mensaje con `getPendingResponseMessage` y lo muestra; marca el ref para
  no repetir.
- Render, solo en la vista base (las sub-vistas ya retornaron antes de llegar acá):
  `{ayudanteMessage && <AyudanteTecnico message={ayudanteMessage} visible onDismiss={() =>
  setAyudanteMessage(null)} />}`.

### 4.4 Toggle on/off

En `ProfessionalProfile.tsx`, nueva sección chica (mismo estilo `rounded-xl border ... p-4` que las
demás secciones de esa pantalla): "Ayudante técnico" con un switch que lee/escribe
`getAyudanteEnabled` / `setAyudanteEnabled`.

## 5. Qué NO cambia

- No toca `DiagnosisAssistant.tsx`, sus assets, ni ningún flujo de pago/cronómetro/checklist ya
  existente.
- No agrega columnas ni migraciones a Supabase — todo el estado nuevo es de cliente (`localStorage`
  + estado de React).

## 6. Fases

- [ ] Fase 1.1 — Asset: copiar el placeholder recortado a `src/assets/technician/ayudante-placeholder.png`.
- [ ] Fase 1.2 — `src/lib/ayudanteTecnico.ts`: toggle localStorage + `getPendingResponseMessage`, con tests unitarios.
- [ ] Fase 1.3 — `src/components/technician/AyudanteTecnico.tsx`: mascota + globo + animación + auto-dismiss + tap-to-dismiss.
- [ ] Fase 1.4 — `TechnicianView.tsx`: disparo (ref + effect) + render condicional.
- [ ] Fase 1.5 — `ProfessionalProfile.tsx`: switch on/off.
- [ ] Fase 1.6 — Verificación: `tsc --noEmit`, tests nuevos + suite completa, revisión de diff, y (Cursor/vos en Windows) click-through real: orden pendiente → aparece el mensaje → se desvanece solo o al tocar → apagar el toggle → recargar → ya no aparece.
- [ ] Fase 1.7 — Cierre: commit acotado a este cambio.
