import { randomBytes } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from '../auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';
import { buildAuthorizationUrl } from '../mpOauth.js';

/**
 * Inicio de la vinculación de Mercado Pago (plan-cobro-repartido.md, Fase 1.3). Solo técnicos con sesión.
 * Crea un `state` aleatorio atado al técnico (vence a los 10 minutos, un solo uso) y devuelve la URL de
 * autorización de Mercado Pago a la que el navegador tiene que ir. No mueve dinero.
 *
 * Exige que el técnico haya aceptado la autorización de cobro (casilla de la cláusula X): la UI la registra
 * en legal_acceptances ANTES de llamar acá; sin esa evidencia no se inicia la vinculación.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const caller = await getAuthenticatedCaller(req);
  if (!caller) return res.status(401).json({ error: 'Tu sesión expiró. Volvé a iniciar sesión.' });
  if (caller.role !== 'technician' || !caller.technicianId) {
    return res.status(403).json({ error: 'Solo los técnicos pueden vincular Mercado Pago.' });
  }

  const clientId = process.env.MP_APP_CLIENT_ID;
  if (!clientId) {
    console.error('[mp-oauth-start] falta MP_APP_CLIENT_ID');
    return res.status(500).json({ error: 'La vinculación con Mercado Pago no está disponible por ahora.' });
  }

  const { data: accepted, error: acceptedError } = await supabaseAdmin
    .from('legal_acceptances')
    .select('id')
    .eq('user_id', caller.userId)
    .eq('document_slug', 'autorizacion_cobro_mp')
    .limit(1);
  if (acceptedError) {
    console.error('[mp-oauth-start] no se pudo verificar la autorización', acceptedError.message);
    return res.status(500).json({ error: 'No se pudo iniciar la vinculación. Probá de nuevo.' });
  }
  if (!accepted || accepted.length === 0) {
    return res.status(403).json({ error: 'Primero tenés que aceptar la autorización de cobro.' });
  }

  // Estados sin usar de intentos anteriores: se descartan para no acumularlos.
  await supabaseAdmin.from('mp_oauth_states').delete().eq('technician_id', caller.technicianId).is('used_at', null);

  const state = randomBytes(24).toString('hex');
  const { error: insertError } = await supabaseAdmin.from('mp_oauth_states').insert({ state, technician_id: caller.technicianId });
  if (insertError) {
    console.error('[mp-oauth-start] no se pudo crear el state', insertError.message);
    return res.status(500).json({ error: 'No se pudo iniciar la vinculación. Probá de nuevo.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ url: buildAuthorizationUrl(clientId, state) });
}
