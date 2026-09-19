import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceOrder } from '../types';

const mocks = vi.hoisted(() => ({
  order: null as ServiceOrder | null,
  currentPath: '',
}));

vi.mock('../context/AppContext', () => ({
  useApp: () => ({
    orders: mocks.order ? [mocks.order] : [],
    currentUser: { customerId: 'cust-julian', name: 'Julián Albarracín' },
    saveCustomerSignature: vi.fn(),
    showToast: vi.fn(),
    currentPath: mocks.currentPath,
    navigate: vi.fn(),
    deleteCustomerOrder: vi.fn(),
  }),
}));
vi.mock('../components/client/AssignedTechnicianCard', () => ({
  AssignedTechnicianCard: () => <section>Tu técnico asignado</section>,
}));
vi.mock('../components/client/QuoteViewer', () => ({
  QuoteViewer: () => <section>Presupuesto del diagnóstico</section>,
}));
vi.mock('../components/common/SignaturePad', () => ({
  SignaturePad: () => <button type="button">Confirmar y Guardar Firma</button>,
}));
vi.mock('../components/client/CustomerHomeBlocks', () => ({ CustomerHomeBlocks: () => null }));
vi.mock('../components/client/CustomerProfilePage', () => ({ CustomerProfilePage: () => null }));
vi.mock('../components/client/CustomerAddressesPage', () => ({ CustomerAddressesPage: () => null }));
vi.mock('../components/client/CustomerServiceRequestPage', () => ({ CustomerServiceRequestPage: () => null }));
vi.mock('../components/client/CustomerClaimsPage', () => ({ CustomerClaimsPage: () => null }));
vi.mock('../components/client/OrderRatingCard', () => ({ OrderRatingCard: () => null }));
vi.mock('../components/common/ConversationsPanel', () => ({ ConversationsPanel: () => null }));
vi.mock('../lib/conversations', () => ({ startOrderConversation: vi.fn() }));
vi.mock('../lib/paymentClient', () => ({ fetchPendingDraft: vi.fn(), retryDraftPayment: vi.fn() }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

const { CustomerView } = await import('./CustomerView');

function order(overrides: Partial<ServiceOrder> = {}): ServiceOrder {
  return {
    id: 'dd0f52d3-c069-460c-8a84-808e6888240f',
    title: 'Fase 6 verificacion directo',
    description: 'Orden de prueba',
    serviceType: 'Plomería',
    priority: 'media',
    status: 'assigned',
    workMode: 'direct',
    paymentStatus: 'paid_in_full',
    quoteStatus: 'none',
    scheduledDate: '2026-09-07',
    createdAt: '2026-09-06T04:00:00Z',
    clientId: 'cust-julian',
    clientName: 'Julián Albarracín',
    clientPhone: '+54 9 11 4521-8900',
    clientAddress: 'Av. Corrientes 3421, 4to B',
    clientNeighborhood: 'CABA',
    assignedTechnicianId: 'tech-carlos',
    assignedTechnicianName: 'Carlos Méndez',
    technicianResponseStatus: 'accepted',
    travelStartedAt: '2026-09-06T04:22:57.969Z',
    workStartedAt: '2026-09-06T04:23:01.47Z',
    checklist: [{ id: 'c1', label: 'Verificar', completed: false }],
    timeLogs: [],
    technicalNotes: [],
    usedMaterials: [],
    materialExpenses: [],
    customerSignature: null,
    events: [],
    diagnosisPhotos: [],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.order = null;
  mocks.currentPath = '';
});

describe('CustomerView — etapas reales, sin bloques futuros', () => {
  it('Julián / directo assigned: técnico y chat, sin progreso ni firma ni presupuesto', () => {
    mocks.order = order();
    mocks.currentPath = `/customer/orders/${mocks.order.id}`;
    render(<CustomerView />);

    expect(screen.getByText(/Te presentamos a tu técnico asignado/)).toBeInTheDocument();
    expect(screen.getByText('Tu técnico asignado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Escribir al técnico/ })).toBeInTheDocument();
    expect(screen.queryByText('Progreso del trabajo')).not.toBeInTheDocument();
    expect(screen.queryByText('Tiempo Registrado')).not.toBeInTheDocument();
    expect(screen.queryByText('Presupuesto del diagnóstico')).not.toBeInTheDocument();
    expect(screen.queryByText('Firma Digital de Conformidad')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirmar y Guardar Firma/ })).not.toBeInTheDocument();
  });

  it('diagnóstico con presupuesto enviado: se ve el presupuesto, no el seguimiento ni la firma', () => {
    mocks.order = order({
      id: 'diag-1',
      workMode: 'diagnosis',
      paymentStatus: 'deposit_paid',
      quoteStatus: 'sent',
      workStartedAt: undefined,
      travelStartedAt: undefined,
    });
    mocks.currentPath = '/customer/orders/diag-1';
    render(<CustomerView />);

    expect(screen.getByText(/Esta etapa es el presupuesto/)).toBeInTheDocument();
    expect(screen.getByText('Presupuesto del diagnóstico')).toBeInTheDocument();
    expect(screen.queryByText('Progreso del trabajo')).not.toBeInTheDocument();
    expect(screen.queryByText('Firma Digital de Conformidad')).not.toBeInTheDocument();
  });

  it('diagnóstico con presupuesto enviado: se ve el presupuesto, no la ferretería hasta que pague', () => {
    mocks.order = order({
      id: 'diag-list',
      workMode: 'diagnosis',
      paymentStatus: 'deposit_paid',
      quoteStatus: 'sent',
      workStartedAt: undefined,
      travelStartedAt: undefined,
      materialExpenses: [
        {
          id: 'm1',
          description: 'Visagras 3 pulgadas',
          unit: 'unidades',
          quantity: 4,
          unitPrice: 0,
          subtotal: 0,
          addedAt: '2026-09-17T12:00:00Z',
        },
      ],
    });
    mocks.currentPath = '/customer/orders/diag-list';
    render(<CustomerView />);

    expect(screen.getByText('Presupuesto del diagnóstico')).toBeInTheDocument();
    expect(screen.queryByText('Lista para la ferretería')).not.toBeInTheDocument();
    expect(screen.queryByText('Visagras 3 pulgadas')).not.toBeInTheDocument();
    expect(screen.queryByText('Progreso del trabajo')).not.toBeInTheDocument();
  });
});
