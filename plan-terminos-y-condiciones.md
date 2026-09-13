# Plan: Términos y Condiciones + evidencia técnica de aceptación

Rama de trabajo: sobre la rama principal activa, sin rama propia (cambio acotado a un solo commit).

## 1. Contexto

Charla con Sandy del 12/9/2026 sobre cobertura legal del negocio: TecniUrbano es un intermediario
tecnológico entre clientes y técnicos independientes, y Sandy quería (a) páginas públicas de
Términos y Condiciones separadas para cliente y técnico, en `www.tecniurbano.online`, y (b) que el
checkbox de aceptación durante el alta de cada cuenta sea imprescindible para poder entrar, con
evidencia técnica de que la persona efectivamente aceptó — para poder responder ante un reclamo con
algo más sólido que "seguro lo aceptó".

En esa misma charla se discutió también, con harto detalle, que ningún sistema de aceptación de
términos resuelve por sí solo el riesgo de que un técnico reclame relación de dependencia laboral
(eso depende de la sustancia real del vínculo, no de lo que diga el papel — ver jurisprudencia
Rappi/PedidosYa y la reforma laboral 2026, Ley 27.742/27.802) ni exime a la plataforma de la
responsabilidad solidaria frente al consumidor del art. 40 de la Ley de Defensa del Consumidor. Esta
mejora cubre lo que sí es sólido y verificable: dejar evidencia técnica de que cada cliente y cada
técnico vio y aceptó un texto específico, en un momento específico. El contenido legal de los textos
es un borrador técnico (ver nota en `src/lib/legalTerms.ts`), no una redacción validada por un
abogado — sigue pendiente esa revisión antes de considerarlo definitivo.

## 2. Diseño

- **Textos**: una única fuente de verdad por documento (`TERMS_CLIENTE_TEXT` / `TERMS_TECNICO_TEXT`
  en `src/lib/legalTerms.ts`), consumida tanto por la página pública como por el hash que se calcula
  al aceptar — así lo que se hashea es exactamente lo que la persona vio, nunca una copia aparte que
  se pueda desincronizar.
- **Páginas públicas**: `/terminos_y_condiciones/cliente` (`TermsClienteView.tsx`) y
  `/terminos_y_condiciones/tecnico` (`TermsTecnicoView.tsx`), agregadas al switch de rutas de
  `App.tsx` con el mismo patrón que ya usaba `/terminos` (que se deja intacto, sin romper enlaces
  viejos). El footer público (`LandingFooter.tsx`) ahora linkea a las dos páginas nuevas en vez de a
  la genérica.
- **Evidencia de aceptación**: tabla nueva `legal_acceptances` (migración
  `20260912190500_create_legal_acceptances_table.sql`) — un registro append-only (RLS habilitado,
  sin policy de UPDATE/DELETE para nadie, ni siquiera el dueño de la fila) con: `user_id`, `role`
  (cliente/tecnico), `document_slug`, `document_version`, `document_hash` (SHA-256 del texto exacto,
  calculado en el navegador con la Web Crypto API nativa, sin dependencias), `accepted_at`,
  `ip_address` y `user_agent`.
- **Endpoint server-side** `api/legal/accept-terms.ts`: público (sin sesión), porque en el momento en
  que se llama la cuenta recién se creó y puede no haber sesión todavía (si el proyecto exige
  confirmar el email antes de loguear). Valida que el `userId` recibido exista realmente en Supabase
  Auth antes de insertar, agrega IP (`x-forwarded-for`) y user-agent del request, y persiste con
  `supabaseAdmin` (service role) — nunca se inserta directo desde el cliente.
- **Imprescindible para tener cuenta**: la llamada a `recordTermsAcceptance()` se agregó dentro de
  `registerCustomer`/`registerTechnician` (`AppContext.tsx`), inmediatamente después de crear el
  usuario en Supabase Auth y ANTES de dar el alta por exitosa (toast de bienvenida, navegación,
  mensaje de "revisá tu email") — si el registro de la aceptación falla, todo el alta falla, en vez
  de ser un checkbox decorativo que no bloquea nada.
- **UI**: en `AuthView.tsx`, tanto el formulario de registro de cliente (`mode === 'register'`) como
  el de alta de técnico (`mode === 'apply'`) tienen ahora un checkbox obligatorio ("Leí y acepto los
  Términos y Condiciones para clientes/técnicos de TecniUrbano", con link a la página
  correspondiente en una pestaña nueva) que deshabilita el botón "Crear cuenta" hasta que se tilde,
  además de una validación explícita en el submit handler.

## 3. Alcance y lo que quedó afuera (a propósito)

Este cambio cubre las dos altas de cuenta reales (`register` de cliente y `apply` de técnico). El
flujo de invitado (`GuestServiceRequestForm.tsx`, sin cuenta) no se tocó — Sandy pidió puntualmente
"imprescindible para entrar a la cuenta", que no aplica ahí de la misma forma; queda como decisión
pendiente si en algún momento se quiere agregar aceptación también al checkout de invitado.

## 4. Verificación

- `tsc --noEmit` limpio sobre los 5 archivos existentes tocados (`src/App.tsx`,
  `src/context/AppContext.tsx`, `src/types/index.ts`, `src/views/AuthView.tsx`,
  `src/components/landing/LandingFooter.tsx`) más los 5 archivos nuevos.
- Migración aplicada y verificada directamente contra el proyecto real (`ayszrtieplmqscqtabsu`);
  `get_advisors` (security) no reporta ningún hallazgo nuevo asociado a `legal_acceptances`.
- `git diff -b --stat` confirmó, antes de commitear, que el diff de los 5 archivos existentes
  correspondía exactamente a estos cambios (sin drift de línea de fin de renglón ni hunks ajenos
  mezclados).

## 5. Tercer camino de alta de cuenta: `registerWithInvite`

El 13/9 Sandy notó, con razón, que faltaba algo: además de `register` (cliente) y `apply`
(técnico), la app tiene un tercer camino real para crear una cuenta con contraseña —
`registerWithInvite` (`AppContext.tsx`), detrás del formulario "Crear cuenta y entrar" que
aparece cuando alguien llega con un link de invitación (`?invite=...`). Es el mismo formulario
al que llega, por ejemplo, un cliente que compró como invitado y después recibe el link para
ponerle contraseña a su cuenta, o un técnico al que administración le generó una invitación
directamente (`createAccountInviteLink`). Este camino se había quedado afuera del cambio
original sin querer: no es lo mismo que el checkout de invitado (que sigue sin cuenta, y sigue
fuera de alcance a propósito, ver sección 3).

Se agregó el mismo patrón: checkbox obligatorio + validación en `AuthView.tsx`, y el registro
de la aceptación (hash, versión, imprescindible para completar el alta) dentro de
`registerWithInvite` en `AppContext.tsx`, antes de dar la cuenta por creada. La diferencia es
que acá no hay selector de rol en el formulario — el rol sale de la invitación
(`invite.kind === 'technician'`), y con eso se elige automáticamente si el link y el hash
corresponden al documento de cliente o al de técnico.

Verificación: `tsc --noEmit` limpio, `git diff -b --stat` confirmó 6 hunks para las 3 ediciones
en cada uno de los 2 archivos tocados (`AppContext.tsx`, `AuthView.tsx`), sin drift ajeno.
