import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { ACCOUNTS, hasCredentials, login } from './helpers';

/**
 * Flujo E2E obligatorio del roadmap: "Conversación → no leído → lectura".
 *
 * El setup de la conversación se hace con el cliente admin de Supabase
 * (service role) porque armar una orden real asignada solo para tener un
 * hilo de conversación sería frágil y ajeno a lo que este test quiere
 * probar. Los PASOS del test — mandar el mensaje, ver el badge, abrir el
 * hilo, ver que se limpia — son interacciones reales de navegador contra
 * la app real.
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY y VITE_SUPABASE_URL en el entorno
 * (los mismos que usa api/_lib/supabaseAdmin.ts) — si faltan, el test se
 * saltea en vez de fallar en falso.
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasServiceRole = Boolean(supabaseUrl && serviceRoleKey);
const hasConversationCredentials =
  hasServiceRole && hasCredentials(ACCOUNTS.customer) && hasCredentials(ACCOUNTS.technician);

const JULIAN_PROFILE_ID = '39921296-0657-4aca-868d-45d7c63c46a7';
const MARIA_PROFILE_ID = '3ef7d581-b040-4669-88bf-d572ab4b4ac4';

test.describe('Conversación → no leído → lectura', () => {
  test.skip(
    !hasConversationCredentials,
    'Requiere service role y credenciales E2E protegidas para cliente y técnico.',
  );

  let conversationId: string;

  test.beforeAll(async () => {
    const admin = createClient(supabaseUrl!, serviceRoleKey!);
    const { data: conv, error } = await admin
      .from('conversations')
      .insert({ subject: 'TEST E2E — conversación no leída', created_by: JULIAN_PROFILE_ID })
      .select('id')
      .single();
    if (error || !conv) throw new Error(`No se pudo crear la conversación de prueba: ${error?.message}`);
    conversationId = conv.id;

    await admin.from('conversation_participants').insert([
      { conversation_id: conversationId, profile_id: JULIAN_PROFILE_ID, role: 'customer', display_name: 'Julián (E2E)' },
      { conversation_id: conversationId, profile_id: MARIA_PROFILE_ID, role: 'technician', display_name: 'María (E2E)' },
    ]);
  });

  test.afterAll(async () => {
    if (!conversationId) return;
    const admin = createClient(supabaseUrl!, serviceRoleKey!);
    await admin.from('messages').delete().eq('conversation_id', conversationId);
    await admin.from('conversation_participants').delete().eq('conversation_id', conversationId);
    await admin.from('conversations').delete().eq('id', conversationId);
  });

  test('María ve el mensaje de Julián como no leído, y al abrirlo se marca leído', async ({ browser }) => {
    const julianCtx = await browser.newContext();
    const mariaCtx = await browser.newContext();
    const julianPage = await julianCtx.newPage();
    const mariaPage = await mariaCtx.newPage();

    await login(julianPage, ACCOUNTS.customer);
    await login(mariaPage, ACCOUNTS.technician);

    // Julián abre el hilo navegando DESDE el dashboard (click real, como un
    // usuario) — un goto() directo a la ruta profunda recarga la página y
    // pierde la sesión en la carrera de inicialización de AppContext.
    await julianPage.getByRole('button', { name: /TEST E2E — conversación no leída/ }).click();
    const messageBox = julianPage.getByPlaceholder('Escribir un mensaje…');
    await messageBox.fill('Hola María, este es un mensaje de prueba E2E.');
    await julianPage.getByRole('button', { name: 'Enviar' }).click();
    await expect(julianPage.getByText('Hola María, este es un mensaje de prueba E2E.')).toBeVisible();

    // María todavía no abrió el hilo: el badge de "Mensajes" en el header
    // debe reflejar al menos 1 no leído tras refrescar.
    await mariaPage.reload();
    const badge = mariaPage.getByRole('button', { name: /Mensajes/i }).locator('text=/^[1-9]/');
    await expect(badge.first()).toBeVisible({ timeout: 15_000 });

    // María abre el hilo (click real desde su bandeja) y lee el mensaje.
    await mariaPage.getByRole('button', { name: /Mensajes/i }).click();
    await mariaPage.getByRole('button', { name: /TEST E2E — conversación no leída/ }).click();
    await expect(mariaPage.getByText('Hola María, este es un mensaje de prueba E2E.')).toBeVisible();

    // Tras leerlo, el badge debe limpiarse.
    await mariaPage.reload();
    await expect(mariaPage.getByRole('button', { name: /Mensajes/i }).locator('text=/^[1-9]/')).toHaveCount(0);

    await julianCtx.close();
    await mariaCtx.close();
  });
});
