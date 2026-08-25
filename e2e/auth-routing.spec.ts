import { expect, test } from '@playwright/test';
import { ACCOUNTS, login } from './helpers';

/**
 * Base de la pirámide E2E: cada rol aterriza en su espacio real y no puede
 * quedar "colgado" en la pantalla de login. No cubre los 7 flujos
 * obligatorios del roadmap todavía — esos quedan para sesiones siguientes,
 * documentado explícitamente en ROADMAP-TERMINACION.md.
 */
test.describe('Login y ruteo por rol', () => {
  test('admin aterriza en el Panel Operativo — Admin Hub', async ({ page }) => {
    await login(page, ACCOUNTS.admin);
    await expect(page.getByText('Panel Operativo — Admin Hub')).toBeVisible({ timeout: 15_000 });
  });

  test('técnico aterriza en la Terminal de Campo', async ({ page }) => {
    await login(page, ACCOUNTS.technician);
    await expect(page.getByText('Terminal de Campo')).toBeVisible({ timeout: 15_000 });
  });

  test('cliente aterriza en el Portal del Cliente', async ({ page }) => {
    await login(page, ACCOUNTS.customer);
    await expect(page.getByText('Portal del Cliente')).toBeVisible({ timeout: 15_000 });
  });

  test('credenciales inválidas no entran a ningún panel', async ({ page }) => {
    await login(page, ACCOUNTS.admin, 'contraseña-incorrecta');
    await expect(page.getByText('Panel Operativo')).not.toBeVisible();
    // Sigue en la pantalla de login, no navegó a ningún hub por error.
    await expect(page.getByText('Iniciá sesión')).toBeVisible();
  });
});
