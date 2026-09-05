# Asistente de diagnóstico guiado (widget flotante) — Electricidad primero

**Estado:** Piloto de Electricidad **en producción** desde el 29/8 (commits `3f358e0` widget y `dbc8f95` triaje de seguridad). El widget está en la landing pública y en la app logueada; **no** aparece en la pantalla de recuperar contraseña. El árbol de preguntas de este documento sigue vigente; las secciones de emergencia, prioridad y corrección de potencia se alinearon el 5/9 al comportamiento real del código (ver abajo). El resto de rubros sigue pendiente.
**Visión completa:** un único widget de chat flotante (ícono cerrado por defecto, se abre al tocarlo) que ayuda al cliente en **todas las ramas de servicio** — Electricidad, Plomería, Refrigeración, Soldadura, Cerrajería, Reparaciones del hogar — no solo Electricidad. Esta versión del documento especifica completo el árbol de Electricidad (la categoría más grande, 105 servicios) como piloto; el resto de las categorías se diseñan con el mismo método una vez que este primero esté funcionando y validado en producción.
**Cómo funciona (sin IA):** preguntas cerradas con botones de respuesta rápida, sin texto libre ni modelo de lenguaje — ver la discusión de "Opción A vs. Opción B" más abajo en este documento para el porqué.
**Objetivo:** que un cliente que "no sabe lo que tiene en la casa" llegue, con preguntas en lenguaje cotidiano, a un servicio concreto del catálogo real — sin tener que entender terminología técnica de antemano.

---

## Punto de entrada — selector de rubro

Como el widget es para todas las ramas, la primera pregunta (antes de cualquier triaje de seguridad) tiene que identificar el rubro:

**Pregunta 0. "¿Qué tipo de problema tenés?"**
Opciones: Electricidad / Plomería / Refrigeración y aire acondicionado / Soldadura / Cerrajería / Reparaciones generales del hogar / No estoy seguro

- Cada opción (salvo "No estoy seguro") lleva al árbol específico de ese rubro. El de Electricidad está 100% especificado más abajo.
- **Importante:** el triaje de seguridad (lo que en este documento se llama "Paso 0") no es genérico — cada rubro tiene sus propios riesgos reales y necesita su propia pregunta de seguridad. "¿Olés a quemado?" tiene sentido en Electricidad, pero no es la pregunta correcta para, por ejemplo, una emergencia de Plomería (ahí importaría algo como "¿hay una pérdida de agua activa que no podés cortar?") o Cerrajería (¿hay alguien en riesgo trabado adentro/afuera?). Cuando se diseñe cada rama nueva, hay que pensar su propio triaje, no reutilizar el de Electricidad.
- "No estoy seguro" → deja texto libre + foto y deriva a diagnóstico general (sin intentar clasificar automáticamente).

---

## Cómo se conecta con la ficha de creación de servicio

Verificado directo contra la tabla real `service_orders`: ya existen los campos necesarios para que la conclusión del asistente pre-cargue la ficha, en vez de que el cliente tenga que volver a explicar todo de cero.

| Campo real en `service_orders` | Qué le pasa el asistente |
|---|---|
| `service_type` (enum: Electricidad, Plomería, Refrigeración, Soldadura, Cerrajería, Reparaciones del hogar, Mantenimiento general, Instalación de equipos) | La respuesta de la Pregunta 0 (selector de rubro) — mapea casi 1 a 1. *Nota: el enum real tiene 2 valores más que no incluí en la Pregunta 0 ("Mantenimiento general" e "Instalación de equipos") — cada una tiene 1 solo servicio activo en el catálogo, así que probablemente alcance con dejarlas dentro de la opción "Reparaciones generales del hogar" en vez de mostrarlas como opciones separadas.* |
| `fixed_price_service_id` + `fixed_price_quantity` | Cuando el árbol llega a **un ítem exacto del catálogo** (por ejemplo, una luminaria puntual con precio fijo), se pre-selecciona directo — el cliente ve el precio antes de confirmar. |
| `title` | Etiqueta corta autogenerada (ej: "Cambio de interruptor — 1 boca"). |
| `description` | Resumen en lenguaje natural de las respuestas del cuestionario (no un volcado literal de preguntas y respuestas) — pre-cargado pero **siempre editable**, el cliente lo revisa y puede agregar detalle antes de enviar. |
| `priority` (enum: baja, media, alta, urgente) | El draft del asistente usa **siempre** `media`. No hay `urgente` automático por esta vía. |

