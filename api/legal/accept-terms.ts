import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

type AcceptTermsBody = {
  userId?: string;
  role?: string;
  documentSlug?: string;
  documentVersion?: string;
  documentHash?: string;
};

const VALID_ROLES = ['cliente', 'tecnico'] as const;
const VALID_SLUGS = ['terminos_cliente', 'terminos_tecnico'] as const;

/**
 * Registra la aceptación de Términos y Condiciones (cliente o técnico) como
 * evidencia técnica: quién, qué versión/hash exacto de texto vio, cuándo, y
 * desde qué IP/user-agent (ver plan-terminos-y-condiciones.md). Lo llama
 * registerCustomer/registerTechnician (AppContext.tsx) justo después de
 * crear la cuenta en Supabase Auth, ANTES de dar el registro por exitoso —
 * si esto falla, el registro entero falla.
 *
 * Es un endpoint público (sin Authorization bearer) a propósito: en el
 * momento en que se llama, el usuario recién se creó y puede no tener
 * sesión todavía (si el proyecto exige confirmar el email antes de loguear,
 * signUp() no devuelve session). Por eso no usa getAuthenticatedCaller — en
 * cambio, valida contra Supabase Auth que el userId recibido realmente
 * exista antes de insertar, en vez de confiar ciegamente en el body.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const body = (req.body ?? {}) as AcceptTermsBody;
  const userId = String(body.userId ?? '').trim();
  const role = body.role;
  const documentSlug = body.documentSlug;
  const documentVersion = String(body.documentVersion ?? '').trim().slice(0, 40);
  const documentHash = String(body.documentHash ?? '').trim().toLowerCase();

  if (!userId || !VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) {
    return res.status(400).json({ error: 'Falta el usuario o el rol es inválido.' });
  }
  if (!VALID_SLUGS.includes(documentSlug as (typeof VALID_SLUGS)[number])) {
    return res.status(400).json({ error: 'Documento inválido.' });
  }
  if (!documentVersion || !/^[0-9a-f]{64}$/i.test(documentHash)) {
    return res.status(400).json({ error: 'Falta la versión o el hash del documento aceptado.' });
  }

  const { data: userLookup, error: userLookupError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userLookupError || !userLookup?.user) {
    return res.status(404).json({ error: 'Usuario no encontrado.' });
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const firstForwarded = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const ipAddress = firstForwarded?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
  const userAgent = (req.headers['user-agent'] as string | undefined)?.slice(0, 300) || null;

  const { error: insertError } = await supabaseAdmin.from('legal_acceptances').insert({
    user_id: userId,
    role,
    document_slug: documentSlug,
    document_version: documentVersion,
    document_hash: documentHash,
    ip_address: ipAddress,
    user_agent: userAgent,
  });
  if (insertError) {
    console.error('[legal/accept-terms] Error insertando aceptación', insertError);
    return res.status(500).json({ error: 'No se pudo registrar la aceptación.' });
  }

  return res.status(200).json({ ok: true });
}
