#!/usr/bin/env node
/**
 * Prueba de concepto (SOLO cuentas de prueba de Mercado Pago, sin plata real):
 * ¿se puede RESERVAR un pago con tarjeta con comisión de marketplace (marketplace_fee) y
 * cuenta del técnico vinculada por OAuth, y CAPTURARLO después?  API de Orders.
 * Ver memoria del proyecto "cobro con comisión y retención en Mercado Pago".
 *
 * Hallazgos previos: con las credenciales de prueba la API /v1/payments da "Unauthorized use of
 * live credentials"; /v1/orders sí funciona. Orders rechaza application_fee: usa marketplace_fee.
 *
 * Variables (en .env.local, nunca por chat):
 *   MP_APP_CLIENT_ID, MP_APP_CLIENT_SECRET   → aplicación (Credenciales de producción)
 *   MP_ACCESS_TOKEN, MP_PUBLIC_KEY           → de prueba (solo para --direct)
 *   MP_POC_BUYER_EMAIL (opcional)            → correo del comprador de prueba
 *
 * Uso:
 *   node scripts/mp-split-poc.mjs auth-url
 *   node scripts/mp-split-poc.mjs exchange <code> [--test]      (--test = test_token:true, token de sandbox)
 *   node scripts/mp-split-poc.mjs reserve [monto=1000] [comision=100] [tarjeta] [--direct]
 *   node scripts/mp-split-poc.mjs show
 *   node scripts/mp-split-poc.mjs capture
 *   node scripts/mp-split-poc.mjs cancel
 *
 * API de Payments (la única con application_fee, según soporte de MP 6/11/2026):
 *   node scripts/mp-split-poc.mjs pay-reserve [monto=1000] [comision=170] [tarjeta] [email]
 *   node scripts/mp-split-poc.mjs pay-show
 *   node scripts/mp-split-poc.mjs pay-capture [monto]   (sin monto = captura total)
 *   node scripts/mp-split-poc.mjs pay-cancel
 *
 * El token del vendedor de prueba queda en .mp-poc-state.json (ignorado por git).
 * Este script no imprime tokens ni claves.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_FILE = join(ROOT, '.mp-poc-state.json');
const API = 'https://api.mercadopago.com';
// Aplicación con la que se vincula al vendedor: por defecto la de PRUEBA (creada desde la cuenta Marketplace de prueba). MP_POC_APP=real usa la aplicación real.
const APP_PREFIX = process.env.MP_POC_APP === 'real' ? 'MP_APP' : 'MP_TEST_APP';
// Desde el 5/11/2026 /oauth-callback es el callback REAL de la app (Fase 1): redirige al instante y el `code`
// desaparece de la barra. Para el script, la app de PRUEBA usa una ruta que no existe (404) y deja el code visible.
// Tiene que coincidir con la Redirect URL cargada en esa aplicación de Mercado Pago.
const REDIRECT_URI =
  process.env.MP_POC_REDIRECT_URI ||
  (APP_PREFIX === 'MP_APP' ? 'https://tecniurbano.online/oauth-callback' : 'https://tecniurbano.online/prueba-oauth');
// Comprador de prueba creado en el panel de Mercado Pago (no es un secreto).
const DEFAULT_BUYER_EMAIL = 'TESTUSER336183156078157878@testuser.com';

// Tarjetas de prueba oficiales de Mercado Pago Argentina (titular APRO = pago aprobado).
const CARDS = {
  mastercard: { number: '5031755734530604', cvv: '123', method: 'master', type: 'credit_card' },
  visa: { number: '4509953566233704', cvv: '123', method: 'visa', type: 'credit_card' },
  'debito-mastercard': { number: '5287338310253304', cvv: '123', method: 'debmaster', type: 'debit_card' },
  'debito-visa': { number: '4002768694395619', cvv: '123', method: 'debvisa', type: 'debit_card' },
};

try {
  process.loadEnvFile(join(ROOT, '.env.local'));
} catch {
  /* sin .env.local: se usan las variables del entorno */
}

const readState = () => (existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {});
const writeState = (patch) => writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }, null, 2));

