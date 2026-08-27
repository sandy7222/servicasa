import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAppMock = vi.fn();
vi.mock('../../context/AppContext', () => ({ useApp: () => useAppMock() }));

const fetchNotificationsMock = vi.fn();
const fetchUnreadNotificationCountMock = vi.fn();
const markNotificationReadMock = vi.fn();
const markAllNotificationsReadMock = vi.fn();
vi.mock('../../lib/notifications', () => ({
  fetchNotifications: (...args: unknown[]) => fetchNotificationsMock(...args),
  fetchUnreadNotificationCount: (...args: unknown[]) => fetchUnreadNotificationCountMock(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationReadMock(...args),
  markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsReadMock(...args),
  getNotificationLink: () => '/customer/reclamos/abc',
}));

const { NotificationBell } = await import('./NotificationBell');

const navigateMock = vi.fn();

function mockSession(overrides: Record<string, unknown> = {}) {
  useAppMock.mockReturnValue({
    currentUser: { id: 'user-1', role: 'customer', name: 'Julián' },
    isAuthenticated: true,
    navigate: navigateMock,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fetchUnreadNotificationCountMock.mockResolvedValue(0);
  fetchNotificationsMock.mockResolvedValue([]);
});

describe('NotificationBell — permisos visuales y estados de carga', () => {
  it('sin sesión: no renderiza nada (no expone ni siquiera el ícono)', () => {
    useAppMock.mockReturnValue({ currentUser: null, isAuthenticated: false, navigate: navigateMock });
    const { container } = render(<NotificationBell />);
    expect(container).toBeEmptyDOMElement();
  });

  it('con sesión y notificaciones sin leer: muestra el número correcto en el badge', async () => {
    mockSession();
    fetchUnreadNotificationCountMock.mockResolvedValue(3);
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
  });

  it('99+ cuando el conteo real supera el límite visual del badge', async () => {
    mockSession();
    fetchUnreadNotificationCountMock.mockResolvedValue(140);
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('99+')).toBeInTheDocument());
  });

  it('estado de carga: al abrir el panel muestra "Cargando…" antes de resolver', async () => {
    mockSession();
    let resolveFetch: (value: unknown[]) => void = () => {};
    fetchNotificationsMock.mockReturnValue(new Promise((resolve) => { resolveFetch = resolve; }));
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    expect(screen.getByText('Cargando…')).toBeInTheDocument();
    resolveFetch([]);
    await waitFor(() => expect(screen.queryByText('Cargando…')).not.toBeInTheDocument());
  });

  it('estado vacío: sin notificaciones muestra el mensaje correcto, no una lista vacía silenciosa', async () => {
    mockSession();
    fetchNotificationsMock.mockResolvedValue([]);
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    await waitFor(() => expect(screen.getByText('No tenés notificaciones.')).toBeInTheDocument());
  });

  it('clickear una notificación sin leer la marca como leída y navega — nunca se queda "sin leer" tras abrirla', async () => {
    mockSession();
    fetchNotificationsMock.mockResolvedValue([
      { id: 'n1', type: 'claim_opened', title: 'Reclamo abierto', body: 'desc', entityType: 'claim', entityId: 'abc', priority: 'high', readAt: null, createdAt: new Date().toISOString() },
    ]);
    markNotificationReadMock.mockResolvedValue(undefined);
    render(<NotificationBell />);
    fireEvent.click(screen.getByRole('button', { name: 'Notificaciones' }));
    const item = await screen.findByText('Reclamo abierto');
    fireEvent.click(item);
    await waitFor(() => expect(markNotificationReadMock).toHaveBeenCalledWith('n1'));
    expect(navigateMock).toHaveBeenCalledWith('/customer/reclamos/abc');
  });
});
