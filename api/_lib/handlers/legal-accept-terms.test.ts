// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  inserts: [] as any[],
  insertError: null as null | { message: string },
  userFound: true,
}));

vi.mock('../supabaseAdmin.js', () => ({
  supabaseAdmin: {
    auth: { admin: { getUserById: async () => ({ data: { user: m.userFound ? { id: 'u1' } : null }, error: null }) } },
    from: () => ({
      insert: async (row: unknown) => {
        m.inserts.push(row);
        return { error: m.insertError };
      },
    }),
  },
}));

import handler from './legal-accept-terms';

const HASH = 'a'.repeat(64);
const makeRes = () => {
  const res: any = { headers: {}, status(c: number) { res.statusCode = c; return res; }, json(b: unknown) { res.body = b; return res; }, setHeader() {} };
  return res;
};
const call = async (over: Record<string, unknown> = {}) => {
  const res = makeRes();
  await handler(
    { method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'Vitest' }, socket: {}, body: { userId: 'u1', role: 'cliente', documentSlug: 'terminos_cliente', documentVersion: '2026-09-12', documentHash: HASH, ...over } } as never,
    res
  );
  return res;
};

describe('api legal accept-terms', () => {
  beforeEach(() => {
    m.inserts.length = 0;
    m.insertError = null;
    m.userFound = true;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('registra la aceptación de los términos con versión, hash, IP y navegador', async () => {
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(m.inserts[0]).toMatchObject({ user_id: 'u1', role: 'cliente', document_slug: 'terminos_cliente', document_hash: HASH, ip_address: '1.2.3.4', user_agent: 'Vitest' });
  });

  it('también acepta la Política de Privacidad como documento', async () => {
    const res = await call({ documentSlug: 'politica_privacidad', documentVersion: '2026-09-19' });
    expect(res.statusCode).toBe(200);
    expect(m.inserts[0]).toMatchObject({ document_slug: 'politica_privacidad', document_version: '2026-09-19' });
  });

  it('rechaza documentos desconocidos, hash inválido y usuarios inexistentes', async () => {
    expect((await call({ documentSlug: 'otro' })).statusCode).toBe(400);
    expect((await call({ documentHash: 'xyz' })).statusCode).toBe(400);
    expect((await call({ role: 'admin' })).statusCode).toBe(400);
    m.userFound = false;
    expect((await call()).statusCode).toBe(404);
    expect(m.inserts).toHaveLength(0);
  });

  it('si falla guardar los TÉRMINOS, el registro falla (son imprescindibles)', async () => {
    m.insertError = { message: 'db caída' };
    expect((await call()).statusCode).toBe(500);
  });

  it('admite la autorización de cobro de Mercado Pago, pero si falla guardarla devuelve error (es evidencia obligatoria)', async () => {
    const ok = await call({ role: 'tecnico', documentSlug: 'autorizacion_cobro_mp' });
    expect(ok.statusCode).toBe(200);
    expect(m.inserts[0]).toMatchObject({ role: 'tecnico', document_slug: 'autorizacion_cobro_mp' });
    m.insertError = { message: 'violates check constraint' };
    expect((await call({ role: 'tecnico', documentSlug: 'autorizacion_cobro_mp' })).statusCode).toBe(500);
  });

  it('si falla guardar la PRIVACIDAD (por ejemplo, migración sin aplicar), responde ok y no frena el registro', async () => {
    m.insertError = { message: 'violates check constraint legal_acceptances_document_slug_check' };
    const res = await call({ documentSlug: 'politica_privacidad' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, recorded: false });
  });
});
