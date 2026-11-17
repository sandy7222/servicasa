import type { Technician } from '../types';

/**
 * Herramientas opcionales del técnico que dependen de su especialidad.
 * "Proyecto de instalación" (plan-proyecto-instalacion.md) es solo para Electricidad.
 */
export function isElectrician(technician: Pick<Technician, 'specialty' | 'specialties'> | undefined | null): boolean {
  if (!technician) return false;
  const names = [technician.specialty ?? '', ...(technician.specialties ?? []).map((s) => s.name)];
  return names.some((n) => /electric/i.test(n.normalize('NFD').replace(/[̀-ͯ]/g, '')));
}
