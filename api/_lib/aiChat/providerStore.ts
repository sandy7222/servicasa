import { supabaseAdmin } from '../supabaseAdmin.js';
import { configuredProviders, type Provider } from './providers.js';

type ActiveRow = {
  id: string;
  label: string;
  base_url: string;
  model: string;
  reasoning_effort: string | null;
  api_key: string;
};

/**
 * Proveedores que usa el chat: primero los cargados en el panel (Vault), en el orden
 * que eligió el admin, y al final los de las variables de entorno como respaldo (así,
 * si una clave del panel vence, el chat sigue andando con la de Vercel). Si falla la
 * base, se usa solo el entorno: el chat nunca queda sin intentar.
 */
export async function loadProviders(): Promise<Provider[]> {
  const out: Provider[] = [];
  const { data, error } = await supabaseAdmin.rpc('ai_providers_active');
  if (error) {
    console.error('[aiChat] no se pudieron leer los proveedores del panel', error.message);
  } else {
    for (const row of (data ?? []) as ActiveRow[]) {
      out.push({
        name: row.label,
        baseUrl: row.base_url,
        key: row.api_key,
        model: row.model,
        ...(row.reasoning_effort ? { extra: { reasoning_effort: row.reasoning_effort } } : {}),
      });
    }
  }
  for (const envProvider of configuredProviders()) {
    if (!out.some((p) => p.key === envProvider.key)) out.push(envProvider);
  }
  return out;
}
