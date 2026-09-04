import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, getSettingValue } from './settings';
import type { SettingRow } from './settings';

function row(overrides: Partial<SettingRow>): SettingRow {
  return {
    key: 'visit_deposit_amount',
    value: 30000,
    value_type: 'number',
    visibility: 'authenticated',
    description: null,
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: null,
    ...overrides,
  };
}

describe('getSettingValue — nunca dejar la app sin un número si Supabase no respondió', () => {
  it('devuelve el valor real cuando la fila existe', () => {
    const rows = [row({ key: 'warranty_days', value: 45, value_type: 'number' })];
    expect(getSettingValue<number>(rows, 'warranty_days')).toBe(45);
  });

  it('si la fila no vino (Supabase no respondió, o la key no existe todavía), cae al default seguro', () => {
    expect(getSettingValue<number>([], 'platform_commission_rate')).toBe(DEFAULT_SETTINGS.platform_commission_rate);
  });

  it('los defaults declarados coinciden con lo sembrado en system_settings', () => {
    expect(DEFAULT_SETTINGS.visit_deposit_amount).toBe(30000);
    expect(DEFAULT_SETTINGS.platform_commission_rate).toBe(0.17);
    expect(DEFAULT_SETTINGS.warranty_days).toBe(30);
    expect(DEFAULT_SETTINGS.settlement_release_days).toBe(7);
    expect(DEFAULT_SETTINGS.urgent_surcharge_percent).toBe(0);
    expect(DEFAULT_SETTINGS.message_max_length).toBe(2000);
    expect(Array.isArray(DEFAULT_SETTINGS.enabled_provinces)).toBe(true);
    expect(DEFAULT_SETTINGS.feature_flags).toEqual({});
    expect(DEFAULT_SETTINGS.payout_daily_process_time).toBe('20:00');
    expect(DEFAULT_SETTINGS.payout_stale_scheduled_days).toBe(1);
  });
});
