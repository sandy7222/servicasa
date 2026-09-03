# Changelog

Registro de cambios funcionales relevantes de TecniUrbano. No reemplaza `git log`
(los detalles de implementación están en los commits y las migraciones) — es un
resumen de qué cambió para el negocio y qué evidencia lo respalda.

## 2026-09-03 (cont. 6) — Foto real del asistente de diagnóstico

Commit: (pendiente).

Sandy pidió cerrar el flujo de la foto que el cliente puede adjuntar en el
asistente de diagnóstico (`DiagnosisAssistant.tsx`): hasta ahora solo se
guardaba el nombre del archivo, nunca el contenido, aunque ya existía la
infraestructura en Supabase (bucket privado `diagnosis-photos` y tabla
`order_diagnosis_photos`).

- **El problema de fondo:** el asistente corre antes de que exista una
  cuenta o una orden, pero las policies de RLS de `diagnosis-photos` exigen
  una orden real ya pagada (`service_orders.id` como carpeta, con técnico
  asignado o `payment_status = 'deposit_paid'`) — un invitado no autenticado
  no puede subir nada ahí directamente.
- **Solución:** la foto se sube de una al elegir el archivo (comprimida en
  el navegador a ~1600px/JPEG antes de mandarla, para no pegarle al límite
  de 4.5MB de las funciones de Vercel) a un endpoint público nuevo
  (`api/orders/upload-diagnosis-photo.ts`, con service role) que la deja en
  `pending/<draftId>/photo.jpg` — `draftId` es un UUID generado en el
  navegador al abrir el asistente, sin relación con ninguna cuenta u orden.
  Esa ruta viaja con el resto del pedido armado por el asistente
  (`sessionStorage` → formulario → `guest-checkout`/`request-service`,
  validada con una regex estricta contra cualquier otra ruta) hasta el
  webhook de Mercado Pago, que al confirmarse el pago mueve el archivo a
  `<order_id>/photo.jpg` (con la Storage API, no SQL directo) e inserta la
  fila real en `order_diagnosis_photos`.
- **Visualización:** un componente único (`DiagnosisPhotoCard.tsx`) muestra
  la foto igual en el detalle de la orden del técnico y del admin — sin
  versión distinta por rol, usando siempre una signed URL porque el bucket
  es privado.
- **Borrado automático, nuevo Vercel Cron** (`api/cron/cleanup-diagnosis-photos.ts`,
  corre 06:00 UTC): borra archivo + fila recién a los 30 días de que la
  orden pasa a `completed`, salvo que tenga un `support_case` vinculado que
  siga sin `closed` — cubre la ventana de 48hs para reclamar y toda la
  garantía. Requiere cargar `CRON_SECRET` en las env vars de Vercel (no
  existía ese patrón en este proyecto; los 2 cron jobs previos eran SQL puro
  vía `pg_cron`, pero este necesita llamar a la Storage API). Fotos huérfanas
  (foto sacada en el asistente, pedido nunca confirmado) no se limpian por
  ahora — quedan sueltas en `pending/`, fue una decisión explícita de Sandy
  para no meter alcance de más.

## 2026-09-03 (cont. 5) — Base para la descarga real de Android (TWA)

Commit: `1a878c8`.

Sandy pidió activar la descarga real de Android en la sección "Descargá
TecniUrbano" (QR + botón), dejando iOS intacto ("Muy pronto"), con un
pipeline de CI que genere y publique el APK automáticamente.

- **Frontend, ya activo y probado:** `DownloadAppSection.tsx` ahora usa
  `qrcode.react` para un QR real (antes esperaba, por error, que
  `APP_DOWNLOAD_URL` fuera la URL de una imagen). `appLinks.ts` quedó con
  un solo `ANDROID_APK_URL` (reemplaza `GOOGLE_PLAY_URL`/`APP_DOWNLOAD_URL`
  — no es Play Store, es un APK directo) que alimenta el QR y el botón de
  Android a la vez. Probado con una URL de prueba: el botón se activa sin
  el badge "Muy pronto" y el QR renderiza un path SVG real; iPhone
  (`APP_STORE_URL`) sigue exactamente igual. Con `ANDROID_APK_URL` en
  `undefined` (su valor real hoy), el comportamiento visible no cambió.
- **Pipeline de CI, armado pero sin poder probarlo de punta a punta**
  (`.github/workflows/build-android-twa.yml`): en cada push a `main`, si
  los 4 secretos de firma están cargados, restaura el keystore, fija
  `versionCode` = número de corrida (autoincremental sin tocar nada a
  mano), corre `bubblewrap update` + `build`, y publica el APK como asset
  de un GitHub Release fijo (`android-latest`) — URL estable entre
  versiones. Si los secretos no están, el job se salta solo, sin romper
  el resto del CI.
- **Decisión de seguridad importante, no pedida explícitamente:** el plan
  original contemplaba generar el keystore en un workflow de CI y subirlo
  como *artifact* para que Sandy lo bajara — pero este repo es público, y
  cualquier artifact de un run público queda descargable por cualquiera.
  Eso hubiera expuesto la clave de firma de la app. El keystore se genera
  ahora **a mano, en la máquina de quien lo administre, nunca en CI ni en
  este chat** — ver `docs/android-twa-setup.md`.
- **Otro ajuste sobre la marcha, verificado contra la documentación real
  de Bubblewrap (no solo memoria):** `bubblewrap build` no puede arrancar
  de cero desde un `twa-manifest.json` escrito a mano — necesita el
  proyecto Android completo que genera `bubblewrap init`, y `init` es
  interactivo (genera el keystore en el momento) sin un modo confiable
  100% no interactivo — es una limitación conocida y todavía abierta del
  propio proyecto Bubblewrap. Por eso el diseño final es: `init` se corre
  una sola vez a mano (junto con la generación del keystore), el proyecto
  resultante (sin el keystore) se commitea, y CI solo hace `update` +
  `build` sobre ese proyecto ya generado — eso sí está documentado como
  soportado sin interacción.
- `public/.well-known/assetlinks.json` agregado con un fingerprint
  placeholder — se completa con el real recién cuando exista el keystore
  (paso a paso en la documentación).
- **Pendiente, a cargo de Sandy, fuera de este chat:** generar el
  keystore (`docs/android-twa-setup.md` da los comandos exactos), cargarlo
  como secreto del repo, completar el fingerprint real, y recién ahí
  poner la URL real en `appLinks.ts`. Nada de esto se hizo desde acá — ni
  siquiera se disparó el workflow una vez, a propósito.
- `tsc`/`vitest` (106/106)/`build` limpios. YAML del workflow validado
  sintácticamente, pero **no ejecutado ni una vez** (no hay Java/Android
  SDK en este entorno) — la primera corrida real puede necesitar un ajuste.

## 2026-09-03 (cont. 4) — Dos correcciones puntuales del Hero

Commit: `f2366c1`.

Sandy reportó, con captura, dos problemas visuales en el Hero.

- **Desborde de letras:** el párrafo tenía su propio `max-w-xl` (576px),
  más ancho que la columna de texto real en desktop (`lg:max-w-[45%]`,
  ~547px a 1440px de ancho) — el texto se corría hacia la zona del
  degradado. Corregido con `lg:max-w-none` para que el párrafo respete el
  ancho real de su columna en desktop (mobile/tablet sin cambios).
- **Fondo no unificado:** la fusión foto/fondo usaba un color plano fijo
  (`#00203d`) mientras el fondo de la sección es un degradado vertical de
  3 paradas — a media altura no coincidían, dejando ver una franja. Ahora
  la fusión usa exactamente el mismo degradado vertical que el fondo de
  la sección como color, y una máscara aparte solo para el desvanecido
  horizontal — mismo color en cualquier altura, sin costura visible.
- Verificado en 1440×900 (el desborde y la costura no se reproducen más)
  y en mobile (sin cambios, como esperado). `vitest` (106/106)/`build`
  limpios.

## 2026-09-03 (cont. 3) — Menú de navegación y encuadre de scroll

Commit: `916ab38`.

Ajuste puntual pedido explícitamente como "no rediseñar la landing" — solo
el menú superior y el punto exacto donde cae el scroll de cada anchor.
Contenido, diseño, funcionalidades, backend, asistente y login sin tocar.

- **Menú:** `Servicios | Cómo funciona | La App | Opiniones | Empresas |
  Trabajá con nosotros | Ingresar al sistema`. Se sacaron "Garantía" y
  "Contacto" del menú superior — **la sección y el contenido siguen
  intactos** (la banda de garantía sigue en la página, el email de
  contacto sigue en el bloque de empresas y en el footer; el footer en sí
  no se tocó, sigue linkeando a `#garantia`/`#contacto`).
