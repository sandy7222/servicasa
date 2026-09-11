# Plan: Zona de trabajo + Agenda del técnico + Asignación por distancia y horario

## 1. Qué se pidió (resumen de la charla)

- **Técnico**: nuevo módulo "Zona de trabajo" en su panel — declara localidad/provincia donde
  trabaja, el mapa se centra solo ahí (sin que tenga que buscar ni hacer zoom a mano) y arrastra el
  borde de un círculo para agrandar o achicar su radio de cobertura. Además, una "Agenda" con los
  días/horarios que está disponible, sus francos, vacaciones y trámites.
- **Administrador**: al recibir una solicitud, saber cuántos técnicos hay disponibles en la zona de
  esa orden (por distancia, no solo por provincia); si el más cercano ya tiene otro trabajo aceptado
  que se pisa en fecha/horario, que el sistema avise — pero sin bloquear, porque el admin puede
  chatear con el técnico y confirmar igual; si no hay nadie ideal en zona, poder ofrecerle el
  trabajo a otros técnicos de todas formas.

## 2. Lo que ya existe en el código y la base (importante — cambia el punto de partida)

Antes de diseñar esto de cero, encontré que gran parte de la idea ya estaba anticipada en un ADR de
Sandy de agosto (`docs/adr-address-redesign.md`, Fases 4-6 "pendientes, a confirmar"), y parte de la
base ya está migrada aunque nadie la usa todavía. Verificado en vivo contra la base real (proyecto
`ServiCasa`, hoy 5 órdenes y 4 técnicos cargados, cero riesgo de migración con datos reales):

- `service_orders` **ya tiene** `client_lat`, `client_lng`, `client_city`, `client_postal_code`,
  `client_address_id` — agregadas en la Fase 1 de ese ADR, pero **ninguna orden tiene lat/lng
  cargado** (geocoding quedó deliberadamente pendiente, "Fase 6, opcional"). No hace falta agregar
  columnas nuevas en la orden: hay que empezar a completar las que ya están.
- Existe una tabla `technician_coverage_areas` (`technician_id`, `province`, `city`) con RLS ya
  armada, pensada para que el técnico marque provincias/ciudades sueltas que cubre — pero tiene
  **0 filas** y no tiene ninguna pantalla que la use (era la Fase 5 de ese mismo ADR, nunca
  confirmada). Es una idea más simple (lista de localidades) que lo que pediste ahora (círculo de
  radio en un mapa) — no la voy a usar tal cual: la reemplazo por lat/lng + radio en el técnico, que
  cubre lo mismo y más (un radio en Quilmes puede alcanzar zonas de otra provincia limítrofe sin que
  haga falta листар cada localidad a mano). Como tiene cero filas y ninguna pantalla la toca, no hay
  nada que migrar ni romper al dejarla de lado.
- `technicians.zone` sigue siendo un campo de texto libre, puramente decorativo (decisión ya tomada
  por Sandy de no usarlo para filtrar, para no arriesgar lo que ya funciona) — lo dejo así, sin
  tocar; la cobertura real vive en el radio nuevo, no en este campo.
- El campo `appointmentWindow` existe en el tipo `CustomerServiceRequestInput` pero no se usa en
  ningún lado del código — lo reviso para la franja horaria (mañana/tarde) en vez de agregar un
  campo nuevo.
- El modal "Asignar técnico" de hoy (`AdminHubView.tsx`) lista a todos los técnicos elegibles,
  ordenados por nombre o rating — sin filtrar por zona ni avisar de superposición de horarios.
- **Hallazgo nuevo (revisando para la Fase 3): existe `src/components/technician/AvailabilityView.tsx`,
  una pantalla de "Mi disponibilidad" completa (toggle online/offline, horario semanal por día con
  hora exacta, excepciones puntuales por fecha, y zonas de cobertura por nombre de barrio/ciudad) —
  pero está huérfana: no la importa ni la rutea nada (`App.tsx`/`TechnicianView.tsx`), y consulta dos
  tablas que ni siquiera existen en la base real (`technician_working_hours`,
  `technician_availability_exceptions` — confirmado contra `information_schema.tables`, solo existe
  `technician_coverage_areas`, con 0 filas, la misma que ya se deja de lado en el punto anterior). Es
  código escrito y nunca terminado de cablear, probablemente de la misma tanda que el ADR de agosto.
  Para la Fase 3 (Agenda) conviene adaptarlo en vez de escribir `AgendaView.tsx` desde cero: ya tiene
  el patrón semanal + excepciones que pedís, con mejor granularidad (hora exacta, no solo
  Mañana/Tarde) — falta crear las dos tablas que le faltan, cablear la ruta, y sacarle la sección de
  "zonas de cobertura por nombre" (haría doble función con el radio en mapa de la Fase 2). Se decide
  al llegar a esa fase, no bloquea la Fase 2 actual.
- No hay ninguna tabla de disponibilidad/agenda/turnos en la base — esto sí es 100% nuevo (salvo el
  hallazgo de `AvailabilityView.tsx` recién descripto, que ya trae el diseño pensado aunque sin
  tablas ni ruteo).

## 3. Decisiones ya acordadas en la charla

