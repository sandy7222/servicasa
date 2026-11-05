import { supabase } from './supabase';

export type MpLinkStatus = { linked: boolean; mpUserId: string | null; expiresAt: string | null };

/** Días antes del vencimiento en que la tarjeta avisa "vence pronto" (el cron renueva a los 30). */
export const MP_EXPIRING_SOON_DAYS = 30;

export function isExpiringSoon(expiresAt: string | null, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  return Number.isFinite(time) && time - now < MP_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;
}

async function post<T>(action: string): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Volvé a iniciar sesión e intentá de nuevo.');
  const response = await fetch(`/api/gateway?action=${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{}',
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'No se pudo completar la operación.');
  return body;
}

/** Pide la URL de autorización de Mercado Pago (el servidor ata el state al técnico logueado). */
export const startMpLink = () => post<{ url: string }>('mp-oauth-start').then((r) => r.url);

export const unlinkMp = () => post<{ ok: true }>('mp-oauth-unlink');

/** Estado de MI vinculación (sin tokens). Lo devuelve la función SQL my_mp_account_status. */
export async function fetchMyMpStatus(): Promise<MpLinkStatus> {
  const { data, error } = await supabase.rpc('my_mp_account_status');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { linked: Boolean(row?.linked), mpUserId: row?.mp_user_id ?? null, expiresAt: row?.expires_at ?? null };
}
