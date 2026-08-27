import { supabase } from './supabase';
import { ARGENTINA_PROVINCES } from './argentina';

export type SettingKey =
  | 'visit_deposit_amount'
  | 'platform_commission_rate'
  | 'warranty_days'
  | 'settlement_release_days'
  | 'urgent_surcharge_percent'
  | 'message_max_length'
  | 'enabled_provinces'
  | 'feature_flags';

/** Defaults seguros si Supabase no responde — reflejan el mismo valor que
 * el seed real en system_settings, así la app nunca queda sin un número
 * razonable para calcular precios/límites. */
export const DEFAULT_SETTINGS: Record<SettingKey, unknown> = {
  visit_deposit_amount: 30000,
  platform_commission_rate: 0.17,
  warranty_days: 30,
  settlement_release_days: 7,
  urgent_surcharge_percent: 0,
  message_max_length: 2000,
  enabled_provinces: ARGENTINA_PROVINCES,
  feature_flags: {},
};

export type SettingRow = {
  key: string;
  value: unknown;
  value_type: 'number' | 'boolean' | 'text' | 'json';
  visibility: 'public' | 'authenticated' | 'admin';
  description: string | null;
  version: number;
  updated_at: string;
  updated_by: string | null;
};

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Todos los settings visibles para el usuario actual (RLS ya filtra por
 * visibility — admin ve todo, cualquier otro solo public/authenticated). */
export async function fetchSettings(): Promise<SettingRow[]> {
  const { data, error } = await supabase.from('system_settings').select('*').order('key');
  throwIfError(error);
  return (data ?? []) as SettingRow[];
}

/** Valor tipado de un setting con fallback seguro si Supabase no respondió
 * o la fila todavía no existe (no debería pasar, pero nunca hay que
 * confiar ciegamente en que el fetch funcionó). */
export function getSettingValue<T>(rows: SettingRow[], key: SettingKey): T {
  const row = rows.find((r) => r.key === key);
  return (row ? row.value : DEFAULT_SETTINGS[key]) as T;
}

/** Admin-only por RLS (system_settings_admin_all) — un cliente o técnico
 * que intente esto no modifica ninguna fila. */
export async function updateSetting(key: SettingKey, value: unknown): Promise<void> {
  const { error } = await supabase.from('system_settings').update({ value }).eq('key', key);
  throwIfError(error);
}

export async function fetchSettingsHistory(key: SettingKey, limit = 20) {
  const { data, error } = await supabase
    .from('system_settings_history')
    .select('*')
    .eq('key', key)
    .order('changed_at', { ascending: false })
    .limit(limit);
  throwIfError(error);
  return data ?? [];
}
