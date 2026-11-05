// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  rpc: vi.fn(),
  inserts: [] as any[],
  insertError: null as null | { code?: string; message: string },
  telegram: vi.fn(),
}));

vi.mock('./telegram.js', () => ({ sendTelegramMessage: m.telegram }));
vi.mock('./supabaseAdmin.js', () => ({
  supabaseAdmin: {
    rpc: (...a: unknown[]) => m.rpc(...a),
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === 'profiles' ? { id: 'profile-1' } : null, error: null }) }) }),
      insert: async (row: unknown) => { m.inserts.push({ table, row }); return { error: m.insertError }; },
      delete: () => ({ lt: async () => ({ error: null }) }),
    }),
  },
}));

import { renewExpiringAccounts } from './mpOauth';

const OLD_REFRESH = 'TG-REFRESH-VIEJO';
const NEW_ACCESS = 'APP_USR-NUEVO-ACCESS';
const NEW_REFRESH = 'TG-NUEVO-REFRESH';

describe('renovación de tokens de Mercado Pago (cron)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    m.inserts.length = 0;
    m.insertError = null;
    m.telegram.mockReset().mockResolvedValue(true);
    m.rpc.mockReset().mockImplementation(async (name: string) => {
      if (name === 'mp_accounts_expiring') return { data: [{ technician_id: 'tech-1', expires_at: '2026-11-20T00:00:00Z' }], error: null };
      if (name === 'mp_account_token') return { data: [{ access_token: 'viejo', refresh_token: OLD_REFRESH, mp_user_id: '1', public_key: 'pk', expires_at: '2026-11-20T00:00:00Z' }], error: null };
      return { data: null, error: null };
    });
    process.env.MP_APP_CLIENT_ID = 'cid';
    process.env.MP_APP_CLIENT_SECRET = 'csecret';
    fetchMock.mockReset().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: NEW_ACCESS, refresh_token: NEW_REFRESH, user_id: 1, expires_in: 15552000, scope: 'offline_access', public_key: 'pk' }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lista las cuentas que vencen en menos de 30 días y las renueva con refresh_token', async () => {
    const summary = await renewExpiringAccounts();
    expect(m.rpc).toHaveBeenCalledWith('mp_accounts_expiring', { p_days: 30 });
    expect(summary).toEqual({ checked: 1, renewed: 1, failed: 0 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ grant_type: 'refresh_token', refresh_token: OLD_REFRESH, client_id: 'cid', client_secret: 'csecret' });
    expect(m.rpc).toHaveBeenCalledWith('mp_account_save', expect.objectContaining({ p_technician_id: 'tech-1', p_access_token: NEW_ACCESS, p_refresh_token: NEW_REFRESH }));
    expect(m.inserts).toHaveLength(0);
    expect(m.telegram).not.toHaveBeenCalled();
  });

  it('si falla: avisa al técnico (campanita) y a Sandy (Telegram) sin datos sensibles', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({}) });
    const summary = await renewExpiringAccounts();
    expect(summary).toEqual({ checked: 1, renewed: 0, failed: 1 });
    expect(m.rpc).not.toHaveBeenCalledWith('mp_account_save', expect.anything());
    expect(m.inserts).toHaveLength(1);
    expect(m.inserts[0].table).toBe('notifications');
    expect(m.inserts[0].row).toMatchObject({ recipient_profile_id: 'profile-1', entity_id: 'tech-1', dedupe_key: 'mp_refresh_failed:tech-1:2026-11-20' });
    expect(m.telegram).toHaveBeenCalledTimes(1);
    const text = String(m.telegram.mock.calls[0][0]);
    for (const secret of [OLD_REFRESH, 'tech-1', 'csecret', 'profile-1']) expect(text).not.toContain(secret);
    expect(JSON.stringify((console.error as any).mock.calls)).not.toContain(OLD_REFRESH);
  });

  it('un aviso ya enviado para ese vencimiento (clave duplicada) no repite el Telegram', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    m.insertError = { code: '23505', message: 'duplicate' };
    const summary = await renewExpiringAccounts();
    expect(summary.failed).toBe(1);
    expect(m.telegram).not.toHaveBeenCalled();
  });

  it('sin cuentas por vencer no hace nada', async () => {
    m.rpc.mockResolvedValue({ data: [], error: null });
    expect(await renewExpiringAccounts()).toEqual({ checked: 0, renewed: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
