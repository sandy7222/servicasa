// Evidencia técnica de aceptación de Términos y Condiciones (charla con
// Sandy, 12/9): hash SHA-256 del texto exacto mostrado + versión, más una
// llamada al endpoint server-side (api/legal/accept-terms.ts) que agrega IP
// y user-agent y persiste todo en legal_acceptances (ver migración
// correspondiente). El hash se calcula acá mismo, en el navegador, con la
// Web Crypto API nativa (sin dependencias) sobre el mismo string que exporta
// src/lib/legalTerms.ts — así, si el texto legal cambia en el futuro, el
// hash cambia solo, sin depender de que alguien se acuerde de bumpear a mano
// la constante de versión.
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export type TermsRole = 'cliente' | 'tecnico';
export type TermsDocumentSlug = 'terminos_cliente' | 'terminos_tecnico';

/**
 * Se llama desde registerCustomer/registerTechnician (AppContext.tsx) justo
 * después de crear la cuenta y ANTES de darla por exitosa: si esto falla, el
 * registro entero falla (aceptar los términos es imprescindible para tener
 * cuenta, no un checkbox decorativo). Es un endpoint público (sin sesión) a
 * propósito — en el momento en que se llama, la cuenta recién se creó y
 * puede no haber sesión todavía si el proyecto exige confirmar el email
 * antes de loguear.
 */
export async function recordTermsAcceptance(params: {
  userId: string;
  role: TermsRole;
  documentSlug: TermsDocumentSlug;
  documentVersion: string;
  documentHash: string;
}): Promise<void> {
  const res = await fetch('/api/legal/accept-terms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: params.userId,
      role: params.role,
      documentSlug: params.documentSlug,
      documentVersion: params.documentVersion,
      documentHash: params.documentHash,
    }),
  });
  if (!res.ok) {
    throw new Error('No se pudo registrar la aceptación de los Términos y Condiciones.');
  }
}
