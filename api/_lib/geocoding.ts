import { supabaseAdmin } from './supabaseAdmin.js';

export type GeocodedPoint = { lat: number; lng: number };

const NOMINATIM_USER_AGENT = 'TecniUrbano/1.0';

/**
 * Quita acentos/diacríticos y normaliza mayúsculas/espacios para que el
 * texto que escribe el usuario (con o sin tilde, con espacios de más, etc.)
 * pueda compararse contra `nombre_normalizado` / `provincia_normalizada` en
 * `ar_localidades`, que se generaron con la misma normalización al armar el
 * seed (ver supabase/migrations/*_seed_ar_localidades.sql).
 */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Alias de provincia → valor canónico de `provincia_normalizada` en la
 * tabla. La normalización por acentos ya resuelve la enorme mayoría de los
 * casos (p.ej. "Río Negro" → "rio negro" coincide directo), así que acá solo
 * hacen falta los nombres cortos/alternativos que la gente realmente
 * escribe y que no son una simple cuestión de tildes.
 */
const PROVINCE_ALIASES: Record<string, string> = {
  caba: 'ciudad autonoma de buenos aires',
  'capital federal': 'ciudad autonoma de buenos aires',
  'ciudad de buenos aires': 'ciudad autonoma de buenos aires',
  'ciudad autonoma de buenos aires': 'ciudad autonoma de buenos aires',
  'tierra del fuego': 'tierra del fuego, antartida e islas del atlantico sur',
};

function resolveProvince(normalizedProvince: string): string {
  return PROVINCE_ALIASES[normalizedProvince] ?? normalizedProvince;
}

/**
 * Busca "Ciudad, Provincia" en la tabla local `ar_localidades` (dataset de
 * INDEC/georef API, ~3866 localidades) antes de salir a Nominatim. Nunca
 * lanza: cualquier error de red/consulta a Supabase se trata igual que un
 * "no encontrado" y deja que `geocodeLocality` siga con el fallback.
 *
 * Estrategia en dos pasos:
 *  1. Match exacto por `provincia_normalizada` + `nombre_normalizado` —
 *     cubre el caso común de que el usuario escriba el nombre oficial tal
 *     cual (con o sin tildes).
 *  2. Si no hay match exacto, un ILIKE por `nombre_normalizado` dentro de
 *     la misma provincia — cubre variantes como escribir "Bariloche" en vez
 *     de "San Carlos de Bariloche", o completar solo parte de un nombre
 *     compuesto ("Oliveros" en vez de "Villa La Rivera (Oliveros)").
 */
async function lookupLocalLocality(
  normalizedCity: string,
  normalizedProvince: string
): Promise<GeocodedPoint | null> {
  const provincia = resolveProvince(normalizedProvince);

  try {
    const exact = await supabaseAdmin
      .from('ar_localidades')
      .select('lat, lng')
      .eq('provincia_normalizada', provincia)
      .eq('nombre_normalizado', normalizedCity)
      .limit(1);

    if (exact.error) {
      console.warn('[geocoding] Error consultando ar_localidades (match exacto)', exact.error);
    } else if (exact.data && exact.data.length > 0) {
      const row = exact.data[0] as { lat: number | string; lng: number | string };
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    const partial = await supabaseAdmin
      .from('ar_localidades')
      .select('lat, lng')
      .eq('provincia_normalizada', provincia)
      .ilike('nombre_normalizado', `%${normalizedCity}%`)
      .order('nombre_normalizado', { ascending: true })
      .limit(1);

    if (partial.error) {
      console.warn('[geocoding] Error consultando ar_localidades (match parcial)', partial.error);
      return null;
    }
    if (partial.data && partial.data.length > 0) {
      const row = partial.data[0] as { lat: number | string; lng: number | string };
      const lat = Number(row.lat);
      const lng = Number(row.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return null;
  } catch (err) {
    console.warn('[geocoding] Error buscando localidad en tabla local', err);
    return null;
  }
}

/**
 * Geocodifica "Ciudad, Provincia, Argentina". Primero busca en la tabla
 * local `ar_localidades` (dataset de INDEC/georef API, ver
 * lookupLocalLocality arriba) y solo si no hay match ahí cae a Nominatim
 * (el geocoder público de OpenStreetMap). Reemplaza al primer intento con
 * Mapbox (código ya borrado, ver plan-zona-trabajo-agenda.md Fase 1/7):
 * Mapbox pedía cargar una tarjeta para crear la cuenta aunque el uso
 * quedara dentro del nivel gratuito, y se prefirió no dejarla cargada solo
 * para esto. Nominatim no pide cuenta, API key ni tarjeta.
 *
 * Su política de uso (operations.osmfoundation.org/policies/nominatim)
 * permite búsquedas puntuales disparadas por un usuario — exactamente este
 * caso: una vez por orden creada, una vez por técnico que declara su zona —
 * pero prohíbe geocodificación masiva/automatizada y pide como máximo
 * 1 request por segundo y un User-Agent que identifique la app. Nunca hay
 * que llamar a esta función en un loop ni en un proceso batch. La tabla
 * local resuelve la enorme mayoría de los casos sin siquiera tocar
 * Nominatim, así que además de más rápido esto reduce todavía más el
 * volumen de requests salientes. Si TecniUrbano crece mucho en volumen de
 * pedidos, Nominatim (el fallback que queda) es lo primero que habría que
 * migrar a un proveedor pago.
 *
 * Igual que el intento anterior con Mapbox: nunca lanza. Si ni la tabla
 * local ni Nominatim matchean la localidad, devuelve null y quien llama
 * guarda la orden/zona igual sin coordenadas — nunca bloquea un pedido ni
 * un guardado de perfil por un problema del geocoder.
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

  const localMatch = await lookupLocalLocality(normalize(cityTrimmed), normalize(provinceTrimmed));
  if (localMatch) return localMatch;

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
