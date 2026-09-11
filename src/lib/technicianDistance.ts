export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Distancia en línea recta entre dos coordenadas — fórmula de Haversine, sin
 * dependencias nuevas. Ver plan-zona-trabajo-agenda.md, Fase 5. No es
 * distancia de ruta real (no contempla calles ni tráfico), pero alcanza para
 * ordenar técnicos por cercanía relativa a una orden, igual que ya se decidió
 * para el radio de "Zona de trabajo" del técnico (Fase 2).
 */
export function distanceKm(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  // Math.min(1, h) por seguridad numérica: con puntos casi idénticos, h puede
  // quedar en 1.0000000000000002 por redondeo de punto flotante y asin
  // devolvería NaN.
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, h)));
}

/**
 * Distancia entre la orden y la zona de trabajo declarada del técnico, o
 * `null` si a cualquiera de los dos le faltan coordenadas (orden vieja sin
 * geocodificar, o técnico que todavía no declaró su Zona de trabajo) — nunca
 * se inventa una distancia sin datos reales.
 */
export function distanceToOrderKm(
  order: { clientLat?: number | null; clientLng?: number | null },
  technician: { workZoneLat?: number | null; workZoneLng?: number | null }
): number | null {
  if (order.clientLat == null || order.clientLng == null) return null;
  if (technician.workZoneLat == null || technician.workZoneLng == null) return null;
  return distanceKm(
    { lat: order.clientLat, lng: order.clientLng },
    { lat: technician.workZoneLat, lng: technician.workZoneLng }
  );
}

/**
 * true si la orden cae dentro del radio de cobertura que el técnico declaró.
 * `false` (nunca "true" por defecto) si falta cualquier dato — ver el mismo
 * criterio en `distanceToOrderKm`.
 */
export function isWithinWorkZone(
  order: { clientLat?: number | null; clientLng?: number | null },
  technician: { workZoneLat?: number | null; workZoneLng?: number | null; workZoneRadiusKm?: number | null }
): boolean {
  const distance = distanceToOrderKm(order, technician);
  if (distance == null || technician.workZoneRadiusKm == null) return false;
  return distance <= technician.workZoneRadiusKm;
}
