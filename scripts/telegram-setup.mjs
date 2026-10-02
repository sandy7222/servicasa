#!/usr/bin/env node
/**
 * Ayuda para configurar el bot de Telegram (plan-avisos-telegram-y-chat.md, Fase 1).
 *
 *   node scripts/telegram-setup.mjs           -> verifica el token y muestra tu chat id
 *   node scripts/telegram-setup.mjs --test    -> manda un mensaje de prueba (con botón)
 *
 * Lee TELEGRAM_BOT_TOKEN (y TELEGRAM_CHAT_ID para --test) de .env.local o del
 * entorno. NUNCA imprime el token: la API de Telegram lo lleva en la URL, por
 * eso este script jamás muestra URLs ni mensajes de error crudos de red.
 *
 * Ojo: getUpdates falla (409) si ya hay un webhook activo en el bot. Correr
 * este script ANTES de registrar webhooks (variante A del plan, Fase 3).
 */
import { readFileSync } from 'node:fs';

function loadEnvLocal() {
  try {
    for (const raw of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    /* sin .env.local: se usa solo el entorno */
  }
}

async function telegram(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(10000),
  });
  return response.json().catch(() => ({ ok: false, description: `respuesta no JSON (HTTP ${response.status})` }));
}

loadEnvLocal();
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const wantsTest = process.argv.includes('--test');

if (!token) {
  console.error('Falta TELEGRAM_BOT_TOKEN. Agregalo a .env.local (esa línea: TELEGRAM_BOT_TOKEN=...) y volvé a correr.');
  process.exit(1);
}

try {
  const me = await telegram(token, 'getMe');
  if (!me.ok) {
    console.error(`El token no es válido: ${me.description ?? 'error desconocido'}.`);
    process.exit(1);
  }
  console.log(`✔ Bot verificado: @${me.result.username} (${me.result.first_name})`);

  if (wantsTest) {
    if (!chatId) {
      console.error('Falta TELEGRAM_CHAT_ID para el envío de prueba. Corré el script sin --test para averiguarlo.');
      process.exit(1);
    }
    const sent = await telegram(token, 'sendMessage', {
      chat_id: chatId,
      text: '✅ Prueba de TecniUrbano: si ves este mensaje, los avisos de visitas pagadas van a llegar acá.',
      reply_markup: { inline_keyboard: [[{ text: 'Abrir panel de admin', url: 'https://tecniurbano.online/#/hub' }]] },
    });
    console.log(sent.ok ? '✔ Mensaje de prueba enviado. Revisá tu celular.' : `✘ No se pudo enviar: ${sent.description ?? 'error desconocido'}`);
    process.exit(sent.ok ? 0 : 1);
  }

  const updates = await telegram(token, 'getUpdates');
  if (!updates.ok) {
    console.error(`No se pudieron leer los mensajes: ${updates.description ?? 'error desconocido'}.`);
    process.exit(1);
  }
  const chats = new Map();
  for (const update of updates.result ?? []) {
    const chat = update.message?.chat ?? update.my_chat_member?.chat;
    if (chat) chats.set(chat.id, chat);
  }
  if (chats.size === 0) {
    console.log('Todavía no hay mensajes. Abrí el chat con tu bot en Telegram, apretá "Iniciar" (o mandale "hola") y volvé a correr este script.');
  } else {
    console.log('\nChats que le escribieron al bot (usá el "id" de TU chat como TELEGRAM_CHAT_ID):');
    for (const chat of chats.values()) {
      const name = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || '';
      console.log(`  id: ${chat.id}   tipo: ${chat.type}   nombre: ${name}${chat.username ? `   @${chat.username}` : ''}`);
    }
    console.log('\nSiguiente paso: cargá TELEGRAM_CHAT_ID en .env.local y en Vercel, y probá con: node scripts/telegram-setup.mjs --test');
  }
} catch (err) {
  console.error(`Error de red al hablar con Telegram (${err instanceof Error ? err.name : 'desconocido'}). Reintentá.`);
  process.exit(1);
}
