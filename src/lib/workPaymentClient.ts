/**
 * Pago del trabajo con cobro repartido (plan-cobro-repartido.md, Fase 2), lado navegador.
 *
 * Nunca recibe tokens de Mercado Pago: solo la public key del técnico (pública por diseño) para dibujar el
 * formulario de tarjeta, y le manda al servidor el token de la tarjeta que genera ese formulario. El monto y
 * la comisión los calcula el servidor.
 */
import { supabase } from './supabase';

export type WorkPaymentConfig = { split: false } | { split: true; publicKey: string; amount: number };

export type CardFormData = {
  token: string;
  payment_method_id: string;
  issuer_id?: string | number;
  installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.');
  return { Authorization: `Bearer ${token}` };
}

/** ¿Este presupuesto se paga con reserva en la cuenta del técnico? Ante cualquier duda: no (pago de siempre). */
export async function fetchWorkPaymentConfig(orderId: string, quoteId: string): Promise<WorkPaymentConfig> {
  const response = await fetch(
    `/api/payments/work?orderId=${encodeURIComponent(orderId)}&quoteId=${encodeURIComponent(quoteId)}`,
    { headers: await authHeader() }
  );
  const body = (await response.json().catch(() => ({}))) as Partial<{ split: boolean; publicKey: string; amount: number; error: string }>;
  if (!response.ok) throw new Error(body.error || 'No se pudo iniciar el pago seguro.');
  if (body.split === true && typeof body.publicKey === 'string' && body.publicKey && typeof body.amount === 'number') {
    return { split: true, publicKey: body.publicKey, amount: body.amount };
  }
  return { split: false };
}

/** Reserva la tarjeta. Resuelve si quedó reservada; si no, lanza un Error con un mensaje para el cliente. */
export async function reserveWorkPayment(orderId: string, quoteId: string, form: CardFormData): Promise<void> {
  const response = await fetch('/api/payments/work', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({
      orderId,
      quoteId,
      token: form.token,
      paymentMethodId: form.payment_method_id,
      issuerId: form.issuer_id != null ? String(form.issuer_id) : undefined,
      installments: form.installments ?? 1,
      payer: form.payer ?? {},
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { status?: string; error?: string };
  if (!response.ok || (body.status !== 'authorized' && body.status !== 'approved')) {
    throw new Error(body.error || 'No se pudo procesar el pago. Probá de nuevo.');
  }
}
