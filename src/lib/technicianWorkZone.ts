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

export type CoverageLocality = {
  localidadId: string;
  city: string;
  province: string;
  categoria: string;
  distanceKm: number;
};

/**
 * Preview en vivo de que localidades toca un centro+radio, SIN guardar nada
 * — se usa mientras el tecnico todavia esta arrastrando el mapa/slider en
 * WorkZone.tsx, antes de tocar "Guardar zona de trabajo". Llama a la misma
 * funcion de Postgres (`localities_within_radius`) que usa el trigger de
 * `technicians.work_zone_*` para recalcular `technician_coverage_areas` al
 * guardar, asi que el preview y lo que termina persistido nunca difieren.
 * Nunca lanza por un fallo de red o de sesion — sin preview no se bloquea ni
 * el ajuste del radio ni el guardado, solo no se muestra la lista.
 */
export async function previewWorkZoneCoverage(point: GeocodedPoint, radiusKm: number): Promise<CoverageLocality[]> {
  const { data, error } = await supabase.rpc('localities_within_radius', {
    p_lat: point.lat,
    p_lng: point.lng,
    p_radius_km: radiusKm,
  });
  if (error || !data) return [];
  return (data as { localidad_id: string; nombre: string; provincia_nombre: string; categoria: string; distance_km: number }[]).map(
    (row) => ({
      localidadId: row.localidad_id,
      city: row.nombre,
      province: row.provincia_nombre,
      categoria: row.categoria,
      distanceKm: Number(row.distance_km),
    })
  );
}
