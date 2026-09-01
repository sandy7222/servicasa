import { expect, test } from '@playwright/test';
import { ACCOUNTS, hasCredentials, login } from './helpers';

test.describe('Intentos cruzados de rutas por rol', () => {
  test('un cliente no puede abrir el panel administrativo', async ({ page }) => {
    test.skip(!hasCredentials(ACCOUNTS.customer), 'Falta la credencial E2E protegida del cliente.');
    await login(page, ACCOUNTS.customer);
    await page.goto('/#/admin/clientes');
    await expect(page).toHaveURL(/#\/customer$/);
    await expect(page.getByText('Portal del Cliente')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Panel Operativo — Admin Hub')).not.toBeVisible();
  });

  test('un técnico no puede abrir datos de clientes del admin', async ({ page }) => {
    test.skip(!hasCredentials(ACCOUNTS.technician), 'Falta la credencial E2E protegida del técnico.');
    await login(page, ACCOUNTS.technician);
    await page.goto('/#/admin/clientes');
    await expect(page).toHaveURL(/#\/technician$/);
    await expect(page.getByText('Terminal de Campo')).toBeVisible({ timeout: 15_000 });
  });

  test('un cliente no puede abrir la terminal técnica', async ({ page }) => {
    test.skip(!hasCredentials(ACCOUNTS.customer), 'Falta la credencial E2E protegida del cliente.');
    await login(page, ACCOUNTS.customer);
    await page.goto('/#/technician');
    await expect(page).toHaveURL(/#\/customer$/);
    await expect(page.getByText('Portal del Cliente')).toBeVisible({ timeout: 15_000 });
  });
});
