# Plan: notificaciones push (avisos al celular con la app cerrada)

> **Cómo retomar este plan en otra sesión:** leer la sección "Bitácora" (al final), mirar qué casillas están tildadas y correr `git log --oneline -15`.

**Leyenda:** ✅ hecho · 🔄 en curso · ⏳ pendiente · 👤 lo hace Sandy · 🤖 lo hace Claude.

## Por qué
Hoy los avisos de la app (campanita y contador de mensajes) se consultan cada 30 s **solo con la app abierta**. Con el celular bloqueado no llega nada. Para un técnico que recibe trabajos eso equivale a tener solo una página web. Sandy: no le interesa la App Store; quiere que la web instalada **se comporte como una app** en Android y en iPhone.

## Decisiones ya tomadas (no re-discutir)
- Camino: **PWA instalada + Web Push** (gratis). Sin app nativa ni App Store por ahora.
- iPhone: los avisos solo funcionan con la app **instalada desde Safari** (Compartir → Agregar a pantalla de inicio) y **iOS 16.4 o más nuevo**. El permiso se pide desde un botón (exigencia de iOS).
- Los avisos salen de la tabla `notifications` (todo aviso de la app se crea ahí): un disparador en la base llama al servidor por pg_net, igual que `admin-event` (ver `20261003180326_admin_event_alerts.sql`). Se reutiliza el secreto compartido existente (`ADMIN_EVENT_SECRET` en Vercel y `admin_event_secret` / `admin_event_url` en Vault): NO se crean secretos nuevos en Vault.
- Telegram sigue siendo el canal del admin (aviso de visita pagada, alta de técnico/cliente). Web Push es para técnicos y clientes (y también llega al admin en su celular).
- Respaldo futuro si hace falta: Telegram para técnicos, correo.

## Cómo funciona (arquitectura)
1. El usuario toca "Activar avisos" → el navegador crea una **suscripción** (endpoint + claves) → se guarda en `push_subscriptions` (una fila por dispositivo).
2. Se inserta una fila en `notifications` (como siempre) → trigger `AFTER INSERT` llama a `/api/gateway?action=admin-event` con `kind: 'push_notification'`.
3. El servidor busca las suscripciones del destinatario y envía con la librería `web-push` (claves VAPID).
4. El service worker del celular muestra el aviso; al tocarlo abre la app en la pantalla correspondiente.
5. Suscripciones vencidas (404/410) se borran solas.

## Fases

### Fase 0 — Preparación
- [x] 0.1 🤖 Claves VAPID generadas y guardadas en `.env.local` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`). La pública también para el navegador.
- [x] 0.2 🤖 Dependencia `web-push` instalada.
- [x] 0.3 🤖 Variables VAPID cargadas en Vercel (producción) desde el archivo, sin mostrarlas.

### Fase 1 — Base: suscribirse y recibir
- [~] 1.1 🤖 Migración escrita pero SIN APLICAR en la base (`20261028000000_push_subscriptions.sql`): el conector de Supabase quedó vinculado a otra cuenta (ver bitácora). Migración `push_subscriptions` (RLS: cada usuario solo ve y borra las suyas).
- [x] 1.2 🤖 Service worker: recibe el `push` y muestra el aviso; `notificationclick` abre la app en la ruta del aviso.
- [x] 1.3 🤖 `src/lib/push.ts`: soporte, permiso, suscribir/desuscribir, guardado en la base.
- [x] 1.4 🤖 Botón "Activar avisos" en el panel de técnico y de cliente.
- [x] 1.5 🤖 Tests.
- **Definición de terminado:** en Android, un técnico activa los avisos y recibe uno de prueba con la app cerrada.

### Fase 2 — Envío automático
- [~] 2.1 🤖 Código del handler hecho; FALTA aplicar el trigger en la base (`20261028000100_push_notification_trigger.sql`).
- [x] 2.2 🤖 Envío con `web-push`, limpieza de suscripciones vencidas, sin datos sensibles en el texto.
- [x] 2.3 🤖 Ruta de destino del aviso según el rol (mismo mapa que `getNotificationLink`).
- [x] 2.4 🤖 Tests.
- **Definición de terminado:** asignar una visita a un técnico de prueba hace sonar su celular.

### Fase 3 — iPhone
- [ ] 3.1 🤖 Mensaje "Instalá la app para recibir avisos" cuando se entra desde Safari sin instalar.
- [ ] 3.2 👤 Prueba en un iPhone real con iOS 16.4+ (instalar, activar, recibir). Sin esto no se da por cerrado.
- [ ] 3.3 🤖 Ajustes según lo que se vea (permiso, ícono, sesión).

### Fase 4 — Pulido
- [ ] 4.1 Preferencias (qué avisos recibir) si hacen falta.
- [ ] 4.2 Aviso "hay una versión nueva, tocá para actualizar" (el service worker hoy no refresca solo una pestaña abierta).

## Riesgos conocidos
- Web Push en iPhone es menos predecible que una app nativa y no se puede garantizar la entrega de cada aviso.
- Sin un iPhone real no se puede validar la Fase 3.
- Plan Hobby de Vercel: máximo 12 funciones; todo va por `api/gateway.ts`.

## Bitácora
| Fecha | Qué se hizo | Commit |
|---|---|---|
| 28/10/2026 | Se confirma que la app no tiene push (solo campanita con consulta cada 30 s). Sandy elige PWA + Web Push. Se escribe este plan. | (este commit) |
| 28/10/2026 | Fase 0 hecha (VAPID, `web-push`, variables en Vercel). Código de las Fases 1 y 2 hecho y con tests (service worker, `push.ts`, botón en Ajustes, envío `webPush.ts`, rutas `pushRoute.ts`). Migraciones escritas, **sin aplicar**: el conector de Supabase de Claude ve solo `CapitanYA-MASTER` (otra cuenta), no ServiCasa; hay que correrlas en el editor SQL de Supabase. **No desplegar el código antes de aplicarlas.** | (este commit) |
