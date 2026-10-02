/** Email de asignación al técnico: suspendido.
 * Los técnicos no usan correo; el aviso útil es push/WhatsApp.
 * El endpoint `/api/notifications/assignment-email` se eliminó (el 2/10, para
 * liberar una función del límite de 12 de Vercel Hobby); esta función no hace nada. */
export async function notifyTechnicianAssignment(_orderId: string, _technicianId: string): Promise<void> {
  return;
}
