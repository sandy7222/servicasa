import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client for /api functions only. Never import this from src/ —
 * it bypasses RLS entirely. payment_transactions only grants SELECT to
 * `authenticated`; writing to it is intentionally server-only.
 */
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el entorno del servidor.');
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