function need(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta ${name} en .env.local (ver el encabezado de este script).`);
    process.exit(1);
  }
  return value;
}

async function mp(path, { method = 'GET', token, body, idempotent = false } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(idempotent ? { 'X-Idempotency-Key': randomUUID() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  if (!response.ok) {
    console.error(`✘ ${method} ${path.split('?')[0]} → ${response.status}: ${json.message || json.error || JSON.stringify(json).slice(0, 400)}`);
    if (json.cause) console.error('  causa:', JSON.stringify(json.cause).slice(0, 400));
    if (json.errors) console.error('  errores:', JSON.stringify(json.errors).slice(0, 500));
    process.exit(1);
  }
  return json;
}

function orderSummary(order) {
  return {
    id: order.id,
    status: order.status,
    status_detail: order.status_detail,
    capture_mode: order.capture_mode,
    total_amount: order.total_amount,
    total_paid_amount: order.total_paid_amount,
    user_id: order.user_id,
    external_reference: order.external_reference,
    expiration_time: order.expiration_time,
    payments: (order.transactions?.payments || []).map((p) => ({ id: p.id, status: p.status, status_detail: p.status_detail, amount: p.amount, paid_amount: p.paid_amount, reference_id: p.reference_id })),
  };
}

/** Los pagos "clásicos" de la orden (con fee_details y comisión) se buscan por external_reference. */
async function classicPayments(token, externalReference) {
  const found = await mp(`/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}`, { token });
  return (found.results || []).map((p) => ({
    id: p.id,
    status: p.status,
    status_detail: p.status_detail,
    transaction_amount: p.transaction_amount,
    captured: p.captured,
    marketplace_fee: p.marketplace_fee ?? p.application_fee ?? null,
    fee_details: (p.fee_details || []).map((f) => ({ type: f.type, payer: f.fee_payer, amount: f.amount })),
    net_received_amount: p.transaction_details?.net_received_amount,
    money_release_date: p.money_release_date,
    collector_id: p.collector_id,
    live_mode: p.live_mode,
  }));
}

const [, , command, ...rest] = process.argv;
const flags = rest.filter((a) => a.startsWith('--'));
const args = rest.filter((a) => !a.startsWith('--'));

/** Credenciales con las que se opera: el vendedor vinculado por OAuth, o (--direct) las de prueba de la propia aplicación. */
function creds(state) {
  if (state.mode === 'direct') return { token: need('MP_ACCESS_TOKEN'), publicKey: need('MP_PUBLIC_KEY') };
  if (!state.seller) {
    console.error('Primero vinculá al vendedor (auth-url + exchange), o usá reserve --direct.');
    process.exit(1);
  }
  return { token: state.seller.access_token, publicKey: state.seller.public_key };
}

if (command === 'auth-url') {
  const clientId = need(APP_PREFIX + '_CLIENT_ID');
  const state = randomBytes(8).toString('hex');
  writeState({ oauthState: state });
  const url = `https://auth.mercadopago.com/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  console.log('Abrí este enlace en una ventana de INCÓGNITO, iniciá sesión con el VENDEDOR de prueba y autorizá:\n');
  console.log(url);
  console.log('\nAl terminar te lleva a tecniurbano.online/oauth-callback?code=...&state=...');
  console.log('Copiá solo el valor de "code" (vale 10 minutos) y corré:  node scripts/mp-split-poc.mjs exchange <code>');
} else if (command === 'exchange') {
  const code = args[0];
  if (!code) {
    console.error('Falta el código:  node scripts/mp-split-poc.mjs exchange <code>');
    process.exit(1);
  }
  const data = await mp('/oauth/token', {
    method: 'POST',
    body: {
      client_id: need(APP_PREFIX + '_CLIENT_ID'),
      client_secret: need(APP_PREFIX + '_CLIENT_SECRET'),
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      test_token: flags.includes('--test') ? 'true' : 'false',
    },
  });
  writeState({
    seller_prev: readState().seller ?? null,
    seller: {
      user_id: data.user_id,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      public_key: data.public_key,
      expires_in: data.expires_in,
      test_token: flags.includes('--test'),
    },
  });
  console.log('✔ Vendedor vinculado.', {
    user_id: data.user_id,
    live_mode: data.live_mode,
    scope: data.scope,
    expires_in_days: Math.round(data.expires_in / 86400),
    token_prefix: String(data.access_token || '').split('-')[0],
  });
} else if (command === 'reserve') {
  const mode = flags.includes('--direct') ? 'direct' : 'oauth';
  const state = { ...readState(), mode };
  const { token, publicKey } = creds(state);
  const amount = Number(args[0] ?? 1000).toFixed(2);
  const fee = Number(args[1] ?? 100);
  const card = CARDS[args[2] ?? 'mastercard'];
  if (!card) {
    console.error(`Tarjeta desconocida. Opciones: ${Object.keys(CARDS).join(', ')}`);
    process.exit(1);
  }
  const email = process.env.MP_POC_BUYER_EMAIL || DEFAULT_BUYER_EMAIL;
  const cardToken = await mp(`/v1/card_tokens?public_key=${publicKey}`, {
    method: 'POST',
    body: {
      card_number: card.number,
      security_code: card.cvv,
      expiration_month: 11,
      expiration_year: 2030,
      cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
    },
  });
  const externalReference = `poc-${Date.now()}`;
  const order = await mp('/v1/orders', {
    method: 'POST',
    token,
    idempotent: true,
    body: {
      type: 'online',
      processing_mode: 'automatic',
      capture_mode: 'manual',
      external_reference: externalReference,
      total_amount: amount,
      payer: { email },
      ...(fee > 0 ? { marketplace_fee: fee.toFixed(2) } : {}),
      transactions: { payments: [{ amount, payment_method: { id: card.method, type: card.type, token: cardToken.id, installments: 1 } }] },
    },
  });
  writeState({ orderId: order.id, externalReference, mode });
  console.log('Reserva creada:', orderSummary(order));
} else if (command === 'show' || command === 'capture' || command === 'cancel') {
  const state = readState();
  if (!state.orderId) {
    console.error('Primero creá una reserva (reserve).');
    process.exit(1);
  }
  const { token } = creds(state);
  let order;
  if (command === 'show') order = await mp(`/v1/orders/${state.orderId}`, { token });
  else order = await mp(`/v1/orders/${state.orderId}/${command}`, { method: 'POST', token, idempotent: true });
  console.log(`${command}:`, orderSummary(order));
  if (command !== 'cancel') {
    try {
      console.log('pagos asociados (detalle de comisión):', JSON.stringify(await classicPayments(token, state.externalReference), null, 1));
    } catch {
      /* el detalle clásico es opcional */
    }
  }
} else if (command === 'pay-reserve') {
  const state = readState();
  const { token, publicKey } = creds({ ...state, mode: 'oauth' });
  const amount = Number(args[0] ?? 1000);
  const fee = Number(args[1] ?? 170);
  const card = CARDS[args[2] ?? 'mastercard'];
  if (!card) {
    console.error(`Tarjeta desconocida. Opciones: ${Object.keys(CARDS).join(', ')}`);
    process.exit(1);
  }
  const email = args[3] || process.env.MP_POC_BUYER_EMAIL || 'test_user_3775271222@testuser.com';
  const cardToken = await mp(`/v1/card_tokens?public_key=${publicKey}`, {
    method: 'POST',
    body: {
      card_number: card.number,
      security_code: card.cvv,
      expiration_month: 11,
      expiration_year: 2030,
      cardholder: { name: 'APRO', identification: { type: 'DNI', number: '12345678' } },
    },
  });
  const externalReference = `poc-pay-${Date.now()}`;
  const payment = await mp('/v1/payments', {
    method: 'POST',
    token,
    idempotent: true,
    body: {
      transaction_amount: amount,
      token: cardToken.id,
      installments: 1,
      payment_method_id: card.method,
      description: 'Prueba split TecniUrbano',
      payer: { email },
      capture: false,
      ...(fee > 0 ? { application_fee: fee } : {}),
      external_reference: externalReference,
    },
  });
  writeState({ paymentId: payment.id, externalReference });
  console.log('Reserva (Payments) creada:', JSON.stringify((await classicPayments(token, externalReference))[0] ?? { id: payment.id, status: payment.status }, null, 1));
} else if (command === 'pay-show' || command === 'pay-capture' || command === 'pay-cancel') {
  const state = readState();
  if (!state.paymentId) {
    console.error('Primero creá una reserva (pay-reserve).');
    process.exit(1);
  }
  const { token } = creds({ ...state, mode: 'oauth' });
  if (command === 'pay-capture') {
    const body = { capture: true, ...(args[0] ? { transaction_amount: Number(args[0]) } : {}) };
    await mp(`/v1/payments/${state.paymentId}`, { method: 'PUT', token, idempotent: true, body });
  } else if (command === 'pay-cancel') {
    await mp(`/v1/payments/${state.paymentId}`, { method: 'PUT', token, idempotent: true, body: { status: 'cancelled' } });
  }
  console.log(`${command}:`, JSON.stringify(await classicPayments(token, state.externalReference), null, 1));
} else {
  console.log('Comandos: auth-url | exchange <code> [--test] | reserve | show | capture | cancel | pay-reserve [monto] [comision] [tarjeta] [email] | pay-show | pay-capture [monto] | pay-cancel');
}
