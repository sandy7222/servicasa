import { supabase } from './supabase';
import type { AppointmentBlock, OrderStatus } from '../types';

/** Rango horario fijo de cada bloque (HH:MM, 24h) — coincide exactamente con
 * las etiquetas que ve el cliente en el selector "Franja para este pedido"
 * ("Mañana (08–12 h)", etc.) y con api/_lib/appointmentBlock.ts del lado del
 * servidor. 'unscheduled' ("A coordinar") queda afuera a propósito: no tiene
 * un rango fijo contra el cual comparar. */
export const APPOINTMENT_BLOCK_HOURS: Record<Exclude<AppointmentBlock, 'unscheduled'>, { start: string; end: string }> = {
  morning: { start: '08:00', end: '12:00' },
  midday: { start: '12:00', end: '15:00' },
  afternoon: { start: '15:00', end: '19:00' },
};

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

export type WorkingHoursRow = { weekday: number; start_time: string; end_time: string; is_active: boolean };
export type ExceptionRow = { is_available: boolean; start_time: string | null; end_time: string | null };

/**
 * Lógica pura (sin red) de resolveAvailability: dado el patrón semanal ya
 * filtrado al día de la semana correspondiente y la excepción puntual de esa
 * fecha (si existe), decide si el técnico está disponible para `block`.
 * Separada de `isTechnicianAvailable` (que hace las consultas a Supabase)
 * para poder testearla sin mockear el cliente — mismo criterio que
 * `technicianEligibility.ts`/`technicianGoals.ts` en este mismo directorio.
 *
 * 'unscheduled' ("A coordinar") no tiene horario fijo: solo se resuelve en
 * base a si el técnico se puso ausente todo el día, nunca comparando horas
 * exactas — no hay nada más específico que comparar.
 *
 * Compara por SOLAPAMIENTO, no por cobertura completa: alcanza con que el
 * horario del técnico se cruce en algún punto con el bloque, no que lo cubra
 * entero. El horario default que carga AvailabilityView.tsx es 09:00-18:00 —
 * si se exigiera cobertura completa, ese técnico nunca calificaría para
 * "Mañana" (08–12h, arranca una hora tarde) ni "Tarde" (15–19h, termina una
 * hora antes) aunque en la práctica sí puede atender esos turnos dentro de su
 * jornada. Dos franjas que solo se tocan en la punta (una termina justo
 * cuando la otra empieza) NO cuentan como solapadas.
 */
export function resolveAvailability(
  hoursForWeekday: WorkingHoursRow[],
  exception: ExceptionRow | null,
  block: AppointmentBlock
): boolean {
  // Franco/vacaciones/trámite de todo el día (como los agrega hoy
  // AvailabilityView.tsx: is_available=false, sin horario propio) — pisa
  // cualquier bloque, incluido 'unscheduled'.
  if (exception && !exception.is_available && !exception.start_time) {
    return false;
  }

  if (block === 'unscheduled') {
    return true;
  }

  const { start: blockStart, end: blockEnd } = APPOINTMENT_BLOCK_HOURS[block];
  const blockStartMin = timeToMinutes(blockStart);
  const blockEndMin = timeToMinutes(blockEnd);
  const overlaps = (startTime: string, endTime: string) =>
    timeToMinutes(startTime) < blockEndMin && timeToMinutes(endTime) > blockStartMin;

  // Una excepción puntual con horario propio (is_available=true + rango)
  // pisa el patrón semanal solo para esa fecha.
  if (exception && exception.is_available && exception.start_time && exception.end_time) {
    return overlaps(exception.start_time, exception.end_time);
  }

  return hoursForWeekday.some((row) => row.is_active && overlaps(row.start_time, row.end_time));
}

