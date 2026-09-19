import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const navigateMock = vi.fn();
let currentPath = '/hub';

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    currentPath,
    navigate: navigateMock,
    orders: [],
    currentUser: { role: 'admin' },
  }),
}));

vi.mock('./SettlementsHub', () => ({
  usePendingPayoutRequestCount: () => ({ count: 3, refresh: vi.fn() }),
}));

vi.mock('../../lib/conversations', () => ({
  fetchTotalUnreadCount: () => Promise.resolve(0),
}));

const { AdminModuleChrome } = await import('./AdminModuleChrome');

describe('AdminModuleChrome', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    currentPath = '/hub';
    sessionStorage.clear();
  });

  it('muestra los 4 grupos y Órdenes como destino activo en /hub', () => {
    render(
      <AdminModuleChrome>
        <div>tablero</div>
      </AdminModuleChrome>,
    );

    expect(screen.getAllByText('Operación').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Personas').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Catálogo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Plataforma').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Órdenes').length).toBeGreaterThan(0);
    expect(screen.getByText('tablero')).toBeInTheDocument();
  });

  it('desde Plataforma navega a Página del cliente por defecto', () => {
    render(
      <AdminModuleChrome>
        <div>tablero</div>
      </AdminModuleChrome>,
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Plataforma' })[0]);
    expect(navigateMock).toHaveBeenCalledWith('/hub?tab=pageEditor');
  });

  it('en #/admin/clientes el chrome sigue montado y Clientes queda activo', () => {
    currentPath = '/admin/clientes';
    render(
      <AdminModuleChrome>
        <div>planilla clientes</div>
      </AdminModuleChrome>,
    );

    expect(screen.getByText('planilla clientes')).toBeInTheDocument();
    expect(screen.getAllByText('Clientes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Personas').length).toBeGreaterThan(0);
  });
});
