import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/supabaseAdmin.js';

const RETENTION_DAYS = 30;

/**
 * Vercel Cron (ver vercel.json): borra la foto de diagnóstico de una orden
 * (archivo en el bucket privado diagnosis-photos + su fila en
 * order_diagnosis_photos) recién a los 30 días de que la orden se marcó
 * `completed` — cubre la ventana de 48hs para abrir un reclamo y toda la
 * garantía. Si la orden tiene un support_case vinculado que sigue sin
 * `closed`, se pospone el borrado aunque ya hayan pasado los 30 días.
 *
 * Fotos huérfanas (el cliente sacó la foto en el asistente pero nunca llegó
 * a pedir el servicio, `pending/<draftId>/photo.jpg` sin orden nunca creada)
 * no las toca esta rutina — quedan sueltas en el bucket, ver alcance
 * acordado con Sandy.
 *
 * Usa la Storage API (.remove()) en vez de borrar directo de
 * storage.objects por SQL, porque solo la API garantiza que se libere el
 * archivo físico en el backend de Supabase Storage.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'No autorizado.' });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: eligibleOrders, error: ordersError } = await supabaseAdmin
    .from('service_orders')
    .select('id')
    .eq('status', 'completed')
    .lte('completed_at', cutoff);
  if (ordersError) {
    console.error('[cron/cleanup-diagnosis-photos] Error buscando órdenes completadas', ordersError);
    return res.status(500).json({ error: 'No se pudo buscar órdenes completadas.' });
  }
  const orderIds = (eligibleOrders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) {
    return res.status(200).json({ deleted: 0 });
  }

  const { data: photos, error: photosError } = await supabaseAdmin
    .from('order_diagnosis_photos')
    .select('id, order_id, storage_path')
    .in('order_id', orderIds);
  if (photosError) {
    console.error('[cron/cleanup-diagnosis-photos] Error buscando fotos', photosError);
    return res.status(500).json({ error: 'No se pudo buscar fotos.' });
  }
  if (!photos || photos.length === 0) {
    return res.status(200).json({ deleted: 0 });
  }

  const { data: openCases, error: casesError } = await supabaseAdmin
    .from('support_cases')
    .select('order_id')
    .in('order_id', orderIds)
    .neq('status', 'closed');
  if (casesError) {
    console.error('[cron/cleanup-diagnosis-photos] Error buscando reclamos abiertos', casesError);
    return res.status(500).json({ error: 'No se pudo verificar reclamos abiertos.' });
  }
  const ordersWithOpenCase = new Set((openCases ?? []).map((c) => c.order_id as string));

  const deletable = photos.filter((photo) => !ordersWithOpenCase.has(photo.order_id as string));
  if (deletable.length === 0) {
    return res.status(200).json({ deleted: 0 });
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from('diagnosis-photos')
    .remove(deletable.map((photo) => photo.storage_path as string));
  if (removeError) {
    console.error('[cron/cleanup-diagnosis-photos] Error borrando archivos', removeError);
    return res.status(500).json({ error: 'No se pudo borrar los archivos.' });
  }

  const { error: deleteRowsError } = await supabaseAdmin
    .from('order_diagnosis_photos')
    .delete()
    .in('id', deletable.map((photo) => photo.id as string));
  if (deleteRowsError) {
    console.error('[cron/cleanup-diagnosis-photos] Error borrando filas', deleteRowsError);
    return res.status(500).json({ error: 'No se pudo borrar los registros.' });
  }

  return res.status(200).json({ deleted: deletable.length });
}
