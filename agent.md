# agent.md — Estado del proyecto ServiCasa

Documento de contexto para agentes y desarrolladores. Actualizar cuando cambie el alcance, el stack o el estado de integración.

**Última actualización:** 2026-08-16

---

## Qué es ServiCasa

Aplicación web de gestión de servicios técnicos a domicilio (plomería, electricidad, reparaciones, mantenimiento, instalación). Opera con tres roles:

1. **admin** — operación central (órdenes, clientes, inventario, asignación)
2. **technician** — ejecución en campo (checklist, tiempo, materiales, notas, firma)
3. **customer** — seguimiento y firma de conformidad

Objetivo de producto: pasar de demo UI a producto usable en producción, con backend real y deploy público.

---

## Estado actual (resumen)

| Área | Estado |
| --- | --- |
| UI / pantallas por rol | Lista (demo) |
| Dominio tipado (órdenes, eventos, inventario) | Lista |
| Persistencia | Lectura + escritura en Supabase (órdenes, clientes, inventario, campo, firma) |
| Auth real | Sí — email/password contra Supabase |
| Supabase | Conectado — proyecto `ayszrtieplmqscqtabsu` (11 tablas públicas) |
| Deploy Vercel | No |
| Gemini / AI Studio | Eliminado (`@google/genai`, `metadata.json`, deps servidor) — **no forma parte del producto** |

**Veredicto:** login real + catálogo/órdenes leídos desde Supabase; falta persistir altas/ediciones (resto de Fase 2).

### Cuentas de prueba

| Rol | Email | Password |
| --- | --- | --- |
| Admin | `admin@servicasa.com.ar` | `ServiCasa2026!` |
| Técnico | `carlos.mendez@servicasa.com.ar` | `ServiCasa2026!` |
| Técnico | `maria.rodriguez@servicasa.com.ar` | `ServiCasa2026!` |
| Cliente | `julian.albarracin@gmail.com` | `ServiCasa2026!` |

---

## Stack real en el repo

- React 19, TypeScript, Vite (`vite.config.ts`, puerto **3000**)
- Tailwind CSS 4 (`@tailwindcss/vite`)
- Estado: `AppContext` + clave `servicasa_app_state_v1` en `localStorage`
- Datos iniciales: `src/data/mockData.ts`
- Tipos: `src/types/index.ts`
- Ruteo simple por `currentPath` en contexto (no React Router)

Dependencias heredadas de AI Studio (`@google/genai`, `GEMINI_*`, `metadata.json`, `express`, `dotenv`, `tsx`) fueron **eliminadas** en la fase de higiene del repo.

---

## Mapa de la app

| Ruta (`currentPath`) | Vista | Rol esperado |
| --- | --- | --- |
| `/` | `LandingView` | Público |
| `/auth` | `AuthView` | Selector de perfiles demo |
| `/home` | Redirige según `currentUser.role` | Los 3 |
| `/hub` | `AdminHubView` | Admin |
| `/technician` | `TechnicianView` | Técnico |
| `/customer` | `CustomerView` | Cliente |
| `/settings` | `SettingsView` | Config / demo |

Componentes clave: `Header`, `RoleSwitcherModal`, `Timeline`, `SignaturePad`, badges, toasts.

---

## Capacidades ya modeladas en UI (sobre mock)

### Admin
- Listado / filtros de órdenes
- Alta de órdenes y clientes
- Asignación de técnicos
- Inventario de materiales (stock / altas)
- Detalle con timeline de eventos

### Técnico
- Órdenes asignadas
- Cambios de estado (iniciar, pausar, reanudar, completar…)
- Checklist, time logs, materiales usados, notas técnicas
- Firma del cliente en sitio

### Cliente
- Sus órdenes
- Visibilidad de avance / materiales / firma
- Firma de conformidad

---

## Backend Supabase (Fase 1)

| Dato | Valor |
| --- | --- |
| Project ref | `ayszrtieplmqscqtabsu` |
| URL | `https://ayszrtieplmqscqtabsu.supabase.co` |
| Env local | `.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) |
| MCP | servidor `servicasa` en `.cursor/mcp.json` |

**Tablas:** `profiles`, `technicians`, `customers`, `materials`, `service_orders`, `order_checklist_items`, `order_time_logs`, `order_notes`, `order_materials_used`, `order_events`, `order_signatures`.

**Auth:** al crear un usuario en Auth, el trigger crea `profiles`. El `role` se toma de `raw_app_meta_data.role` (`admin` \| `technician` \| `customer`); default `customer`.

**Seeds actuales:** 2 técnicos, 3 clientes, 8 materiales. Sin filas en `profiles` hasta que existan usuarios Auth.

### Crear usuarios de prueba (dashboard)

1. Authentication → Users → Add user  
2. En **User Metadata / App Metadata** poner por ejemplo: `{"role":"admin"}`  
3. Luego vincular en SQL: `profiles.technician_id` / `profiles.customer_id` y el `profile_id` del técnico/cliente

## Lo que falta para que “funcione de verdad”

1. ~~Proyecto Supabase~~ / ~~Esquema~~ / ~~RLS base~~ / ~~Env locales~~
2. **Usuarios Auth de prueba** + vínculo a técnicos/clientes
3. **Cliente Supabase en el frontend** (Fase 2) reemplazando mocks y `localStorage`
4. Endurecer RLS / firmas (Fase 3)
5. **Deploy en Vercel**
6. (Opcional) Storage para firmas/imágenes

Detalle de fases: [`ROADMAP.md`](./ROADMAP.md).

---

## Convenciones para agentes

- Responder y documentar en **español** si el usuario lo pide.
- No reintroducir Gemini / AI Studio como parte del producto.
- Preferir evolucionar el dominio existente en `types/` y las vistas actuales antes de reescribir la UI.
- Cualquier cambio de schema Supabase debe reflejarse aquí y en el roadmap.
- No commitear secretos (`.env`, service role keys).

---

## Criterio de “listo para internet”

La app se considera lista para el primer lanzamiento cuando:

- Un admin, un técnico y un cliente reales pueden iniciar sesión
- Las órdenes y el inventario persisten en Supabase
- Las políticas RLS impiden acceso cruzado indebido entre roles
- El build de Vite está publicado en Vercel y abre sin configuración manual del usuario final
