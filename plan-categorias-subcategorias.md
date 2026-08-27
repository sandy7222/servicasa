# Plan: Categorías y Subcategorías reales en Supabase — TecniUrbano

Rama sugerida: `feature/categorias-subcategorias-real`, a partir de `feature/mercadopago-payments-backend`.

## 1. Diagnóstico

- La pestaña Categorías del admin vive solo en `localStorage`, desconectada de Supabase.
- El agrupamiento real sale de `services.category` (texto libre) + `services.subcategoria` (texto libre, ya usada por QuoteBuilder).
- **Fase 0 completada (22/8/2026):** 233 servicios totales, 48 combinaciones distintas de category/subcategoria.
  - 8 categorías reales existen hoy: Cerrajería, Electricidad, Instalación de equipos, Mantenimiento general, Plomería, Refrigeración, Reparaciones del hogar, Soldadura.
  - 5 filas "huérfanas" (subcategoria = null): 1 en Electricidad, 1 en Plomería, 1 en Reparaciones del hogar (previo a cargar Pintura/Albañilería), y los únicos ítems de Instalación de equipos y Mantenimiento general (nunca tuvieron tarifario completo).
  - Enum `service_type` confirmado actualizado (21/8) con Cerrajería/Refrigeración/Soldadura — pendiente confirmar en Fase 1 si es redundante con `category` o se usa para otra cosa (revisar antes de decidir si se deprecar junto con `category`).

## 2. Objetivo

1. `categories` y `subcategories` como entidades reales en Supabase, con relación jerárquica.
2. `services` referencia ambas por FK.
3. Admin gestiona categorías/subcategorías desde una UI conectada a la base.
4. Vista pública del cliente agrupa por categoría → subcategoría.
5. Cero ruptura de lo ya probado (pagos, QuoteBuilder, Realtime, archivado).

## 3. Modelo de datos

```sql
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  icon text,
  description text,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete restrict,
  name text not null,
  slug text not null,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

alter table services add column category_id uuid references categories(id);
alter table services add column subcategory_id uuid references subcategories(id);
```

`on delete restrict` intencional. `services.category`/`subcategoria` (texto) se mantienen sin tocar hasta Fase 6.

## 4. Datos semilla — CONFIRMADO con Fase 0 (8 categorías reales)

| name | icon (sugerido) | description (sugerida, editable después) | display_order |
|---|---|---|---|
| Plomería | llave inglesa | Reparación y mantenimiento de sistemas de agua y desagüe | 1 |
| Electricidad | rayo | Instalaciones eléctricas seguras y reparaciones | 2 |
| Reparaciones del hogar | llave+destornillador | Pintura, albañilería y arreglos generales del hogar | 3 |
| Cerrajería | llave/candado | Apertura, cambio y reparación de cerraduras y sistemas de seguridad | 4 |
| Refrigeración | copo de nieve | Instalación, mantenimiento y reparación de heladeras, freezers y aires acondicionados | 5 |
| Soldadura | chispa/soldador | Trabajos de soldadura y estructuras metálicas | 6 |
| Mantenimiento general | engranaje | Revisiones preventivas e inspecciones técnicas | 7 |
| Instalación de equipos | escudo/check | Montaje y instalación de electrodomésticos | 8 |

Íconos/descripciones de Cerrajería, Refrigeración y Soldadura son placeholders razonables — no existían en el panel viejo (nunca se publicaron ahí). El usuario los puede editar después desde el nuevo panel real (Fase 4), no bloquea la migración.

Subcategorías conocidas (de los `tarifario_*_seed.json`, confirmar nombres exactos contra la tabla real al escribir el INSERT): Electricidad tiene >20 subcategorías técnicas granulares (Monofásicas, Trifásicas, Canalización Embutida Metálica, etc.); los rubros nuevos usan subcategorías más genéricas (ej. Aperturas, Pintura Interior). Es aceptable la diferencia de granularidad — el editor de subcategorías (Fase 4) debe soportar bien categorías con muchas subcategorías (scroll/búsqueda).

## 5. Plan de migración por fases

**Fase 0 — COMPLETADA.** Resultado real arriba (sección 1 y 4).

**Fase 1 — Crear tablas + seed (SIGUIENTE PASO)**
- Migración SQL de la sección 3.
- Insertar las 8 categorías de la sección 4.
- Insertar subcategorías conocidas por rubro (extraídas de los `tarifario_*_seed.json` reales, no inventadas).
- No tocar componentes React todavía.

**Fase 2 — Backfill de datos existentes**
- Para cada valor distinto de `services.category`, resolver a qué fila de la tabla `categories` corresponde (case-insensitive, trim). Con las 8 categorías ya semillas en la Fase 1, esto debería ser un match directo 1 a 1, sin ambigüedad.
- Para cada `services.subcategoria`, resolver a su fila en `subcategories`, ligada al `category_id` correspondiente. Usar los `tarifario_*_seed.json` como fuente de verdad para los nombres exactos de subcategoría por rubro.
- `UPDATE services SET category_id = ..., subcategory_id = ... WHERE ...` — se puede hacer en un solo UPDATE con un JOIN contra las tablas nuevas por nombre de texto, no hace falta fila por fila.
- Los 5 huérfanos (subcategoria = null): crear una subcategoría "Otros" en Electricidad, Plomería y Reparaciones del hogar, y asignarles esa. Para Instalación de equipos y Mantenimiento general (categorías de 1 solo ítem), dejar `subcategory_id` en null es aceptable — no tiene sentido crear una subcategoría para agrupar un solo servicio.
- Verificación de cierre de fase: `SELECT count(*) FROM services WHERE category_id IS NULL;` tiene que dar 0. Si da más de 0, hay un valor de `category` que no matcheó ninguna semilla — investigar antes de seguir.

