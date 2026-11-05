import { supabaseAdmin } from './supabaseAdmin.js';
import { sendTelegramMessage } from './telegram.js';

/**
 * OAuth de Mercado Pago para vincular la cuenta del técnico (plan-cobro-repartido.md, Fase 1).
 * Los tokens SOLO viven acá (servidor) y en Vault: no se devuelven al navegador ni se loguean.
 */
export const MP_REDIRECT_URI = 'https://tecniurbano.online/oauth-callback';
export const MP_TOKEN_URL = 'https://api.mercadopago.com/oauth/token';
export const MP_AUTH_URL = 'https://auth.mercadopago.com/authorization';
const MP_TIMEOUT_MS = 10000;
const RENEW_WITHIN_DAYS = 30;

export type MpTokenResponse = {
  accessToken: string;
  refreshToken: string;
  mpUserId: string;
  publicKey: string | null;
  scope: string | null;
  expiresAt: string;
};

export function buildAuthorizationUrl(clientId: string, state: string): string {
  return (
    `${MP_AUTH_URL}?client_id=${encodeURIComponent(clientId)}&response_type=code&platform_id=mp` +
    `&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(MP_REDIRECT_URI)}`
  );
}

function credentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.MP_APP_CLIENT_ID;
  const clientSecret = process.env.MP_APP_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function requestToken(body: Record<string, string>): Promise<MpTokenResponse | null> {
  const creds = credentials();
  if (!creds) {
    console.error('[mpOauth] faltan MP_APP_CLIENT_ID o MP_APP_CLIENT_SECRET');
    return null;
  }
  try {
    const response = await fetch(MP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: creds.clientId, client_secret: creds.clientSecret, ...body }),
      signal: AbortSignal.timeout(MP_TIMEOUT_MS),
    });
    if (!response.ok) {
      // Solo el estado HTTP: el cuerpo de la respuesta podría repetir datos del pedido.
      console.error('[mpOauth] Mercado Pago rechazó el pedido de token', response.status);
      return null;
    }
    const json = (await response.json()) as Record<string, unknown>;
    const accessToken = typeof json.access_token === 'string' ? json.access_token : '';
    const refreshToken = typeof json.refresh_token === 'string' ? json.refresh_token : '';
    const userId = json.user_id != null ? String(json.user_id) : '';
    const expiresIn = Number(json.expires_in);
    if (!accessToken || !refreshToken || !userId || !Number.isFinite(expiresIn) || expiresIn <= 0) {
      console.error('[mpOauth] respuesta de token incompleta');
      return null;
    }
    return {
      accessToken,
      refreshToken,
      mpUserId: userId,
      publicKey: typeof json.public_key === 'string' ? json.public_key : null,
      scope: typeof json.scope === 'string' ? json.scope : null,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  } catch (err) {
    console.error('[mpOauth] error de red o timeout con Mercado Pago', err instanceof Error ? err.name : 'desconocido');
    return null;
  }
}

/** Canjea el `code` del callback. */
export function exchangeCode(code: string): Promise<MpTokenResponse | null> {
  return requestToken({ grant_type: 'authorization_code', code, redirect_uri: MP_REDIRECT_URI, test_token: 'false' });
}

/** Renueva con el refresh token (MP devuelve también un refresh token nuevo). */
export function refreshAccessToken(refreshToken: string): Promise<MpTokenResponse | null> {
  return requestToken({ grant_type: 'refresh_token', refresh_token: refreshToken });
}

export async function saveAccount(technicianId: string, t: MpTokenResponse): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc('mp_account_save', {
    p_technician_id: technicianId,
    p_mp_user_id: t.mpUserId,
    p_public_key: t.publicKey,
    p_scope: t.scope,
    p_access_token: t.accessToken,
    p_refresh_token: t.refreshToken,
    p_expires_at: t.expiresAt,
  });
  if (error) {
    console.error('[mpOauth] no se pudo guardar la cuenta', error.message);
    return false;
  }
  return true;
}

async function notifyRenewFailed(technicianId: string, expiresAt: string | null): Promise<boolean> {
  const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('technician_id', technicianId).maybeSingle();
  const profileId = (profile as { id?: string } | null)?.id;
  if (!profileId) return false;
  // Una sola campanita por vencimiento (dedupe_key único): evita repetirla todos los días.
  const { error } = await supabaseAdmin.from('notifications').insert({
    recipient_profile_id: profileId,
    type: 'technician_validation',
    title: 'Revisá tu vinculación con Mercado Pago',
    body: 'No pudimos renovar la vinculación de tu cuenta de Mercado Pago. Entrá a tu perfil y volvé a vincularla para seguir cobrando trabajos.',
    entity_type: 'technician',
    entity_id: technicianId,
    priority: 'high',
    dedupe_key: `mp_refresh_failed:${technicianId}:${(expiresAt ?? '').slice(0, 10)}`,
  });
  if (error) {
    if (error.code !== '23505') console.error('[mpOauth] no se pudo crear la notificación', error.message);
    return false;
  }
  return true;
}

export type RenewSummary = { checked: number; renewed: number; failed: number };

/**
 * Paso del cron diario: renueva los tokens que vencen en menos de 30 días. Si una renovación falla avisa al
 * técnico (campanita) y a Sandy (Telegram, un único mensaje por corrida, sin nombres ni datos sensibles).
 * Cada cuenta es independiente: un fallo no frena a las demás.
 */
export async function renewExpiringAccounts(): Promise<RenewSummary> {
  const summary: RenewSummary = { checked: 0, renewed: 0, failed: 0 };
  const { data, error } = await supabaseAdmin.rpc('mp_accounts_expiring', { p_days: RENEW_WITHIN_DAYS });
  if (error) {
    console.error('[mpOauth] no se pudo listar cuentas por vencer', error.message);
    return summary;
  }
  const rows = (data ?? []) as Array<{ technician_id: string; expires_at: string | null }>;
  summary.checked = rows.length;
  let newAlerts = 0;

  for (const row of rows) {
    let ok = false;
    try {
      const { data: tokens, error: tokenError } = await supabaseAdmin.rpc('mp_account_token', { p_technician_id: row.technician_id });
      const current = (Array.isArray(tokens) ? tokens[0] : tokens) as { refresh_token?: string } | null | undefined;
      if (!tokenError && current?.refresh_token) {
        const renewed = await refreshAccessToken(current.refresh_token);
        if (renewed) ok = await saveAccount(row.technician_id, renewed);
      }
    } catch (err) {
      console.error('[mpOauth] error renovando una cuenta', err instanceof Error ? err.name : 'desconocido');
    }
    if (ok) {
      summary.renewed += 1;
    } else {
      summary.failed += 1;
      try {
        if (await notifyRenewFailed(row.technician_id, row.expires_at)) newAlerts += 1;
      } catch (err) {
        console.error('[mpOauth] error avisando al técnico', err instanceof Error ? err.name : 'desconocido');
      }
    }
  }

  if (newAlerts > 0) {
    await sendTelegramMessage(
      `⚠️ Mercado Pago: no se pudo renovar la vinculación de ${newAlerts} técnico${newAlerts === 1 ? '' : 's'}. Ya se les avisó en la app; revisalo en el panel de admin.`
    );
  }
  return summary;
}

/** Limpieza de estados de OAuth viejos (vencidos hace más de un día). */
export async function purgeOldStates(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabaseAdmin.from('mp_oauth_states').delete().lt('created_at', cutoff);
  if (error) console.error('[mpOauth] no se pudo limpiar estados viejos', error.message);
}