/**
 * Resuelve si un técnico está disponible en `date` (YYYY-MM-DD) para `block`,
 * cruzando su patrón semanal (technician_working_hours) con sus excepciones
 * puntuales (technician_availability_exceptions) — ver plan-zona-trabajo-agenda.md,
 * Fase 3 y 4. Única fuente de verdad, pensada para reusarse tanto en la
 * Agenda del técnico como en el aviso de conflicto del modal de asignar del
 * admin (Fase 5, todavía no implementada).
 *
 * Nunca lanza: ante cualquier error de red o de la consulta devuelve `true`
 * (no bloquea ni inventa un conflicto que no se pudo verificar) — el admin
 * siempre puede confirmar igual charlando con el técnico, el mismo criterio
 * de "aviso, nunca bloqueo" del resto de este módulo.
 */
export async function isTechnicianAvailable(
  technicianId: string,
  date: string,
  block: AppointmentBlock
): Promise<boolean> {
  try {
    const weekday = new Date(`${date}T00:00:00`).getDay();

    const [{ data: exceptionRow, error: exceptionError }, { data: hoursRows, error: hoursError }] = await Promise.all([
      supabase
        .from('technician_availability_exceptions')
        .select('is_available,start_time,end_time')
        .eq('technician_id', technicianId)
        .eq('exception_date', date)
        .maybeSingle(),
      supabase
        .from('technician_working_hours')
        .select('weekday,start_time,end_time,is_active')
        .eq('technician_id', technicianId)
        .eq('weekday', weekday),
    ]);
    if (exceptionError || hoursError) return true;

    return resolveAvailability(
      (hoursRows ?? []) as WorkingHoursRow[],
      exceptionRow as ExceptionRow | null,
      block
    );
  } catch {
    return true;
  }
}

/** Forma mínima de una orden que hace falta para el chequeo de conflicto —
 * ver `findConflictingOrder`. */
export type ConflictCandidateOrder = {
  id: string;
  status: OrderStatus;
  scheduledDate: string;
  appointmentBlock?: AppointmentBlock;
  assignedTechnicianId: string | null;
  technicianResponseStatus?: 'pending' | 'accepted' | 'rejected';
};

// Estados en los que una orden asignada sigue "viva" — una cancelada o
// completada ya liberó al técnico, no cuenta como conflicto.
const ACTIVE_CONFLICT_STATUSES: OrderStatus[] = ['assigned', 'in_progress', 'paused'];

function blocksMayOverlap(a: AppointmentBlock | undefined, b: AppointmentBlock | undefined): boolean {
  // Sin bloque estructurado en cualquiera de las dos (órdenes de antes de la
  // Fase 4, o "A coordinar") no se puede descartar el solape — mejor avisar
  // de más que de menos, mismo criterio de "aviso, nunca bloqueo" de todo
  // este módulo.
  if (!a || !b || a === 'unscheduled' || b === 'unscheduled') return true;
  return a === b;
}

/**
 * Busca, entre las órdenes ya cargadas del admin, otra orden activa
 * (asignada, en curso o pausada) que ese mismo técnico ya aceptó para la
 * misma fecha y un bloque horario que podría superponerse con `order`. Es un
 * chequeo puro (sin red) sobre datos ya en memoria — distinto de
 * `isTechnicianAvailable`, que resuelve la agenda declarada del técnico
 * (horario semanal + excepciones), no sus otras órdenes. Ver
 * plan-zona-trabajo-agenda.md, Fase 5: es solo un aviso para el admin, nunca
 * bloquea la asignación.
 */
export function findConflictingOrder(
  technicianId: string,
  order: { id: string; scheduledDate: string; appointmentBlock?: AppointmentBlock },
  allOrders: ConflictCandidateOrder[]
): ConflictCandidateOrder | null {
  return (
    allOrders.find(
      (candidate) =>
        candidate.id !== order.id &&
        candidate.assignedTechnicianId === technicianId &&
        candidate.technicianResponseStatus === 'accepted' &&
        ACTIVE_CONFLICT_STATUSES.includes(candidate.status) &&
        candidate.scheduledDate === order.scheduledDate &&
        blocksMayOverlap(candidate.appointmentBlock, order.appointmentBlock)
    ) ?? null
  );
}
