import { describe, expect, it } from 'vitest';
import { resolveAvailability, type ExceptionRow, type WorkingHoursRow } from './technicianSchedule';

const weekday = (start: string, end: string, is_active = true): WorkingHoursRow => ({
  weekday: 1,
  start_time: start,
  end_time: end,
  is_active,
});

describe('resolveAvailability', () => {
  it('"A coordinar" (unscheduled) siempre disponible si no hay ausencia de todo el día', () => {
    expect(resolveAvailability([], null, 'unscheduled')).toBe(true);
    expect(resolveAvailability([weekday('09:00', '13:00', false)], null, 'unscheduled')).toBe(true);
  });

  it('una excepción de ausencia de todo el día pisa cualquier bloque, incluido unscheduled', () => {
    const dayOff: ExceptionRow = { is_available: false, start_time: null, end_time: null };
    expect(resolveAvailability([weekday('08:00', '19:00')], dayOff, 'unscheduled')).toBe(false);
    expect(resolveAvailability([weekday('08:00', '19:00')], dayOff, 'morning')).toBe(false);
    expect(resolveAvailability([weekday('08:00', '19:00')], dayOff, 'midday')).toBe(false);
    expect(resolveAvailability([weekday('08:00', '19:00')], dayOff, 'afternoon')).toBe(false);
  });

  it('disponible por solapamiento, aunque el horario semanal no cubra el bloque entero', () => {
    // Horario default de AvailabilityView.tsx (09-18): arranca una hora
    // después de que empieza "Mañana" y termina una hora antes de que
    // termina "Tarde", pero igual se solapa con los tres bloques — no hace
    // falta cubrirlos enteros para poder atender un trabajo dentro de ellos.
    expect(resolveAvailability([weekday('09:00', '18:00')], null, 'morning')).toBe(true);
    expect(resolveAvailability([weekday('09:00', '18:00')], null, 'midday')).toBe(true);
    expect(resolveAvailability([weekday('09:00', '18:00')], null, 'afternoon')).toBe(true);
  });

  it('no disponible si el horario semanal no se solapa en absoluto con el bloque', () => {
    // Termina justo cuando empieza "Mañana" (08h) — tocarse en la punta no cuenta como solapar.
    expect(resolveAvailability([weekday('06:00', '08:00')], null, 'morning')).toBe(false);
    // Arranca justo cuando termina "Tarde" (19h).
    expect(resolveAvailability([weekday('19:00', '22:00')], null, 'afternoon')).toBe(false);
    // Ni siquiera se toca con "Mediodía" (12-15h).
    expect(resolveAvailability([weekday('16:00', '20:00')], null, 'midday')).toBe(false);
  });

  it('el día está inactivo (is_active=false) aunque tenga horario cargado', () => {
    expect(resolveAvailability([weekday('08:00', '19:00', false)], null, 'morning')).toBe(false);
  });

  it('sin ninguna fila de horario para ese día, no disponible', () => {
    expect(resolveAvailability([], null, 'morning')).toBe(false);
  });

  it('una excepción puntual con horario propio pisa el patrón semanal para esa fecha', () => {
    // Ese día normalmente no trabaja (is_active=false), pero cargó una
    // excepción puntual disponible de 08 a 11 — se solapa con "Mañana"...
    const punctualAvailable: ExceptionRow = { is_available: true, start_time: '08:00', end_time: '11:00' };
    expect(resolveAvailability([weekday('09:00', '18:00', false)], punctualAvailable, 'morning')).toBe(true);
    // ...pero termina antes de que empiece "Mediodía" (12h): no se solapan.
    expect(resolveAvailability([weekday('09:00', '18:00', false)], punctualAvailable, 'midday')).toBe(false);
  });
});
