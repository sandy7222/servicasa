import { afterEach, describe, expect, it, vi } from 'vitest';
import { recordTermsAcceptance, sha256Hex } from './legalAcceptance';
import { PRIVACY_POLICY_VERSION } from './legalTerms';

const base = { userId: 'u1', role: 'cliente' as const, documentSlug: 'terminos_cliente' as const, documentVersion: '2026-09-12', documentHash: 'a'.repeat(64) };
const bodyOf = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);

describe('legalAcceptance', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sha256Hex da el hash conocido de un texto', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('registra los términos y, a continuación, la política de privacidad con su versión', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await recordTermsAcceptance(base);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodyOf(fetchMock.mock.calls[0])).toMatchObject({ documentSlug: 'terminos_cliente' });
    const privacy = bodyOf(fetchMock.mock.calls[1]);
    expect(privacy).toMatchObject({ documentSlug: 'politica_privacidad', documentVersion: PRIVACY_POLICY_VERSION, userId: 'u1', role: 'cliente' });
    expect(privacy.documentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('si los términos no se pueden registrar, lanza y NO intenta la privacidad', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(recordTermsAcceptance(base)).rejects.toThrow(/Términos y Condiciones/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('si falla la privacidad (red caída o error), el registro NO falla', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 })).mockRejectedValueOnce(new Error('red'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(recordTermsAcceptance(base)).resolves.toBeUndefined();
    const failing = vi.fn().mockResolvedValueOnce(new Response('{}', { status: 200 })).mockResolvedValueOnce(new Response('{}', { status: 500 }));
    vi.stubGlobal('fetch', failing);
    await expect(recordTermsAcceptance(base)).resolves.toBeUndefined();
  });
});