1. **Proveedor de mapa/geocoding: Leaflet + OpenStreetMap (mapa) y Nominatim (geocoding),
   ~~Mapbox~~.** Cambio de decisión: Mapbox pide cargar una tarjeta para crear la cuenta aunque el
   uso quede dentro del nivel gratuito ("no se te cobra hasta pasar el límite"), y se prefirió no
   dejarla cargada solo para esto. La alternativa elegida no pide cuenta, API key ni tarjeta para
   nada de esto: Leaflet es una librería de mapas gratis que se usa con las capas de OpenStreetMap
   sin registrarse, y Nominatim (el geocoder de OSM) confirmado sin cuenta/key/tarjeta — solo pide
   no hacer geocodificación masiva/automatizada y respetar 1 request por segundo, que es
   exactamente nuestro caso (una vez por pedido, una vez por técnico que declara su zona). Si el
   volumen de pedidos crece mucho en el futuro, ahí sí conviene migrar el geocoding a un proveedor
   pago — no es necesario ahora.
2. **El mapa se autoposiciona.** El técnico escribe localidad y provincia (mismos campos de
   dirección ya usados en el resto de la app, con auto-capitalización); al confirmar, se geocodifica
   ese texto y el mapa se centra y hace zoom ahí solo — el técnico nunca busca ni desplaza el mapa a
   mano, solo ajusta el radio.
3. **Radio de cobertura, no lista de localidades.** Círculo centrado en la localidad declarada,
   arrastrable para agrandar/achicar, guardado como `lat`, `lng`, `radius_km`.
   - **Tope del radio: 60 km, mínimo 5 km.** A diferencia de El Guía YA (capitanes cubriendo
     distancias fluviales de hasta 200 km), acá es un técnico viajando en auto/moto dentro del
     conurbano/CABA — referencia real dada en la charla: Glew a Capital son 34 km, y pasado un radio
     de 60 km ya no tiene sentido económico viajar para un service hogareño. El slider del mapa
     queda limitado a ese rango (5-60 km), con un valor sugerido inicial de ~15 km al declarar la
     zona por primera vez (ajustable al toque).
4. **Horario en bloques, no horas exactas.** Un turno de una orden queda en un bloque del día
   (Mañana / Tarde — dejo lugar para sumar Noche después si hace falta), reutilizando
   `appointmentWindow`. Un técnico con turno de mañana en una fecha se considera ocupado esa mañana;
   la tarde queda libre.
5. **Agenda del técnico**: patrón semanal recurrente (qué bloques trabaja cada día de la semana) +
   excepciones puntuales por fecha (franco, vacaciones, trámite) que pisan el patrón semanal para
   esos días.
6. **Conflictos = aviso, nunca bloqueo.** Si el técnico ideal ya tiene un trabajo aceptado que se
   pisa, el admin lo ve marcado pero puede igual abrirle el chat y asignarlo si confirma que puede
   — mismo criterio que ya usa hoy el modal para técnicos no habilitados (aviso + un click extra).
7. **Sin nadie ideal en zona → lista igual, no oferta automática.** El modal de asignar sigue
   mostrando a todos los técnicos (no solo a los de la zona), ordenados por distancia y
   disponibilidad, con los que no cumplen marcados con un aviso — no se construye un mecanismo de
   "ofrecer el trabajo a varios y que el primero lo acepte" (sería una función bastante más grande,
   con notificaciones a varios a la vez y una condición de carrera a resolver; queda como fase
   futura si hace falta más adelante).

## 4. Diseño técnico

### 4.1 Geocoding (nuevo, servidor)

- `api/_lib/geocoding.ts` — sin token ni configuración: llama directo a Nominatim con un
  `User-Agent` identificando la app (requisito de su política de uso).
- Función `geocodeLocality(city, province): Promise<{ lat, lng } | null>`. Se usa en dos lugares:
  - Al guardar la "Zona de trabajo" de un técnico (geocodifica su localidad declarada).
  - Al crear una orden real (`api/orders/request-service.ts`, `api/orders/guest-checkout.ts` vía
    `api/payments/webhook.ts`, mismo punto donde hoy se escribe `client_city`) — completa
    `service_orders.client_lat`/`client_lng`, columnas que ya existen y están vacías.
- Falla silenciosa y no bloqueante: si Nominatim no responde o la localidad no matchea, la
  orden/zona se guarda igual sin coordenadas (como pasa hoy) y simplemente no participa del
  ordenamiento por distancia — nunca frena un pedido ni un guardado de perfil por un problema del
  geocoder.

### 4.2 Zona de trabajo del técnico (nuevo)

- Migración: agrega a `technicians` las columnas `work_zone_lat numeric`, `work_zone_lng numeric`,
  `work_zone_radius_km numeric`, `work_zone_city text`, `work_zone_province text` (o una tabla
  aparte `technician_work_zone` 1:1 si preferís no ensuciar la tabla principal — lo defino al
  implementar, no cambia el resto del diseño).
- Se elimina/ignora `technician_coverage_areas` (0 filas, sin UI) en vez de migrar datos — no hay
  nada que migrar.
- `src/components/technician/WorkZone.tsx` (nombre tentativo): formulario de localidad/provincia
  (reutilizando `AddressFields`-style) + mapa Leaflet (capa de OpenStreetMap) con círculo
  arrastrable + guardar.
- Al guardar: geocodifica vía el endpoint del punto 4.1, centra el mapa, guarda lat/lng/radio.

### 4.3 Agenda del técnico (nuevo)

