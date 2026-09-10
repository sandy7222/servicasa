import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from '../_lib/auth.js';
import { geocodeLocality } from '../_lib/geocoding.js';

type Body = { city?: string; province?: string };

/**
 * Geocodifica la localidad+provincia que el técnico escribe en "Zona de
 * trabajo" (src/components/technician/WorkZone.tsx) para centrar el mapa.
 * Server-side porque Nominatim exige un User-Agent identificatorio (ver
 * api/_lib/geocoding.ts) y los navegadores no dejan que el JS del cliente
 * setee ese header — no por necesitar ocultar ninguna clave, Nominatim no
 * pide ninguna.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const caller = await getAuthenticatedCaller(req);
  if (!caller) {
    return res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
  if (caller.role !== 'technician' || !caller.technicianId) {
    return res.status(403).json({ error: 'Solo un técnico puede declarar su zona de trabajo.' });
  }

  const body = (req.body ?? {}) as Body;
  const city = String(body.city ?? '').trim().slice(0, 100);
  const province = String(body.province ?? '').trim().slice(0, 60);
  if (!city || !province) {
    return res.status(400).json({ error: 'Indicá localidad y provincia.' });
  }

  const point = await geocodeLocality(city, province);
  return res.status(200).json({ point });
}
