/**
 * Browser-side Mercado Pago boundary.
 *
 * This module never receives an access token and never talks to Mercado Pago
 * directly. It only asks the server to create a payment preference and then
 * redirects the customer to the URL returned by that trusted server.
 */
import { supabase } from './supabase';
import type { GuestServiceRequestInput } from '../types';

export type PaymentType = 'visit_deposit' | 'balance_payment' | 'full_advance' | 'extra_payment';

export type PaymentLinkResponse = {
  paymentUrl: string;
  preferenceId: string;
};

export async function requestPaymentLink(
  orderId: string,
  paymentType: PaymentType,
  quoteId?: string
): Promise<PaymentLinkResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) throw new Error('Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.');

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
