import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const m = vi.hoisted(() => ({
  status: vi.fn(),
  start: vi.fn(),
  unlink: vi.fn(),
  accept: vi.fn(),
  toast: vi.fn(),
  path: '/technician/profile',
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ currentUser: { id: 'user-1' }, currentPath: m.path, showToast: m.toast }),
}));
vi.mock('../../lib/mpLinkClient', async (orig) => ({
  ...(await orig<typeof import('../../lib/mpLinkClient')>()),
  fetchMyMpStatus: m.status,
  startMpLink: m.start,
  unlinkMp: m.unlink,
}));
vi.mock('../../lib/legalAcceptance', () => ({ recordMpCollectionAuthorization: m.accept }));

import { MercadoPagoLinkCard } from './MercadoPagoLinkCard';
import { MP_COLLECTION_AUTH_TEXT } from '../../lib/legalTerms';

const inDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

describe('MercadoPagoLinkCard', () => {
  const assign = vi.fn();
  const realLocation = window.location;
  beforeEach(() => {
    Object.values(m).forEach((fn) => typeof fn === 'function' && 'mockReset' in fn && (fn as any).mockReset());
    m.path = '/technician/profile';
    m.status.mockResolvedValue({ linked: false, mpUserId: null, expiresAt: null });
    m.start.mockResolvedValue('https://auth.mercadopago.com/authorization?state=x');
    m.accept.mockResolvedValue(undefined);
    m.unlink.mockResolvedValue({ ok: true });
    assign.mockReset();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, assign } });
  });
  afterEach(() => {
    cleanup();
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('no vinculada: muestra el texto exacto de la casilla y el botón deshabilitado hasta tildarla', async () => {
    render(<MercadoPagoLinkCard />);
    expect(await screen.findByText('No vinculada')).toBeInTheDocument();
    expect(screen.getByText(MP_COLLECTION_AUTH_TEXT)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /Vincular mi Mercado Pago/ });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(m.accept).not.toHaveBeenCalled();
    expect(m.start).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeDisabled();
  });

  it('al vincular registra la aceptación primero, pide la URL y redirige a Mercado Pago', async () => {
    render(<MercadoPagoLinkCard />);
    await screen.findByText('No vinculada');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Vincular mi Mercado Pago/ }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://auth.mercadopago.com/authorization?state=x'));
    expect(m.accept).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(m.accept.mock.invocationCallOrder[0]).toBeLessThan(m.start.mock.invocationCallOrder[0]);
  });

  it('si no se pudo registrar la aceptación, no inicia la vinculación', async () => {
    m.accept.mockRejectedValue(new Error('No se pudo registrar tu autorización. Probá de nuevo.'));
    render(<MercadoPagoLinkCard />);
    await screen.findByText('No vinculada');
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Vincular mi Mercado Pago/ }));
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith('No se pudo registrar tu autorización. Probá de nuevo.', 'error'));
    expect(m.start).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it('vinculada: muestra el estado, el usuario y permite desvincular', async () => {
    m.status.mockResolvedValueOnce({ linked: true, mpUserId: '12345', expiresAt: inDays(150) });
    render(<MercadoPagoLinkCard />);
    expect(await screen.findByText('Vinculada')).toBeInTheDocument();
    expect(screen.getByText(/usuario 12345/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Desvincular/ }));
    await waitFor(() => expect(m.unlink).toHaveBeenCalled());
    expect(await screen.findByText('No vinculada')).toBeInTheDocument();
  });

  it('vence pronto: lo indica', async () => {
    m.status.mockResolvedValue({ linked: true, mpUserId: '12345', expiresAt: inDays(10) });
    render(<MercadoPagoLinkCard />);
    expect(await screen.findByText('Vence pronto')).toBeInTheDocument();
  });

  it('vuelta con ?mp=ok: muestra el aviso de éxito', async () => {
    m.path = '/technician/profile?mp=ok';
    m.status.mockResolvedValue({ linked: true, mpUserId: '12345', expiresAt: inDays(180) });
    render(<MercadoPagoLinkCard />);
    expect(await screen.findByText('Listo: tu cuenta de Mercado Pago quedó vinculada.')).toBeInTheDocument();
  });

  it('vuelta con ?mp=error: muestra el aviso de error', async () => {
    m.path = '/technician/profile?mp=error';
    render(<MercadoPagoLinkCard />);
    expect(await screen.findByText(/No se pudo vincular tu cuenta de Mercado Pago/)).toBeInTheDocument();
  });
});
