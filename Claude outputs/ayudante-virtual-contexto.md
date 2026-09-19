# Ayudante virtual del técnico — contexto para retomar la construcción

Documento de traspaso para Grok. Resume qué es esta funcionalidad, qué existe hoy en el código, qué falta, y por qué se decidió pausarla el 17/9/2026 en vez de construirla ese mismo día.

## 1. Propósito

Un personaje/mascota que aparece brevemente en la pantalla del técnico, con un globo de diálogo, al estilo de los pop-ins de tutorial de juegos como Clash of Clans o Plants vs Zombies: da una indicación puntual de cómo seguir en ese momento del trabajo, y desaparece solo — no queda como un panel fijo ni un modal que hay que cerrar a mano.

Objetivo de negocio: que el técnico no se pierda en la lista de tareas de un servicio (checklist, presupuesto, materiales, firma), y como parte de profesionalizar y estandarizar cómo se hace un trabajo en la plataforma.

Requisito explícito: tiene que poder **apagarse**. Un técnico con experiencia no necesita que le expliquen cada paso — la idea es que sea útil para alguien que recién se suma (por ejemplo, los contactos cargados en `prospective_technicians` que se van dando de alta), sin resultar molesto para los que ya conocen el flujo.

## 2. Qué existe hoy en el código (y nada más que esto)

Se buscó en todo `src/` cualquier rastro de un componente, ícono, globo de diálogo o lógica de disparo — no hay nada. Lo único construido es el campo donde se guardaría qué tips ya vio cada técnico:

- Columna en la base: `technicians.tutorial_tips_seen` (array de texto).
- Tipo en frontend: `Technician.tutorialTipsSeen?: string[]` — `src/types/index.ts:405`.
- Mapeo de lectura: `src/lib/supabaseData.ts:76` → `tutorialTipsSeen: row.tutorial_tips_seen ?? []`.

Ese campo es justamente para que, si un tip ya se mostró y el técnico lo descartó, no vuelva a aparecer aunque cambie de celular o de navegador (queda guardado del lado del servidor, no en localStorage). Pero hoy nada lo lee para decidir si mostrar o no un tip, y nada lo escribe cuando se descarta uno — es un gancho preparado, sin la funcionalidad enganchada todavía.

## 3. Qué falta construir (todo lo demás)

1. **El componente visual**: el personaje/avatar flotante + su globo de diálogo. Estilo y tono a definir (coherente con el resto de la marca TecniUrbano).
2. **Los puntos de disparo**: en qué pantalla/momento exacto aparece cada tip. Esto tiene que mapearse contra las pantallas ya definitivas (ver sección 5 — hoy varias siguen cambiando).
3. **El contenido**: el texto de cada tip, en criollo, breve, accionable ("Tocá acá para...", no explicaciones largas).
4. **Lógica de descarte**: al cerrar o interactuar con un tip, agregar su id a `tutorial_tips_seen` vía Supabase (update del registro del técnico), para que no vuelva a aparecer.
5. **El toggle on/off**: falta decidir dónde vive (¿configuración del perfil del técnico?) y cómo se guarda — hoy no hay ningún campo para "el ayudante está apagado para este técnico", habría que sumar uno (podría ser un valor especial dentro de `tutorial_tips_seen`, tipo `"__disabled__"`, o un booleano nuevo en la tabla `technicians` — a decidir).

## 4. Cronología relevante de la sesión del 17/9/2026

No es sobre el ayudante en sí, pero explica por qué se pausó y qué pantallas está tocando el resto del equipo en paralelo:

- Se reclasificó la orden de prueba de la reja (`dd0f52d3-c069-460c-8a84-808e6888240f`) de `work_mode = 'direct'` a `'diagnosis'`, vía `UPDATE` directo en Supabase (proyecto `ayszrtieplmqscqtabsu`), para que pase por el flujo de presupuesto en vez del flujo directo.
- Se rediseñó `QuoteBuilder.tsx`: tarifario completo plegado por defecto, un solo catálogo (sin duplicar "servicios publicados" y "tarifario completo" como dos fuentes separadas), total visible mientras se arma el presupuesto.
- Se decidió que los materiales **no se cobran por la plataforma**, ni junto con la mano de obra ni por separado: el técnico no adelanta plata de su bolsillo por los materiales del cliente. El módulo de materiales (`order_material_expenses`, pestaña "Materiales") se reconvirtió en una lista de compras informativa para que el cliente vaya directamente a la ferretería — sin precios cobrados, sin facturación.
- Se encontró (y se pasó a Grok para corregir) un bug de actualización en vivo: el canal de Supabase Realtime en `AppContext.tsx` (~línea 611-624) escucha la tabla vieja `order_materials_used` en vez de la nueva `order_material_expenses`, por lo que los cambios en la lista de materiales no le llegan en vivo al cliente.

Ninguno de estos cambios toca el ayudante virtual directamente, pero sí cambia las pantallas y pasos que el ayudante tendría que señalar.

## 5. Por qué se pausó (y cuándo retomarlo)

El flujo completo de un servicio (diagnosis vs. direct, armado del presupuesto, lista de materiales) se modificó varias veces en esta misma sesión y sigue en movimiento — el rediseño del tarifario plegado, por ejemplo, todavía no está aplicado en producción al momento de escribir esto. Escribir hoy los puntos de disparo del ayudante ("cuando el técnico esté en tal pantalla, mostrale tal tip") significaría reescribirlos cada vez que una de esas pantallas cambie.

Recomendación: construir el ayudante recién cuando el flujo de diagnosis/direct + presupuesto + materiales lleve un tiempo corriendo estable con órdenes reales, para mapear los tips contra pantallas que ya no se van a mover.

## 6. Para retomarlo

Cuando se decida construirlo: confirmar que las pantallas de checklist, presupuesto y materiales ya están en su forma final, escribir la lista de puntos de disparo + contenido de cada tip contra esas pantallas, definir dónde vive el toggle on/off, y recién ahí construir el componente visual y la lógica de descarte/persistencia sobre `tutorial_tips_seen`.
