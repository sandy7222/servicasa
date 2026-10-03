// Aplica el tema oscuro antes del primer pintado, para evitar el parpadeo de tema claro.
// Vive en un archivo propio (y no inline en index.html) porque la política de seguridad
// de Vercel (script-src 'self') bloquea los scripts inline.
(function () {
  try {
    var stored = localStorage.getItem('tecniurbano_theme');
    var dark = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
