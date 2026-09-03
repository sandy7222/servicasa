// Configuración de los links de descarga de la app.
//
// ANDROID_APK_URL apunta al GitHub Release fijo "android-latest" que publica
// .github/workflows/build-android-twa.yml. La URL no cambia entre versiones
// (el mismo Release se sobrescribe en cada build).
export const ANDROID_APK_URL: string | undefined =
  'https://github.com/sandy7222/servicasa/releases/download/android-latest/tecniurbano.apk';

// Sin build de iOS todavía — deliberadamente `undefined` hasta que exista.
export const APP_STORE_URL: string | undefined = undefined;