- `technician_weekly_availability` — `technician_id`, `day_of_week` (0-6), `block` (`'morning' |
  'afternoon'`), `available boolean`. Una fila por combinación técnico×día×bloque (o simplemente
  ausencia de fila = no disponible, para no precargar 14 filas por técnico).
- `technician_time_off` — `technician_id`, `start_date`, `end_date`, `reason` (`'vacation' |
  'errand' | 'day_off' | 'other'`), `note text`. Cubre francos, vacaciones y trámites como rango de
  fechas.
- `src/components/technician/AgendaView.tsx`: grilla semanal (día × Mañana/Tarde) para marcar
  disponibilidad recurrente + lista de excepciones con alta/edición/borrado.
- `src/lib/technicianSchedule.ts`: `isTechnicianAvailable(technicianId, date, block)` — resuelve
  patrón semanal + excepciones, única fuente de verdad reusada tanto en la Agenda como en el chequeo
  de conflictos del admin.

### 4.4 Asignación con distancia y conflicto (admin)

- `src/lib/technicianDistance.ts`: `distanceKm(a, b)` (fórmula de Haversine, sin dependencias
  nuevas) + `isWithinWorkZone(order, technician)`.
- Modal "Asignar técnico" (`AdminHubView.tsx`): se agrega orden por distancia (cuando la orden y el
  técnico tienen lat/lng), y por cada técnico se calcula, además de la elegibilidad que ya existe,
  si está dentro de su radio para esa orden y si tiene un turno aceptado que se superpone ese
  día/bloque (usando `isTechnicianAvailable` + revisar otras órdenes ya `accepted` de ese técnico en
  esa fecha/bloque). Los que no cumplen se muestran igual, más abajo, con el aviso correspondiente
  — nunca se ocultan ni se bloquean.
- En la vista de la orden nueva/pendiente de asignar, un contador simple: "X técnicos en la zona,
  Y disponibles ese turno" — resuelve el punto 2 del pedido original sin pantalla nueva, reusando el
  mismo cálculo del modal.
- **(Opcional, no bloqueante) Mapa de admin.** Inspirado en el "Comando Operativo" de El Guía YA
  (captura compartida en la charla): un mapa de Argentina en el panel del admin mostrando a cada
  técnico con su círculo de radio, reusando el mismo componente de mapa de la Fase 2 en modo
  lectura, sin la complejidad de múltiples tipos de actor de aquel proyecto — acá un solo tipo
  (técnico) alcanza. Se implementa si da el tiempo dentro de esta fase, o queda como una fase corta
  aparte después, sin comprometer el resto del plan.

## 5. Qué NO cambia

- No se toca `technicians.zone` (label decorativo) ni `technician_coverage_areas` (se deja de lado,
  no se borra por las dudas, pero no se migra ni se usa).
- No se agregan columnas nuevas en `service_orders` — las de lat/lng/city ya existen de la Fase 1
  del ADR anterior.
- No se construye un sistema de oferta activa a múltiples técnicos (fase futura si hace falta).
- No se toca el flujo de pago, cronómetro, checklist ni nada de lo ya construido en fases previas.

## 6. Fases de implementación

- [x] **Fase 1** — Geocoding: `api/_lib/geocoding.ts`, wiring en creación de orden (completar
  `client_lat`/`client_lng`), tipo `ServiceOrder` actualizado con `clientLat`/`clientLng`.
  Implementado en dos pasadas: primero con Mapbox, después reemplazado por Nominatim (ver decisión
  1 más arriba) porque Mapbox pide tarjeta para crear la cuenta. Estado final:
  `api/_lib/geocoding.ts` (nuevo, `geocodeLocality` contra Nominatim, sin token ni cuenta —
  `api/_lib/mapbox.ts` quedó como stub deprecado, se puede borrar), wiring en las dos funciones de
  `api/payments/webhook.ts` que crean la orden real (`createOrderFromApprovedGuestDraft` y
  `createOrderFromApprovedCustomerDraft`), `ServiceOrder.clientLat/clientLng` en
  `src/types/index.ts`, `DbServiceOrder.client_lat/client_lng` en `src/lib/supabase.ts`, mapeo en
  `mapOrder()` (`src/lib/supabaseData.ts`) — `database.types.ts` ya tenía las columnas tipadas de
  la Fase 1 del ADR de direcciones, no hizo falta regenerarlo. `.env.example` sin variables nuevas
  — no hace falta configurar nada para que esto funcione.
  **Verificado** (vía Cursor, conexión directa a tu máquina caída toda la sesión): `tsc --noEmit`
  limpio. Primer `vitest run` encontró un bug real: `geocodeLocality` asumía que `city`/`province`
  siempre llegaban como string y reventaba con `undefined` (el fixture de
  `api/payments/webhook.test.ts` — un test de antes del ADR de direcciones — no tiene `city` en su
  payload), rompiendo el test de idempotencia del webhook. Corregido tratando `null`/`undefined`
  como "no hay dato" en vez de asumir string. Segunda corrida: **149/149 tests, 19/19 archivos,
  todo verde.** **Commiteado: `99cf4ee`** (`feat: geocodificar la direccion del cliente al crear una
  orden (Fase 1 de zona de trabajo)`, 8 archivos, 291 inserciones). Sin push.
