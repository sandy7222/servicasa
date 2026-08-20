import type { VercelRequest } from '@vercel/node';
import { supabaseAdmin } from './supabaseAdmin';

/**
 * Verifies the Supabase access token sent by the frontend (Authorization:
 * Bearer <token>) and returns the caller's user id + linked customer/technician
 * ids from `profiles`. Returns null if there is no valid session — callers
 * must treat that as unauthenticated, never as "trust the request body".
 */
export async function getAuthenticatedCaller(req: VercelRequest) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, technician_id, customer_id')
    .eq('id', data.user.id)
    .maybeSingle();
  if (profileError || !profile) return null;

  return {
    userId: data.user.id,
    role: profile.role as 'admin' | 'technician' | 'customer',
    customerId: profile.customer_id as string | null,
    technicianId: profile.technician_id as string | null,
  };
}
