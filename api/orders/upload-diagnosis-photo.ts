import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

type UploadDiagnosisPhotoBody = {
  draftId?: string;
  imageBase64?: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * Público, sin autenticación: el asistente de diagnóstico corre antes de que
 * exista una cuenta o una orden, así que no hay nada contra qué autenticar
 * todavía. Sube la foto a un prefijo `pending/<draftId>/` en el bucket
 * privado diagnosis-photos usando el service role (las policies de RLS de
 * ese bucket exigen una orden real ya existente, que acá todavía no hay).
 *
 * `draftId` es un UUID generado en el cliente al abrir el asistente — no
 * identifica nada por sí solo, solo agrupa la foto hasta que se cree la
 * orden real. Si el pedido nunca se llega a hacer, la foto queda huérfana
 * en `pending/` sin limpieza automática (ver alcance acordado con Sandy).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido.' });
  }

  const body = (req.body ?? {}) as UploadDiagnosisPhotoBody;
  const draftId = String(body.draftId ?? '');
  const imageBase64 = String(body.imageBase64 ?? '');

  if (!UUID_RE.test(draftId)) {
    return res.status(400).json({ error: 'Identificador de borrador inválido.' });
  }
  if (!imageBase64) {
    return res.status(400).json({ error: 'Falta la imagen.' });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(imageBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'Imagen inválida.' });
  }
  if (buffer.length === 0 || buffer.length > MAX_BYTES) {
    return res.status(400).json({ error: 'La imagen debe pesar menos de 4MB.' });
  }

  const storagePath = `pending/${draftId}/photo.jpg`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from('diagnosis-photos')
    .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });
  if (uploadError) {
    console.error('[orders/upload-diagnosis-photo] Error subiendo foto', uploadError);
    return res.status(500).json({ error: 'No se pudo subir la foto.' });
  }

  return res.status(200).json({ storagePath });
}