- [x] **Fase 2** — Zona de trabajo. Migración `technician_work_zone` aplicada de
  verdad en Supabase (`work_zone_lat/lng/radius_km/city/province` en `technicians`, con `CHECK` de
  radio 5-60km y de lat/lng válidos — probada primero con `begin;...rollback;`, después aplicada en
  serio; verificado que RLS ya cubre esto sin cambios, `technicians_update_own_professional_profile`
  es por fila, no por columna); tipos actualizados (`DbTechnician` en `src/lib/supabase.ts`,
  `Technician` en `src/types/index.ts`, mapeo en `mapTechnician()` y columna nueva en
  `TECHNICIAN_COLUMNS_ADMIN` en `src/lib/supabaseData.ts` — igual criterio que `address`/`work_phone`,
  afuera del set compartido con clientes); endpoint `api/technicians/geocode-work-zone.ts` (solo
  técnico autenticado, reusa `geocodeLocality`); helper de cliente `src/lib/technicianWorkZone.ts`
  (mirror del patrón de `paymentClient.ts`); componente `src/components/technician/WorkZone.tsx`
  (mapa Leaflet + capa OpenStreetMap, marcador arrastrable con divIcon propio para no depender de los
  íconos default de Leaflet, círculo de radio sincronizado con un slider 5-60km, geocodifica al tocar
  "Ubicar" o permite marcar el centro con un click en el mapa); ruta `/technician/zona-trabajo`
  cableada en `App.tsx` y `TechnicianView.tsx` (botón de escritorio + entrada del menú mobile, mismo
  patrón que `/technician/profile`); dependencias `leaflet` + `@types/leaflet` agregadas a
  `package.json` (falta `npm install` antes de poder compilar/testear). Nota: el mapa lo armé yo
  directamente en vez de pasárselo a Cursor como se había hablado — no hace falta preview visual para
  escribir la integración de Leaflet correctamente, es la misma lógica que el resto del código de
  esta sesión (vos verificás con `tsc`/`vitest`/probándolo en el navegador, igual que las demás
  fases). Se sumó también `supabase/migrations/20260910122407_technician_work_zone.sql` (faltaba el
  archivo local de la migración, que ya estaba aplicada en la base — este proyecto versiona cada
  migración como archivo, lo que hubiera dejado un drift entre el repo y la base real). Un ajuste de
  UX después de la primera prueba en navegador: el zoom al geocodificar arrancaba mostrando todo el
  partido/región (zoom 11); se subió a zoom 13 (nivel localidad) y se corrigió que una búsqueda nueva
  siempre recentre el mapa (antes solo pasaba si el mapa seguía en la vista de Argentina entera).
  **Verificado** (vía terminal en tu máquina): `tsc --noEmit` limpio, `vitest run` **149/149 tests,
  19/19 archivos, todo verde** (un test de regresión de columnas rompió al principio — esperaba
  exactamente 2 columnas admin-only y ahora son 7 por los `work_zone_*` nuevos, corregido para que
  cuente dinámicamente), y probado a mano en el navegador como técnico: declarar localidad, ubicar,
  arrastrar el centro, ajustar el radio, guardar y recargar — todo funciona. **Commiteado: `22c78f6`**
  (`feat: modulo Zona de trabajo del tecnico (mapa Leaflet + radio de cobertura) (Fase 2 de zona de
  trabajo)`, 13 archivos, 540 inserciones, 18 eliminaciones). Sin push.
- [x] **Fase 3** — Agenda. Migración `technician_agenda` aplicada de verdad en Supabase
  (tablas `technician_working_hours` y `technician_availability_exceptions`, mismo diseño que ya
  estaba escrito sin aplicar en `supabase/sql/enable_technician_availability.sql` — probada primero
  con `begin;...rollback;`, incluida una prueba explícita de que el constraint `start_time < end_time`
  rechaza un horario invertido; RLS con el mismo patrón que `technician_payment_accounts` — el técnico
  tiene ALL sobre sus propias filas, el admin sobre todas). `AvailabilityView.tsx` adaptado: se le
  sacó la sección de "Zona de cobertura por nombre" (`technician_coverage_areas`, `addArea`/
  `removeArea`/`setBase`, tipo `Area`) — quedaba reemplazada por el radio en mapa de la Fase 2, y
  además esa tabla tiene RLS de escritura solo-admin (el técnico nunca hubiera podido guardar ahí
  aunque la pantalla estuviera cableada). Ruta `/technician/disponibilidad` cableada en `App.tsx` y
  `TechnicianView.tsx` (botón de escritorio + menú mobile, mismo patrón que las otras).
  `tsc --noEmit` limpio y `vitest run` 149/149 desde el primer intento (no hizo falta `npm install`,
  no se agregó ninguna dependencia nueva).
  **Bug encontrado probando a mano en el navegador**: el toggle "Activar/No disponible" tocaba y
  volvía siempre a su estado anterior, con el toast "No se pudo actualizar tu estado." Causa: las
  columnas `technicians.is_available`/`availability_updated_at` que escribe ese toggle **tampoco
  existían** en la tabla real — el propio código ya tenía un comentario de un desarrollador anterior
  confirmándolo ("is_available NO se incluye porque esa columna no existe en la tabla real"), y de
  paso eso significaba que la insignia "Disponible/No disponible" del admin en `AdminHubView.tsx`
  venía mostrando siempre "No disponible" para todos, en silencio. Se agregó la migración
  `technician_is_available` (mismo patrón: dry-run con rollback, después aplicada en serio) y se sumó
  `is_available` a `TECHNICIAN_COLUMNS_ADMIN` en `supabaseData.ts` (antes deliberadamente afuera
  porque la columna no existía) — de paso corrige también la insignia del admin.
  **Verificado** (vía terminal en tu máquina, después del fix): `tsc --noEmit` limpio, `vitest run`
  149/149 de nuevo, y probado a mano en el navegador — el toggle "Activar" ya queda en verde como
  "Disponible" con su toast, se guardó el horario semanal y se agregó una excepción con fecha, todo
  sin problemas.
  **Nota sobre `technicianSchedule.ts`**: se saca de esta fase y se mueve a cuando arranque la Fase 4
  — su firma (`isTechnicianAvailable(technicianId, date, block)`) depende de cómo queden definidos
  los bloques Mañana/Tarde, y al revisar el código encontré que `appointmentWindow` hoy es texto libre
  sin ningún límite horario fijado todavía (el cliente escribe cualquier cosa, ej. "Mañana (08-12h)"
  como frase, no como dato estructurado) — recién en la Fase 4, al convertirlo en un campo real, se
  fijan esos horarios y ahí tiene sentido escribir la función que los use. Escribirla antes sería
  inventar un límite que la Fase 4 podría después contradecir.
  **Commiteado: `e46435bb`** (`feat: agenda del tecnico - horario semanal y ausencias (Fase 3 de zona
  de trabajo)`, 8 archivos, 166 inserciones, 23 eliminaciones). Sin push.
