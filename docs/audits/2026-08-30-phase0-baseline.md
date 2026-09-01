# Baseline de Fase 0 — TecniUrbano / ServiCasa

**Fecha de auditoría:** 30/08/2026 (ART; algunas consultas live quedaron registradas como 31/08/2026 UTC)
**Alcance:** Git/GitHub, Supabase live y Vercel live.
**Modo:** solo lectura sobre infraestructura. No se aplicaron migraciones, no se desplegó y no se cambió ninguna funcionalidad. La única escritura de esta sesión es documentación de auditoría.

## 1. Veredicto ejecutivo

La infraestructura está considerablemente más avanzada que en el baseline del 23/08: producción coincide con `main`, las 40 migraciones locales coinciden con las 40 remotas, las 51 tablas públicas tienen RLS, las 5 vistas usan `security_invoker`, `pg_cron` está instalado y sus 2 jobs están activos, y Vercel sirve producción correctamente con previews protegidos.

La **Fase 0 queda reabierta y no debe declararse cerrada** por estos bloqueos:

1. El repositorio GitHub es público y una contraseña de pruebas actualmente utilizable aparece en 8 archivos versionados. Hay 4 cuentas de prueba activas y confirmadas en Supabase live. El valor se omite deliberadamente en este informe.
2. Supabase Advisor informa 12 funciones `SECURITY DEFINER` ejecutables por `anon`. Al menos `offer_to_next_eligible_technician(uuid)` modifica la asignación de una orden y no contiene una comprobación de identidad o rol; `expire_stale_technician_offers()` también modifica órdenes sin comprobar al llamador. No se intentó explotarlas ni se cambiaron privilegios.
3. La lectura de protección de Vercel devolvió material de bypass sensible. Está completamente omitido aquí. La asociación visible entre ese bypass y el nombre de otro secreto debe verificarse y el bypass debe rotarse preventivamente en una fase autorizada.

## 2. Git y GitHub

### Estado comprobado

- Repositorio: `sandy7222/servicasa`, **público**.
- Rama actual y rama por defecto: `main`.
- HEAD local: `872e0926ec2404987b128451f5b60b2e545671bc`.
- `origin/main`: el mismo commit; divergencia local/remota `0/0`.
- `main` no tiene protección de rama configurada.
- Última ejecución de CI consultada: `33328894445`, asociada al HEAD actual.
- El resultado agregado figura como exitoso, pero dos jobs fallaron:
  - `supabase-migrations-reproducible`;
  - `e2e-smoke`.
- Los jobs de instalación/lint/build/unit y seguridad/dependencias finalizaron correctamente. Los dos fallos anteriores son hoy informativos y no bloquean el verde general.

### Árbol de trabajo al tomar la foto

El árbol no estaba limpio; se preservó todo:

- `.gitignore`: marcado como modificado, aunque `git diff` no mostró diferencia textual (probable normalización de fin de línea o estado del índice).
- `ROADMAP-TERMINACION.md`: modificado por la reauditoría documental en curso.
- `.claude/settings.local.json`: archivo local no versionado.
- `docs/asistente-diagnostico-electricidad.md`: archivo no versionado preexistente.

### Secretos y credenciales

Se revisaron el árbol versionado, el historial Git y el bundle `dist` con patrones para tokens personales de Supabase, credenciales productivas/de prueba de Mercado Pago, JWT, claves privadas y nombres de secretos de servidor. También se verificó que el remoto Git no contenga credenciales embebidas.

- No se detectaron tokens personales de Supabase, credenciales privadas de Mercado Pago, claves privadas ni JWT de `service_role` en Git.
- `.env.local`, `.mcp.json`, `.cursor/mcp.json` y `.vercel/project.json` existen localmente, están ignorados y no están versionados.
- `.env.example` contiene placeholders, no valores operativos.
- El bundle web contiene una clave pública/anon de Supabase esperable para un cliente web; no contiene una clave de servidor.
- **Hallazgo bloqueante:** una contraseña de pruebas utilizable está escrita en 8 archivos versionados: `agent.md`, `CHANGELOG.md`, `e2e/helpers.ts`, `playwright.config.ts`, `README.md`, `ROADMAP-TERMINACION.md`, `src/lib/supabaseData.ts` y `src/views/AuthView.tsx`.
- La herramienta `gitleaks` no está instalada; por eso el resultado es una auditoría por patrones y revisión dirigida, no una garantía criptográfica de ausencia absoluta.

## 3. Supabase live

**Proyecto auditado:** `ayszrtieplmqscqtabsu` (referencia pública del proyecto).
**PostgreSQL:** 17.6.
**CLI usada:** 2.101.0; la CLI informó que 2.116.0 está disponible.

