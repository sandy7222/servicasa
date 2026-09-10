export type AppointmentBlock = 'unscheduled' | 'morning' | 'midday' | 'afternoon';

/**
 * Mismas 4 opciones que ofrece hoy el selector "Franja para este pedido" en
 * src/components/client/ServiceRequestForm.tsx y GuestServiceRequestForm.tsx
 * — ver plan-zona-trabajo-agenda.md, Fase 4. El cliente sigue mandando el
 * mismo texto de siempre (`appointmentWindow`); nunca confiamos en que
 * mande el bloque estructurado directamente (podría mandar cualquier
 * string) — se resuelve acá contra esta lista fija. Cualquier texto no
 * reconocido (o "A coordinar") cae en 'unscheduled', que nunca bloquea ni
 * rompe el pedido: solo significa que no hay horario fijo para comparar
 * contra la agenda del técnico.
 */
const APPOINTMENT_WINDOW_LABELS: Record<string, AppointmentBlock> = {
  'Mañana (08–12 h)': 'morning',
  'Mediodía (12–15 h)': 'midday',
  'Tarde (15–19 h)': 'afternoon',
};

export function resolveAppointmentBlock(appointmentWindow: string): AppointmentBlock {
  return APPOINTMENT_WINDOW_LABELS[appointmentWindow] ?? 'unscheduled';
}
