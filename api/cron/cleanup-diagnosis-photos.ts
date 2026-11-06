import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { purgeOldStates, renewExpiringAccounts } from '../_lib/mpOauth.js';
import { processSplitReservations } from '../_lib/splitPayment.js';

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

  let result: CleanupResult;
  try {
    result = await cleanupDiagnosisPhotos();
  } catch (err) {
    console.error('[cron/cleanup-diagnosis-photos] error inesperado en la limpieza', err instanceof Error ? err.name : 'desconocido');
    result = { status: 500, body: { error: 'Falló la limpieza de fotos.' } };
  }

  // Paso extra, aislado: renovar los tokens de Mercado Pago de los técnicos que vencen pronto
  // (plan-cobro-repartido.md, Fase 1.5). Va en este cron para no sumar una función (límite de Vercel Hobby).
  // Un fallo acá NO afecta la limpieza de arriba ni su respuesta.
  let mpRenewal: unknown = null;
  try {
    mpRenewal = await renewExpiringAccounts();
    await purgeOldStates();
  } catch (err) {
    console.error('[cron/cleanup-diagnosis-photos] falló la renovación de Mercado Pago', err instanceof Error ? err.name : 'desconocido');
  }

  // Cobro repartido, Fase 3: resolver las reservas de pago del trabajo (cobrar, cancelar o avisar a Sandy).
  // Aislado igual que el paso anterior.
  let splitReservations: unknown = null;
  try {
    splitReservations = await processSplitReservations();
  } catch (err) {
    console.error('[cron/cleanup-diagnosis-photos] falló el control de reservas', err instanceof Error ? err.name : 'desconocido');
  }

  return res.status(result.status).json({ ...result.body, mpRenewal, splitReservations });
}

type CleanupResult = { status: number; body: Record<string, unknown> };

async function cleanupDiagnosisPhotos(): Promise<CleanupResult> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: eligibleOrders, error: ordersError } = await supabaseAdmin
    .from('service_orders')
    .select('id')
    .eq('status', 'completed')
    .lte('completed_at', cutoff);
  if (ordersError) {
    console.error('[cron/cleanup-diagnosis-photos] Error buscando órdenes completadas', ordersError);
    return { status: 500, body: { error: 'No se pudo buscar órdenes completadas.' } };
  }
  const orderIds = (eligibleOrders ?? []).map((o) => o.id as string);
  if (orderIds.length === 0) {
    return { status: 200, body: { deleted: 0 } };
  }

  const { data: photos, error: photosError } = await supabaseAdmin
    .from('order_diagnosis_photos')
    .select('id, order_id, storage_path')
    .in('order_id', orderIds);
  if (photosError) {
    console.error('[cron/cleanup-diagnosis-photos] Error buscando fotos', photosError);
    return { status: 500, body: { error: 'No se pudo buscar fotos.' } };
  }
  if (!photos || photos.length === 0) {
    return { status: 200, body: { deleted: 0 } };
  }

  const { data: openCases, error: casesError } = await supabaseAdmin
    .from('support_cases')
    .select('order_id')
    .in('order_id', orderIds)
    .neq('status', 'closed');
  if (casesError) {
    console.error('[cron/cleanup-diagnosis-photos] Error buscando reclamos abiertos', casesError);
    return { status: 500, body: { error: 'No se pudo verificar reclamos abiertos.' } };
  }
  const ordersWithOpenCase = new Set((openCases ?? []).map((c) => c.order_id as string));

  const deletable = photos.filter((photo) => !ordersWithOpenCase.has(photo.order_id as string));
  if (deletable.length === 0) {
    return { status: 200, body: { deleted: 0 } };
  }

  const { error: removeError } = await supabaseAdmin.storage
    .from('diagnosis-photos')
    .remove(deletable.map((photo) => photo.storage_path as string));
  if (removeError) {
    console.error('[cron/cleanup-diagnosis-photos] Error borrando archivos', removeError);
    return { status: 500, body: { error: 'No se pudo borrar los archivos.' } };
  }

  const { error: deleteRowsError } = await supabaseAdmin
    .from('order_diagnosis_photos')
    .delete()
    .in('id', deletable.map((photo) => photo.id as string));
  if (deleteRowsError) {
    console.error('[cron/cleanup-diagnosis-photos] Error borrando filas', deleteRowsError);
    return { status: 500, body: { error: 'No se pudo borrar los registros.' } };
  }

  return { status: 200, body: { deleted: deletable.length } };
}
