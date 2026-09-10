/**
 * Browser-side boundary para "Zona de trabajo" (ver
 * src/components/technician/WorkZone.tsx). Mirror deliberado del patrón de
 * paymentClient.ts (getAccessTokenOrThrow + fetch autenticado a una ruta de
 * Vercel) en vez de importarlo de ahí — paymentClient.ts está scopeado
 * explícitamente a Mercado Pago por su propio comentario de cabecera.
 */
import { supabase } from './supabase';

export type GeocodedPoint = { lat: number; lng: number };

async function getAccessTokenOrThrow(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.');
  return accessToken;
}

/** Devuelve null si Nominatim no pudo resolver la localidad — nunca lanza
 * por eso, solo por sesión expirada o error de red/servidor. */
export async function geocodeWorkZoneLocality(city: string, province: string): Promise<GeocodedPoint | null> {
  const accessToken = await getAccessTokenOrThrow();

  const response = await fetch('/api/technicians/geocode-work-zone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ city, province }),
  });

  const body = (await response.json().catch(() => ({}))) as { point?: GeocodedPoint | null; error?: string };
  if (!response.ok) {
    throw new Error(body.error || 'No se pudo ubicar la localidad.');
  }
  return body.point ?? null;
}
