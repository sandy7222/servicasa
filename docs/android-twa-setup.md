# Descarga de Android (TWA) — puesta en marcha

Este documento cubre los pasos que **tenés que hacer vos, a mano, en tu
máquina, fuera de este chat**. Dos motivos:

1. **El keystore de firma es la identidad permanente de la app.** Si se
   pierde o se reemplaza, nadie que ya instaló el APK puede actualizar sin
   desinstalar antes. No se genera en CI porque este repo es público —
   cualquier archivo que un workflow suba como *artifact* queda descargable
   por cualquiera.
2. **`bubblewrap init` es interactivo** (confirma valores y genera el
   keystore en el momento) y no tiene un modo confiable 100% no-interactivo
   — es una limitación conocida y todavía abierta del propio proyecto
   Bubblewrap, no algo que se pueda resolver desde acá. Por eso `init` se
   corre una sola vez, a mano, y de ahí en adelante CI solo corre `update` +
   `build` sobre el proyecto ya generado — eso sí está bien soportado de
   forma no interactiva.

## 1. Instalar Bubblewrap CLI

```bash
npm install -g @bubblewrap/cli
```

## 2. Generar el proyecto (`init`) — una sola vez

```bash
bubblewrap init --manifest="https://tecniurbano.online/manifest.webmanifest" --directory="./twa"
```

Es interactivo — te va a ir preguntando y proponiendo valores tomados del
manifest real del sitio. Guía de qué contestar:

- **App name / Launcher name:** `TecniUrbano` (ya viene bien por defecto).
- **Package ID:** proponé `online.tecniurbano.twa` si no lo autocompleta —
  es prácticamente permanente (si algún día se sube a Play Store, cambiarlo
  después implica publicar como una app distinta).
- **Colores / ícono / display:** aceptá los valores por defecto, ya vienen
  del manifest real (`#0F172A`, `#F8FAFC`, standalone).
- **JDK / Android SDK:** si no los tenés instalados, Bubblewrap te va a
  ofrecer descargarlos él mismo (responder que sí es lo más simple — los
  deja en su propia carpeta de config, no instala nada a nivel sistema).
- **Signing key (keystore):** cuando pida generar uno nuevo, usá alias
  `tecniurbano` y elegí una contraseña fuerte (puede ser la misma para
  keystore y clave). **Anotala** — la vas a necesitar en el paso 4.

Al terminar vas a tener una carpeta `twa/` con un proyecto Android completo
(`twa-manifest.json`, `gradlew`, `app/`, etc.) y el keystore, normalmente en
`twa/android.keystore`.

**Guardá el keystore en un lugar seguro y hacé un backup fuera de tu
máquina** (gestor de contraseñas, drive cifrado) — si se pierde, no hay
forma de recuperarlo ni de reemplazarlo sin romper las actualizaciones para
quien ya instaló la app.

## 3. Commitear el proyecto (sin el keystore)

El `.gitignore` ya excluye `twa/*.keystore` y `twa/*.jks`, así que un `git
add twa/` normal no se va a llevar el archivo sensible por error — igual,
conviene revisar `git status` antes de commitear para confirmarlo.

```bash
git add twa/
git commit -m "chore: agregar proyecto Android TWA generado con bubblewrap init"
```

## 4. Sacar el fingerprint SHA-256 (para `assetlinks.json`)

```bash
keytool -list -v -keystore twa/android.keystore -alias tecniurbano
```

(Si no tenés `keytool` en el PATH, corré el mismo comando dentro de
`docker run --rm -v "$PWD":/work -w /work eclipse-temurin:17 keytool ...`.)

Buscá la línea `SHA256:` en la salida — 32 pares de dígitos hexadecimales
separados por `:`. Reemplazá el valor placeholder en
[`public/.well-known/assetlinks.json`](../public/.well-known/assetlinks.json)
con ese fingerprint real. Este archivo no es sensible — es información
pública por diseño (así es como Android verifica que la app y el sitio son
del mismo dueño). Confirmá también que `package_name` coincida con el
Package ID que elegiste en el paso 2.

## 5. Cargar el keystore como secreto del repo

Corré esto en tu máquina, con el `gh` CLI ya autenticado — así el contenido
del keystore y las contraseñas nunca pasan por este chat:

```bash
base64 -w0 twa/android.keystore > android.keystore.base64.txt

gh secret set ANDROID_KEYSTORE_BASE64 < android.keystore.base64.txt
gh secret set ANDROID_KEYSTORE_PASSWORD -b"TU-CONTRASEÑA-DE-KEYSTORE"
gh secret set ANDROID_KEY_ALIAS -b"tecniurbano"
gh secret set ANDROID_KEY_PASSWORD -b"TU-CONTRASEÑA-DE-CLAVE"

rm android.keystore.base64.txt  # no dejar el base64 sin cifrar en el disco
```

(En Windows sin `base64` de coreutils: `certutil -encode twa\android.keystore
android.keystore.base64.txt` y sacale las líneas `-----BEGIN/END-----` antes
de cargarlo.)

## 6. Pushear y correr el pipeline

Con `twa/` commiteado (sin el keystore) y los 4 secretos cargados, el
workflow [`build-android-twa.yml`](../.github/workflows/build-android-twa.yml)
corre solo en cada push a `main`. Para probarlo ahora sin esperar un push:

```bash
git push
gh workflow run build-android-twa.yml
gh run watch
```

Si todo sale bien, vas a tener un asset descargable en una URL que **no
cambia** entre versiones (el mismo Release se sobrescribe en cada build):

```
https://github.com/sandy7222/servicasa/releases/download/android-latest/tecniurbano.apk
```

**No pude probar este pipeline de punta a punta** — no tengo Java/Android
SDK en este entorno para hacer un build real, y la parte de `init` es
inherentemente interactiva (no la puedo correr yo por vos). El resto
(`update` + `build` + publicar el Release) está armado siguiendo la
documentación oficial de Bubblewrap, pero la primera corrida real puede
necesitar un ajuste chico. Si falla, pegame el log del job y lo corrijo.

## 7. Activar la sección en la landing

Una vez que la URL de arriba responda con el APK real:

1. Editá [`src/lib/appLinks.ts`](../src/lib/appLinks.ts) y poné esa URL en
   `ANDROID_APK_URL`.
2. Commiteá y pusheá — el QR real y el botón activo de Android aparecen
   solos, sin tocar `DownloadAppSection.tsx` (ya está preparado para esto).

## Notas

- `iOS` (`APP_STORE_URL`) queda intacto, sin ningún build todavía.
- El `versionCode` se autoincrementa solo en cada build de CI (usa el
  número de corrida de GitHub Actions) — no hace falta tocar nada a mano.
- Si en algún momento cambiás el manifest de la PWA (nombre, colores,
  íconos) y querés que el TWA lo refleje, no hace falta repetir `init` —
  `bubblewrap update` (que ya corre solo en cada build) toma los cambios.
