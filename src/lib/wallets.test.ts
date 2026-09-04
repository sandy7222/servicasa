import { describe, expect, it } from 'vitest';
import { formatDailyProcessLabel, nextDailyProcessAt, parseDailyProcessTime } from './wallets';

describe('horario diario de liquidaciones', () => {
  it('normaliza HH:MM y rechaza basura con default 20:00', () => {
    expect(parseDailyProcessTime('9:05')).toBe('09:05');
    expect(parseDailyProcessTime('"20:00"')).toBe('20:00');
    expect(parseDailyProcessTime('nope')).toBe('20:00');
  });

  it('si ya pasó la hora de hoy, apunta al día siguiente', () => {
    const now = new Date('2026-09-04T23:30:00-03:00');
    const next = nextDailyProcessAt('20:00', now);
    expect(formatDailyProcessLabel('20:00', now)).toContain('20:00');
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});