Distinción importante: cuando el árbol termina en **un ítem exacto y de precio fijo** (la mayoría de Colocación de Luminarias, Artefactos, CCTV, Puesta a Tierra), se pre-carga `fixed_price_service_id` y el cliente ve el precio antes de confirmar. Cuando termina en **una subcategoría sin ítem único posible** (la mayoría de la Rama A de Reparación, y Canalización dentro de Instalación), no hay un precio fijo que ofrecer todavía — se pre-carga `title`/`description`/`service_type` y el pedido sigue el camino normal de cotización (`order_quotes`/`order_quote_items`) una vez que el técnico ve el problema en persona.

El asistente **nunca envía** el pedido: llena el formulario (`sessionStorage` → `ServiceRequestForm` / `GuestServiceRequestForm`) y el cliente confirma. El Paso 0 (triaje de seguridad) **tampoco** crea un pedido: corta en `safety-stop` sin draft (ver esa sección).

## Diseño del widget (UI)

- **Ícono flotante, cerrado por defecto**, esquina inferior derecha, en todas las páginas (landing pública y app logueada). Se abre al tocarlo — confirmado con Sebastián para no estorbar la vista ni tapar contenido, sobre todo en celular.
- Al abrir, el asistente ya muestra la Pregunta 0 (selector de rubro) con botones — no hay campo de texto libre ni mensaje de bienvenida genérico tipo "¿en qué te ayudo?" invitando a escribir.
- Los mensajes se presentan como burbujas de chat (asistente a la izquierda, respuesta del cliente a la derecha), no como placeholders con etiquetas de tipo "[USER]:" — eso fue solo el bosquejo inicial de Sebastián para transmitir la idea.
- El personaje real (cara en el FAB cerrado, cuerpo al abrir) ya está en el widget; no hay mockup pendiente.

## Extras respecto a la spec original (ya en el código)

- Foto del diagnóstico: se sube a Storage (`diagnosis-photos`, ruta `pending/<draftId>/…`) y viaja en el draft.
- Overlay del personaje al abrir el chat (cara en el FAB cerrado).
- Si el picker de catálogo deja **un solo ítem**, el asistente lo selecciona solo y precarga `fixed_price_service_id`.

## Por qué botones y no un asistente con IA de texto libre

Decisión tomada: **cuestionario de botones (sin IA)**, por tres razones concretas:

1. **Seguridad:** el triaje de riesgo tiene que ser 100% confiable. Con botones, "Sí" siempre significa lo mismo; con texto libre interpretado por un modelo de lenguaje, existe margen de error en frases ambiguas — inaceptable en algo que puede derivar en una emergencia real (incendio, escape de agua, etc. según el rubro).
2. **Costo y previsibilidad:** un árbol de botones no tiene costo por uso ni depende de un servicio externo. Un asistente con IA cobra por mensaje y hay que mantenerlo — un gasto recurrente nuevo que no se justifica todavía en esta etapa del negocio (misma lógica que la decisión de no pagar Supabase Pro/Branching por ahora).
3. **Se puede probar entero:** un árbol fijo se recorre camino por camino y se verifica que cada uno termina en un resultado sensato. Un asistente de IA es mucho más difícil de garantizar así.

Un asistente con IA queda anotado como posible mejora futura, pero **separado** de este cuestionario de diagnóstico — para preguntas generales de bajo riesgo (cuánto tarda un técnico, cómo se paga, etc.), no para reemplazar el triaje de seguridad ni la clasificación del servicio.

---

## Rama Electricidad — árbol completo (piloto, 100% especificado)

### Principios de diseño

1. **La seguridad va antes que la venta.** Si hay una señal de riesgo (olor a quemado, chispas, humo), el cuestionario se corta ahí mismo y deriva a emergencia. No se le sigue preguntando cosas de catálogo a alguien que puede tener un principio de incendio en la pared.
2. **Nunca forzar una respuesta técnica.** Toda pregunta que requiera saber algo técnico (tensión, tipo de canalización, etc.) tiene que tener una opción válida de "no sé" — y esa opción no puede ser un callejón sin salida, tiene que seguir llevando a algún lado (normalmente: "lo confirma el técnico en el lugar").
3. **Preguntar solo lo que hace falta para esa rama.** No se pregunta tensión (220V/380V) si el cliente solo quiere instalar una lámpara — esa pregunta solo aporta en las ramas donde de verdad cambia el servicio (acometida, tablero, corrección de potencia).
4. **Integridad ante todo: no cobrar lo que no podemos resolver.** Si el problema es un corte de la empresa distribuidora (no solo de la vivienda), el cuestionario tiene que decírselo al cliente y no empujarlo a pagar una visita que no le va a solucionar nada.
5. **El cuestionario orienta, no reemplaza el diagnóstico técnico.** En las ramas más técnicas (por ejemplo, qué tipo exacto de canalización hace falta), el cuestionario llega hasta "instalación de cableado nuevo" y el detalle fino (PVC vs. metálica, embutida vs. a la vista, cantidad de bocas) lo termina de definir el técnico en la cotización, usando el flujo de `order_quotes` que ya existe.

