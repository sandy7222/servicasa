/* Avisos push de TecniUrbano (plan-notificaciones-push.md).
 * Este archivo lo carga el service worker de la PWA con importScripts (ver vite.config.ts).
 * Solo recibe el aviso y lo muestra; al tocarlo abre la app en la pantalla indicada. */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'TecniUrbano', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'TecniUrbano';
  // Sin etiqueta, renotify no vuelve a sonar si ya hay un aviso igual en la barra.
  const tag = data.tag || 'tecniurbano';
  // iOS exige mostrar siempre una notificación por cada push recibido.
  // Vibrar y renotify hacen que Android suene también con la pantalla apagada.
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: tag,
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200, 100, 200],
      data: { url: data.url || '/#/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/#/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) {
          await client.focus();
          if ('navigate' in client) {
            try {
              await client.navigate(target);
            } catch (err) {
              /* si no se puede navegar, alcanza con haber enfocado la app */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
