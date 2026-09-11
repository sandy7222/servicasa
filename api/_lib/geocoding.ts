export type GeocodedPoint = { lat: number; lng: number };

const NOMINATIM_USER_AGENT = 'TecniUrbano/1.0';

/**
 * Geocodifica "Ciudad, Provincia, Argentina" contra Nominatim (el geocoder
 * público de OpenStreetMap). Reemplaza al primer intento con Mapbox (código
 * ya borrado, ver plan-zona-trabajo-agenda.md Fase 1/7): Mapbox pedía cargar
 * una tarjeta para crear la cuenta aunque el uso quedara dentro del nivel
 * gratuito, y se prefirió no dejarla cargada solo para esto. Nominatim no
 * pide cuenta, API key ni tarjeta.
 *
 * Su política de uso (operations.osmfoundation.org/policies/nominatim)
 * permite búsquedas puntuales disparadas por un usuario — exactamente este
 * caso: una vez por orden creada, una vez por técnico que declara su zona —
 * pero prohíbe geocodificación masiva/automatizada y pide como máximo
 * 1 request por segundo y un User-Agent que identifique la app. Nunca hay
 * que llamar a esta función en un loop ni en un proceso batch. Si
 * TecniUrbano crece mucho en volumen de pedidos, esto es lo primero que
 * habría que migrar a un proveedor pago.
 *
 * Igual que el intento anterior con Mapbox: nunca lanza. Si Nominatim no
 * responde o no matchea la localidad, devuelve null y quien llama guarda la
 * orden/zona igual sin coordenadas — nunca bloquea un pedido ni un guardado
 * de perfil por un problema del geocoder.
 */
export async function geocodeLocality(
  city: string | null | undefined,
  province: string | null | undefined
): Promise<GeocodedPoint | null> {
  // Nunca asumir que llegan strings: el payload de un draft es JSON guardado
  // en la base (customer_order_drafts.payload / guest_checkout_drafts.payload)
  // y el tipo de TypeScript no garantiza nada sobre filas viejas o
  // incompletas — el test de idempotencia del webhook lo confirmó con un
  // payload real que no tiene `city` (fixture de antes del ADR de
  // direcciones). Tratar undefined/null como "no hay dato" en vez de
  // reventar es la misma filosofía de "nunca bloquea" que el resto de la
  // función.
  const cityTrimmed = (city ?? '').trim();
  const provinceTrimmed = (province ?? '').trim();
  if (!cityTrimmed || !provinceTrimmed) return null;

  const query = encodeURIComponent(`${cityTrimmed}, ${provinceTrimmed}, Argentina`);
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=ar`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': NOMINATIM_USER_AGENT },
    });
    if (!response.ok) {
      console.warn('[geocoding] Nominatim respondió', response.status, await response.text().catch(() => ''));
      return null;
    }
    const results = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const first = results[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err) {
    console.warn('[geocoding] Error geocodificando', cityTrimmed, provinceTrimmed, err);
    return null;
  }
}
