// Configuración de los links de descarga de la app.
//
// ANDROID_APK_URL se completa cuando el pipeline de CI (ver
// .github/workflows/build-android-twa.yml) publique el primer APK firmado
// como GitHub Release. Hasta entonces queda `undefined` a propósito: la
// sección de descarga arma toda la interfaz (QR incluido) pero no ofrece un
// QR ni un botón que no lleve a ningún lado — ver docs/android-twa-setup.md
// para los pasos manuales pendientes (generar el keystore, cargarlo como
// secreto de CI, correr el pipeline una vez).
export const ANDROID_APK_URL: string | undefined = undefined;

// Sin build de iOS todavía — deliberadamente `undefined` hasta que exista.
export const APP_STORE_URL: string | undefined = undefined;
