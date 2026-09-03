const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/** Redimensiona y recomprime una imagen en el navegador antes de subirla,
 * para no pegarle al límite de tamaño de body de las funciones serverless
 * de Vercel (~4.5MB) con una foto de cámara sin comprimir. Devuelve el
 * base64 (sin el prefijo data:) listo para mandar como JSON. */
export async function compressImageToBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) throw new Error('No se pudo comprimir la imagen.');

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  return dataUrl.split(',')[1] ?? '';
}
