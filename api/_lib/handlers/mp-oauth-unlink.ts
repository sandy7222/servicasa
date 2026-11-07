import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAuthenticatedCaller } from '../auth.js';
import { supabaseAdmin } from '../supabaseAdmin.js';

/**
 * Desvincula la cuenta de Mercado Pago del técnico logueado: borra la fila y, con ella, sus secretos de Vault
 * (trigger de la migración 20261105120000). Para revocar también del lado de Mercado Pago, el técnico lo hace
 * desde su cuenta de Mercado Pago (Seguridad > Conexiones). No mueve dinero.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const caller = await getAuthenticatedCaller(req);
  if (!caller) return res.status(401).json({ error: 'Tu sesión expiró. Volvé a iniciar sesión.' });
  if (caller.role !== 'technician' || !caller.technicianId) {
    return res.status(403).json({ error: 'Solo los técnicos pueden desvincular Mercado Pago.' });
  }

  // Con una reserva de pago abierta, su token es lo único que permite cobrarla o cancelarla: no se puede
  // desvincular hasta que se resuelva (si no, la plata del cliente queda retenida hasta que venza sola).
  const { data: open, error: openError } = await supabaseAdmin
    .from('payment_transactions')
    .select('id')
    .eq('split_technician_id', caller.technicianId)
    .eq('split', true)
    .eq('status', 'authorized')
    .limit(1);
  if (openError) {
    console.error('[mp-oauth-unlink] no se pudieron revisar las reservas', openError.message);
    return res.status(500).json({ error: 'No se pudo desvincular. Probá de nuevo.' });
  }
  if (open && open.length > 0) {
    return res.status(409).json({
      error: 'Tenés un trabajo con el pago reservado. Vas a poder desvincular Mercado Pago cuando ese pago se cobre o se cancele.',
    });
  }

  const { error } = await supabaseAdmin.rpc('mp_account_delete', { p_technician_id: caller.technicianId });
  if (error) {
    console.error('[mp-oauth-unlink] no se pudo desvincular', error.message);
    return res.status(500).json({ error: 'No se pudo desvincular. Probá de nuevo.' });
  }
  return res.status(200).json({ ok: true });
}
