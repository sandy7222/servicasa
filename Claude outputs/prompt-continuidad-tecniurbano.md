# Prompt de continuidad — TecniUrbano (servicasa)

Pegar esto tal cual para retomar el trabajo. Fecha de corte: 17/9/2026 ~00:54 ART.

## Contexto

- Repo: `sandy7222/servicasa`. Live: `tecniurbano.online`.
- Stack: React + Vite + TS. Supabase project `ayszrtieplmqscqtabsu`.
- **Producción Vercel sigue `origin/main`**, no `master`. En esta sesión se empujó el mismo SHA a `main` y a `master` para que no se desfasen. No hacer force-push.
- Rama local: `main`, al día con `origin/main` y `origin/master` en `72f306d`.
- TecniUrbano es intermediario puro: no modelar depósito/stock de la empresa; los técnicos declaran materiales de su bolsillo.

## Qué ya está hecho (no rehacer)

1. **Orden unificado** de banners + tarjetas (`display_order` compartido, sin fusionar tablas `customer_home_banners` / `customer_home_cards`). Editor admin: una sola lista con flechas. Cliente: Banner → grilla de tarjetas → Banner. Si hay servicio en curso, ese bloque reemplaza TODO el home.
2. **Tarjetas** 4 por fila, iconos outline grandes (no cuadrados chicos).
3. Texto cliente: “pago de vista de presupuesto”.
4. **Color de fondo + fusión foto/fondo** de banners (este cierre):
   - Columnas remotas: `background_color` default `#0F172A`, `media_fade` 0–100 default `70`.
   - Migración local: `supabase/migrations/20260917034500_home_banner_background_and_fade.sql` (no-op si la tabla no existe en CI).
   - Admin: presets Oscuro / Blanco / Celeste / Teal + color picker + slider “Fusión foto / fondo”.
   - Cliente: degradé CSS que funde la foto con el color; texto claro/oscuro según luminancia.
   - Archivos: `src/lib/homeBannerStyle.ts` (+ test), `HomePageEditor.tsx`, `CustomerPromoBanner.tsx`, types, mapper, persist, AppContext.

## Cómo lo usa Sebastián

- Admin Hub → Página del cliente → Editar banner.
- El color **no** se diseña en la foto: se elige en el panel.
- Banners actuales: oscuro + fusión 70%. Para el de aire estilo boceto claro: Celeste o Blanco.

## Cuidados

- No fusionar las tablas de banners y tarjetas.
- No force-push a `main`/`master`.
- No recrear stock de empresa.
- CI y “Build Android TWA” siguen en rojo (materialExpenses / TWA). Fuera de alcance de esta tanda; Vercel igual publica.
- No commitear `output/pdf/` ni secretos `.env`.

## Pendiente opcional para mañana

- Ajustar a ojo el color/fusión de cada banner (sobre todo el de aire acondicionado, si se quiere fondo claro).
- Recarga fuerte en `tecniurbano.online` (Ctrl+F5) si no se ve el degradé: el deploy de `72f306d` a Production ya había terminado al guardar.
- Si se pide otro cambio de home, verificar también `/customer` y el editor admin: el estado se comparte.
