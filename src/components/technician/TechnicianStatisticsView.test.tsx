import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderRating } from '../../lib/orderRatings';
import type { ServiceOrder, Technician } from '../../types';

const mocks = vi.hoisted(() => ({
  fetchTechnicianRatings: vi.fn(),
  navigate: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({
    currentUser: { technicianId: 'tech-1' },
    technicians: [
      {
        id: 'tech-1',
        name: 'Ana Pérez',
        specialty: 'Electricidad',
        specialties: [],
        phone: '11',
        email: 'ana@test.com',
        rating: 4.5,
        avatarBg: '#0d9488',
        activeOrdersCount: 0,
        completedOrdersCount: 10,
        zone: 'CABA',
        province: 'CABA',
      } satisfies Technician,
    ],
    orders: [
      {
        id: 'order-10',
        title: 'Tablero cocina',
        assignedTechnicianId: 'tech-1',
        status: 'completed',
        workElapsedSeconds: 0,
      } as ServiceOrder,
    ],
    navigate: mocks.navigate,
    showToast: mocks.showToast,
  }),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('../../lib/orderRatings', async () => {
  const actual = await vi.importActual<typeof import('../../lib/orderRatings')>('../../lib/orderRatings');
  return {
    ...actual,
    fetchTechnicianRatings: mocks.fetchTechnicianRatings,
  };
});

const { TechnicianStatisticsView } = await import('./TechnicianStatisticsView');

function rating(partial: Pick<OrderRating, 'id' | 'orderId' | 'stars' | 'createdAt'> & { comment?: string | null }): OrderRating {
  return {
    technicianId: 'tech-1',
    customerId: 'cust-1',
    comment: partial.comment ?? null,
    editedAt: null,
    ...partial,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchTechnicianRatings.mockResolvedValue([]);
});

describe('TechnicianStatisticsView — calificaciones', () => {
  it('muestra Nuevo y no el 5.00 público si hay menos de 3 calificaciones', async () => {
    mocks.fetchTechnicianRatings.mockResolvedValue([
      rating({ id: 'r1', orderId: 'order-1', stars: 5, createdAt: '2026-08-01T00:00:00.000Z' }),
      rating({ id: 'r2', orderId: 'order-2', stars: 4, createdAt: '2026-08-02T00:00:00.000Z' }),
    ]);
    render(<TechnicianStatisticsView />);
    expect(await screen.findByText('Nuevo')).toBeInTheDocument();
    expect(screen.queryByText('4.5')).not.toBeInTheDocument();
    expect(screen.getByText(/Todavía no hay comentarios/)).toBeInTheDocument();
    expect(screen.queryByText(/módulo de calificaciones/)).not.toBeInTheDocument();
  });

  it('muestra rating, tendencia y comentarios cuando hay historial', async () => {
    const previous = [2, 2, 3, 2, 3].map((stars, i) =>
      rating({
        id: `p${i}`,
        orderId: `op${i}`,
        stars,
        createdAt: `2026-08-0${i + 1}T00:00:00.000Z`,
      })
    );
    const recent = [5, 4, 5, 5, 4].map((stars, i) =>
      rating({
        id: `n${i}`,
        orderId: i === 4 ? 'order-10' : `on${i}`,
        stars,
        createdAt: `2026-08-1${i}T00:00:00.000Z`,
        comment: i === 4 ? 'Muy prolijo con el tablero' : null,
      })
    );
    mocks.fetchTechnicianRatings.mockResolvedValue([...previous, ...recent]);
    render(<TechnicianStatisticsView />);
    expect(await screen.findByText('4.5')).toBeInTheDocument();
    expect(screen.getByText('Mejorando')).toBeInTheDocument();
    expect(screen.getByText('Muy prolijo con el tablero')).toBeInTheDocument();
    expect(screen.getByText('Tablero cocina')).toBeInTheDocument();
    expect(screen.queryByText('Nuevo')).not.toBeInTheDocument();
  });

  it('avisa si falla la carga', async () => {
    mocks.fetchTechnicianRatings.mockRejectedValue(new Error('sin red'));
    render(<TechnicianStatisticsView />);
    await waitFor(() => expect(mocks.showToast).toHaveBeenCalledWith('sin red', 'error'));
  });
});