---

### Paso 0 — Triaje de seguridad (siempre primero)

**Pregunta:** "¿Sentís olor a quemado, ves chispas o humo, o escuchás un zumbido raro en algún tablero o enchufe?"

- **Sí** → Se corta el cuestionario (`safety-stop`). **No se arma draft ni se crea pedido.** Aviso real (código): cortá la llave térmica si podés sin riesgo; si hay fuego o chispas en curso, bomberos o la distribuidora; TecniUrbano atiende en horario comercial y **no** ofrece servicio de emergencia. Tests en `diagnosisAssistant.test.ts` lo exigen (commit `dbc8f95`). **Cambio deliberado por seguridad: no reimplementar el auto-crear pedido urgente** de la spec original del 28/8.
- **No** → Continuar a Paso 1.

---

### Paso 1 — Tipo de trabajo

**Pregunta:** "¿Qué necesitás: reparar algo que no funciona, o instalar algo nuevo?"

- Reparación → Rama A
- Instalación → Rama B

---

### Rama A — Reparación

**A1. "¿Tenés energía eléctrica en la vivienda ahora mismo?"**
Opciones: Sí / No, nada de nada / Parcial (solo en algunos ambientes o tomas)

- **No, nada de nada** → **A2.** "¿Tus vecinos también se quedaron sin luz?"
  - Sí → *No es un problema que un técnico nuestro pueda resolver — es un corte de la empresa distribuidora.* Mostrar el aviso y **no ofrecer la creación de un servicio pago**. Opcional: dejar un link/recordatorio de cómo reportarlo a la distribuidora.
  - No (solo mi casa) → sigue a A3.

- **Parcial (algunos ambientes/tomas sin luz)** → va directo a la subcategoría **Cableado y Re-Cableado / Canalización** como diagnóstico en el lugar (no hace falta preguntar tensión acá).

- **A3. "¿Cómo están las llaves de la caja térmica/disyuntor?"**
  Opciones: Bajadas (las subí y vuelven a bajar) / Una está quemada o caliente / No sé cómo revisarlas

  - Bajadas / vuelven a bajar → **Tablero Domiciliario** (revisión de térmica/disyuntor).
  - Quemada o caliente → mismo `safety-stop` que el Paso 0 (sin draft, sin pedido). No reimplementar creación automática de Emergencia.
  - No sé → **Tablero Domiciliario**, con nota para el técnico: "cliente no pudo confirmar estado de las llaves, revisar en el lugar."

  - **Solo si la respuesta en A3 apunta a un problema de acometida o tablero** (es decir, no en el caso "parcial"), preguntar tensión:
    **A4. "¿Sabés qué tensión te llega a la vivienda: 220V, 380V, las dos, o no sabés?"**
    - 220V → probablemente monofásico → filtra ítems de **Tablero Domiciliario** o **Acometidas** monofásicos.
    - 380V o "las dos" → probablemente trifásico (uso comercial/industrial más frecuente) → filtra ítems trifásicos de **Tablero Domiciliario**, **Acometidas** o **Corrección de Potencia**.
    - No sé → no pasa nada, se deja sin filtrar y "lo confirma el técnico en la visita".

---

### Rama B — Instalación

**B1. "¿Qué tipo de instalación necesitás?"**
Opciones (mapeadas 1 a 1 con subcategorías reales del catálogo):

| Opción para el cliente | Subcategoría real | Ítems activos hoy |
|---|---|---|
| Cableado nuevo o recablear la casa | Cableado y Re-Cableado | 10 |
| Puesta a tierra (jabalina) | Puesta a Tierra | 1 |
| Tablero nuevo o ampliar el que tengo | Tablero Domiciliario | 5 |
| Luces, apliques, arañas, ventiladores, extractores | Colocación de Luminarias + Colocación de Artefactos | 10 + 6 |
| Cámaras de seguridad | CCTV | 10 |
| Más potencia para casa/local (acometida) | Acometidas | 4 |
| Obra nueva o remodelación completa | Proyecto Eléctrico | 4 |
| Otra cosa / no estoy seguro | — | deja texto libre + foto, deriva a diagnóstico general |

