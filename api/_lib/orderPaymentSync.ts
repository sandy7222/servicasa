import { supabaseAdmin } from './supabaseAdmin.js';
import { notifyAdminsVisitPaid } from './visitPaidAlert.js';

/**
 * Efectos sobre la orden de un pago confirmado. Movido tal cual desde api/payments/webhook.ts (6/11/2026)
 * para que también lo use el cobro repartido (api/_lib/splitPayment.ts) sin duplicar la lógica.
 */

/**
 * A payment just confirmed for a customer with no linked account (guest
 * checkout, or any admin-created "cliente sin cuenta" that happens to pay) —
 * auto-generate the same account_invites row the admin's "Generar enlace de
 * cuenta" button creates, so the customer-status page has something to show.
 * No-op if an unused invite already exists (avoids duplicate rows on webhook
 * retries) or the customer already has a linked profile.
 */
export async function ensureAccountInviteForGuestCustomer(customerId: string) {
  const { data: customer, error: customerError } = await supabaseAdmin
    .from('customers')
    .select('id, name, email, profile_id')
    .eq('id', customerId)
    .maybeSingle();
  if (customerError || !customer || customer.profile_id || !customer.email) return;

  const { data: existingInvite } = await supabaseAdmin
    .from('account_invites')
    .select('id')
    .eq('kind', 'customer')
    .eq('target_id', customerId)
    .is('used_at', null)
    .maybeSingle();
  if (existingInvite) return;

  const { error: insertError } = await supabaseAdmin.from('account_invites').insert({
    kind: 'customer',
    target_id: customerId,
    email: customer.email,
    full_name: customer.name,
  });
  if (insertError) {
    console.error('[payments/webhook] Error generando invitacion de cuenta', insertError);
  }
}

/**
 * Once a payment is confirmed approved, reflect it on the order itself —
 * not just payment_transactions — so the rest of the app (canExecutePaidWork,
 * assignTechnician gating, etc.) sees a consistent payment_status.
 */
export async function syncOrderAfterApprovedPayment(
  paymentType: string,
  orderId: string,
  quoteId: string | null,
  amount: number
) {
  const { data: order, error: orderError } = await supabaseAdmin
    .from('service_orders')
    .select('id, title, service_type, client_city, client_neighborhood, scheduled_date, appointment_block, priority, assigned_technician_name, total_paid_amount, customer_id')
    .eq('id', orderId)
    .maybeSingle();
  if (orderError || !order) {
    console.error('[payments/webhook] No se encontró la orden para sincronizar', orderId, orderError);
    return;
  }

  const patch: Record<string, unknown> = {
    total_paid_amount: Number(order.total_paid_amount ?? 0) + amount,
  };

  if (paymentType === 'visit_deposit') {
    patch.payment_status = 'deposit_paid';
  } else if (paymentType === 'full_advance') {
    patch.payment_status = 'paid_in_full';
  } else if (paymentType === 'balance_payment') {
    patch.payment_status = 'paid_in_full';
    patch.quote_status = 'accepted';
  }
  // extra_payment: only accumulates total_paid_amount, no status change —
  // no flow triggers this payment type yet.

  const { error: updateError } = await supabaseAdmin.from('service_orders').update(patch).eq('id', orderId);
  if (updateError) {
    console.error('[payments/webhook] Error sincronizando service_orders', updateError);
  }

  // Orden que ya existía (p. ej. armada por el admin) y recién recibe la
  // seña de la visita: también es una "visita pagada". El aviso dice si ya
  // tiene técnico o si falta asignarlo.
  if (paymentType === 'visit_deposit' && !updateError) {
    await notifyAdminsVisitPaid({
      orderId,
      title: String(order.title ?? ''),
      serviceType: String(order.service_type ?? ''),
      city: order.client_city as string | null,
      neighborhood: order.client_neighborhood as string | null,
      scheduledDate: order.scheduled_date as string | null,
      appointmentBlock: order.appointment_block as string | null,
      priority: order.priority as string | null,
      assignedTechnicianName: (order.assigned_technician_name as string | null) ?? null,
    });
  }

  // balance_payment finalizes the quote the customer was paying for — this is
  // what QuoteViewer.tsx's comment refers to: "Do not mark accepted until its
  // webhook confirms payment."
  if (paymentType === 'balance_payment' && quoteId) {
    const { error: quoteError } = await supabaseAdmin
      .from('order_quotes')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', quoteId);
    if (quoteError) {
      console.error('[payments/webhook] Error marcando presupuesto como aceptado', quoteError);
    }
  }

  if ((paymentType === 'visit_deposit' || paymentType === 'full_advance') && order.customer_id) {
    await ensureAccountInviteForGuestCustomer(order.customer_id as string);
  }
}
