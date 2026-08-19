// src/lib/featureFlags.ts

/**
 * Feature flags para ServiCasa.
 * 
 * DEMO_MODE: 
 * - true (default): Muestra accesos rápidos, usuarios de prueba y usa mockData.
 * - false: Oculta la UI demo y fuerza el uso de Supabase.
 * 
 * Para desactivar en Vercel, agregar la variable de entorno:
 * VITE_DEMO_MODE=false
 */

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';