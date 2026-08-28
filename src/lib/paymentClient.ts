/**
 * Browser-side Mercado Pago boundary.
 *
 * This module never receives an access token and never talks to Mercado Pago
 * directly. It only asks the server to create a payment preference and then
 * redirects the customer to the URL returned by that trusted server.
 */
import { supabase } from './supabase';
import type { CustomerServiceRequestInput, GuestServiceRequestInput } from '../types';

export type PaymentType = 'visit_deposit' | 'balance_payment' | 'full_advance' | 'extra_payment';

export type PaymentLinkResponse = {
  paymentUrl: string;
  preferenceId: string;
};

export type PendingCustomerDraft = {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  title: string;
  amount: number;
  paymentType: PaymentType;
  createdAt: string;
};

async function getAccessTokenOrThrow(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.');
  return accessToken;
}

export async function requestPaymentLink(
  orderId: string,
  paymentType: PaymentType,
  quoteId?: string
): Promise<PaymentLinkResponse> {
  const accessToken = await getAccessTokenOrThrow();

  const response = await fetch('/api/payments/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ orderId, paymentType, quoteId }),
  });

  const body = (await response.json().catch(() => ({}))) as Partial<PaymentLinkResponse> & {
    error?: string;
  };

  if (!response.ok || !body.paymentUrl || !body.preferenceId) {
    throw new Error(body.error || 'No se pudo iniciar el pago seguro.');
  }

  return { paymentUrl: body.paymentUrl, preferenceId: body.preferenceId };
}

export async function redirectToPayment(
  orderId: string,
  paymentType: PaymentType,
  quoteId?: string
) {
  const { paymentUrl } = await requestPaymentLink(orderId, paymentType, quoteId);
  window.location.assign(paymentUrl);
}

/** No session involved — this hits the public api/orders/guest-checkout.ts
 * endpoint, which creates the account-less customer + order server-side. */
export async function redirectToGuestPayment(input: GuestServiceRequestInput) {
  const response = await fetch('/api/orders/guest-checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => ({}))) as { paymentUrl?: string; error?: string };
  if (!response.ok || !body.paymentUrl) {
    throw new Error(body.error || 'No se pudo iniciar el pago seguro.');
  }

  window.location.assign(body.paymentUrl);
}

/**
 * Authenticated equivalent of redirectToGuestPayment, for a logged-in
 * customer's "Solicitar diagnóstico"/"Sé qué trabajo necesito". Hits
 * api/orders/request-service.ts, which only creates a draft — the real
 * order is created by the webhook once Mercado Pago confirms the payment.
 * Never adds anything to the app's order list directly: there's nothing
 * real to add until that confirmation arrives.
 */
export async function redirectToCustomerServiceRequest(input: CustomerServiceRequestInput) {
  const accessToken = await getAccessTokenOrThrow();

  const response = await fetch('/api/orders/request-service', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(input),
  });

  const body = (await response.json().catch(() => ({}))) as { paymentUrl?: string; error?: string };
  if (!response.ok || !body.paymentUrl) {
    throw new Error(body.error || 'No se pudo iniciar el pago seguro.');
  }

  window.location.assign(body.paymentUrl);
}

/** "¿Tenés algo pendiente de pagar?" — sin `id`, la última solicitud propia
 * sin pagar (para no obligar a rehacer el formulario). Con `id`, resuelve un
 * aviso de tipo 'payment' cuyo entity_id es un borrador, no una orden. */
export async function fetchPendingDraft(id?: string): Promise<PendingCustomerDraft | null> {
  const accessToken = await getAccessTokenOrThrow();
  const query = id ? `?id=${encodeURIComponent(id)}` : '';
  const response = await fetch(`/api/orders/pending-draft${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json().catch(() => ({}))) as { draft?: PendingCustomerDraft | null; error?: string };
  if (!response.ok) throw new Error(body.error || 'No se pudo consultar el borrador.');
  return body.draft ?? null;
}

/** Retoma el pago de un borrador ya creado, sin pedirle al cliente que
 * reescriba el formulario. */
export async function retryDraftPayment(draftId: string) {
  const accessToken = await getAccessTokenOrThrow();
  const response = await fetch('/api/payments/retry-draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ draftId }),
  });

  const body = (await response.json().catch(() => ({}))) as { paymentUrl?: string; error?: string };
  if (!response.ok || !body.paymentUrl) {
    throw new Error(body.error || 'No se pudo retomar el pago.');
  }

  window.location.assign(body.paymentUrl);
}
