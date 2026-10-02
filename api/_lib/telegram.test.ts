// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendTelegramMessage } from './telegram';

const TOKEN = '123456:SECRET-TOKEN-VALUE';

describe('sendTelegramMessage', () => {
  const fetchMock = vi.fn();
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('TELEGRAM_BOT_TOKEN', TOKEN);
    vi.stubEnv('TELEGRAM_CHAT_ID', '999');
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    errorSpy.mockRestore();
  });

  it('no hace nada (ni llama a la red) si faltan las variables', async () => {
    vi.stubEnv('TELEGRAM_BOT_TOKEN', '');
    expect(await sendTelegramMessage('hola')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubEnv('TELEGRAM_BOT_TOKEN', TOKEN);
    vi.stubEnv('TELEGRAM_CHAT_ID', '');
    expect(await sendTelegramMessage('hola')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('manda el mensaje al chat configurado, con botón y sin vista previa de links', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const ok = await sendTelegramMessage('Visita pagada', { text: 'Abrir panel', url: 'https://tecniurbano.online/#/hub' });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      chat_id: '999',
      text: 'Visita pagada',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: 'Abrir panel', url: 'https://tecniurbano.online/#/hub' }]] },
    });
  });

  it('si Telegram rechaza el botón (400) reintenta una vez sin botón', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response('{"ok":false,"description":"BUTTON_URL_INVALID"}', { status: 400 }))
      .mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const ok = await sendTelegramMessage('Visita pagada', { text: 'Abrir', url: 'https://x.test' });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string);
    expect(secondBody.reply_markup).toBeUndefined();
  });

  it('devuelve false sin lanzar ante un error HTTP', async () => {
    fetchMock.mockResolvedValue(new Response('{"ok":false}', { status: 500 }));
    await expect(sendTelegramMessage('hola')).resolves.toBe(false);
  });

  it('devuelve false sin lanzar ante un error de red, y nunca loguea el token', async () => {
    fetchMock.mockRejectedValue(new TypeError(`fetch failed https://api.telegram.org/bot${TOKEN}/sendMessage`));

    await expect(sendTelegramMessage('hola')).resolves.toBe(false);

    const logged = JSON.stringify(errorSpy.mock.calls);
    expect(logged).not.toContain(TOKEN);
    expect(logged).not.toContain('SECRET-TOKEN-VALUE');
  });
});
