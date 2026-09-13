# Plan: sacar el badge "v1.2.0 • HD-CORE" y mostrar la foto de perfil en círculo

## 1. Contexto

Charla con Sandy del 13/9/2026: preguntó qué era el badge "v1.2.0 • HD-CORE" que
aparece en el header al lado del logo. Se le explicó que es un texto decorativo
fijo (hardcodeado en `Header.tsx`), sin relación con el `version` real del
`package.json` ni con ningún release — puramente cosmético. Pidió sacarlo para
todos (técnicos y clientes) y, en su lugar, que el círculo de usuario que ya
existe en el header muestre la foto que el usuario haya subido como avatar, en
vez de solo las iniciales.

## 2. Diseño

- Se eliminó por completo el badge "v1.2.0 • HD-CORE" (con su puntito verde
  animado) del lado izquierdo del header, sin reemplazo — no representaba nada
  real.
- El círculo de usuario que ya existía arriba a la derecha (con las iniciales,
  ej. "MR") ahora resuelve y muestra la foto de perfil cuando existe, usando lo
  que ya estaba armado en el resto de la app (no hizo falta crear ningún
  sistema de fotos nuevo):
  - **Técnico**: usa la foto profesional pública que ya carga desde "Mi perfil"
    (`ProfessionalProfile.tsx` → bucket `technician-avatars`,
    `technicians.public_avatar_path`, URL pública).
  - **Cliente / admin**: usa el avatar de cuenta que ya carga desde su panel de
    perfil (`CustomerProfilePanel.tsx` → bucket privado `avatars`,
    `profiles.avatar_url`, resuelto con URL firmada de 1 hora, igual que hace
    ese mismo panel).
  - Si todavía no subió ninguna foto, se sigue viendo el círculo con las
    iniciales (`avatarText`) como hasta ahora — nada se rompe para el que no
    tiene foto cargada.
- Los tres lugares del header que ya mostraban el círculo de iniciales
  (selector de rol demo, versión con sesión Supabase, y el del menú mobile)
  ahora comparten una única función `renderAvatar(size)` para no repetir la
  lógica de "foto o iniciales" tres veces.

## 3. Alcance

- No se tocó ningún flujo de carga de fotos — ya existían y funcionan
  (`CustomerProfilePanel.tsx`, `ProfessionalProfile.tsx`). Este cambio solo
  hace que el header, que antes ignoraba esas fotos, ahora las use.
- Cambio acotado a `src/components/common/Header.tsx`.

## 4. Verificación

- `tsc --noEmit` limpio.
- `git diff --stat` confirmó que el único archivo tocado fue `Header.tsx`.
