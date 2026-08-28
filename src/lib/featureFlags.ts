// src/lib/featureFlags.ts

/**
 * Feature flags para TecniUrbano.
 *
 * DEMO_MODE: muestra accesos rápidos y usuarios de prueba (con credenciales
 * reales de Supabase visibles, incluida una cuenta de admin) — nunca debe
 * ser alcanzable fuera de `vite dev` local, sin importar cómo esté seteada
 * VITE_DEMO_MODE en cualquier entorno desplegado. `import.meta.env.DEV` lo
 * fija Vite en build time según el modo (dev vs. build de producción/preview)
 * y no se puede pisar con una variable de entorno mal configurada en Vercel
 * — a diferencia de VITE_DEMO_MODE, que sí se pisó así una vez.
 */

export const DEMO_MODE = import.meta.env.DEV && import.meta.env.VITE_DEMO_MODE !== 'false';