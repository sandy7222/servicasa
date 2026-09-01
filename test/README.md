# Estrategia de pruebas

La Fase 8 se ejecuta por capas. Ninguna prueba debe debilitar una regla de negocio para quedar verde.

## Comandos

- `npm run test:unit`: reglas puras de dinero, elegibilidad, configuración y permisos.
- `npm run test:api`: endpoints server-side, autorización, montos confiables e idempotencia.
- `npm run test:components`: formularios y estados visibles con dependencias externas simuladas.
- `npm run test:e2e`: navegador real contra Vite y el Supabase de pruebas configurado.
- `npm run test:coverage`: cobertura conjunta de Vitest con reporte de texto, HTML y JSON.

## Límites de cada capa

- Los tests unitarios no consultan Supabase ni Mercado Pago.
- Los tests de API ejercitan los handlers reales, pero sustituyen Supabase y Mercado Pago por dobles deterministas. El monto esperado siempre proviene de la fila simulada del servidor, nunca del body enviado por el cliente.
- Los scripts SQL de `supabase/tests/` son transaccionales y deben terminar en `ROLLBACK`. No se ejecutan automáticamente contra producción desde un pull request.
- Los E2E que requieren cuentas reales usan variables protegidas. No debe haber contraseñas literales en los specs ni en este documento.

## Variables E2E

El entorno que ejecute Playwright debe proporcionar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `E2E_TEST_PASSWORD`
- Opcionalmente, contraseñas separadas: `E2E_ADMIN_PASSWORD`, `E2E_TECHNICIAN_PASSWORD` y `E2E_CUSTOMER_PASSWORD`
- `SUPABASE_SERVICE_ROLE_KEY` solo para specs que necesiten crear y limpiar fixtures

Si falta la contraseña E2E, los flujos autenticados se omiten con una razón explícita. Si falta `SUPABASE_SERVICE_ROLE_KEY`, únicamente se omiten los specs que escriben fixtures administrativos.
