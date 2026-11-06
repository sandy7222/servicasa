import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) } },
}));

const { SplitReservationCard } = await import('./SplitReservationCard');

const authorized = {
  id: 'tx-1', status: 'authorized', amount: 90000, application_fee: 15300, mp_fee_amount: 0,
  authorized_at: '2026-11-06T12:00:00Z', captured_at: null, cancelled_at: null,
  expires_at: '2026-11-13T12:00:00Z', split_action_reason: null,
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('SplitReservationCard', () => {
  it('sin pagos repartidos no muestra nada', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ payments: [] }) });
    const { container } = render(<SplitReservationCard orderId="o1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('con una reserva vigente muestra estado, comisión y los dos botones', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ payments: [authorized] }) });
    render(<SplitReservationCard orderId="o1" />);
    expect(await screen.findByText(/Reservado \(todavía no cobrado\)/)).toBeInTheDocument();
    expect(screen.getByText(/15\.300/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cobrar ahora' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar reserva' })).toBeInTheDocument();
  });

  it('cancelar exige motivo antes de llamar al servidor', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ payments: [authorized] }) });
    render(<SplitReservationCard orderId="o1" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancelar reserva' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByText(/Escribí el motivo/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // solo la carga inicial
  });

  it('un pago ya cobrado no ofrece botones', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ payments: [{ ...authorized, status: 'approved', captured_at: '2026-11-08T12:00:00Z', expires_at: null }] }) });
    render(<SplitReservationCard orderId="o1" />);
    expect(await screen.findByText(/Cobrado y repartido/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cobrar ahora' })).not.toBeInTheDocument();
  });
});
