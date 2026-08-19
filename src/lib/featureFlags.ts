/**
 * Feature flags — controlados por variables de entorno Vite.
 *
 * DEMO_MODE: cuando es `true`, se muestran la tarjeta de accesos demo en
 * Landing, los botones de cuentas de prueba en AuthView, el simulador de
 * usuarios en Header/RoleSwitcherModal y las opciones de reinicio en
 * SettingsView.
 *
 * Para desactivarlo en producción (Vercel), agregá:
 *   VITE_DEMO_MODE=false
 *
 * Vite reemplaza la expresión en tiempo de build, por lo que el código
 * muerto queda eliminado del bundle de producción (tree-shaking).
 */
export const DEMO_MODE: boolean = import.meta.env.VITE_DEMO_MODE !== 'false';
