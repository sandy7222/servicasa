import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { exchangeCode, saveAccount } from '../mpOauth.js';

const STATE_TTL_MS = 10 * 60 * 1000;
const OK_URL = '/#/technician/profile?mp=ok';
const ERROR_URL = '/#/technician/profile?mp=error';

function redirect(res: VercelResponse, to: string) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Location', to);
  return res.status(302).end();
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Callback del OAuth de Mercado Pago (/oauth-callback, ver rewrite en vercel.json). Plan-cobro-repartido, 1.4.
 * Valida el `state` (existe, sin usar, no vencido) y lo marca usado en una sola operación atómica; canjea el
 * `code`, guarda los tokens en Vault y redirige al perfil con ?mp=ok o ?mp=error. NUNCA muestra ni loguea
 * tokens ni el client secret: el navegador solo ve la redirección.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const state = String(first(req.query.state as string | string[] | undefined) ?? '').trim();
  const code = String(first(req.query.code as string | string[] | undefined) ?? '').trim();
  const mpError = first(req.query.error as string | string[] | undefined);

  if (!state || state.length > 200) return redirect(res, ERROR_URL);

  const cutoff = new Date(Date.now() - STATE_TTL_MS).toISOString();
  const { data: consumed, error: stateError } = await supabaseAdmin
    .from('mp_oauth_states')
    .update({ used_at: new Date().toISOString() })
    .eq('state', state)
    .is('used_at', null)
    .gte('created_at', cutoff)
    .select('technician_id')
    .maybeSingle();
  if (stateError || !consumed) return redirect(res, ERROR_URL);

  // El técnico rechazó la autorización en Mercado Pago (o MP devolvió un error): el state ya quedó usado.
  if (mpError || !code) return redirect(res, ERROR_URL);

  const tokens = await exchangeCode(code);
  if (!tokens) return redirect(res, ERROR_URL);

  const saved = await saveAccount((consumed as { technician_id: string }).technician_id, tokens);
  return redirect(res, saved ? OK_URL : ERROR_URL);
}
