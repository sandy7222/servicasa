# ServiCasa

Plataforma web para la gestión integral de servicios técnicos a domicilio. Conecta tres roles —**administrador**, **técnico** y **cliente**— en un mismo flujo operativo: órdenes de servicio, inventario, checklist en campo, registro de tiempo, materiales usados y firma de conformidad.

## Estado actual

Auth y datos viven en **Supabase** (Postgres + RLS). La UI lee y escribe el catálogo operativo remoto. Siguiente foco: endurecer seguridad (Fase 3) y deploy en **Vercel**.

Más detalle: [`agent.md`](./agent.md) y [`ROADMAP.md`](./ROADMAP.md).

## Roles

| Rol | Qué hace en la app |
| --- | --- |
| **Admin** | Hub de órdenes, clientes, inventario, asignación de técnicos y seguimiento |
| **Técnico** | Órdenes asignadas, checklist, tiempo, materiales, notas y firma en sitio |
| **Cliente** | Seguimiento de sus servicios y firma de conformidad |

## Stack

- React 19 + TypeScript + Vite (puerto **3000**)
- Tailwind CSS 4
- Supabase (`@supabase/supabase-js`) — Auth + Postgres
- Destino de hosting: Vercel

## Cómo correr en local

**Requisito:** Node.js 18+

1. Copiá `.env.example` → `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
2. Instalá y levantá:

```bash
npm install
npm run dev
```

Abrí `http://localhost:3000`.

### Cuentas de prueba

| Rol | Email | Password |
| --- | --- | --- |
| Admin | `admin@servicasa.com.ar` | `ServiCasa2026!` |
| Técnico | `carlos.mendez@servicasa.com.ar` | `ServiCasa2026!` |
| Cliente | `julian.albarracin@gmail.com` | `ServiCasa2026!` |

## Schema Supabase (público)

`profiles`, `technicians`, `customers`, `materials`, `service_orders`, `order_checklist_items`, `order_time_logs`, `order_notes`, `order_materials_used`, `order_events`, `order_signatures`

## Scripts

```bash
npm run build
npm run preview
npm run lint
```
