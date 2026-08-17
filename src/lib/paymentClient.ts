/**
 * Browser-side Mercado Pago boundary.
 *
 * This module never receives an access token and never talks to Mercado Pago
 * directly. It only asks the server to create a payment preference and then
 * redirects the customer to the URL returned by that trusted server.
 */
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
  const response = await fetch('/api/payments/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
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