- [x] **Fase 4** — Revivir `appointmentWindow` como bloque real en la orden. Al revisar
  `ServiceRequestForm.tsx`/`GuestServiceRequestForm.tsx` de cerca encontré que el selector "Franja
  para este pedido" ya existe y ya ofrece 4 opciones reales con horario fijo, no solo Mañana/Tarde
  como decía el diseño original: "A coordinar", "Mañana (08–12 h)", "Mediodía (12–15 h)", "Tarde
  (15–19 h)" — el texto ya se manda hoy (`appointmentWindow`), solo que quedaba pegado como texto
  libre dentro de `description` ("Disponibilidad solicitada: X") y nunca en una columna propia.
  Migración `service_orders_appointment_block` aplicada de verdad en Supabase: columna
  `service_orders.appointment_block` (`'unscheduled' | 'morning' | 'midday' | 'afternoon'`, NOT
  NULL, default `'unscheduled'`, con CHECK — probada primero con `begin;...rollback;`, incluida una
  prueba explícita de que el CHECK rechaza un valor inválido). El default cubre sin romper nada la
  creación manual de órdenes del admin (`persistCreateOrder()` en `supabaseMutations.ts`, que no
  pide este dato todavía — queda fuera de esta fase, ver nota más abajo).
  Server: nuevo `api/_lib/appointmentBlock.ts` (`resolveAppointmentBlock()`, mapea las 3 etiquetas
  con horario fijo a su bloque — cualquier otro texto, incluido "A coordinar", cae en
  `'unscheduled'`; nunca confía en que el cliente mande el bloque estructurado directamente), usado
  en `api/orders/request-service.ts` y `api/orders/guest-checkout.ts` para sumar `appointmentBlock`
  al payload del borrador (sin tocar el texto libre existente en `description`, por compatibilidad
  con lo que ya lee el técnico/admin). `api/payments/webhook.ts` actualizado (los dos tipos de
  payload + las dos funciones que crean la orden real) para escribir `appointment_block` al insertar
  — con `?? 'unscheduled'` por si un borrador viejo, ya en vuelo antes de este cambio, no tiene el
  campo en su payload guardado.
  Frontend: `AppointmentBlock` nuevo en `src/types/index.ts`, sumado a `ServiceOrder`;
  `DbServiceOrder` en `src/lib/supabase.ts` y mapeo en `mapOrder()` (`supabaseData.ts`) — no hizo
  falta tocar ningún `select()` de `service_orders` porque ya usan `select('*')` en todos lados.
  No se tocaron los formularios del cliente: ya mandaban el dato correcto, faltaba solo guardarlo
  estructurado del lado del servidor.
  Se escribió también `src/lib/technicianSchedule.ts` (quedó pendiente de la Fase 3 a propósito,
  como estaba anotado ahí: recién con el bloque real definido tenía sentido escribirla).
  `resolveAvailability()` es la lógica pura (patrón semanal + excepción puntual → disponible/no,
  sin red) y `isTechnicianAvailable(technicianId, date, block)` es el wrapper que consulta
  `technician_working_hours`/`technician_availability_exceptions` y nunca lanza (ante cualquier
  error de red devuelve `true` — no bloquea ni inventa un conflicto no verificado, mismo criterio de
  "aviso, nunca bloqueo" de todo este módulo). `'unscheduled'` ("A coordinar") solo se resuelve por
  ausencia de todo el día, nunca comparando horas — no hay nada más específico que comparar. Es la
  pieza que va a usar el modal de asignar del admin en la Fase 5.
  Tests nuevos: `api/_lib/appointmentBlock.test.ts` (mapeo de etiquetas) y
  `src/lib/technicianSchedule.test.ts` (`resolveAvailability()` — unscheduled, ausencia de todo el
  día, solapamiento con el bloque, día inactivo, sin horario cargado, excepción puntual pisando el
  patrón semanal).
  **Bug real encontrado por el propio test** (no en la prueba, en el diseño): la primera versión de
  `resolveAvailability()` exigía que el horario del técnico *cubriera el bloque entero* (ej. trabajar
  desde las 08:00 en punto para calificar para "Mañana"). Con el horario default que carga
  `AvailabilityView.tsx` (09:00-18:00), eso significaba que NINGÚN técnico con ese horario default
  iba a calificar nunca para "Mañana" (arranca 08h) ni "Tarde" (termina 19h), solo para "Mediodía" —
  hubiera generado un aviso de conflicto falso para casi todos los técnicos en dos de los tres
  bloques reales. Corregido a comparar por solapamiento (alcanza con que se crucen en algún punto,
  no que uno cubra al otro entero) — dos franjas que solo se tocan en la punta no cuentan como
  solapadas. Los 7 tests del archivo se reescribieron para probar esta semántica correcta.
  **Verificado**: `tsc --noEmit` limpio y `vitest run` **158/158 tests, 21/21 archivos, todo
  verde** (149 de antes + 9 nuevos: 7 de `technicianSchedule.test.ts` y 2 de
  `appointmentBlock.test.ts`). La prueba manual de punta a punta (pedido real → pago sandbox →
  webhook → orden con `appointment_block` correcto) se decidió saltear esta vez: las cuentas de
  sandbox de Mercado Pago estaban colgándose, un problema ajeno al código que no vale la pena
  perseguir. Cobertura igual sólida para esta fase en particular: la única lógica con riesgo real
  (el mapeo de etiqueta a bloque y la resolución de disponibilidad) quedó 100% cubierta por tests
  unitarios — de hecho fue un test, no la prueba manual, el que encontró el bug real de esta fase
  (ver más abajo). Lo que no verificamos a mano es la escritura de dos líneas en el insert del
  webhook, que es sintácticamente trivial y ya pasa `tsc` + los tests de idempotencia existentes de
  `webhook.test.ts` sin romperse. Se puede volver a intentar la prueba manual más adelante si hace
  falta más confianza antes de construir la Fase 5 sobre esto.
  **Nota, queda fuera de esta fase**: la creación manual de una orden desde el admin
  (`handleCreateOrderSubmit` en `AdminHubView.tsx` → `createOrder` → `persistCreateOrder`) todavía no
  tiene un selector de franja — queda en `'unscheduled'` por el default de la columna. No hacía
  falta tocarlo para "conectar de punta a punta" el flujo del cliente, que es lo que pediste; se
  puede sumar más adelante si hace falta que el admin también lo cargue a mano.
  **Commiteado: `4b5a227`** (`feat: bloque horario real de la orden y disponibilidad del tecnico
  (Fase 4 de zona de trabajo)`, 12 archivos, 340 inserciones, 3 eliminaciones). Sin push.
