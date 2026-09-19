import { expect, test } from '@playwright/test';
import { ACCOUNTS, hasCredentials, login } from './helpers';

test.describe('Navegación admin en 4 grupos', () => {
  test.skip(!hasCredentials(ACCOUNTS.admin), 'Falta E2E_ADMIN_PASSWORD o E2E_TEST_PASSWORD.');

  test('móvil: Órdenes es home, Plataforma abre la página del cliente, Clientes conserva la barra', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, ACCOUNTS.admin);
    await expect(page.getByText('Panel Operativo — Admin Hub')).toBeVisible({ timeout: 15_000 });

    const groups = page.getByRole('navigation', { name: 'Grupos del administrador' });
    await expect(groups).toBeVisible();
    await expect(groups.getByText('Operación')).toBeVisible();
    await expect(groups.getByText('Personas')).toBeVisible();
    await expect(groups.getByText('Catálogo')).toBeVisible();
    await expect(groups.getByText('Plataforma')).toBeVisible();
    await expect(page.getByRole('button', { name: /En gestión operativa/ })).toBeVisible();

    await groups.getByText('Plataforma').click();
    await expect(page.getByRole('heading', { name: 'Página del cliente' })).toBeVisible();
    await expect(groups).toBeVisible();

    await groups.getByText('Operación').click();
    await expect(page.getByRole('button', { name: /En gestión operativa/ })).toBeVisible();

    await groups.getByText('Personas').click();
    await expect(page).toHaveURL(/#\/admin\/clientes/);
    await expect(page.getByRole('heading', { name: 'Planilla de clientes' })).toBeVisible();
    await expect(groups).toBeVisible();
  });

  test('escritorio: menú lateral con los 4 grupos y chrome en Clientes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, ACCOUNTS.admin);
    await expect(page.getByText('Panel Operativo — Admin Hub')).toBeVisible({ timeout: 15_000 });

    const sidebar = page.getByRole('navigation', { name: 'Módulos del administrador' });
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Grupos del administrador' })).toBeHidden();
    await expect(sidebar.getByText('Operación')).toBeVisible();
    await expect(sidebar.getByText('Personas')).toBeVisible();
    await expect(sidebar.getByText('Catálogo')).toBeVisible();
    await expect(sidebar.getByText('Plataforma')).toBeVisible();

    await sidebar.getByRole('button', { name: 'Página del cliente' }).click();
    await expect(page.getByRole('heading', { name: 'Página del cliente' })).toBeVisible();

    await sidebar.getByRole('button', { name: 'Clientes' }).click();
    await expect(page).toHaveURL(/#\/admin\/clientes/);
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Planilla de clientes' })).toBeVisible();
  });
});
