# Base de conocimiento del Centro de ayuda — BORRADOR

**Estado:** borrador del 2/10/2026, armado leyendo el código de la app (no de memoria). Es la fuente que van a usar las preguntas frecuentes (botones) y la IA del chat (plan: `plan-avisos-telegram-y-chat.md`, Fases B y C).

**Cómo leerlo:** lo que no tiene marca está **confirmado en el código** (se indica dónde). Todo lo marcado con **❓** es una política o un dato que **no pude confirmar** y Sandy tiene que corregir antes de publicar. La IA solo debe afirmar lo confirmado.

---

## 1. La visita paso a paso (lo que vive el cliente)

| # | Paso | Qué ve el cliente en la app | Origen |
|---|---|---|---|
| 1 | **Pedir la Visita de Presupuesto** | Arma el pedido (con el asistente o el formulario): qué necesita, dirección, fecha y franja (Mañana 08–12, Mediodía 12–15, Tarde 15–19 o "A coordinar"). Puede adjuntar una foto. | Formularios del cliente |
| 2 | **Pagar la visita** | Se paga con **Mercado Pago**. Hasta que el pago no se confirma, el pedido **no se activa**: la app muestra "Pago pendiente", "Pago confirmado" o "Pago no confirmado" y permite retomar el pago. | `CustomerView.tsx` (l. 222–246) |
| 3 | **Buscamos técnico** | "Estamos buscando un técnico para tu pedido… para tu zona y franja horaria; en cuanto se asigne vas a poder ver su nombre y coordinar la visita acá mismo." | `CustomerView.tsx` (l. 430–433) |
| 4 | **Técnico asignado** | "Te presentamos a tu técnico asignado" con un botón para **escribirle y coordinar**. Solo aparece cuando el técnico **aceptó**: si todavía no respondió o rechazó, el cliente sigue viendo "buscando técnico". Si rechaza o no responde a tiempo, el sistema ofrece el pedido al siguiente técnico habilitado. | `CustomerView.tsx` (l. 97–102, 400) y funciones de oferta en la base |
| 5 | **El técnico sale y llega** | El cliente recibe el aviso **"técnico en camino"**. El sistema registra la hora de salida y de llegada. ⚠️ **No hay ubicación GPS ni mapa**: el seguimiento es por estados y avisos. | Trigger `notify_technician_en_route`; columnas `travel_started_at` / `arrived_at` |
| 6 | **La visita (diagnóstico)** | "Progreso del trabajo" (lista de tareas del técnico). ❓ Confirmar qué ve exactamente el cliente de tiempos y materiales durante la visita. | `CustomerView.tsx` (l. 473) |
| 7 | **Presupuesto** | "Presupuesto del diagnóstico": informe del técnico, ítems y precios, y **total a pagar**. Dos botones: **"Aceptar y pagar"** o **"Rechazar presupuesto"**. El presupuesto **tiene vencimiento**: vencido ya no se puede aceptar; se puede rechazar o pedir una nueva versión. **La visita ya pagada es aparte y NO se descuenta del presupuesto.** | `QuoteViewer.tsx` (l. 47–57) |
| 8 | **El trabajo** | Al aceptar y pagar: "Presupuesto aceptado y pago confirmado. El trabajo ya puede comenzar." Aparece la lista de materiales ("Lista para la ferretería") que declara el técnico. | `QuoteViewer.tsx` (l. 57); `CustomerView.test.tsx` |
| 9 | **Cierre** | El cliente da su **conformidad con firma digital** ("Firma Digital de Conformidad") y puede **calificar** el servicio ("Calificá este servicio"). | `CustomerView.tsx` (l. 643); `OrderRatingCard.tsx` |
| 10 | **Después** | **Garantía de 30 días** y **reclamos hasta 48 hs** después del servicio (así lo dice la web). Se abren desde "Reclamos y garantías" con el botón **"Abrir reclamo"**. | Landing; `MyClaimsPanel.tsx` |

Si el cliente **rechaza el presupuesto**, la visita igual se cobra (el técnico cobra la visita): hay un comprobante de "visita rechazada". ❓ Confirmar cómo se lo explicamos.

## 2. Cómo seguir una visita desde la aplicación

- **Con cuenta:** entrando al área de cliente ve **sus servicios** y abre cada uno para ver el estado, el técnico, el presupuesto y el chat. La **campanita** avisa de los cambios (pago confirmado, técnico asignado, técnico en camino, presupuesto enviado, etc.). ❓ Confirmar los nombres exactos de los menús tal como aparecen en pantalla.
- **Sin cuenta (invitado):** usa el **link de seguimiento** que recibe después de pagar (`…/#/pedido/<código>`), y puede crear su contraseña desde el enlace que le damos.
- **Ver al técnico en un mapa: no existe.** No prometerlo. Lo correcto es: "Te avisamos cuando el técnico sale, cuando llega y cuando termina."

