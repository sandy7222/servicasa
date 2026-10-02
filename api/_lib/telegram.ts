const TELEGRAM_TIMEOUT_MS = 5000;

export type TelegramButton = { text: string; url: string };

async function postSendMessage(
  token: string,
  chatId: string,
  text: string,
  button?: TelegramButton
): Promise<Response> {
  return fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(button ? { reply_markup: { inline_keyboard: [[{ text: button.text, url: button.url }]] } } : {}),
    }),
    signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
  });
}

/**
 * Manda un aviso al Telegram del administrador (bot propio, ver
 * plan-avisos-telegram-y-chat.md, Fase 1).
 *
 * Diseñado para NO poder romper nada de lo que lo llama — sobre todo el
 * webhook de Mercado Pago, que jamás debe fallar por un aviso:
 * - si faltan TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID no hace nada (devuelve false);
 * - nunca lanza: cualquier error de red, timeout (5 s) o respuesta rara se loguea
 *   y devuelve false;
 * - nunca loguea el token (viaja en la URL de la API de Telegram, por eso solo se
 *   registra el estado HTTP y el mensaje de error, nunca la URL).
 *
 * Si Telegram rechaza el botón (URL inválida, 400), reintenta una vez sin botón:
 * mejor un aviso sin botón que ningún aviso.
 */
export async function sendTelegramMessage(text: string, button?: TelegramButton): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    let response = await postSendMessage(token, chatId, text, button);
    if (response.status === 400 && button) {
      console.error('[telegram] Telegram rechazó el botón (400); reintentando sin botón');
      response = await postSendMessage(token, chatId, text);
    }
    if (!response.ok) {
      const detail = (await response.text().catch(() => '')).slice(0, 200);
      console.error('[telegram] sendMessage falló', response.status, detail);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram] error de red o timeout al avisar', err instanceof Error ? err.name : 'desconocido');
    return false;
  }
}
