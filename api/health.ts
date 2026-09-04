import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from './_lib/auth.js';

/**
 * Público: solo confirma que el servicio está arriba, sin revelar nada de
 * la configuración (evita filtrar qué variables de entorno están
 * cargadas a cualquiera que pegue en la URL). El detalle de configuración
 * queda atrás de sesión de admin — útil para monitoreo interno, no para
 * un uptime-checker anónimo.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const caller = await getAuthenticatedCaller(req);
  if (!caller || caller.role !== 'admin') {
    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({
    ok: true,
    hasSupabaseUrl: Boolean(process.env.VITE_SUPABASE_URL),
    hasServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasMpAccessToken: Boolean(process.env.MP_ACCESS_TOKEN),
    hasMpWebhookSecret: Boolean(process.env.MP_WEBHOOK_SECRET),
    nodeVersion: process.version,
  });
}
