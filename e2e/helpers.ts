import type { Page } from '@playwright/test';

/** Contraseña compartida por todas las cuentas de prueba sembradas
 * (ver ROADMAP-TERMINACION.md / memoria de sesión). */
export const TEST_PASSWORD = 'TecniUrbano2026!';

export const ACCOUNTS = {
  admin: 'admin@tecniurbano.com.ar',
  technician: 'maria.rodriguez@tecniurbano.com.ar',
  customer: 'julian.albarracin@gmail.com',
} as const;

/** Login real contra Supabase Auth — no hay atajo de sesión: cada test
 * pasa por el formulario real, igual que un usuario. */
export async function login(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto('/#/auth');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}
