import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderQuote, ServiceOrder } from '../../types';

const mocks = vi.hoisted(() => ({
  refreshRemoteData: vi.fn(),
  showToast: vi.fn(),
  redirectToPayment: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ refreshRemoteData: mocks.refreshRemoteData, showToast: mocks.showToast }),
}));
vi.mock('../../lib/paymentClient', () => ({ redirectToPayment: mocks.redirectToPayment }));
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ update: mocks.update }),
  },
}));
vi.mock('./RejectedVisitReceipt', () => ({ RejectedVisitReceipt: () => <div>Comprobante de rechazo</div> }));

const { QuoteViewer } = await import('./QuoteViewer');

function quote(overrides: Partial<OrderQuote> = {}): OrderQuote {
  return {
    id: 'quote-1',
    version: 2,
    status: 'sent',
    subtotalLabor: 70_000,
    subtotalMaterials: 20_000,
    totalAmount: 90_000,
    visitDepositCredit: 0,
    remainingAmount: 90_000,
    items: [
      {
        id: 'item-1',
        itemType: 'labor',
        description: 'Reparación de tablero',
        quantity: 1,
        unit: 'servicio',
        unitPrice: 90_000,
        subtotal: 90_000,
      },
    ],
    ...overrides,
  };
}

function order(currentQuote: OrderQuote): ServiceOrder {
  return {
    id: 'order-1',
    title: 'Tablero eléctrico',
    description: 'Diagnóstico',
    serviceType: 'Electricidad',
    priority: 'media',
    status: 'assigned',
    scheduledDate: '2026-09-05',
    createdAt: '2026-08-30T10:00:00Z',
    clientId: 'customer-1',
    clientName: 'Cliente',
    clientPhone: '1112345678',
    clientAddress: 'Dirección 123',
    clientNeighborhood: 'Centro',
    assignedTechnicianId: 'tech-1',
    assignedTechnicianName: 'Técnica',
    checklist: [],
    timeLogs: [],
    technicalNotes: [],
    usedMaterials: [],
    customerSignature: null,
    events: [],
    quotes: [currentQuote],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eq.mockResolvedValue({ error: null });
  mocks.update.mockReturnValue({ eq: mocks.eq });
  mocks.redirectToPayment.mockResolvedValue(undefined);
  mocks.refreshRemoteData.mockResolvedValue(undefined);
});

describe('QuoteViewer — estados y protección del pago', () => {
  it('no muestra un presupuesto en borrador', () => {
    const { container } = render(<QuoteViewer order={order(quote({ status: 'draft' }))} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('muestra el saldo persistido y manda orderId/quoteId al endpoint de pago', async () => {
    render(<QuoteViewer order={order(quote({ remainingAmount: 76_500 }))} />);
    expect(screen.getByText(/76\.500/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Aceptar y pagar/ }));
    await waitFor(() => expect(mocks.redirectToPayment).toHaveBeenCalledWith('order-1', 'balance_payment', 'quote-1'));
  });

  it('un presupuesto vencido no inicia ningún pago', () => {
    render(<QuoteViewer order={order(quote({ validUntil: '2020-01-01T00:00:00Z' }))} />);
    const acceptButton = screen.getByRole('button', { name: /Aceptar y pagar/ });
    expect(acceptButton).toBeDisabled();
    fireEvent.click(acceptButton);
    expect(mocks.redirectToPayment).not.toHaveBeenCalled();
    expect(screen.getByText(/Presupuesto vencido/)).toBeInTheDocument();
  });

  it('rechazar exige confirmación y, si se cancela, no escribe nada', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<QuoteViewer order={order(quote())} />);
    fireEvent.click(screen.getByRole('button', { name: /Rechazar presupuesto/ }));
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('al confirmar el rechazo actualiza solo la cotización elegida y refresca', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<QuoteViewer order={order(quote())} />);
    fireEvent.click(screen.getByRole('button', { name: /Rechazar presupuesto/ }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'rejected' })));
    expect(mocks.eq).toHaveBeenCalledWith('id', 'quote-1');
    await waitFor(() => expect(mocks.refreshRemoteData).toHaveBeenCalled());
  });

  it('un presupuesto aceptado muestra pago confirmado y no vuelve a ofrecer pagar', () => {
    render(<QuoteViewer order={order(quote({ status: 'accepted' }))} />);
    expect(screen.getByText(/Presupuesto aceptado y pago confirmado/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Aceptar y pagar/ })).not.toBeInTheDocument();
  });
});
