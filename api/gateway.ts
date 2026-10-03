import type { VercelRequest, VercelResponse } from '@vercel/node';
import leadsBusiness from './_lib/handlers/leads-business.js';
import legalAcceptTerms from './_lib/handlers/legal-accept-terms.js';
import guestStatus from './_lib/handlers/guest-status.js';
import pendingDraft from './_lib/handlers/pending-draft.js';
import retryDraft from './_lib/handlers/retry-draft.js';
import geocodeWorkZone from './_lib/handlers/geocode-work-zone.js';
import aiChat from './_lib/handlers/ai-chat.js';
import adminEvent from './_lib/handlers/admin-event.js';

type Handler = (req: VercelRequest, res: VercelResponse) => unknown;

/**
 * Un solo Serverless Function para los endpoints chicos.
 *
 * El plan Hobby de Vercel permite como máximo 12 funciones por deployment, y
 * este proyecto (Vite, no Next.js) cuenta cada archivo bajo /api como una
 * función aparte — ya rompió el deploy dos veces (3/9 y 23/9). Cada handler
 * vive en api/_lib/handlers/ (lo que empieza con "_" no cuenta) y las URLs de
 * siempre siguen funcionando vía los rewrites de vercel.json, así que el
 * frontend no cambió. Para sumar un endpoint chico: crear el handler en
 * _lib/handlers/, registrarlo acá y agregar su rewrite.
 *
 * Los endpoints con tests propios, con body grande o con cron
 * (guest-checkout, request-service, payments/create, webhook,
 * upload-diagnosis-photo, cron/*) se quedan como funciones separadas.
 */
const ROUTES = new Map<string, Handler>([
  ['leads-business', leadsBusiness],
  ['legal-accept-terms', legalAcceptTerms],
  ['guest-status', guestStatus],
  ['pending-draft', pendingDraft],
  ['retry-draft', retryDraft],
  ['geocode-work-zone', geocodeWorkZone],
  ['ai-chat', aiChat],
  ['admin-event', adminEvent],
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.action;
  const action = Array.isArray(raw) ? raw[0] : raw;
  const route = action ? ROUTES.get(action) : undefined;
  if (!route) return res.status(404).json({ error: 'Ruta no encontrada.' });
  return route(req, res);
}
