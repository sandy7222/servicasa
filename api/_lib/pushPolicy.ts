/**
 * Qué avisos llegan al celular (push) y cuáles quedan solo en la campanita de la app.
 *
 * Criterio de Sandy: al celular solo los momentos importantes de cada proceso, para que el aviso
 * no pierda valor. Todo lo demás se sigue viendo en la campanita. Los avisos al admin por alta de
 * técnico, documentos, visita pagada o nuevo contacto ya salen por Telegram, así que no se duplican.
 * Ver plan-notificaciones-push.md.
 */
export const PUSH_TYPES: ReadonlySet<string> = new Set([
  // Órdenes y visitas
  'order_assigned', // técnico: nueva orden asignada
  'order_accepted', // cliente: el técnico aceptó la visita
  'order_rejected', // admin: un técnico rechazó una orden
  'technician_en_route', // cliente: el técnico está en camino
  'technician_arrived', // cliente: el técnico llegó
  'work_completed', // cliente: el trabajo terminó
  // Presupuesto y pagos
  'quote_sent', // cliente: llegó un presupuesto
  'quote_accepted', // técnico: el cliente aceptó
  'quote_rejected', // técnico: el cliente rechazó
  'payment_approved', // cliente: su pago se aprobó
  'payment_rejected', // cliente: su pago fue rechazado
  'payment_received', // técnico: el cliente pagó
  // Cobros del técnico
  'settlement_scheduled',
  'settlement_released',
  'settlement_paid',
  // Mensajes y reclamos
  'message_new',
  'claim_opened',
  'claim_message',
  'claim_resolved',
  // Fallas que el admin tiene que ver
  'cron_failure',
]);

export function shouldPush(type: string | null | undefined): boolean {
  return Boolean(type) && PUSH_TYPES.has(String(type));
}
