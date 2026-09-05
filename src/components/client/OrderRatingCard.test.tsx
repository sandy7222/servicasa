import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderRating } from '../../lib/orderRatings';

const mocks = vi.hoisted(() => ({
  fetchOrderRating: vi.fn(),
  insertOrderRating: vi.fn(),
  updateOrderRating: vi.fn(),
  canCreateRating: vi.fn(),
  canEditRating: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ showToast: mocks.showToast }),
}));
vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: true,
}));
vi.mock('../../lib/orderRatings', () => ({
  fetchOrderRating: mocks.fetchOrderRating,
  insertOrderRating: mocks.insertOrderRating,
  updateOrderRating: mocks.updateOrderRating,
  canCreateRating: mocks.canCreateRating,
  canEditRating: mocks.canEditRating,
}));

const { OrderRatingCard } = await import('./OrderRatingCard');

const existing: OrderRating = {
  id: 'rating-1',
  orderId: 'order-1',
  technicianId: 'tech-1',
  customerId: 'customer-1',
  stars: 4,
  comment: 'Muy prolijo',
  createdAt: '2026-09-05T10:00:00.000Z',
  editedAt: null,
};

const props = {
  orderId: 'order-1',
  technicianId: 'tech-1',
  customerId: 'customer-1',
  completedAt: '2026-09-01T12:00:00.000Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.fetchOrderRating.mockResolvedValue(null);
  mocks.canCreateRating.mockReturnValue(true);
  mocks.canEditRating.mockReturnValue(false);
  mocks.insertOrderRating.mockResolvedValue(existing);
  mocks.updateOrderRating.mockResolvedValue({ ...existing, stars: 2, comment: 'lo pienso mejor' });
});

describe('OrderRatingCard — estados', () => {
  it('no renderiza si falta el técnico', () => {
    const { container } = render(<OrderRatingCard {...props} technicianId={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el formulario de alta si no hay calificación y estamos dentro de 30 días', async () => {
    render(<OrderRatingCard {...props} />);
    expect(await screen.findByRole('button', { name: /Enviar calificación/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '5 estrellas' }));
    fireEvent.click(screen.getByRole('button', { name: /Enviar calificación/ }));
    await waitFor(() =>
      expect(mocks.insertOrderRating).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'order-1', technicianId: 'tech-1', customerId: 'customer-1', stars: 5 })
      )
    );
  });

  it('no muestra el widget si no hay calificación y el plazo de 30 días venció', async () => {
    mocks.canCreateRating.mockReturnValue(false);
    const { container } = render(<OrderRatingCard {...props} />);
    await waitFor(() => expect(mocks.fetchOrderRating).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('permite editar una calificación dentro de las 48 hs', async () => {
    mocks.fetchOrderRating.mockResolvedValue(existing);
    mocks.canEditRating.mockReturnValue(true);
    render(<OrderRatingCard {...props} />);
    expect(await screen.findByRole('button', { name: /Actualizar calificación/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: '2 estrellas' }));
    fireEvent.click(screen.getByRole('button', { name: /Actualizar calificación/ }));
    await waitFor(() =>
      expect(mocks.updateOrderRating).toHaveBeenCalledWith('rating-1', expect.objectContaining({ stars: 2 }))
    );
  });

  it('muestra la calificación en solo lectura fuera de las 48 hs', async () => {
    mocks.fetchOrderRating.mockResolvedValue(existing);
    mocks.canEditRating.mockReturnValue(false);
    render(<OrderRatingCard {...props} />);
    expect(await screen.findByText('Calificación enviada')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Actualizar calificación/ })).not.toBeInTheDocument();
    expect(screen.getByText(/Muy prolijo/)).toBeInTheDocument();
  });
});