- **Solo si eligió** Cableado/Recableado, Tablero, Acometidas o Proyecto Eléctrico completo, preguntar tensión (misma pregunta A4: 220V / 380V / las dos / no sé) — en el resto de las opciones (luminarias, artefactos, CCTV, puesta a tierra) esa pregunta no aporta nada, no se pregunta.

- **Canalización** (34 ítems activos, la subcategoría más grande del catálogo) **no aparece como opción directa** en el cuestionario — es un detalle técnico (tipo de caño, material, cantidad de bocas) que se resuelve dentro de la cotización del técnico una vez que ya se sabe que el cliente necesita "cableado nuevo" o "más tomas". No tiene sentido pedirle a un cliente que elija entre "canalización a la vista de PVC" o "canalización embutida metálica" sin haber visto la instalación.

---

## Puntos abiertos — resueltos (28/8)

1. **Personal Contratado queda fuera del cuestionario residencial.** Se verificó contra los datos reales del catálogo (no por el nombre solamente):
   - *Corrección de Potencia* (8 ítems activos, todos en Electricidad): tableros de corrección de factor de potencia de "Hasta 2 Kvar" a "Hasta 150 Kvar". En la spec original del 28/8 se la dejó fuera del árbol residencial. **En el código actual sí entra al picker** cuando la tensión es 380V o "las dos", junto a Acometidas / Tablero Domiciliario (ítems trifásicos). No es una opción de B1; aparece como filtro del catálogo en esas ramas.
   - *Personal Contratado* (existe tanto en Electricidad como en Soldadura, tarifas de $6.000–$135.700 por hora/jornada según categoría del personal): es contratación de mano de obra por tiempo, no un síntoma a diagnosticar — el cliente que lo pide ya sabe que quiere contratar horas de un técnico, no encaja en ninguna rama del árbol de síntomas. Sigue fuera del asistente; se pide directo por el catálogo.
   - **Nota para el futuro:** una rama B2B con punto de entrada propio (Personal Contratado y el resto comercial) sigue pendiente y **separada** de este cuestionario residencial.
2. **Mono/trifásico por tensión (220V/380V)** es una aproximación práctica, no una regla exacta — sirve para orientar sin exigirle al cliente terminología técnica, pero el dato real siempre lo termina confirmando el técnico en la visita. Aceptado tal cual, no bloquea la implementación.

## Próximos pasos (orden recomendado)

1. ~~Confirmar los 2 puntos abiertos de Electricidad~~ — hecho, ver arriba (28/8).
2. ~~Decidir el timing~~ — hecho: el piloto **se adelantó** y está en producción desde el 29/8 (`3f358e0`, `dbc8f95`).
3. ~~Armar el mockup visual del widget~~ — hecho (canvas de diseño + capturas, personaje real del usuario aplicado en los 3 estados).
4. **Próximo paso real:** diseñar y validar las otras ramas (mismo método, triaje propio por rubro). El resultado de cada rama sigue siendo una **sugerencia** que precarga la ficha; el cliente confirma. El Paso 0 **no** crea pedido (ver `safety-stop`).
5. **Lanzar y validar solo con Electricidad primero** — es la categoría más grande (105 de 233 servicios activos, casi la mitad del catálogo) y ya sirve de prueba real de que el modelo funciona antes de invertir en diseñar las otras cinco ramas.
6. Una vez validado en producción, diseñar con el mismo método (preguntas abiertas → cierran hacia subcategorías reales, con su propio triaje de seguridad específico) las ramas de Plomería, Refrigeración, Soldadura, Cerrajería y Reparaciones generales del hogar, en ese orden sugerido por tamaño de catálogo (Reparaciones del hogar 49 ítems, Plomería 34, Refrigeración 18, Soldadura 16, Cerrajería 9).
7. **Más adelante, fuera de este documento:** diseñar la rama B2B de "servicios eléctricos para empresas" (Corrección de Potencia, Personal Contratado, y lo que corresponda), con su propio punto de entrada tipo "tipo de atención de servicio" — separado del cuestionario residencial, cuando ese frente del negocio esté sobre la mesa.
