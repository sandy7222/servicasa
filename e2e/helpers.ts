import type { Page } from '@playwright/test';

export type TestAccount = { email: string; password?: string };

const sharedPassword = process.env.E2E_TEST_PASSWORD;

export const ACCOUNTS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'admin@tecniurbano.com.ar',
    password: process.env.E2E_ADMIN_PASSWORD ?? sharedPassword,
  },
  technician: {
    email: process.env.E2E_TECHNICIAN_EMAIL ?? 'maria.rodriguez@tecniurbano.com.ar',
    password: process.env.E2E_TECHNICIAN_PASSWORD ?? sharedPassword,
  },
  customer: {
    email: process.env.E2E_CUSTOMER_EMAIL ?? 'julian.albarracin@gmail.com',
    password: process.env.E2E_CUSTOMER_PASSWORD ?? sharedPassword,
  },
} as const;

export function hasCredentials(account: TestAccount): boolean {
  return Boolean(account.email && account.password);
}

/** Login real contra Supabase Auth — no hay atajo de sesión: cada test
 * pasa por el formulario real, igual que un usuario. */
export async function login(page: Page, account: TestAccount, passwordOverride?: string) {
  const password = passwordOverride ?? account.password;
  if (!password) throw new Error(`Falta la contraseña E2E protegida para ${account.email}.`);
  await page.goto('/#/auth');
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
}
