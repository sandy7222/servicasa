import { compressImageToBase64 } from './imageCompression';

/** Sube la foto del asistente de diagnóstico al bucket privado
 * diagnosis-photos vía el endpoint server-side (necesario porque las
 * policies de RLS de ese bucket exigen una orden real, que todavía no
 * existe en este punto del flujo). Devuelve la ruta temporal
 * `pending/<draftId>/photo.jpg` para guardar en el draft del asistente. */
export async function uploadDiagnosisPhoto(draftId: string, file: File): Promise<string> {
  const imageBase64 = await compressImageToBase64(file);
  const response = await fetch('/api/orders/upload-diagnosis-photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draftId, imageBase64 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo subir la foto.');
  }
  return data.storagePath as string;
}