### Inventario actual

| Objeto | Estado live |
|---|---:|
| Tablas en `public` | 51 |
| Tablas públicas sin RLS | 0 |
| Vistas públicas | 5 |
| Vistas con `security_invoker = true` | 5 |
| Funciones públicas | 60 |
| Funciones `SECURITY DEFINER` | 42 |
| Políticas públicas | 109 |
| Buckets de Storage | 5 |
| Buckets públicos | 1 (`technician-avatars`) |
| Políticas de Storage | 15 |
| Extensiones instaladas | 6 |
| Migraciones registradas | 40 |
| Edge Functions desplegadas | 0 |
| Secretos de Edge Functions | 1 nombre registrado; valor y hash omitidos |

Las cinco vistas (`admin_settlement_reconciliation`, `conversation_unread_counts`, `customer_summary`, `support_cases_summary` y `technician_public_view`) usan `security_invoker`; no conceden lectura a `anon` y sí a `authenticated`.

Los buckets privados son `avatars`, `diagnosis-photos`, `payout-receipts` y `technician-documents`. `technician-avatars` es el único público.

### Migraciones, RLS y Cron

- `npx supabase migration list --linked` devolvió 40 versiones locales y las mismas 40 remotas, en el mismo orden.
- Los Advisors en nivel `error` devolvieron cero errores de seguridad y cero de rendimiento.
- Una prueba transaccional con `ROLLBACK` reprodujo el antiguo caso de recursión: el intento directo de un cliente fue rechazado con `42501` por RLS, no con `42P17` por recursión infinita.
- `pg_cron` está instalado.
- Jobs activos: `release-technician-settlements` y `expire-stale-technician-offers`, ambos cada 15 minutos.
- Últimas 24 horas consultadas: 192 ejecuciones exitosas y 0 fallidas.
- Ventana de 7 días: 761 exitosas y ninguna falla registrada.

### Advisors en nivel `warn`

**Seguridad: 31 avisos**

- 12 `anon_security_definer_function_executable`.
- 18 `authenticated_security_definer_function_executable`.
- 1 `auth_leaked_password_protection`: protección contra contraseñas filtradas desactivada.

No todos los 30 avisos de funciones implican un defecto: algunos RPC están diseñados para el usuario autenticado y validan `auth.uid()`. Sí requieren corrección prioritaria las funciones internas o de mantenimiento que conservan `EXECUTE` para `PUBLIC`/`anon`, especialmente:

- `offer_to_next_eligible_technician(uuid)`: cambia el técnico asignado y no valida al llamador.
- `expire_stale_technician_offers()`: modifica ofertas vencidas y no valida al llamador; su consumidor esperado es Cron.
- Funciones trigger como `lock_technician_review_fields()` y `notify_technician_en_route()` no necesitan ser RPC públicos.
- RPC de usuario como `hide_own_cancelled_order`, `register_material_usage` y `respond_to_technician_assignment` sí contienen controles internos, pero no necesitan conservar ejecución para `anon`.

Supabase documenta que una función `SECURITY DEFINER` se ejecuta con privilegios del propietario y que una función pública ejecutable por `anon` puede invocarse por RPC; la corrección debe decidirse firma por firma, no mediante una revocación masiva sin pruebas.

**Rendimiento: 68 avisos**

- 46 `multiple_permissive_policies`.
- 22 `auth_rls_initplan`.

Son deuda de rendimiento, no evidencia de una interrupción activa.

## 4. Vercel live

### Deploy, dominio y protección

- Proyecto: `tecniurbano`; framework Vite; Node.js 24.x.
- Producción está `READY` y despliega `main` en el mismo commit `872e0926ec2404987b128451f5b60b2e545671bc` auditado en Git.
- `https://tecniurbano.online` respondió HTTP 200 con validación TLS correcta.
- `https://tecniurbano.online/api/health` respondió HTTP 200.
- El dominio y `www` están asociados al proyecto y servidos por Vercel Edge Network; el DNS sigue administrado por un tercero.
- Los previews usan SSO de Vercel: el preview más reciente respondió 302 hacia el login de Vercel.
- Git Fork Protection está activado.
- Existe un bypass de automatización. Su valor se omite. El metadato de asociación merece revisión y rotación preventiva.

### Variables y logs

Vercel registra 8 variables en Preview y Production. Solo se consignan nombres:

- `MP_PUBLIC_KEY`
- `MP_ACCESS_TOKEN`
- `VERCEL_AUTOMATION_BYPASS_SECRET`
- `MP_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_DEMO_MODE`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