## 3. Datos que la IA puede dar (confirmados)

**Política de cobro — confirmada por Sandy el 2/10/2026 (es lo primero que el cliente tiene que tener claro):**

- **El término exacto es "Visita de Presupuesto"** (con esas mayúsculas, definido por Sandy el 2/10). **No se llama "seña"**, ni "anticipo", ni "depósito", ni "adelanto".
- **La Visita de Presupuesto no es una seña.** Es el cobro, **por adelantado**, para que un técnico pueda ir a visitar al cliente, ver el problema y dar su punto de vista (reparación, instalación, etc.).
- **La Visita de Presupuesto y el trabajo son dos cobros distintos.** Lo que el técnico proponga después (una reparación, una instalación) es un **servicio aparte, que se cobra aparte** de la visita. La visita ya pagada no se descuenta del trabajo (así lo dice hoy el cartel del presupuesto).
- **Por qué se cobra de entrada (explicación de Sandy, 3/10):** en la visita, un técnico —un idóneo en la materia— asiste al domicilio, revisa el problema, da su diagnóstico, detecta qué pasa y presupuesta la solución. Eso es un **servicio profesional en sí mismo**, por eso se paga por adelantado. **"Visita de diagnóstico" y "Visita de Presupuesto" son la misma visita**; el término oficial es **"Visita de Presupuesto"**.
- **Si el cliente rechaza el presupuesto, la Visita de Presupuesto no se devuelve ni se descuenta** (corresponde a la visita del técnico, que cobra siempre que la haya hecho). Si tuvo un problema con la visita, puede abrir un reclamo dentro de las 48 horas. *(Confirmado por Sandy el 3/10.)*

**Otros datos confirmados:**

- Pagos con **Mercado Pago**.
- La Visita de Presupuesto cuesta hoy **$50.000** (se lee de la configuración del sistema, puede cambiar). La IA debe leer el valor vigente, no tenerlo escrito.
- Franjas horarias: Mañana 08–12 h, Mediodía 12–15 h, Tarde 15–19 h, o a coordinar.
- Rubros: Plomería, Electricidad, Reparaciones del hogar, Cerrajería, Refrigeración, Soldadura (la web lista esos seis).
- La visita pagada **no se descuenta** del presupuesto.
- El técnico debe **aceptar** el pedido; si no, se ofrece al siguiente.

## 4. Qué se puede pedir (el catálogo real, leído de la base el 2/10)

**Hay 6 rubros activos y 227 servicios activos.** (Existen además dos categorías desactivadas, "Mantenimiento general" e "Instalación de equipos", que no se ofrecen.)

| Rubro | Servicios | Tipos de trabajo (subcategorías del catálogo) |
|---|---|---|
| **Electricidad** | 101 | Cableado y re-cableado · Canalización · CCTV · Colocación de artefactos · Colocación de luminarias · Corrección de potencia · Mantenimiento · Personal contratado · Proyecto eléctrico · Puesta a tierra · Tablero domiciliario · Otros |
| **Reparaciones del hogar** | 49 | Pintura interior y exterior · Preparación de superficies · Esmalte y carpintería · Revoques y tabiques · Pisos y revestimientos · Contrapisos · Impermeabilización · Demoliciones · Aberturas y vanos · Veredas · Trabajos puntuales · Otros |
| **Plomería** | 34 | Reparaciones y grifería · Destapaciones · Instalaciones · Limpieza de tanques · Reformas · Otros |
| **Refrigeración** | 18 | Visita técnica · Instalación estándar · Pre-instalación y desinstalación · Limpieza y mantenimiento · Detección y reparación de fugas · Recambios |
| **Soldadura** | 16 | Personal contratado · Trabajos comunes · Estructuras metálicas |
| **Cerrajería** | 9 | Aperturas · Cerraduras · Llaves · Herrajes de seguridad |

- Los **precios** no se escriben en esta base: la IA y los botones deben **leerlos del catálogo vigente** (cambian).
- Un trabajo con **precio fijo** se puede pedir directo; todo lo demás se resuelve con la **Visita de Presupuesto**.

## 5. Cómo completar el pedido, campo por campo

**Paso 0: elegir cómo pedir** (dos tarjetas en el formulario, textos tal cual):

1. **"No sé exactamente qué necesito"** — *"Visita de presupuesto: $X. Este monto corresponde a la visita y se cobra de forma independiente del valor del trabajo."* Se describe el problema y viene un técnico a evaluarlo.
2. **"Sé qué trabajo necesito"** — *"Solo para tareas de precio fijo. El pago se habilitará antes de asignar un técnico."* Se elige el servicio del catálogo y la cantidad (de 1 a 20); se paga el total por adelantado.

**Campos del formulario:**

