import { expect, test } from '@playwright/test';

test.describe('Invitado → catálogo → handoff de pago', () => {
  test('envía el servicio fijo elegido al backend y nunca crea una orden desde el navegador', async ({ page }) => {
    let postedBody: Record<string, unknown> | undefined;

    await page.route('**/api/orders/guest-checkout', async (route) => {
      postedBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ paymentUrl: 'https://checkout.test/preference-e2e' }),
      });
    });

    await page.goto('/#/auth');
    await page.getByRole('button', { name: 'Pedir servicio' }).click();
    await expect(page.getByRole('heading', { name: 'Pedir un servicio como invitado' })).toBeVisible();

    await page.getByRole('button', { name: /Sé qué trabajo necesito/ }).click();
    const fixedPricePanel = page.getByText('Servicio de precio fijo').locator('..');
    const catalogItem = fixedPricePanel.locator('button').first();
    await expect(catalogItem).toBeVisible({ timeout: 15_000 });
    await catalogItem.click();

    await page.getByPlaceholder('Nombre completo').fill('Invitado E2E');
    await page.getByPlaceholder('Email').fill('invitado-e2e@example.com');
    await page.getByPlaceholder('Teléfono').fill('1112345678');
    await page.getByPlaceholder(/Contanos qué sucede/).fill('Prueba de handoff al checkout sin crear datos reales.');
    await page.getByPlaceholder('Ej.: Suipacha').fill('Corrientes');
    await page.getByPlaceholder('Ej.: 547').fill('1234');
    await page.getByPlaceholder('Ej.: Burzaco').fill('Córdoba');
    await page.getByLabel('Provincia').selectOption('Córdoba');

    const requestPromise = page.waitForRequest('**/api/orders/guest-checkout');
    await page.getByRole('button', { name: 'Pedir trabajo y pagar' }).click();
    await requestPromise;

    expect(postedBody).toMatchObject({
      fullName: 'Invitado E2E',
      email: 'invitado-e2e@example.com',
      workMode: 'direct',
      quantity: 1,
    });
    expect(postedBody?.fixedPriceServiceId).toEqual(expect.any(String));
    expect(Number(postedBody?.requestedTotal)).toBeGreaterThan(0);
    expect(postedBody).not.toHaveProperty('orderId');
  });
});