- [x] **Fase 5** — Admin: distancia + conflicto en el modal de asignar, contador de técnicos en zona
  en la orden pendiente.
  Nuevo `src/lib/technicianDistance.ts`: `distanceKm()` (fórmula de Haversine, sin dependencias
  nuevas — mismo criterio que el radio de "Zona de trabajo" de la Fase 2), `distanceToOrderKm()`
  (distancia orden↔zona declarada del técnico, `null` si a cualquiera de los dos le falta
  coordenadas — nunca inventa una distancia) e `isWithinWorkZone()` (compara esa distancia contra el
  radio declarado, `false` por defecto ante cualquier dato faltante).
  Sumado a `src/lib/technicianSchedule.ts`: `findConflictingOrder(technicianId, order, allOrders)` —
  chequeo puro sobre las órdenes ya cargadas en memoria del admin (sin red, a diferencia de
  `isTechnicianAvailable`), busca otra orden activa (`assigned`/`in_progress`/`paused`) que ese mismo
  técnico ya aceptó (`technicianResponseStatus === 'accepted'`) para la misma fecha y un bloque que
  podría superponerse. `blocksMayOverlap()` trata `'unscheduled'` en cualquiera de las dos puntas (u
  órdenes viejas sin `appointmentBlock`, de antes de la Fase 4) como "podría solaparse" en vez de
  descartar el conflicto — mismo criterio de avisar de más que de menos.
  `AdminHubView.tsx`: `assignSort` ahora admite `'distance'` (nuevo botón "Más cerca" en el modal,
  solo visible si la orden tiene coordenadas); nuevo estado `assignAvailability` con un efecto que
  hace un solo batch de `isTechnicianAvailable()` al abrir el modal (mismo patrón que
  `assignEligibility`, ya existente); nuevo `zoneCountsByOrderId` (memo, sin red) que para cada orden
  sin asignar y geocodificada cuenta técnicos dentro de su zona declarada y, de esos, cuántos están
  disponibles (toggle) y sin otra orden aceptada superpuesta — deliberadamente más liviano que el
  chequeo del modal (que si consulta la base) porque se recalcula por cada orden visible en la lista
  y no escala igual. Se sumó un chip nuevo junto a "Sin asignar" en la tarjeta de la orden
  (`"N en zona · M libres"` o `"Sin técnicos en zona"`), y en cada técnico del modal de asignar, tres
  avisos nuevos: distancia en km (con "fuera de su zona declarada" si corresponde), "No disponible
  este turno según su agenda" y "Ya tiene {orden} aceptada ese día/turno". Los tres son puramente
  informativos: no ocultan a ningún técnico, no cambian si `isEligible` permite el click de asignar —
  mismo criterio de "aviso, nunca bloqueo" de toda esta funcionalidad.
  Tests nuevos: `src/lib/technicianDistance.test.ts` (8 tests: distancia cero, una referencia real
  —Glew a Capital ~34km—, y los `null`/`false` por defecto de `distanceToOrderKm`/`isWithinWorkZone`
  ante datos faltantes) y 8 tests nuevos de `findConflictingOrder` en `technicianSchedule.test.ts`
  (encuentra el conflicto real, ignora la propia orden/otro técnico/respuesta pendiente o
  rechazada/orden cancelada o completada/otro día/otro bloque sin solapar, y confirma que
  `'unscheduled'` de cualquier lado no descarta el conflicto).
  **Verificado**: `tsc --noEmit` limpio y `vitest run` **174/174 tests, 22/22 archivos, todo verde**
  (158 de la Fase 4 + 16 nuevos). La prueba manual de click-through en el navegador (ver el chip en
  una orden sin asignar, el botón "Más cerca" y los avisos por técnico en el modal) se decidió
  saltear esta vez — a diferencia de la Fase 4, acá no hubo un bloqueo externo, fue una decisión
  explícita para no gastar el tiempo del click-through dado que: (a) toda la lógica con riesgo real
  (distancia, zona, conflicto) quedó 100% cubierta por tests unitarios; (b) `tsc --noEmit` pasa limpio
  sobre todo `AdminHubView.tsx`, lo que ya descarta errores de nombres de campo o tipos en el nuevo
  JSX; y (c) las tres piezas nuevas son estrictamente informativas, nunca bloquean ni ocultan una
  asignación — en el peor caso, un problema de wiring no detectado haría que un chip o un aviso no se
  muestre bien, nunca que se rompa la asignación en sí. Lo que sí queda sin verificar a ojo es el
  renderizado real en el navegador con datos reales (que el chip/los avisos efectivamente aparezcan
  donde y cuando corresponde) — se puede retomar esa prueba manual más adelante si aparece algo raro
  en el uso real, antes de dar por buena definitivamente esta fase.
  **Commiteado: `81e3db3`** (`feat: distancia, zona y conflicto de agenda en el modal de asignar
  (Fase 5 de zona de trabajo)`, 6 archivos, 388 inserciones, 10 eliminaciones). Sin push.
