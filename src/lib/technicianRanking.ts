import type { ServiceOrder, Technician } from '../types';
import { compareTechniciansByRating } from './orderRatings';
import { distanceToOrderKm, isWithinWorkZone } from './technicianDistance';
import { findConflictingOrder } from './technicianSchedule';

export type AssignOrder = {
  id: string;
  scheduledDate: string;
  appointmentBlock?: ServiceOrder['appointmentBlock'];
  clientLat?: number | null;
  clientLng?: number | null;
};

export type RankContext = {
  order: AssignOrder;
  orders: ServiceOrder[];
  availability: Record<string, boolean | undefined>;
  eligibility: Record<string, { canReceive?: boolean } | undefined>;
};

function flags(technician: Technician, ctx: RankContext) {
  return {
    eligible: ctx.eligibility[technician.id]?.canReceive === true ? 1 : 0,
    inZone: isWithinWorkZone(ctx.order, technician) ? 1 : 0,
    noConflict: findConflictingOrder(technician.id, ctx.order, ctx.orders) == null ? 1 : 0,
    available: ctx.availability[technician.id] !== false ? 1 : 0,
    distance: distanceToOrderKm(ctx.order, technician),
  };
}

/** Ranking del modal de asignar: habilitado → en zona → sin choque →
 * disponible en el turno → mejor calificación → más cerca. */
export function compareSuggestedTechnicians(a: Technician, b: Technician, ctx: RankContext): number {
  const left = flags(a, ctx);
  const right = flags(b, ctx);
  if (right.eligible !== left.eligible) return right.eligible - left.eligible;
  if (right.inZone !== left.inZone) return right.inZone - left.inZone;
  if (right.noConflict !== left.noConflict) return right.noConflict - left.noConflict;
  if (right.available !== left.available) return right.available - left.available;
  const byRating = compareTechniciansByRating(a, b);
  if (byRating !== 0) return byRating;
  if (left.distance == null && right.distance == null) return 0;
  if (left.distance == null) return 1;
  if (right.distance == null) return -1;
  return left.distance - right.distance;
}

export function sortTechniciansSuggested(technicians: readonly Technician[], ctx: RankContext): Technician[] {
  return [...technicians].sort((a, b) => compareSuggestedTechnicians(a, b, ctx));
}

export function bestEligibleTechnician(technicians: readonly Technician[], ctx: RankContext): Technician | null {
  return sortTechniciansSuggested(technicians, ctx).find((tech) => ctx.eligibility[tech.id]?.canReceive) ?? null;
}

export function countTechniciansInZone(technicians: readonly Technician[], order: AssignOrder): number {
  return technicians.filter((tech) => isWithinWorkZone(order, tech)).length;
}