- **Encuadre por cálculo, no offset fijo** (`src/lib/landingScrollFraming.ts`,
  nuevo): cada anchor mide su propio título real (no el borde del
  `<section>`, que ya trae padding propio) y deja ~60px debajo del header.
  Para "Cómo funciona" hay una prioridad explícita: si el contenido (título
  + 4 pasos + banda de garantía) no entra completo en el viewport, se
  sacrifica margen superior antes que dejar asomar "La App" — nunca al
  revés. Verificado que la banda de garantía queda al ras del viewport sin
  que el teléfono se asome, en las 7 resoluciones pedidas.
- **Bug real encontrado y corregido en el camino:** en mobile, el momento
  de cerrar el menú hamburguesa y calcular el encuadre pasaba en el mismo
  tick de React — medía la altura del header todavía "alto" por el menú
  desplegado, dando ~433px de margen en vez de 60px. Corregido diferiendo
  el cálculo un tick (`setTimeout(…, 0)`) para que se ejecute después de
  que React cierra el menú.
- **Caso límite, no un bug:** el anchor "Empresas" es la sección anterior
  al footer; en viewports altos el navegador no puede scrollear más allá
  del final real de la página, así que el margen ahí queda mayor a 60px
  cuando el footer completo ya está a la vista — es el comportamiento
  correcto de fin de documento, no algo para forzar.
- Probado en 1440×900, 1366×768, 1280×720, 768×1024, 430×932, 412×915 y
  390×844 — margen ~60px en Servicios/La App/Opiniones/Empresas, sin
  asomo de la sección siguiente en "Cómo funciona", menú hamburguesa
  cierra y hace scroll correcto, "Ingresar al sistema" presente en mobile.
- `tsc`/`vitest` (106/106)/`build` limpios.

## 2026-09-03 (cont. 2) — Dirección de arte y refinamiento visual de la landing

Commit: `e44700b`.

Segunda etapa del rediseño (post `d9b777c`), pedida explícitamente como
"solo visual polish" — sin tocar arquitectura, contenido, rutas, backend,
autenticación, ni la lógica del asistente. Alcance: CSS, composición,
jerarquía, espaciado, tipografía y microinteracciones sobre los mismos
componentes ya aprobados.

- **Sistema visual global:** paleta consistente (azul marino `#0B1B33` en
  header/footer, azul TecniUrbano `#003875` en fondos importantes, turquesa
  como acento, blanco y `#F1F5FB` para alternar secciones) — ritmo:
  azul (hero) → blanco (servicios) → azul muy claro (cómo funciona) → banda
  azul (confianza) → azul con profundidad (descarga app) → blanco
  (testimonios) → superficie clara (empresas) → marino (footer).
- **Hero:** degradado de fusión foto/fondo de 5 paradas (antes: 3 paradas,
  banda fija de 192px) ocupando ~24% del ancho de la foto — técnico
  nítido, sin oscurecer. Jerarquía tipográfica reforzada (H1 más grande,
  línea partida "Soluciones rápidas para" / "tu hogar"), beneficios con
  íconos en superficie circular turquesa.
- **Servicios:** sección ~15-20% más baja (menos padding vertical, no
  cards más chicas); 3 columnas cuando hay exactamente 6 categorías
  (caso real hoy) en vez de 4+2; se sacó el estado de foco persistente que
  hacía ver una tarjeta como "seleccionada" sin serlo.
- **Cómo funciona:** fondo `#F1F5FB` propio (antes compartía tono con
  Servicios), números "01-04" en turquesa, círculos con sombra muy suave,
  textos acortados — menos "timeline técnico", más "esto es fácil".
- **Banda de confianza:** separadores verticales sutiles en desktop,
  funciona como una sola unidad (nunca fueron cards individuales).
- **Sección de descarga de app — la corrección más grande:** tratada como
  "segundo hero" (fondo con profundidad + halo turquesa). El teléfono
  ocupaba antes un rectángulo blanco liso; se probaron y descartaron dos
  técnicas para disolver ese fondo (máscara de opacidad → dejaba un halo
  blanco peor que el rectángulo original; `mix-blend-mode: multiply` →
  oscurecía ilegible la propia pantalla de la app contra un fondo tan
  oscuro). Solución final: recorte más ajustado del mismo asset (mismo
  `app-celular.png`/`.webp`, sin reemplazarlo — ver `scripts/trim-phone.mjs`,
  ya removido) presentado sobre una tarjeta blanca redondeada con sombra
  suave — una superficie deliberada en vez de "una foto pegada".
- **Testimonios y familia:** tarjetas con borde/sombra más suaves, nombre
  en semibold. El aviso "Ejemplo ilustrativo — todavía no contamos con
  testimonios reales publicados" se conservó intacto, sin tocar.
- **Empresas:** superficie clara consistente con el resto, email
  incorporado al bloque, sigue claramente secundaria frente a la app.
- **Footer:** mismo azul marino que el header, jerarquía y espaciado
  refinados.
- **Asistente flotante:** cero cambios de lógica — solo `hover:scale-[1.03]`
  sutil (respeta `prefers-reduced-motion`).
- **Bug real encontrado en la verificación, no pedido explícitamente:** a
  768px (tablet) el nav de escritorio del header (`md:flex`, activo desde
  768px) no entraba — "Trabajá con nosotros" se cortaba en 3 líneas y todo
  quedaba apretado contra el logo. Corregido moviendo el breakpoint del nav
  de escritorio a `lg:` (1024px); hasta 1023px queda el menú hamburguesa,
  que sí tiene espacio de sobra. Verificado en 1440/1280/1024/768/430/390px.
- `tsc`/`vitest` (106/106)/`build` limpios. Verificado en vivo: hero,
  servicios, cómo funciona, banda de confianza, descarga de app (incluida
  la tarjeta del teléfono), testimonios, empresas y footer en desktop y
  mobile; sin errores de consola; sin scroll horizontal en ningún ancho
  probado.

## 2026-09-03 (cont.) — "Trabajá con nosotros", foto del hero más grande, y el bug real del header duplicado en sesión activa

Commit: `36c556c`.

Sandy revisó el sitio en vivo desde su propio navegador y pidió dos ajustes
sobre `fa3e63b`, más una tercera nota que resultó ser un bug real (no solo
un problema de la landing).

- **"Trabajá con nosotros"** agregado en `LandingHeader.tsx` (nav superior y
  menú mobile) y en `LandingFooter.tsx`, apuntando a `/auth?mode=apply`.
  Nuevo: `AuthView` ahora lee `?mode=` de la URL (mismo patrón que ya
  usaba `?invite=`) para caer directo en "Creá tu cuenta de técnico" en vez
  de la pantalla neutra de login — verificado en vivo.
- **Foto del técnico en el Hero, agrandada** acercándola a la proporción del
  boceto original: en desktop ahora ocupa todo el alto de la sección y se
  extiende hasta el borde derecho (antes era un recuadro más chico y
  centrado verticalmente). Mobile sin cambios (foto contenida debajo del
  texto). No hizo falta reexportar el asset — el original nativo (1536px)
  ya alcanza para el contenedor más grande.
- **Bug real, no solo un problema de la landing:** un usuario con sesión
  activa de cualquier rol que visitaba `/#/auth` (por ejemplo, vía el link
  nuevo "Trabajá con nosotros") veía el formulario de login/alta con el
  `<Header/>` compartido de su sesión superpuesto arriba — confuso para un
  técnico externo, y preexistente al rediseño (el header compartido siempre
  se mostró en `/auth`, el fix de `fa3e63b` solo cubría `/`). Corregido en
  `AuthView.tsx`: si hay sesión activa y no es una redención de invitación
  ni un checkout de invitado en curso, redirige de inmediato al panel del
  usuario (`/hub`, `/technician` o `/customer` según el rol) sin llegar a
  renderizar el formulario. Verificado en vivo: logueado como admin,
  navegar a `/#/auth` a mano rebota a `/hub` sin flash del formulario.
- `tsc`/`vitest` (106/106)/`build` limpios.

## 2026-09-03 — Rediseño visual de la landing pública

Commit: `26520b0`.

Rediseño de apariencia de `tecniurbano.online` pedido por Sandy con una spec
completa (recursos gráficos reales del técnico, la familia, el logo y el
asistente, más un boceto de referencia). Alcance explícito: **cambiar la
apariencia sin romper el comportamiento** — cero reconstrucción funcional.