| Campo | Qué poner | Notas |
|---|---|---|
| **Rubro** | Plomería, Electricidad, etc. | Al cambiarlo se borra el servicio elegido. |
| **Prioridad** | Baja, Media, Alta o Urgente | ❓ No sé qué cambia en la práctica (ver preguntas). |
| **Título del problema** | Frase corta de lo que pasa | Solo en el modo "No sé qué necesito". En el modo directo el título es el nombre del servicio elegido. |
| **Servicio y cantidad** | Se elige del catálogo del rubro | Solo en el modo "Sé qué trabajo necesito". |
| **Descripción** | "Contanos qué sucede, desde cuándo y cualquier detalle útil para el técnico." | Obligatoria. |
| **Dirección** | Calle, **altura** (o "s/n" si no tiene), barrio (opcional), **localidad**, **provincia** | La localidad **no puede ser un número** (error típico: poner la altura ahí). Un cliente con cuenta puede **guardar la dirección** para próximos pedidos y elegirla de una lista. |
| **Fecha** | Día de la visita | No puede ser anterior a hoy. |
| **Franja** | Mañana (08–12), Mediodía (12–15), Tarde (15–19) o "A coordinar" | |
| **Foto** | Se adjunta **desde el asistente** (paso de texto libre, "Adjuntar foto") | El formulario en sí **no tiene campo de foto**. |

**Mensajes de error que puede ver:** "Indicá la calle del domicilio…", "Indicá la altura (número)… o 's/n'", "Elegí la provincia de esta visita", "Indicá la localidad de esta visita", "Completá qué necesitás y una breve descripción", "Elegí un servicio de precio fijo".

**Cómo se pasa del asistente al formulario:** el asistente de diagnóstico pregunta con botones, arma el pedido (rubro, descripción, prioridad, foto) y lo **precarga** en el formulario para que el cliente revise y confirme.

**Consejos útiles para el cliente (a confirmar con Sandy):** describir desde cuándo pasa el problema, si hay olor o chispas (en ese caso cortar la luz y no manipular), adjuntar una foto, y dejar la dirección completa con altura.

## 6. ❓ Preguntas para Sandy (sin esto la IA no debe contestar estos temas)

1. **Reembolsos:** si no se consigue técnico para la franja pedida, ¿se devuelve la visita? ¿en cuánto tiempo y cómo?
2. **Cancelación por el cliente:** ¿se puede cancelar antes de que el técnico salga? ¿y después? ¿hay devolución?
3. **Garantía de 30 días:** ¿cuenta desde la firma de conformidad o desde que se termina? ¿qué cubre y qué no?
4. **Reclamo de 48 hs:** ¿desde cuándo corre y qué pasa después de abrirlo (plazo de respuesta, cómo se resuelve)?
5. **Visita rechazada / presupuesto rechazado:** ¿cómo lo explicamos al cliente y qué se le cobra?
6. **Zonas:** ¿qué localidades cubren hoy? (la web muestra ejemplos de Quilmes, Berazategui y Florencio Varela).
7. **Horarios de atención** y el **número de WhatsApp** del botón.
8. **Qué hace el cliente si el técnico no llega** a la hora.
9. **Materiales:** ¿quién los compra y cómo se paga ("Lista para la ferretería")?
10. **Qué información del técnico** ve el cliente (nombre, foto, matrícula, calificación).
11. **Prioridad:** ¿qué cambia en la práctica elegir "Urgente"? ¿se cobra distinto, o se asigna antes, o es solo un dato para el técnico?
12. **Fuera de alcance:** ¿qué trabajos NO hacen? (por ejemplo gas, obras grandes, trabajos en altura, electricidad industrial). La IA necesita saberlo para no prometerlos.
13. **Foto:** hoy solo se puede adjuntar desde el asistente. ¿Querés agregarla también al formulario? (Es una mejora aparte, no hace falta para el chat).
14. **Servicios "Otros":** varias subcategorías se llaman "Otros". ¿Cómo se pide algo que no está en la lista?
15. **Visita técnica de Refrigeración:** el rubro tiene una subcategoría "Visita técnica" propia. ¿Es lo mismo que la Visita de Presupuesto o se cobra distinto?

## 7. Reglas para la IA (cuando se arme)

- Usa siempre el término exacto **"Visita de Presupuesto"**. Nunca la llama "seña", "anticipo", "depósito" ni "adelanto". Siempre aclara que **la Visita de Presupuesto y el trabajo son cobros distintos**.
- Solo afirma lo confirmado; si no sabe o es un tema ❓, dice que no lo sabe y ofrece **hablar con una persona** (WhatsApp).
- Nunca promete ubicación en mapa, plazos de reembolso ni coberturas de garantía no confirmadas.
- Nunca cotiza ni decide reembolsos o compensaciones.
- Avisos de seguridad (olor a quemado, chispas, etc.) siempre con el **texto fijo** del asistente de diagnóstico, antes de llamar a ninguna IA.
- Se identifica como **asistente virtual de TecniUrbano**.