**Fase 3 — Migrar lecturas (de menor a mayor riesgo)**
1. `ServicesCategoryView.tsx` (vista pública del cliente): agrupar por `category_id` → `subcategory_id` en vez de listar todo mezclado. Riesgo bajo — no toca pagos ni flujos críticos, es puramente de lectura/presentación.
2. Catálogo admin ("Catálogo de Servicios Tarifados"): secciones colapsables por categoría, con subagrupación por subcategoría dentro de las categorías grandes (Electricidad). Mismo criterio de UI que ya charlamos antes en esta conversación.
3. `QuoteBuilder.tsx`: cambiar de agrupar por el texto `subcategoria` a agrupar por `subcategory_id`. Antes de tocar este archivo, revisar la definición actual del trigger `apply_catalog_price_to_quote_item` (ya fue modificado una vez para aceptar `service_id`) — confirmar que no rompe nada si además empieza a leer `subcategory_id`. Avisar antes de modificar ese trigger específicamente.

**Fase 4 — Migrar escrituras**
- Formulario de Crear/Editar Servicio (admin): reemplazar los campos de texto libre de categoría/subcategoría por selects conectados a `categories`/`subcategories`, con opción de "crear nueva subcategoría" inline sin salir del formulario.
- Nuevo panel de gestión dentro de la pestaña Categorías (reemplaza el `localStorage` actual): listar categorías reales con su cantidad de servicios (calculada con un COUNT, no hardcodeada), poder crear/editar/reordenar, y aplicar las reglas de borrado de la sección 7 (ocultar o fusionar en vez de borrado silencioso).
- Mismo tratamiento para el panel de subcategorías dentro de cada categoría.

**Fase 5 — Apagar el sistema viejo**
- Confirmar, revisando todo el código (`grep` por `services.category` y `services.subcategoria` como texto), que ningún componente sigue leyendo las columnas de texto viejas.
- Recién ahí, marcar esas columnas como deprecated en un comentario de schema — no eliminarlas todavía, se mantienen como respaldo/auditoría.

**Fase 6 — Limpieza final** (después de 2-4 semanas de uso real validado en producción)
- Eliminar `services.category` y `services.subcategoria` (texto) solo cuando esté 100% confirmado que nada las usa y que la Fase 5 no reveló ningún caso pendiente.

## 6. Riesgos específicos / qué no romper

- **Pagos y `workTimer.ts`**: `assignTechnician`, `orderRequiresPaymentGate`, `isOrderPaymentSettled` no dependen de categoría/subcategoría — no deberían verse afectados, pero correr los mismos tests manuales de pago en sandbox después de las Fases 3 y 4 como red de seguridad.
- **Trigger `apply_catalog_price_to_quote_item`**: ya fue modificado una vez para aceptar `service_id`. Revisar su definición actual antes de tocar `QuoteBuilder.tsx` en la Fase 3, y avisar antes de modificarlo.
- **Realtime**: si algún canal de Supabase Realtime filtra o depende del texto de categoría, actualizar el filtro a la nueva columna.
- **Archivado a Excel**: el proceso de archivado de órdenes viejas no debería depender de categoría de servicio, pero conviene confirmarlo antes de tocar `services`.
- **Rubros en curso de carga** (Refrigeración y cualquier otro que se esté cargando en paralelo): una vez exista la tabla `categories` real (fin de Fase 1), cargar los nuevos servicios directo con `category_id`/`subcategory_id` correctos, en vez de tener que backfillearlos después con texto.

## 7. UX del nuevo editor (para la Fase 4)

Reglas de borrado (esto fue el disparador original de la consulta — "hay categorías que no puedo eliminar"):

- Si una categoría/subcategoría tiene 0 servicios asociados → permitir eliminar directo.
- Si tiene servicios asociados → el botón "Eliminar" abre un diálogo con dos opciones: **"Ocultar"** (`is_active = false`, deja de aparecer en la landing pero no rompe nada) o **"Fusionar con otra"** (reasigna todos los servicios a una categoría/subcategoría destino elegida, y recién ahí borra la vacía). Nunca un borrado silencioso que deje servicios huérfanos.
- Reordenar: drag-and-drop simple sobre `display_order`, tanto para categorías como para subcategorías dentro de su categoría.
- Nota para Instalación de equipos / Mantenimiento general: quedan como categorías propias en el seed inicial (no se fuerza fusión ahora). Si más adelante se decide fusionarlas con otra, la opción "Fusionar con otra" de este mismo panel ya lo resuelve sin necesidad de otra migración.

---

*Documento completo — versión final post Fase 0 real, 22/8/2026.*