- **Nuevo header de marketing solo para la landing pública.** El `<Header/>`
  compartido de las vistas autenticadas (admin/técnico/cliente) no se tocó
  — sigue exactamente igual. `LandingView` ahora arma su propio header
  (logo, nav a Servicios/Cómo funciona/Garantía/Contacto, "Ingresar al
  sistema") y `App.tsx` omite el header compartido solo cuando la ruta es
  `/` y no hay sesión iniciada (una condición de una línea, sin tocar
  `Header.tsx`). Verificado en vivo: el header compartido con nav por rol
  sigue intacto al loguear como admin.
- **"Ingresar al sistema" se movió del hero al header** (mismo
  `navigate('/auth')`, es una relocación de layout, no un cambio de
  comportamiento — confirmado con Sandy antes de tocarlo).
- **Secciones nuevas construidas desde cero** (no existían antes, nada que
  preservar ahí): modal "Cómo funciona" accesible (Escape, foco atrapado,
  restaura el foco al cerrar — verificado en vivo), resumen de 4 pasos en
  página, banda de garantía/reclamos/pagos, sección de descarga de app con
  QR (desktop) / botones grandes (mobile), bloque de empresas B2B con
  formulario y modal de confirmación.
- **Grilla de servicios**: se mantiene 100% dinámica desde Supabase
  (`catalogCategories`/`services`, mismo `navigate` a
  `/services-category/:name`) — solo cambió el estilo de tarjeta.
- **Testimonios marcados explícitamente como ejemplo ilustrativo** (antes
  usaban nombres reales de clientes de prueba del proyecto sin ningún
  aviso — corregido de paso, era justo lo que pedía la spec).
- **Asistente flotante**: cero cambios de lógica, solo la imagen nueva
  (`asistente-avatar.png`) en sus 3 usos.
- **Descarga de app sin fingir que funciona**: la URL real depende de otro
  encargo (empaquetado TWA/PWA). Mientras `src/lib/appLinks.ts` no tenga
  valores reales, el QR y los botones muestran "Muy pronto" en vez de
  apuntar a cualquier lado.
- **Formulario de empresas sin backend todavía**: valida y muestra la
  confirmación que pide la spec, pero no manda nada a ningún lado — queda
  un comentario marcando dónde conectar la API real.
- **Imágenes optimizadas**: las fotos provistas (hasta 2,6MB) se
  redimensionaron y convirtieron a WebP (con fallback PNG/JPG vía
  `<picture>`) con `sharp` en un script de uso único, ya removido del
  proyecto — quedaron reducidas a 40-90KB cada una. Los originales sin
  procesar quedan en `src/assets/landing/source/` (gitignored, no se
  suben).
- **Retirado del services grid**: la tarjeta "Operación Real / Crear orden
  en Admin Hub" que mezclaba contenido de demo/QA con la landing pública
  — contradice el objetivo explícito de la spec de no leerse como una
  herramienta interna. Es la única eliminación de contenido de esta
  sesión; el resto es agregado o restyling.
- `tsc`/`vitest` (106/106)/`build` limpios. Verificado en vivo en el
  navegador: modal con foco/Escape, formulario de empresas de punta a
  punta, menú mobile, header compartido intacto para admin, sin errores
  de consola.

## 2026-09-02 (noche) — Problema 9: "Nueva Orden" del Admin Hub no podía crear órdenes

Commit: `de0909d`.

Sandy reportó, haciendo el smoke test manual de la Fase 10 (flujo 3,
asignación técnica), que "Nueva Orden" en el Admin Hub fallaba siempre con
`null value in column "service_status" of relation "service_orders" violates
not-null constraint`, reproducido dos veces. Impacto real: **ningún pedido
por teléfono/WhatsApp/en persona se podía cargar** — el Admin Hub dependía
100% de que el cliente pasara por el checkout web (que sí completa ese
campo).

- **Causa raíz confirmada:** `service_orders.service_status` es `NOT NULL`
  sin default (a diferencia de `status`, `quote_status` y `payment_status`,
  que sí tienen). `persistCreateOrder` (`src/lib/supabaseMutations.ts`,
  el único inserto de `service_orders` que usa el Admin Hub) nunca mandaba
  ese campo. El flujo de checkout (`api/payments/webhook.ts`) sí lo manda
  explícitamente (`service_status: 'pending'`) en sus dos ramas — por eso
  nunca se había visto ahí.
- **Auditado el resto del código:** de los 6 archivos que referencian
  `service_orders`, solo esos dos insertan filas nuevas. Ninguna otra ruta
  (edge functions, otros formularios) tiene el mismo problema.
- **Corregido en dos capas**, como pidió Sandy: `alter table service_orders
  alter column service_status set default 'pending'`
  (`20260903023741_service_orders_service_status_default.sql`) como red de
  seguridad para cualquier insert futuro que no lo mande, más
  `persistCreateOrder` ahora manda `service_status: 'pending'` explícito.
  Verificado con un insert real contra producción dentro de una transacción
  con `rollback` (sin dejar datos de prueba): la fila queda con
  `service_status='pending'` sin mandarlo. `tsc`/`vitest` (106/106)/`build`
  limpios después del cambio.

## 2026-09-02 — Fase 10: prueba de restauración de punta a punta y rotación de la contraseña de prueba

Commit: `0e728e9`.

Sandy autorizó explícitamente dos de los tres pendientes de la pasada de
release manager del mismo día (ver `docs/fase10-checklist.md`, Actualización
2/9, quinta pasada; `ROADMAP-TERMINACION.md`, Cuarta actualización de la
Fase 10).

- **Restauración del backup, probada de punta a punta.** Instalé un servidor
  Postgres 17 local, desechable, vía la distribución portable de EDB (sin
  instalador, sin servicio de Windows, sin elevación). Restauré
  `backups/pg_dump_2026_09_02.sql` contra él: **51/51 tablas**, con filas
  reales confirmadas (`customers`, y las dos `service_orders` de prueba ya
  conocidas de esta sesión). Los únicos errores del restore fueron
  esperables — roles y esquema `auth` propios de Supabase, ausentes en un
  Postgres vanilla — y no afectan una restauración real contra un proyecto
  Supabase, donde ya existen de fábrica. Todo el footprint (binarios, datos)
  se borró al terminar.
- **Contraseña de prueba `TecniUrbano2026!` rotada.** Generé una nueva
  contraseña y la apliqué a las 4 cuentas reales de Supabase Auth que la
  compartían, vía la API admin de Supabase; verifiqué que autentica de
  verdad contra Supabase real antes de tocar el repo. Actualizada en los 5
  lugares donde es referencia viva (`agent.md`, `README.md`,
  `playwright.config.ts`, `src/lib/supabaseData.ts`, `src/views/AuthView.tsx`);
  las menciones históricas fechadas de este changelog y del roadmap
  quedaron intactas a propósito, para no falsear el registro.

## 2026-08-30 (noche, cont.) — Auditoría de "la seña ya no se descuenta": copy pendiente + un presupuesto congelado con el cálculo viejo

Sandy pidió, en estos términos, "eliminar la lógica de `visit_deposit_credit`"
como si todavía existiera. Antes de tocar nada, verifiqué contra la base y
el código real — ver `docs/adr-liquidacion-visita.md`, sección "Seguimiento".

- **Ya estaba hecho:** `sync_quote_totals_from_items()` (migración de esta
  misma sesión, `20260830013220`) ya calcula
  `remaining_amount = total_amount` sin restar `visit_deposit_credit`.
  Confirmado leyendo la función en vivo — no había nada que eliminar de
  nuevo.
- **Gap real, corregido:** `ServiceRequestForm.tsx` y
  `GuestServiceRequestForm.tsx` todavía decían "La seña vigente es
  {monto} y se descuenta si aceptás el presupuesto" en el selector de modo
  — quedó sin tocar en la Fase 2 del rediseño de dirección (ese cambio
  solo tocó el bloque de domicilio). Reemplazado por: "Visita de
  presupuesto: {monto}. Este monto corresponde a la visita y se cobra de
  forma independiente del valor del trabajo."
- **Dato real congelado, corregido puntualmente:** el presupuesto de la
  orden `00e57e92-e889-421c-b658-55b18542faed` (German Gauna) se creó y
  envió **antes** de la corrección del trigger (2026-08-30 00:06 UTC vs.
  01:32 UTC) — al estar `sent`, quedó congelado para siempre con
  `remaining_amount = 14300` (64300 − 50000). Corregido a `remaining_amount
  = 64300`, `visit_deposit_credit = 0` en una migración puntual que
  deshabilita/rehabilita el trigger de inmutabilidad solo para esa fila.
  `api/payments/create.ts` lee `quote.remaining_amount` directo al cobrar
  el saldo, así que el cliente ahora paga el monto correcto sin más
  cambios de código.
- **Auditoría completa:** de 18 archivos con la palabra "seña" (varios
  falsos positivos de "contraseña"), solo esos dos textos afirmaban un
  descuento. El resto son labels de estado neutros
  (`VisitFeeSettings.tsx` ya decía correctamente "sin descuento entre
  ambos"; los títulos de ítem de Mercado Pago solo nombran el cobro). No
  se encontró ningún otro lugar asumiendo el descuento viejo.
- **Orden de Marcos Abate** (`c9d9d945-...`): confirmada
  `completed`/`paid_in_full` — sin tocar, como pidió Sandy.

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build`
sin errores. `get_advisors` (security) sin hallazgos nuevos.

Commit: `767492d`.

## 2026-08-30 (noche, cont.) — Rediseño de dirección, Fase 3: guardar y reutilizar direcciones del cliente

Alcance definido por el propio documento de Fase 3 de Sandy —
`docs/adr-address-redesign.md` tiene el detalle completo.

**Gap encontrado al re-verificar antes de tocar nada:** Sandy había
marcado "estado verificado, no requiere cambios", pero `customer_addresses`
**no tiene columna de provincia** (confirmado contra
`information_schema.columns`). Como pidió explícitamente "Fase 3 sin
migraciones nuevas", se implementó con ese trade-off declarado: una
dirección guardada no recuerda la provincia, así que al reutilizarla el
cliente confirma la provincia con un clic (no vuelve a *tipear* nada). Una
migración de una columna lo resolvería del todo si se prefiere.

**Implementado:**
- `src/lib/useCustomerAddresses.ts`: único hook con todo el CRUD sobre
  `customer_addresses` (list/create/update/delete/set default), usado por
  `ServiceRequestForm.tsx` y el nuevo `CustomerAddressesPanel.tsx` — mismo
  criterio anti-duplicación que `AddressFields.tsx` en la Fase 2.
- `ServiceRequestForm.tsx`: selector de dirección guardada (con la default
  preseleccionada) + "Agregar nueva dirección"; elegir una precarga los
  campos, **editables** (decisión mía — el documento lo dejaba "a
  definir"), sin modificar la dirección guardada.
- Checkbox "Guardar esta dirección para próximos pedidos", solo en modo
  "nueva dirección"; la primera dirección de un cliente queda
  `is_default = true` automáticamente.
- `service_orders.client_address_id` conectado de punta a punta —
  incluida una verificación server-side en
  `api/orders/request-service.ts` de que el id de dirección realmente
  pertenezca al caller antes de confiarlo (la ruta corre con
  `supabaseAdmin`, sin RLS).
- `CustomerAddressesPanel.tsx` en "Mi perfil" (`#/customer`): listar,
  crear, editar, eliminar y marcar predeterminada — resuelve el reclamo
  original de Marcos de no poder actualizar su dirección desde su cuenta.
- Guardado de dirección best-effort: si falla, el pedido se envía igual
  con los datos tipeados, nunca bloquea el pago.
- `splitAddressLine()` en `src/lib/address.ts` separa el `address_line`
  combinado guardado en calle/número al precargar, sin agregar columnas.

**Verificación:** primera vez que se escribe de verdad en
`customer_addresses` (antes tenía 0 filas) — ciclo completo insert x2 →
select → cambiar default → update → delete probado con un cliente real
impersonado en rollback; aislamiento confirmado aparte (otro cliente
impersonado no puede ver, actualizar ni borrar una dirección ajena,
`GET DIAGNOSTICS row_count = 0`). Persistido como
`supabase/sql/test_customer_addresses_rls.sql`. Cero residuo confirmado
después. `tsc --noEmit`, `vitest run` (84/84), `npm run build` sin
errores. No hubo click-through en navegador de las pantallas nuevas
(requieren sesión de cliente real autenticada).

Commit: `4ee2ffd`.

## 2026-08-30 (noche) — Rediseño de dirección, Fase 2: componente de dirección compartido, sin más resta de localidad/altura

Corrige el bug real de Marcos Abate (escribió la altura "547" en el campo
de localidad). `docs/adr-address-redesign.md` tiene el detalle completo;
resumen:

- Componente compartido `AddressFields.tsx` + `src/lib/address.ts`
  (`capitalizeWords`, `validateAddressDraft`), usado en
  `ServiceRequestForm.tsx` y `GuestServiceRequestForm.tsx` — antes tenían
  el bloque de dirección duplicado byte a byte (mismo patrón de bug que
  `profiles.customer_id`).
- Calle y Número como inputs separados; Localidad separada de Barrio
  (ahora explícitamente opcional); Localidad rechaza vacío o puramente
  numérico — reproduce y bloquea el caso exacto de Marcos.
- Auto-capitalización de calle/localidad/barrio mientras se escribe
  (pedido explícito de Sandy): "suipacha" → "Suipacha" al instante.
- Validación replicada en el servidor (`api/orders/request-service.ts`,
  `api/orders/guest-checkout.ts`) — nunca se confía solo en el formulario.
- `city` conectado de punta a punta: viaja en el payload del draft y
  `api/payments/webhook.ts` lo escribe en `service_orders.client_city` al
  confirmarse el pago — la columna que dejó lista la Fase 1.

**Hallazgo no pedido pero necesario, corregido en la misma pasada:**
separar `neighborhood` de `city` iba a dejar sin localidad el link de "Cómo
llegar" del técnico y dos pantallas más (`TechnicianView.tsx`,
`WorkHistoryView.tsx`) que armaban la dirección combinando solo
`clientAddress` + `clientNeighborhood`. Se sumó `clientCity` al tipo
`ServiceOrder` y a esos 3 lugares puntuales, sin adelantar la
centralización completa de `formatAddress()` (sigue siendo Fase 4).

**Verificación:** probado en vivo contra el formulario de invitado real
(dev server conectado a producción) — capitalización confirmada al
tipear, y el intento con "547" en Localidad quedó bloqueado sin generar
ningún request de red (`read_network_requests` en cero). No se completó un
envío válido real para no crear un draft ni tocar Mercado Pago en vivo sin
necesidad. `tsc --noEmit`, `vitest run` (84/84), `npm run build` sin
errores.

Commit: `b6a1001`.

## 2026-08-30 (tarde, cont.) — Rediseño de dirección, Fase 1: columnas de localidad en órdenes + cobertura de técnicos por zona

**Origen:** documento de Sandy a partir del reporte de Marcos Abate (escribió
la altura "547" en el campo de localidad, dejando la localidad real vacía) +
revisión directa de la base. Diagnóstico completo en
`docs/adr-address-redesign.md`. Verificado contra la base y el código antes
de escribir una sola línea de SQL — todo lo que describía el documento
resultó exacto, con un detalle adicional encontrado en la auditoría:
`technicians.zone` (texto libre) ya existe pero es puramente decorativo, no
filtra nada.

**Decisiones confirmadas por Sandy:** geocoding diferido (inputs de texto
validados, sin lat/lng todavía); `technicians.zone` se mantiene como label,
sin tocar; alcance de esta sesión limitado a Fase 1 (solo la migración de
base) — las fases siguientes (componente de dirección compartido,
direcciones guardadas, `formatAddress` centralizado, cobertura de técnicos
en la UI, geocoding opcional) se confirman una por una antes de
implementarse.

**Implementado (Fase 1, solo base — sin cambios de UI todavía):**
- `service_orders`: nuevas columnas `client_city`, `client_postal_code`,
  `client_lat`, `client_lng`, `client_address_id` (FK a
  `customer_addresses.id`, `ON DELETE SET NULL`). `client_neighborhood`
  queda igual, ahora explícitamente opcional (barrio dentro de la ciudad,
  ya no hace de localidad).
- `technician_coverage_areas`: tabla nueva para reemplazar el filtrado
  100% manual por zona al asignar técnico. RLS con el mismo patrón que
  `technician_requirements`: admin control total, el técnico solo ve sus
  propias filas.

**Verificado con transacciones de rollback contra la base real:** `ALTER
TABLE`/`CREATE TABLE` corren limpio; un técnico impersonado solo ve su
propia fila de cobertura; un admin impersonado ve todas y puede
insertar/editar/borrar. Después de aplicar en real: 0 filas en la tabla
nueva (sin residuo de las pruebas), la única orden real existente quedó con
`client_city` en `NULL` — sin backfill, como corresponde. `tsc --noEmit`,
`vitest run` (84/84) sin cambios de frontend en esta fase. `get_advisors`
(security) sin hallazgos nuevos.

Commit: `9c0d46f`.

## 2026-08-30 (tarde) — Bug real: clientes autorregistrados no podían pedir servicio, aunque la ficha de admin ya los mostrara con cuenta

**Reportado por Sandy**: Marcos Abate (cliente ya cargado en la planilla,
`CLI-0018`) llenaba el formulario de diagnóstico logueado y, al enviarlo,
recibía "Tu cuenta todavía no tiene un perfil de cliente vinculado" — pese a
que la ficha de admin ya lo mostraba con "Ya tiene cuenta".

**Causa real:** hay dos columnas que deberían mantenerse sincronizadas —
`customers.profile_id` (usada por la ficha de admin y por el gate de
asignación de técnico) y `profiles.customer_id` (usada por
`currentUser.customerId`, lo que efectivamente gatea `ServiceRequestForm.tsx`
y cualquier pantalla de cliente logueado). `redeem_account_invite()`
(alta vía invitación del admin) las actualiza a las dos en la misma
transacción. Pero `persistCreateCustomerSelf()` (alta por **autorregistro**,
sin invitación — `registerCustomer()` en `AppContext.tsx:811`) solo
escribía `customers.profile_id` — nunca `profiles.customer_id` — y no hay
ningún trigger en la base que las mantenga sincronizadas solo. El resultado:
cualquier cliente que se haya dado de alta por su cuenta (no por invitación)
queda con `profiles.customer_id` en `NULL` para siempre, invisible desde la
ficha de admin (que solo mira el otro lado del vínculo).

**Alcance real, no solo Marcos:** de los 7 clientes con cuenta vinculada en
la base, **3 estaban rotos** por este mismo motivo — Marcos Abate, Juan
Carlos Muccela, Rebeca Ardiles. Los otros 4 (incluida una cuenta de prueba)
entraron por invitación del admin y estaban bien.

**Corregido:**
1. `persistCreateCustomerSelf()` ahora también actualiza
   `profiles.customer_id` después de crear el cliente, en la misma llamada
   — probado el `UPDATE` bajo RLS impersonando el perfil real de Marcos en
   una transacción de rollback, confirmando que el policy
   `profiles_update_own_or_admin` lo permite tal cual lo ejecutaría el
   cliente real.
2. Backfill de una sola vez para los 3 perfiles ya rotos
   (`profiles.customer_id = customers.id` donde `customers.profile_id`
   apunta a ese perfil y `profiles.customer_id` estaba en `NULL`) —
   verificado después: los 7 clientes con cuenta quedan con las dos
   columnas correctamente cruzadas.

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build` sin
errores. `get_advisors` (security) sin hallazgos nuevos.

Commit: `9e4cf48`.

## 2026-08-30 (noche, cont.) — "Generar enlace de cuenta" también donde ya se está mirando a la persona

Pedido de Sandy: duplicar la acción de invitación (mismo backend
`account_invites`/`createAccountInviteLink`, sin tocar nada de eso) a los
lugares donde un admin ya está viendo a un técnico o cliente puntual, en
vez de obligarlo a ir a la planilla de Clientes.

**Auditado primero:** en la pestaña Técnicos, la "Cuadrilla de Técnicos"
ya es una grilla de tarjetas (no una planilla) y cada tarjeta ya tenía el
menú de tres puntos con "Generar enlace de cuenta" desde una sesión
anterior — nada que agregar ahí.

**Agregado:**
- `ClientFicha.tsx` (la ficha completa del cliente, `#/admin/clientes/<id>`):
  antes no tenía ninguna acción de cuenta. Se agregó el mismo menú de tres
  puntos junto a las métricas del encabezado, mismo criterio de
  habilitación (`disabled` si ya tiene `profileId` o falta el email) y el
  mismo modal de copiar enlace, implementado localmente en el componente
  (no se tocó el modal ni el estado que ya usa `AdminHubView.tsx`).
- Modal de **Detalle de una orden** (`selectedOrder`, bloque "Cliente &
  Contacto"): es el otro lugar real donde un admin mira a un cliente
  puntual sin pasar por la planilla — y es justo el flujo donde más
  importa, porque es ahí donde se topa con el gate duro de asignación de
  técnico si el cliente no tiene cuenta. Reusa el `handleGenerateInvite` y
  el `inviteLinkModal` que ya existían en `AdminHubView.tsx`, sin
  duplicar ese estado.

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build`
sin errores. No hubo click-through en navegador — mismo motivo que el
cambio anterior (sin credenciales reales de admin para autenticar contra
el Supabase conectado).

Commit: `9d3e6db`.

## 2026-08-30 (noche) — Gate duro: sin cuenta vinculada no hay técnico asignado; invitación automática al crear la orden

**Pedido de Sandy, prioridad alta, cerrado en la misma sesión.** Dos cambios
en el mismo espíritu de las invitaciones existentes (`account_invites`,
`redeem_account_invite()`, `get_account_invite()`).

**1. Cuarta condición en `require_eligible_technician_assignment()`**
(mismo trigger que ya valida técnico habilitado, requisitos pendientes y
superposición de horario): si `customers.profile_id` del cliente de la
orden es `NULL`, no se puede asignar ningún técnico —
`raise exception 'El cliente todavía no tiene una cuenta vinculada. Generá
y enviale el enlace de invitación antes de asignar un técnico.'`. El pago
de la seña y la creación de la orden siguen sin cambios — un cliente sin
cuenta puede pagar y pedir el servicio sin problema.

**Hallazgo de la auditoría, no opcional:** el trigger era
`BEFORE UPDATE OF assigned_technician_id` — no cubría el `INSERT`. El modal
"Crear Nueva Orden de Servicio" del admin permite elegir técnico en el
mismo paso en que se crea la orden (`assigned_technician_id` va poblado
directo en el INSERT), así que ese camino se salteaba las 4 condiciones
por completo. Se extendió el trigger a
`BEFORE INSERT OR UPDATE OF assigned_technician_id`, manejando `tg_op`
para no referenciar `OLD` en el caso INSERT.

**Sin retroactividad, confirmado:** la orden de Carlos Méndez/German Gauna
sigue con su técnico ya asignado desde antes — el trigger solo evalúa
asignaciones *nuevas* (`INSERT` con técnico, o `UPDATE` que cambia el
valor), nunca datos ya existentes. Verificado con un intento real contra
esa misma orden (`3ef1ee15-...`, cliente German Gauna, sin canjear su
invitación): crear una segunda orden para él con técnico asignado en el
mismo INSERT fue bloqueado con el mensaje esperado, en una transacción de
rollback sin residuo. Caso de prueba permanente:
`supabase/sql/test_require_customer_account_for_technician_assignment.sql`
(5 casos: INSERT bloqueado, INSERT sin técnico permitido, UPDATE
bloqueado, cliente con cuenta sin problema, regresión de técnico no
habilitado).

**2. Invitación automática al crear la orden desde el admin** (el camino
real de "atiendo un llamado y cargo la orden a mano" — confirmado
auditando `AdminHubView.tsx`: el checkout de invitado online ya le
entrega el link al propio cliente después de pagar, ese camino no
necesitaba nada nuevo). En el modal "Crear Nueva Orden de Servicio":
si el cliente elegido no tiene cuenta (`profileId` null), el selector de
"Asignar Técnico" se deshabilita con una nota explicando por qué, y al
crear la orden se genera automáticamente la invitación — mismo backend
que ya usa el botón "Generar enlace de cuenta" de la planilla de Clientes
(`createAccountInviteLink` / `persistCreateAccountInvite`, sin tocar
`account_invites` ni las funciones de canje) — y se muestra de entrada el
mismo modal de "copiar enlace" que ya existía, sin que el admin tenga que
navegar a otro lado.

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build`
sin errores. `get_advisors` (security) sin hallazgos nuevos. No pude
completar un click-through en el navegador del modal de creación de
orden — el login de demo (`admin@tecniurbano.com.ar` /
`TecniUrbano2026!`) que muestra la propia UI no es una cuenta real contra
la base de Supabase conectada, así que no hay forma de autenticarse sin
tus credenciales reales de admin. El gate en sí está probado exhaustivamente
contra la base real (arriba); lo que falta es la comprobación visual del
modal, que dejo para que la hagas vos con las instrucciones del reporte.

Commit: `846429f`.

## 2026-08-30 — La seña de visita deja de descontarse del presupuesto; se liquida al técnico aparte

**Cambio de negocio aprobado por Sandy tras ADR** (`docs/adr-liquidacion-visita.md`):
la seña de $50.000 deja de restarse del presupuesto final — el cliente paga
ambos montos completos y por separado — y el técnico cobra la seña como una
liquidación propia (`technician_settlements.settlement_type = 'visita'`),
neta de una comisión propia del 15% y del fee de Mercado Pago, apenas la
orden pasa a `in_progress` (no cuando se envía o acepta el presupuesto —
cubre el caso de una visita hecha y una orden cancelada después, admin
emergency override incluido).

**Comisión propia, no reutilizada:** nueva clave
`system_settings.visit_settlement_commission_rate` (default 0.15),
completamente separada de `platform_commission_rate` (17%, sigue exclusiva
de `completed_work`). Mismo panel de admin (`VisitFeeSettings.tsx`), mismo
criterio de validación server-side y auditoría de quién/cuándo/valor
anterior que el resto de Fase 7 — la validación de rango (0 a 1) del
trigger genérico `system_settings_audit()` ahora aplica a cualquier clave
`%_commission_rate`, protegiendo retroactivamente también a
`platform_commission_rate`, que no tenía ese chequeo antes.

**Corregido para que no se duplique el pago:** `total_paid_amount` ahora
incluye la seña completa (ya no está descontada del saldo), así que
`create_settlement_on_order_completed_and_paid()` restaba de más si no se
tocaba — se corrigió para restar lo ya liquidado como `'visita'` (monto y
fee de MP) antes de calcular la comisión y el neto de `completed_work`.
Caso de prueba permanente:
`supabase/sql/test_visit_and_completed_work_settlements.sql` — dispara
ambas liquidaciones sobre la misma orden y confirma que la suma coincide
exactamente con lo pagado por el cliente, en bruto y reconstruida
(neto + comisión + fee), sin faltantes ni duplicados.

**También corregido (encontrado auditando el pedido, no parte de lo
pedido inicialmente pero necesario para que el cambio sea consistente):**
el trigger `sync_quote_totals_from_items` seguía calculando
`remaining_amount = total_amount - visit_deposit_credit` — sin este fix,
"Total a pagar" en las pantallas de cliente/técnico hubiera seguido
mostrando el presupuesto con la seña ya descontada. Ahora
`remaining_amount = total_amount`, sin resta. Solo afecta presupuestos en
`draft` — uno ya `sent`/`accepted` está protegido por
`prevent_sent_quote_content_change` y nunca se recalcula, así que no toca
presupuestos ya cerrados. `ensureDraft` en `QuoteBuilder.tsx` deja de
escribir `visit_deposit_credit: order.visitDepositAmount` en presupuestos
nuevos (queda en 0 — la columna no se borra, solo deja de usarse).

**Pantallas corregidas:** `QuoteViewer.tsx` y `QuoteBuilder.tsx` sacan la
línea de "Seña acreditada: -$X" y muestran el total del presupuesto sin
descuento, con una nota aclaratoria de que la visita ya pagada es aparte.
`RejectedVisitReceipt.tsx` renombra el label "Seña de visita registrada" a
"Visita de presupuesto registrada" (misma lógica, sin cambios). `ClientFicha.tsx`
sin cambios de código — ya leía `remaining_amount` directo, ahora correcto
por el fix del trigger.

**Sin retroactividad, confirmado:** la única orden `in_progress` real de la
base (Carlos Méndez, Soldadura) quedó sin tocar — el trigger nuevo es
`AFTER UPDATE` y no se dispara solo. `technician_settlements` tiene 0 filas
reales tras el deploy.

**Hallazgo de seguridad post-deploy, corregido en el momento:** la nueva
función de trigger `create_visit_settlement_on_started()` quedó exponible
vía `/rest/v1/rpc/create_visit_settlement_on_started` para `anon` y
`authenticated` (`get_advisors` WARN) — a diferencia de
`create_settlement_on_order_completed_and_paid()`, que ya tenía `PUBLIC`
revocado. Se revocó `EXECUTE` para igualar el criterio existente; el
advisor de seguridad quedó limpio de hallazgos nuevos.

**Verificado con transacciones de rollback contra la base real:** doble
liquidación exacta, cancelación posterior a `in_progress` conserva el pago
de la seña, sin backfill sobre la orden real en curso, validación de rango
0–1 rechaza `5.0` y acepta `0.2`. `tsc --noEmit`, `vitest run` (84/84),
`npm run build` sin errores.

Commit: `fdaccc8`.

## 2026-08-30 (madrugada) — Bug de prioridad alta: seña de $30.000 en el camino del asistente de diagnóstico

**Diagnóstico real, no el sospechado.** No era un valor hardcodeado en
`diagnosisAssistant.ts`/`diagnosisDraft.ts` (esos archivos no tocan montos en
absoluto) ni un monto mal calculado server-side. Eran dos problemas de
permisos encadenados, ambos en `system_settings`:

1. `visit_deposit_amount` tenía `visibility='authenticated'`. Para un
   visitante SIN cuenta (el único que realmente pasa por
   `GuestServiceRequestForm.tsx` — un cliente logueado usa `ServiceRequestForm.tsx`,
   ya autenticado), `fetchVisitDepositAmount()` (cliente, sujeto a RLS)
   no podía leer la fila real y caía al fallback hardcodeado de
   `src/lib/supabaseData.ts` (`VISIT_DEPOSIT_FALLBACK = 30000`) — un
   valor de una tanda de precios vieja que nunca se actualizó porque nada
   dependía de él hasta que existió el checkout de invitado.
2. Incluso corrigiendo la visibilidad, el rol `anon` **nunca tuvo el GRANT
   de tabla base** sobre `system_settings` (`permission denied`, no un
   simple 0 filas) — la política `system_settings_select_public` que ya
   incluía `anon` en sus roles nunca pudo aplicarse en la práctica, para
   ningún setting `public`, desde que se creó. No es un problema nuevo de
   este bug, es un hallazgo aparte que salió al verificar el fix.

**El monto realmente cobrado ya era correcto** —
`api/orders/guest-checkout.ts`/`api/orders/request-service.ts` usan
`supabaseAdmin` (service role, sin RLS) y ya recalculaban $50.000 desde
`system_settings` antes de armar la preferencia de Mercado Pago, ignorando
cualquier monto que mandara el cliente (que para modo diagnóstico ni
siquiera envía uno). Era un bug de visualización pre-pago para el
visitante, no un cobro incorrecto — confirmado leyendo el código completo
de ambos endpoints, no solo el síntoma.

**Corregido:** `visit_deposit_amount` pasa a `visibility='public'` (no es
sensible — ya se muestra como texto público en el propio formulario) +
`GRANT SELECT ON system_settings TO anon`, verificado que RLS sigue
acotando a `anon` solo a las filas `public` (`enabled_provinces` y
`visit_deposit_amount` — nada de comisión ni nada admin).

**Defensa en profundidad agregada, como pidió Sandy:** `customer_order_drafts`
(la tabla que arma el borrador y dispara el cobro de MP antes de que exista
la orden) no tenía ningún trigger que revalidara `amount` — a diferencia de
`service_orders`, protegido por `enforce_service_order_pricing`. Hoy la
tabla tiene RLS con **cero políticas** (default-deny total, ya señalado
como INFO en los advisors), así que solo el service role puede escribir
ahí y ninguno de los dos endpoints confía en un monto del cliente para la
seña — pero se agregó `enforce_customer_order_draft_pricing()`
(`BEFORE INSERT`, mismo patrón que el trigger de `service_orders`) para
que ningún camino futuro (una policy nueva, un dashboard, un bug de
migración) pueda saltarse el recálculo. Alcance: solo `payment_type='visit_deposit'`,
tal como se pidió — `full_advance` (precio fijo) sigue igual, ya se
recalcula server-side contra el catálogo real.

**Verificado con transacciones de rollback contra la base real**
(`supabase/sql/test_customer_order_draft_pricing_trigger.sql`, mismo
criterio que `test_pricing_trigger.sql`): un borrador `visit_deposit` con
`amount=1` manipulado se corrige a $50.000; un borrador `full_advance` con
`amount=8000` queda sin tocar. Cero residuo en la base (`customer_order_drafts`
en 0 filas antes y después, tal como confirmó Sandy).

**Verificación:** `tsc --noEmit`, `vitest run` (84/84), `npm run build`.

Commit: `5686ddc`.

## 2026-08-29 (madrugada) — Problema 6 (mobile) investigado, no reproducido; Fase 10 tercera pasada

**Problema 6 — panel de admin desbordado en mobile.** Los tres elementos que
Sandy reportó desde su celular (fila de chips del Admin Hub, desplegable de
"Asignar técnico", panel de notificaciones) ya habían sido arreglados en un
commit previo de esta misma sesión (`c1e05a6`, ya en producción). Probé los
tres en vivo contra `https://tecniurbano.online` real, logueado como admin,
en viewport de 375px y 360px: ningún elemento se corta, `document.documentElement.scrollWidth`
coincide exactamente con `innerWidth` (sin overflow horizontal de página), y
las tres capturas confirman texto completo sin truncar. No encontré nada
para arreglar. Hipótesis más probable de por qué Sandy lo seguía viendo: el
sitio es una PWA con service worker activo (`registerType: 'autoUpdate'`,
confirmado registrado en el navegador) — si tenía la app abierta o instalada
desde antes del deploy del fix, una navegación puramente interna (hash-route)
nunca dispara la verificación de actualización del service worker; hace
falta cerrar la app del todo y volver a abrirla (o un hard refresh) para que
tome el bundle nuevo. Sin código para commitear en este punto — quedo a la
espera de que Sandy confirme si un cierre completo de la app resolvió lo que
veía.

**Fase 10 — tercera pasada, reporte de estado (sin ejecutar nada nuevo).**
Detalle completo en `docs/fase10-checklist.md` (secciones "Resumen
ejecutivo" del 29/8, y nuevas secciones 5 "Primeras 48 horas" y 6
"Definición de terminado"). Resumen: `tsc`/`vitest` (66/66)/`build` limpios;
25 migraciones remoto=local; secretos limpios en todo el historial de git;
**las 10 suites de `supabase/tests/*.sql` corridas hoy por primera vez todas
juntas** (91 aserciones) — 8/10 pasan tal cual están escritas, 2 fallan por
fixtures desactualizados (les falta un campo que un gate de una fase
posterior ahora exige) y se confirmó que las 10 pasan corrigiendo el fixture
al vuelo, sin tocar los archivos del repo. **Regresión real encontrada y
corregida en el camino:** el advisor de seguridad volvió a marcar ERROR en
`technician_public_view` (`CREATE OR REPLACE VIEW` de esta misma sesión,
antes de este reporte, había pisado el `security_invoker=true` puesto en la
Fase 9 sin volver a declararlo) — corregido con
`alter view ... set (security_invoker = true)`
(`20260829195048_restore_technician_public_view_security_invoker.sql`),
advisor reverificado en 0 ERROR. Smoke test de 10 flujos en producción real
y primeras 48 horas post-lanzamiento siguen necesitando a Sandy con
navegador — no son ejecutables desde acá.

## 2026-08-29 (más noche) — Problema 8: gate de "salió hacia el domicilio" y stock de materiales

**"Salí hacia el domicilio" nunca se podía usar en un pedido de diagnóstico.**
El botón, el handler y la persistencia ya existían (Fase 3 Tanda 2, commit
`a00897e`) y funcionaban bien para `work_mode='direct'`. El gate
(`canExecutePaidWork`) exigía para diagnóstico presupuesto aceptado + saldo
pagado — imposible de cumplir en el primer viaje, porque ese viaje es
justamente para diagnosticar, antes de que exista ningún presupuesto. Cambiado
el gate (en el botón, en `updateOrderStatus`, y en el aviso de "esperando
pago") a `isOrderPaymentSettled`, que para diagnóstico alcanza con la seña.
`canExecutePaidWork` quedó sin ningún llamador — se eliminó (ya no es "dejarlo
por las dudas", es código muerto real) y sus tests se consolidaron dentro de
los de `isOrderPaymentSettled`, actualizados para documentar la regla nueva.
No se tocó `assignTechnician` ni el gate de asignación (ya usaban
`isOrderPaymentSettled`) ni el bloqueo de superposición horaria.

**El cambio del lado del cliente no alcanzaba solo.** Probando el flujo real
en el navegador (login como Carlos, orden de diagnóstico con solo la seña
pagada) el click en "Salí hacia el domicilio" seguía devolviendo 400 —
`prevent_unpaid_execution_timer`, un trigger de `service_orders` que nunca
había mirado en la investigación original, duplicaba server-side la regla
vieja exacta (`quote_status='accepted' AND payment_status='paid_in_full'`
para diagnóstico) como defensa en profundidad, independiente del gate de
React. Corregido para espejar `isOrderPaymentSettled`: diagnóstico alcanza
con la seña, sin mirar `quote_status`; `direct` sigue exigiendo todo pagado.
Re-probado en el navegador con una orden real: `PATCH` a `service_orders`
devuelve 204, el estado sobrevive un reload duro, `work_started_at` queda
seteado, el cronómetro corre en pantalla, y `notify_technician_en_route`
disparó la notificación al cliente por primera vez en todo el proyecto.

**"Inventario descontado" no descontaba nada.** El código sí intentaba
restar `materials.stock` — pero `materials_write_admin` es la única política
de escritura de esa tabla y exige `is_admin()`, así que el `UPDATE` de un
técnico quedaba bloqueado por RLS en silencio (sin `.select()`, 0 filas
afectadas no tira error) mientras el estado optimista de React ya mostraba el
descuento — eso también explicaba el "Stock: 118" visto en pantalla con
`materials.stock` real en 120: quedó pegado del intento anterior, nunca
confirmado contra la base. Arreglado con `register_material_usage`
(`SECURITY DEFINER`, mismo patrón que `self_register_technician`): inserta en
`order_materials_used` y descuenta `materials.stock` en un solo paso atómico,
validando adentro que el llamador sea el técnico asignado a esa orden (o
admin) — sin abrir `materials` a escritura general. De paso, `addUsedMaterial`
ahora revierte el descuento optimista de stock y la fila de material
agregada si el guardado remoto falla, para que la pantalla nunca vuelva a
mostrar un número que la base no tiene.

Verificado con transacciones de impersonación con rollback (orden de prueba
efímera, borrada dentro de la misma transacción): técnico asignado descuenta
bien (120→118, fila insertada); técnico no asignado a esa orden, rechazado;
admin puede registrar igual sin estar asignado; orden `completed` rechaza el
registro aunque sea el técnico asignado.

**Verificación:** `tsc --noEmit`, `vitest run` (66/66, 3 tests consolidados
sin perder cobertura), `npm run build`, más la prueba en vivo en el navegador
descripta arriba. Orden de prueba y su notificación/evento borrados al
terminar — 0 `service_orders` reales en la base.

## 2026-08-29 (noche) — Problema 7: remaining_amount y sync de documentos/requisitos

Dos de los tres temas reales que Sandy armó en el "Problema 7" de su tablero
(el tercero, chequeo de rama sin PR a `main`, se descartó: era un dato viejo
del 23/8 nunca reconfirmado — `feature/mercadopago-payments-backend` ya tiene
su PR #1 mergeada y la otra rama está a 0 commits sobre `main`).

**`remaining_amount` no baja tras pagar el saldo.** Diagnóstico de Sandy,
confirmado leyendo el trigger completo: `prevent_sent_quote_content_change`
congela `remaining_amount` (entre otros campos) apenas el presupuesto sale de
`draft` — a propósito, para que no se pueda manipular un presupuesto ya
enviado — pero nada lo recalcula cuando el pago se confirma después. Antes de
tocar nada, rastreé cada lectura de `remaining_amount`/`remainingAmount` en
todo el repo: `QuoteViewer.tsx` (cliente) y `ClientFicha.tsx` (admin) ya
esconden el valor congelado detrás de "Pagado" en cuanto `quote.status ===
'accepted'`, así que ahí no había ningún bug visible hoy. El único lugar sin
ese resguardo era `QuoteBuilder.tsx` (vista del técnico) — mostraba
"Restante: $X" para siempre, incluso con el presupuesto ya aceptado y
cobrado. Corregido con el mismo patrón que ya usan las otras dos pantallas.
El endpoint que cobra el saldo (`api/payments/create.ts`) ya estaba a salvo:
rechaza con 409 si `quote.status !== 'sent'`, así que nunca puede recobrar
usando un `remaining_amount` viejo de un presupuesto ya aceptado.

**Sync `technician_documents`/`technician_matriculas` → `technician_requirements`.**
Mismo patrón de diagnóstico que el bug de la CBU (Fase 6 Tanda 1), pero
causa distinta: acá `lock_technician_review_fields()` ya tenía
`SECURITY DEFINER` (confirmado, no faltaba eso) — el gap real era que las
ramas de `technician_matriculas` y `technician_documents` solo reseteaban los
campos del documento/matrícula mismo, nunca hacían el UPDATE cruzado a
`technician_requirements` que sí tiene la rama de `technician_payment_accounts`.
Mapeo documento→requisito confirmado contra el código real (no supuesto):
`TechnicianReviewCard.renderRequirementEvidence` solo usa `document_type`
`'monotributo'`→`monotributo_approved` e `'identity'`→`identity_verified`.
`'degree'` se sube (`ProfessionalProfile`, "Título o certificación") pero
`education_verified` nunca lo mira — su evidencia en la revisión del admin es
el texto libre de `technicians.degree_title`/`education_level`/`institution_name`,
no el PDF. Esa desconexión queda como hallazgo aparte, sin tocar. `'certificate'`
y `'license_support'` están permitidos por el CHECK de la columna pero no los
produce ninguna pantalla — vestigiales. Agregado también el reset para
`technician_matriculas` → `matricula_validated` (mismo bug, mismo lugar,
no pedido explícitamente pero es el mismo gap de al lado en la misma función).

Verificado con transacciones de impersonación con rollback contra datos
reales (Carlos Méndez, con los 6 requisitos ya aprobados): nueva identidad →
`identity_verified` vuelve a `pending`; nuevo monotributo → `monotributo_approved`
vuelve a `pending`; nueva matrícula → `matricula_validated` vuelve a `pending`;
nuevo `degree` → nada cambia (correcto, no está mapeado); admin subiendo en
nombre del técnico → no dispara ningún reset (mismo comportamiento que ya
tenía el fix de la CBU).

**Verificación:** `tsc --noEmit`, `vitest run` (69/69).

## 2026-08-29 — Fase 6 ampliada: alta y perfil de técnico, Tanda 2 (flujo visible)

Segunda tanda, sobre el schema/backend de la Tanda 1. Esta es la que cambia el
flujo real que usan técnicos y admin.

**"Ser técnico" ahora es un alta real** — pide contraseña y rubros (checkboxes
de categorías reales, no un `<select>` de un solo valor) y crea la cuenta +
ficha del técnico al enviar el formulario (`self_register_technician`), sin
esperar ningún paso de admin. Se loguea al toque en `/technician`. Si Supabase
pide confirmar el email antes de dar sesión, se avisa igual que en el alta de
cliente (mismo patrón que `registerCustomer`).

**"Mi perfil profesional" ahora es editable** — teléfono laboral, formación,
título, institución, presentación, dirección y email pasan de ser de solo
lectura a editables por el propio técnico. La contrapartida: "Editar Técnico"
(admin) dejó de exponer esos mismos campos — ya no hay dos pantallas
escribiendo el mismo dato, que era justo el bug que motivó que antes fueran
de solo lectura para el técnico. CBU sigue en su propia sección (ya era
editable desde la Tanda 1's fix).

**Panel "Solicitudes 'Ser técnico'" pasa a ser bitácora de solo lectura** — sin
botones de Aprobar/Rechazar (ya no hace falta: la cuenta ya existe para
cuando el admin ve la fila). La aprobación real del perfil sigue pasando por
"Validación de técnicos", sin cambios ahí.

**Verificado de punta a punta con una cuenta de prueba real** (creada por el
formulario público real, no simulada): alta con rubro "Plomería" → ficha
`technicians` creada con `validation_status='pending'`, 6 requisitos
sembrados, `technician_specialties` correcto, redirigido a `/technician`
automáticamente; edité "Mi perfil profesional" (teléfono laboral, dirección,
formación, título, institución, presentación) y confirmé cada campo escrito
en la base; confirmé desde el admin que "Solicitudes" la muestra sin botones
de acción, "Validación de técnicos" la lista como pendiente, y "Editar
Técnico" ya no tiene los campos removidos. Cuenta de prueba (`auth.users`
incluido) borrada al terminar — 4 técnicos reales sin residuo.

Código removido en el proceso (quedaba muerto tras el cambio de flujo):
`submitTechnicianApplication`/`persistCreateTechnicianApplication`,
`reviewTechnicianApplication`/`persistReviewTechnicianApplication`,
`TechnicianApplicationInput`, `handleApproveApplication`, los 5 campos de
"perfil profesional" en `TechnicianInput` y en el UPDATE de
`persistUpdateTechnician`.

**Verificación:** `tsc --noEmit`, `vitest run` (69/69), `npm run build`.

## 2026-08-29 — Fase 6 ampliada: alta y perfil de técnico, Tanda 1 (schema y backend)

Primera de dos tandas del rediseño de alta y perfil de técnico, a partir de una
auditoría que encontró aprobaciones de requisitos sin datos reales detrás
(`education_verified` aprobado con `education_level`/`degree_title`/`institution_name`
en `null`). Esta tanda es toda de base y backend — sin cambios de flujo visibles
todavía (eso es la Tanda 2: alta automática de cuenta, "Mi perfil profesional"
editable, panel de solicitudes de solo lectura).

**Múltiples rubros por técnico**
- Tabla nueva `technician_specialties(technician_id, category_id)` (no array de
  texto) + RLS (`technician_specialties_select_scoped`, `technician_specialties_write_admin`).
- Backfill de los 4 técnicos existentes por coincidencia de nombre de categoría
  contra el texto libre de `technicians.specialty` (un caso, "Pintor", no
  matcheaba ninguna categoría por texto y se corrigió a mano a "Reparaciones del
  hogar" — verificado registro por registro contra la base real).
- `technicians.specialty` queda como columna de compatibilidad (ya no se
  escribe) — el código ahora arma ese string uniendo los nombres reales de
  `technician_specialties` con `, `.
- Migrados a la tabla nueva: alta y edición de técnico (Admin Hub), matching de
  elegibilidad para reasignación automática (`offer_to_next_eligible_technician`),
  `technician_public_view` (ficha pública que ve el cliente), y las listas de
  `TechnicianValidation`/`TechnicianReviewCard`.
- Verificado en vivo: edité a Carlos Méndez desde el Admin Hub agregándole
  "Cerrajería" y confirmé el cambio contra la base real antes de revertirlo.

**Columna `technicians.address`** — nueva, para la dirección propia del técnico
(hasta ahora no existía; solo había `zone`/`province`). Se llena desde la Tanda 2
(alta automática y "Mi perfil profesional"); el formulario de admin no la toca.

**Bug real corregido: CBU editado no volvía a pending**
- `lock_technician_review_fields` solo reseteaba `validation_status` a
  `pending` en INSERT, nunca en UPDATE — un técnico ya aprobado podía cambiar su
  CBU sin que nadie lo revisara de nuevo.
- Ahora un UPDATE no-admin en `technician_payment_accounts` fuerza
  `validation_status` a `pending` y además resetea el requisito puntual
  (`technician_requirements.status = 'bank_account_valid'`) — no toca
  `is_enabled` ni el resto del perfil, tal como se pidió.
- La función necesitó `SECURITY DEFINER` para poder escribir esa segunda tabla
  bajo el rol del propio técnico — se detectó con una prueba con rollback que
  falló antes de agregarlo (el UPDATE cruzado quedaba bloqueado por RLS, sin
  error visible) y se volvió a probar después, confirmando el fix real.
- Verificado con dos pruebas con rollback contra Carlos Méndez: (1) admin
  aprueba CBU → técnico edita CBU → ambos estados vuelven a `pending`; (2)
  admin edita un dato no sensible (alias) → el estado aprobado no se toca.

**Alta automática (backend, todavía sin UI)** — `self_register_technician(...)`
(`SECURITY DEFINER`): crea `technicians` + `technician_specialties` + siembra
`technician_requirements` + promueve el perfil a `role='technician'`, en un
solo paso atómico. Probado con rollback: alta completa de un usuario existente
(Julián, cliente) con doble rol preservado (mantiene su ficha de cliente),
rubro múltiple con matrícula requerida detectada correctamente, y los dos
guardas de seguridad (una cuenta admin no puede autoconvertirse; una cuenta que
ya tiene ficha de técnico no puede duplicarla).

**Bucket `technician-documents` acepta imágenes** — sumados `image/jpeg` e
`image/png` a `allowed_mime_types` (antes solo `application/pdf`), mismo
criterio que `technician-avatars`. Se actualizaron los dos checks del lado del
cliente que rechazaban no-PDF antes de llegar a Storage
(`ProfessionalProfile.tsx`, `TechnicianReviewCard.tsx`).

**Migraciones aplicadas** (`ayszrtieplmqscqtabsu`): `create_technician_specialties`,
`add_technicians_address_column`, `fix_payment_account_edit_resets_requirement`,
`fix_lock_technician_review_fields_security_definer`, `create_self_register_technician`,
`allow_image_uploads_technician_documents_bucket`, `backfill_technician_specialties`,
`reoffer_uses_technician_specialties`, `technician_public_view_uses_specialties_table`.

**Verificación:** `tsc --noEmit`, `vitest run` (69/69), `npm run build`, todos
en verde. Commit `d4037f7`.
