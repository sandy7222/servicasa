// Configuración de los links de descarga de la app.
//
// ANDROID_APK_URL apunta al GitHub Release fijo "android-latest" que publica
// .github/workflows/build-android-twa.yml. La URL no cambia entre versiones
// (el mismo Release se sobrescribe en cada build).
export const ANDROID_APK_URL: string | undefined =
  'https://github.com/sandy7222/servicasa/releases/download/android-latest/tecniurbano.apk';

// Sin build de iOS todavía — deliberadamente `undefined` hasta que exista.
export const APP_STORE_URL: string | undefined = undefined;

// Número de WhatsApp (solo dígitos, con código de país, ej. "5491112345678") para el
// botón "Escribinos por WhatsApp" del panel de ayuda. Mientras sea `undefined` el
// botón no se muestra. También puede llegar desde el servidor (PUBLIC_WHATSAPP).
export const WHATSAPP_NUMBER: string | undefined = undefined;

export function whatsappUrl(number: string | null | undefined, text = 'Hola, tengo una consulta sobre TecniUrbano.'): string | null {
  const digits = (number ?? '').replace(/\D/g, '');
  return digits.length >= 8 ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}
