# Roadmap — TecniUrbano

Hoja de ruta hacia el lanzamiento en internet (Vercel + Supabase).

**Posición actual:** Fase 2 cerrada (CRUD persistido + modo demo aislado) · **siguiente:** cerrar Fase 3 (checklist manual de los 3 roles)

---

## Visión

Pasar de una **demo de interfaz** (datos mock + `localStorage`) a una app en producción donde los **3 roles** (admin, técnico, cliente) operen contra datos reales, con autenticación y permisos.

```
[Hoy] UI demo
   → [1] Supabase schema + Auth
   → [2] Frontend conectado (CRUD real)
   → [3] RLS y endurecimiento
   → [4] Deploy Vercel
   → [5] Post-lanzamiento
```

---

## Fase 0 — Base UI (hecha)

- [x] Landing y acceso demo por rol
- [x] Hub admin (órdenes, clientes, inventario)
- [x] Vista técnico (checklist, tiempo, materiales, notas, firma)
- [x] Vista cliente (seguimiento + firma)
- [x] Modelo de dominio tipado
- [x] Persistencia local de demo (`localStorage`)
- [x] Documentación de producto (`README`, `agent.md`, este roadmap)

---

## Fase 1 — Supabase: fundación

**Meta:** tener backend listo aunque la UI siga parcialmente en mock.

- [x] Crear proyecto Supabase (dev) — `ayszrtieplmqscqtabsu`
- [x] Tablas alineadas al dominio
- [x] Auth email/password + usuarios de prueba
- [x] Trigger `handle_new_user` → `profiles`
- [x] Seeds (técnicos, clientes, materiales, 2 órdenes)
- [x] Variables locales `.env.local`

**Salida:** schema + usuarios autenticables. ✅

---

## Fase 2 — Conectar la app (los 3 roles)

**Meta:** dejar de depender de `mockData` / `localStorage` para el flujo principal.

- [x] Instalar `@supabase/supabase-js` y cliente único
- [x] Reemplazar login demo por Auth real (`/auth`)
- [x] Cargar sesión y perfil (`role`, vínculos técnico/cliente)
- [x] Cargar catálogo remoto (técnicos, clientes, materiales, órdenes + hijos)
- [x] Admin: CRUD órdenes, clientes, inventario, asignación (persistir en Supabase)
- [x] Técnico: mutaciones de campo persistidas (checklist, tiempo, notas, materiales)
- [x] Cliente: firma persistida
- [x] Timeline / eventos persistidos
- [x] Guard de rutas por rol
- [x] Manejo de errores y estados de carga (mejorar UX)
- [x] Retirar o aislar el modo demo (flag opcional)
  - _Decisión:_ se mantiene la fuente de datos demo (`DEMO_USERS`, `resetDemoData`) pero toda la UI que la expone (tarjeta de accesos rápidos en Landing, cuentas de prueba en `/auth`, selector de roles en Header/Settings, botón "Restablecer Datos") queda condicionada a `DEMO_MODE` (`src/lib/featureFlags.ts`). Con `VITE_DEMO_MODE=false` en Vercel, ese código queda fuera del bundle de producción por tree-shaking.

**Salida:** los 3 roles usan la misma base remota desde la UI.

---

## Fase 3 — Seguridad y calidad

**Meta:** apto para usuarios reales sin fugas de datos entre roles.

- [x] RLS base por tabla (ya aplicado en Fase 1; validar en profundidad aquí)
- [x] Validar que no se puedan leer/escribir IDs ajenos desde el cliente
- [x] Revisar firmas (tamaño, Storage vs data URL)
  - _Decisión v1:_ data URL PNG acotado (máx. 800×300) en columna `text`. Suficiente para firma mostrada a `h-14 max-w-xs`; Storage se evalúa si crece el volumen de órdenes.
- [x] Limpieza de deps residuales (Gemini / AI Studio si no se usan)
  - _Eliminado:_ `@google/genai`, `metadata.json`, `express`, `dotenv`, `tsx`, `autoprefixer`, `esbuild`, `@types/express` y config HMR de AI Studio en `vite.config.ts`. `motion` quedó (no usado aún, no es de AI Studio).
- [x] `npm run build` + `npm run lint` en verde
- [ ] Checklist manual de los 3 roles

**Salida:** app endurecida y build de producción confiable.

---

## Fase 4 — Lanzamiento (Vercel)

**Meta:** URL pública usable.

- [ ] Proyecto en Vercel vinculado al repo
- [ ] Env vars de Supabase en Vercel
- [ ] Dominio (vercel.app o propio)
- [ ] Smoke test post-deploy (login + crear orden + firma)
- [ ] Actualizar `README` / `agent.md` con URL y credenciales de demo (si aplica)

**Salida:** TecniUrbano en internet.

---

## Fase 5 — Después del primer deploy (opcional)

Priorizar según feedback real:

- [ ] Invitaciones / alta de técnicos y clientes por admin
- [ ] Notificaciones (email o push) al asignar / completar
- [ ] Adjuntos fotográficos del trabajo
- [ ] Reportes / exportes para admin
- [ ] App móvil o PWA
- [ ] Entorno staging separado de producción

---

## Definición de “lanzado”

Se considera lanzamiento v1 cuando:

1. Hay URL pública en Vercel  
2. Auth y datos viven en Supabase  
3. Admin, técnico y cliente pueden completar un ciclo de orden de punta a punta  
4. RLS impide acceso cruzado indebido  

---

## Seguimiento

| Campo | Valor |
| --- | --- |
| Fase activa | **3 — Seguridad y calidad** (en progreso) |
| Bloqueador principal | Implementar RLS en Supabase + testing de seguridad |
| Destino de hosting | Vercel |
| Destino de datos | Supabase |

Al cerrar una fase, marcar checkboxes y actualizar la fila “Fase activa” y [`agent.md`](./agent.md).
