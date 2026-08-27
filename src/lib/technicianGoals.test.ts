import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TechnicianGoal } from './technicianGoals';

function makeQueryBuilder(result: Record<string, unknown>) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    neq: () => builder,
    gte: () => builder,
    lt: () => builder,
    then: (resolve: (value: typeof result) => void) => resolve(result),
  };
  return builder;
}

const fromMock = vi.fn();
vi.mock('./supabase', () => ({
  supabase: { from: (...args: unknown[]) => fromMock(...args) },
}));

const { computeGoalProgress } = await import('./technicianGoals');

function goal(overrides: Partial<TechnicianGoal>): TechnicianGoal {
  return {
    id: 'goal-1',
    technicianId: 'tech-1',
    goalType: 'monthly_jobs',
    targetAmount: null,
    targetCount: 4,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  fromMock.mockReset();
});

describe('computeGoalProgress — el avance sale siempre de datos reales, nunca de un valor guardado a mano', () => {
  it('monthly_jobs / weekly_jobs: cuenta órdenes completadas reales (nunca lee un contador guardado)', async () => {
    fromMock.mockImplementation(() => makeQueryBuilder({ count: 3, error: null }));
    const progress = await computeGoalProgress(goal({ goalType: 'monthly_jobs', targetCount: 4 }));
    expect(progress.current).toBe(3);
    expect(progress.target).toBe(4);
    expect(progress.percent).toBe(75);
    expect(progress.remaining).toBe(1);
    expect(progress.met).toBe(false);
    expect(progress.periodLabel).toBe('este mes');
  });

  it('weekly_jobs usa el período semanal, no el mensual', async () => {
    fromMock.mockImplementation(() => makeQueryBuilder({ count: 2, error: null }));
    const progress = await computeGoalProgress(goal({ goalType: 'weekly_jobs', targetCount: 5 }));
    expect(progress.periodLabel).toBe('esta semana');
  });

  it('monthly_earnings: suma net_amount real de liquidaciones, excluyendo las canceladas (el filtro va en la consulta)', async () => {
    fromMock.mockImplementation(() =>
      makeQueryBuilder({ data: [{ net_amount: 10000 }, { net_amount: 5000.5 }], error: null })
    );
    const progress = await computeGoalProgress(goal({ goalType: 'monthly_earnings', targetAmount: 20000, targetCount: null }));
    expect(progress.current).toBe(15000.5);
    expect(progress.target).toBe(20000);
    expect(progress.met).toBe(false);
  });

  it('meta cumplida: percent se topea en 100 aunque el avance real la supere', async () => {
    fromMock.mockImplementation(() => makeQueryBuilder({ count: 10, error: null }));
    const progress = await computeGoalProgress(goal({ goalType: 'monthly_jobs', targetCount: 4 }));
    expect(progress.percent).toBe(100);
    expect(progress.remaining).toBe(0);
    expect(progress.met).toBe(true);
  });

  it('sin datos (0 liquidaciones/órdenes reales): avance honesto en 0, no un valor de ejemplo', async () => {
    fromMock.mockImplementation(() => makeQueryBuilder({ count: 0, error: null, data: [] }));
    const progress = await computeGoalProgress(goal({ goalType: 'weekly_jobs', targetCount: 3 }));
    expect(progress.current).toBe(0);
    expect(progress.percent).toBe(0);
    expect(progress.met).toBe(false);
  });
});