La CLI mostró todos los valores como ocultos. La muestra de logs de producción de las últimas 24 horas contenía 1 registro `info`, 0 de nivel `error`/`fatal` y 0 respuestas 5xx.

### Webhook y artefactos serverless

- El deployment actual contiene `api/payments/webhook`.
- `docs/fase10-checklist.md` registra confirmación manual del dashboard de Mercado Pago y simulador `200 OK` el 28/08/2026. Esta auditoría no volvió a consultar de manera independiente el dashboard de Mercado Pago.
- **Diferencia nueva:** Vercel también empaquetó `api/payments/webhook.test.ts` como función productiva (`api/payments/webhook.test`). Es código de prueba y no debería formar parte del conjunto de funciones de producción.

### Encabezados públicos comprobados

Producción entrega CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` y `Permissions-Policy`.

## 5. Diferencias frente al baseline del 23/08/2026

| Área | 23/08 | 30/08 | Evaluación |
|---|---:|---:|---|
| Tablas públicas | 38 | 51 | Crecimiento esperado; todas con RLS |
| Vistas `security_invoker` | 0/1 problemática | 5/5 | Corregido |
| Funciones públicas | 21 | 60 | Crecimiento importante; revisar grants |
| `SECURITY DEFINER` | 5 | 42 | Superficie privilegiada mucho mayor |
| Buckets | 4 | 5 | Agregado `payout-receipts`; solo 1 público |
| `pg_cron` | ausente | instalado, 2 jobs | Bloqueo anterior resuelto |
| Migraciones live | 17, con faltantes locales | 40/40 alineadas | Drift de versiones resuelto |
| Advisor seguridad `error` | 1 | 0 | Error de la vista resuelto |
| Advisor seguridad `warn` | varios | 31 | Nueva clase de advertencias de ejecución privilegiada |
| Advisor rendimiento | 91 | 68 | Mejoró, quedan 68 |
| Vercel protección | pendiente manual | preview SSO confirmado | Resuelto |
| Producción vs Git | sin cierre completo | mismo HEAD | Alineado |
| Credencial de prueba en Git público | declarada limpia | 8 archivos con valor utilizable | Baseline anterior invalidado en este punto |

## 6. Lista priorizada de diferencias y siguiente decisión

### P0 — bloquear nuevas fases hasta decidir y corregir

1. Rotar las credenciales de las 4 cuentas de prueba y retirar los valores literales del código/documentación pública; mover E2E a secretos de CI. Decidir por separado si se reescribe el historial Git, porque es una operación destructiva y coordinada.
2. Crear y probar una migración mínima de privilegios para las funciones `SECURITY DEFINER`, empezando por revocar RPC anónimo a `offer_to_next_eligible_technician(uuid)` y `expire_stale_technician_offers()`. Revisar cada firma antes de revocar para no romper RLS, Cron o flujos legítimos.
3. Rotar el bypass de Vercel y verificar que el secreto de bypass, el secreto de webhook y sus asociaciones sean independientes y tengan el alcance correcto.

### P1 — antes de declarar el pipeline y el despliegue productivos

4. Hacer obligatorios los jobs `supabase-migrations-reproducible` y `e2e-smoke`, corregir sus fallos actuales y proteger `main` con checks requeridos.
5. Excluir `api/**/*.test.ts` del paquete serverless productivo y comprobar que la ruta de prueba desaparezca del siguiente Preview antes de promover.
6. Activar la protección de contraseñas filtradas de Supabase, verificando antes el impacto sobre cuentas de prueba.
7. Clasificar las restantes funciones `SECURITY DEFINER` en tres grupos: internas/trigger, RPC autenticadas y RPC deliberadamente públicas; documentar y conceder `EXECUTE` de forma explícita.

### P2 — endurecimiento y mantenimiento

8. Optimizar las 22 políticas con `auth_rls_initplan` y consolidar las 46 políticas permisivas múltiples con pruebas por rol.
9. Actualizar la CLI de Supabase de 2.101.0 a 2.116.0 en una sesión separada y repetir los comandos de auditoría.
10. Actualizar documentación histórica (`agent.md`, README y contadores del roadmap) para que no describa inventarios viejos ni publique credenciales.

## 7. Secretos deliberadamente omitidos

Este informe no contiene contraseñas, tokens, claves API, JWT completos, hashes de secretos, valores de variables Vercel, credenciales MCP ni material de bypass. Los identificadores de proyecto, nombres de variables y claves públicas de arquitectura se consideran metadatos, no credenciales.

## 8. Cierre de la ejecución

La Fase 0 se detiene aquí, tal como pide el roadmap. No se corrigieron los hallazgos, no se aplicaron migraciones, no se cambiaron políticas, variables, credenciales, ramas, deployments ni configuraciones externas.
