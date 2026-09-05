import { describe, expect, it } from 'vitest';
import { canCreateRating, canEditRating, parseInstant } from './orderRatings';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

describe('parseInstant', () => {
  it('acepta ISO', () => {
    expect(parseInstant('2026-09-01T12:00:00.000Z')).toBe(Date.parse('2026-09-01T12:00:00.000Z'));
  });

  it('acepta el formato mock con espacio', () => {
    expect(parseInstant('2026-08-15 17:45')).toBe(Date.parse('2026-08-15T17:45'));
  });

  it('devuelve null si falta o no es fecha', () => {
    expect(parseInstant(undefined)).toBeNull();
    expect(parseInstant(null)).toBeNull();
    expect(parseInstant('')).toBeNull();
    expect(parseInstant('no-es-fecha')).toBeNull();
  });
});

describe('canCreateRating — 30 días desde completed_at', () => {
  const now = Date.parse('2026-09-05T12:00:00.000Z');

  it('permite calificar el mismo día del cierre', () => {
    expect(canCreateRating('2026-09-05T11:00:00.000Z', now)).toBe(true);
  });

  it('permite calificar al día 30 inclusive', () => {
    expect(canCreateRating(new Date(now - 30 * DAY_MS).toISOString(), now)).toBe(true);
  });

  it('bloquea después de 30 días', () => {
    expect(canCreateRating(new Date(now - 30 * DAY_MS - 1).toISOString(), now)).toBe(false);
  });

  it('bloquea si no hay completed_at', () => {
    expect(canCreateRating(undefined, now)).toBe(false);
  });
});

describe('canEditRating — 48 horas desde created_at', () => {
  const now = Date.parse('2026-09-05T12:00:00.000Z');

  it('permite editar dentro de las 48 hs', () => {
    expect(canEditRating(new Date(now - 47 * HOUR_MS).toISOString(), now)).toBe(true);
  });

  it('permite editar exactamente a las 48 hs', () => {
    expect(canEditRating(new Date(now - 48 * HOUR_MS).toISOString(), now)).toBe(true);
  });

  it('bloquea después de 48 hs', () => {
    expect(canEditRating(new Date(now - 48 * HOUR_MS - 1).toISOString(), now)).toBe(false);
  });
});