- [x] **Fase 6** — Verificación: `tsc --noEmit`, tests unitarios de `technicianDistance.ts` y
  `technicianSchedule.ts`, tests de rollback contra la base real para las migraciones nuevas,
  click-through completo (Cursor/vos en Windows): técnico carga su zona y agenda → cliente pide un
  servicio en esa zona → admin ve el contador y el orden por distancia → asigna a alguien con
  conflicto y confirma igual → asigna a alguien libre sin problema.
  `tsc --noEmit` y `vitest run` (174/174) ya venían verificados desde el cierre de la Fase 5, sin
  cambios de código en esta fase que ameriten repetirlos.
  **Rollback de las 4 migraciones de este módulo, contra la base real**: dentro de una única
  transacción (`begin; ...reversa completa de las 4 migraciones en orden inverso...; select
  verificación; rollback;`, nunca se hizo commit) se revirtieron, en orden: `service_orders_appointment_block`
  (drop del CHECK + la columna), `technician_is_available` (drop de `is_available`/
  `availability_updated_at`), `technician_agenda` (drop de las 2 policies + las 2 tablas
  `technician_working_hours`/`technician_availability_exceptions`) y `technician_work_zone` (drop de
  los 3 CHECK + las 5 columnas `work_zone_*`). Verificación con 4 `select count(*)` contra
  `information_schema` confirmó que las 4 reversas dejan **0 columnas/tablas remanentes**, sin
  errores de sintaxis ni de dependencias (por ejemplo, las policies de `technician_agenda` se
  dropean antes que las tablas). Conclusión: si alguna vez hace falta revertir este módulo completo,
  las 4 migraciones se pueden deshacer limpiamente y en este orden, sin dejar nada residual.
  **Click-through en el navegador**: como el `client_lat`/`client_lng` de una orden solo se completa
  hoy vía el flujo real de pago (Mercado Pago, con problemas de cuentas sandbox ajenos al código —
  mismo bloqueo que en la Fase 4), en vez de saltear del todo la prueba se cargaron a mano por SQL
  coordenadas de prueba en una orden real ya existente y sin asignar (`dd0f52d3-c069-460c-8a84-808e6888240f`,
  ~3km del centro de la única zona de trabajo declarada hoy, la de María Rodríguez en Junín) y
  `appointment_block='morning'` — revertido a `null`/`null`/`'unscheduled'` apenas terminada la
  prueba, no quedó dato de prueba en la base. Con eso, click-through hecho en `localhost` (vía otra
  herramienta de código corriendo directo en la máquina de Sandy, dado que el sandbox Linux de esta
  sesión no puede levantar Vite por un choque de plataforma en `node_modules` — no se instaló nada
  ahí para no romper el entorno de Windows real):
  - El chip nuevo aparece exactamente como se diseñó: `"1 en zona · 1 libres"` al lado de "Sin
    asignar", con el tooltip explicativo.
  - En el modal "Asignar técnico": los tres botones de orden (Nombre/Mejor rating/Más cerca) presentes,
    "Más cerca" visible porque la orden tiene coordenadas.
  - María Rodríguez (única con zona declarada) muestra `"@ 3 km"`, sin aviso de "fuera de su zona
    declarada" — correcto, cae dentro de su radio de 35km.
  - Los otros 3 técnicos (sin zona declarada) no muestran ninguna línea de distancia — comportamiento
    esperado, no un bug.
  - Consola del navegador sin errores, antes y después de abrir el modal.
  No se probaron a mano los avisos de conflicto de agenda ("Ya tiene X aceptada ese día/turno") ni de
  disponibilidad ("No disponible este turno según su agenda") porque hubiera hecho falta fabricar una
  segunda orden activa aceptada del mismo técnico en la misma fecha/bloque — se decidió no sumar más
  datos sintéticos a la base real solo para esto, dado que esa lógica (`findConflictingOrder`,
  `isTechnicianAvailable`/`resolveAvailability`) ya está 100% cubierta por tests unitarios (Fases 4 y
  5) y usa el mismo patrón de renderizado condicional ya verificado a ojo con la distancia/zona en
  este mismo click-through — el riesgo residual ahí es mínimo.
  **Fase 6 cerrada.**
