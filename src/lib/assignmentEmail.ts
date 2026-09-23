/** Email de asignación al técnico: suspendido.
 * Los técnicos no usan correo; el aviso útil es push/WhatsApp.
 * El endpoint `/api/notifications/assignment-email` queda, pero no se llama. */
export async function notifyTechnicianAssignment(_orderId: string, _technicianId: string): Promise<void> {
  return;
}
