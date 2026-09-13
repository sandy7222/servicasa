# Plan: "Estado del Almacenamiento en Memoria" pasa a ser solo para admin

## 1. Contexto

Siguiendo con la limpieza visual de las cuentas (charla del 13/9), Sandy mostró
la pantalla de Ajustes de la cuenta de María Rodríguez (técnico) y en ella
aparecía un bloque "Estado del Almacenamiento en Memoria" con conteos globales
de Órdenes/Técnicos/Clientes/Insumos de todo el sistema, y una etiqueta
"v1.0.0". Se identificó como un panel de debug/desarrollo, sin utilidad para
un técnico o cliente real (no es información de su propia cuenta, es una
métrica operativa de todo el negocio) y ruido visual adicional en su pantalla
de Ajustes.

## 2. Cambio

En `src/views/SettingsView.tsx`, el bloque "System & Architecture Info" ahora
se muestra solo cuando `currentUser.role === 'admin'` — mismo criterio que ya
se usaba para `VisitFeeSettings` y `SystemSettingsPanel`, un poco más arriba en
la misma pantalla. Técnicos y clientes dejan de verlo por completo (no se
reemplaza por nada, no aporta nada a su cuenta).

De paso se sacó la etiqueta "v1.0.0" del título de ese bloque — mismo caso que
el "v1.2.0 • HD-CORE" del header: un número de versión decorativo sin relación
con ningún release real.

El botón "Restablecer Datos" (que ya estaba correctamente escondido en modo
Supabase/producción, solo visible en `DEMO_MODE` local) queda igual, ahora
además solo alcanzable por un admin.

## 3. Verificación

- `tsc --noEmit` limpio.
- `git diff` confirmó que el único cambio fue envolver ese bloque en el
  condicional de rol y sacar el span de versión.