- [x] **Fase 7** — Cierre. Como cada fase anterior ya se fue commiteando por separado (Fases 1-6, un
  commit de código + uno de doc por fase), el "cierre y commits" que imaginaba esta fase al planear
  ya estaba hecho — quedó solo una prolijidad chica pendiente de fases anteriores:
  - Borrado `api/_lib/mapbox.ts` (stub muerto desde la Fase 1, reemplazado por Nominatim — sin
    ninguna importación activa, confirmado con un `grep` antes de borrar).
  - Corregidos 3 comentarios que todavía decían "Mapbox"/`api/_lib/mapbox.ts` en vez de
    "Nominatim"/`api/_lib/geocoding.ts` (`api/payments/webhook.ts` ×2, `api/_lib/geocoding.ts`,
    `src/types/index.ts`).
  - Corridos los advisories de seguridad y performance de Supabase después de las 4 migraciones
    nuevas de este módulo: **ningún hallazgo menciona `technician_working_hours`,
    `technician_availability_exceptions`, ni las columnas `work_zone_*`/`is_available`/
    `appointment_block`** — todo lo que aparece (RLS sin política en 2 tablas de borradores de pago,
    funciones `SECURITY DEFINER` ejecutables por `anon`/`authenticated`, protección de contraseñas
    filtradas deshabilitada, foreign keys sin índice) es preexistente de otras partes de la app, no
    introducido por este trabajo.
  **Verificado**: `tsc --noEmit` limpio y `vitest run` 174/174 de nuevo (sin cambios de lógica, solo
  comentarios y un archivo sin uso borrado).
  Con esto, el módulo completo de "Zona de trabajo + Agenda del técnico + Asignación por distancia y
  horario" queda commiteado localmente de punta a punta (Fases 1-7), **sin push a `origin/main`
  todavía** — eso queda para cuando Sandy lo pida explícitamente. Antes de ese push conviene tener
  presente: (a) la Fase 4 no tuvo verificación manual completa de Mercado Pago por el problema de
  cuentas sandbox (cobertura por tests unitarios en su lugar); (b) queda pendiente, fuera de alcance
  de este plan, que el admin pueda cargar la franja horaria al crear una orden a mano; y (c) el mapa
  de admin mencionado como opcional en el punto 4.4 nunca se construyó — no bloqueaba nada y no se
  pidió explícitamente.

Cada fase se confirma antes de arrancarla, como ya veníamos haciendo con los otros módulos grandes.

## Bug post-lanzamiento (11/9/2026): mapa sin cartografía en "Zona de trabajo"

Sandy reportó desde el celular (María Rodríguez, rol Técnico) que en `WorkZone.tsx` el mapa se ve
gris — el círculo de cobertura y el punto central sí aparecen, pero sin calles/imagen de fondo — y
que buscar localidad/provincia con "Ubicar" "no posiciona" el mapa.

**Causa real, una sola para los dos síntomas**: el header `Content-Security-Policy` en `vercel.json`
(agregado antes de este módulo, por seguridad general del sitio) trae un `img-src` que solo permite
`'self' data: https://ayszrtieplmqscqtabsu.supabase.co` — no incluye los dominios de tiles de
OpenStreetMap (`a/b/c.tile.openstreetmap.org`) que usa el `L.tileLayer(...)` de Leaflet. El navegador
bloquea esas imágenes por CSP (sin romper nada más), y como el marcador es un `divIcon` (HTML/CSS
inline) y el círculo es SVG, ambos se dibujan igual — de ahí que se vea "la mitad" del mapa
funcionando. Y como sin las tiles no hay calles ni nombres de lugar como referencia visual, un
recentrado correcto del mapa (`map.setView(...)` tras geocodificar) es indistinguible de que "no pasó
nada" — de ahí el segundo síntoma reportado, que no es un bug aparte.

Se descartó que fuera el `connect-src`: `geocodeWorkZoneLocality` en `src/lib/technicianWorkZone.ts`
llama a `/api/technicians/geocode-work-zone` (mismo origen), y es esa ruta la que en el servidor
llama a Nominatim (`api/_lib/geocoding.ts`) — el navegador nunca contacta a Nominatim directo, así que
ese header no necesitaba cambios.

**Fix**: agregado `https://*.tile.openstreetmap.org` al `img-src` de `vercel.json`. Sin cambios de
código en `WorkZone.tsx` ni en la lógica de geocodificación — era puramente el header.
