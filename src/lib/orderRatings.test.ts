import { describe, expect, it } from 'vitest';
import {
  canCreateRating,
  canEditRating,
  compareTechniciansByRating,
  isNewTechnicianRating,
  parseInstant,
  ratingSparklineValues,
  recentRatingComments,
  summarizeRatingTrend,
  type OrderRating,
} from './orderRatings';

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

describe('isNewTechnicianRating', () => {
  it('trata ausencia, 0 y menos de 3 como Nuevo', () => {
    expect(isNewTechnicianRating(undefined)).toBe(true);
    expect(isNewTechnicianRating(null)).toBe(true);
    expect(isNewTechnicianRating(0)).toBe(true);
    expect(isNewTechnicianRating(2)).toBe(true);
  });

  it('deja de ser Nuevo a partir de 3 calificaciones', () => {
    expect(isNewTechnicianRating(3)).toBe(false);
    expect(isNewTechnicianRating(12)).toBe(false);
  });
});

describe('compareTechniciansByRating', () => {
  const ana = { name: 'Ana Pérez', rating: 4.2, totalRatingsCount: 12 };
  const bruno = { name: 'Bruno Díaz', rating: 4.9, totalRatingsCount: 8 };
  const carla = { name: 'Carla Gómez', rating: 5, totalRatingsCount: 1 };
  const diego = { name: 'Diego López', rating: 4.2, totalRatingsCount: 20 };
  const elena = { name: 'Elena Ruiz', rating: 5, totalRatingsCount: undefined };

  it('manda a los Nuevos al final aunque tengan 5.00', () => {
    expect([carla, bruno].sort(compareTechniciansByRating).map((t) => t.name)).toEqual([
      'Bruno Díaz',
      'Carla Gómez',
    ]);
  });

  it('entre calificados ordena por rating descendente', () => {
    expect([ana, bruno].sort(compareTechniciansByRating).map((t) => t.name)).toEqual([
      'Bruno Díaz',
      'Ana Pérez',
    ]);
  });

  it('empata por nombre si el rating es igual', () => {
    expect([diego, ana].sort(compareTechniciansByRating).map((t) => t.name)).toEqual([
      'Ana Pérez',
      'Diego López',
    ]);
  });

  it('trata totalRatingsCount ausente como Nuevo', () => {
    expect([elena, ana].sort(compareTechniciansByRating).map((t) => t.name)).toEqual([
      'Ana Pérez',
      'Elena Ruiz',
    ]);
  });
});

function rating(partial: Pick<OrderRating, 'stars' | 'createdAt'> & Partial<OrderRating>): OrderRating {
  return {
    id: partial.id ?? `r-${partial.createdAt}`,
    orderId: partial.orderId ?? `o-${partial.createdAt}`,
    technicianId: 'tech-1',
    customerId: 'cust-1',
    stars: partial.stars,
    comment: partial.comment ?? null,
    createdAt: partial.createdAt,
    editedAt: null,
  };
}

describe('summarizeRatingTrend', () => {
  it('es insufficient con menos de 3 calificaciones', () => {
    const trend = summarizeRatingTrend([
      rating({ stars: 5, createdAt: '2026-08-01T00:00:00.000Z' }),
      rating({ stars: 4, createdAt: '2026-08-02T00:00:00.000Z' }),
    ]);
    expect(trend.direction).toBe('insufficient');
    expect(trend.previousAverage).toBeNull();
    expect(trend.sampleSize).toBe(2);
  });

  it('es insufficient si hay 3 o más pero no hay ventana previa de 5', () => {
    const trend = summarizeRatingTrend([
      rating({ stars: 5, createdAt: '2026-08-01T00:00:00.000Z' }),
      rating({ stars: 4, createdAt: '2026-08-02T00:00:00.000Z' }),
      rating({ stars: 5, createdAt: '2026-08-03T00:00:00.000Z' }),
    ]);
    expect(trend.direction).toBe('insufficient');
    expect(trend.recentAverage).toBeCloseTo(14 / 3);
    expect(trend.previousAverage).toBeNull();
  });

  it.each([6, 7, 8, 9])(
    'es insufficient con %i calificaciones (ventana previa incompleta)',
    (count) => {
      const ratings = Array.from({ length: count }, (_, i) =>
        rating({
          stars: 5,
          createdAt: `2026-08-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
        })
      );
      const trend = summarizeRatingTrend(ratings);
      expect(trend.direction).toBe('insufficient');
      expect(trend.previousAverage).toBeNull();
    }
  );

  it('marca up cuando las últimas 5 superan a las 5 anteriores', () => {
    const previous = [2, 2, 3, 2, 3].map((stars, i) =>
      rating({ stars, createdAt: `2026-08-0${i + 1}T00:00:00.000Z` })
    );
    const recent = [5, 4, 5, 5, 4].map((stars, i) =>
      rating({ stars, createdAt: `2026-08-1${i}T00:00:00.000Z` })
    );
    const trend = summarizeRatingTrend([...recent, ...previous]);
    expect(trend.direction).toBe('up');
    expect(trend.recentAverage).toBeCloseTo(4.6);
    expect(trend.previousAverage).toBeCloseTo(2.4);
  });

  it('marca down cuando las últimas 5 bajan', () => {
    const previous = [5, 5, 4, 5, 5].map((stars, i) =>
      rating({ stars, createdAt: `2026-08-0${i + 1}T00:00:00.000Z` })
    );
    const recent = [2, 3, 2, 2, 3].map((stars, i) =>
      rating({ stars, createdAt: `2026-08-1${i}T00:00:00.000Z` })
    );
    expect(summarizeRatingTrend([...previous, ...recent]).direction).toBe('down');
  });

  it('marca stable si el delta es menor al umbral', () => {
    const previous = [4, 4, 5, 4, 4].map((stars, i) =>
      rating({ stars, createdAt: `2026-08-0${i + 1}T00:00:00.000Z` })
    );
    const recent = [4, 4, 4, 5, 4].map((stars, i) =>
      rating({ stars, createdAt: `2026-08-1${i}T00:00:00.000Z` })
    );
    expect(summarizeRatingTrend([...previous, ...recent]).direction).toBe('stable');
  });
});

describe('ratingSparklineValues', () => {
  it('devuelve estrellas en orden cronológico y recorta a 25', () => {
    const ratings = Array.from({ length: 30 }, (_, i) =>
      rating({
        stars: (i % 5) + 1,
        createdAt: `2026-07-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`,
      })
    );
    const values = ratingSparklineValues(ratings);
    expect(values).toHaveLength(25);
    expect(values[0]).toBe((5 % 5) + 1);
    expect(values[24]).toBe((29 % 5) + 1);
  });
});

describe('recentRatingComments', () => {
  it('devuelve solo comentarios con texto, más recientes primero, con tope', () => {
    const ratings = [
      rating({ stars: 5, createdAt: '2026-08-01T00:00:00.000Z', comment: 'Primero' }),
      rating({ stars: 4, createdAt: '2026-08-02T00:00:00.000Z', comment: '   ' }),
      rating({ stars: 3, createdAt: '2026-08-03T00:00:00.000Z', comment: null }),
      rating({ stars: 5, createdAt: '2026-08-04T00:00:00.000Z', comment: 'Último' }),
    ];
    expect(recentRatingComments(ratings, 8).map((r) => r.comment)).toEqual(['Último', 'Primero']);
  });
});
