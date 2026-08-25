/**
 * Convertido a Vitest real (Fase 8) — este archivo ya existía con exactamente
 * los mismos casos, pero como un runner casero (return true/false +
 * console.log) nunca conectado a ningún test runner: nunca se ejecutó de
 * verdad hasta ahora. Se preserva cada caso y cada código de error tal cual
 * estaban — solo cambia el formato a describe/it/expect.
 */
import { describe, expect, it } from 'vitest';
import {
  requireAdmin,
  validateOrderCreationAccess,
  validateOrderModificationAccess,
  validateCustomerOrderAccess,
  validateCustomerSignatureAccess,
  validateTechnicianOrderAccess,
  validateTechnicianAssignmentAccess,
  validateOrderId,
  SecurityError,
} from './securityValidations';
import type { CurrentUserData, ServiceOrder } from '../types';

const adminUser: CurrentUserData = {
  id: 'admin-1', name: 'Administrador', email: 'admin@tecniurbano.com.ar',
  role: 'admin', technicianId: null, customerId: null, avatarText: 'AD',
};

const technicianUser1: CurrentUserData = {
  id: 'tech-1', name: 'Carlos', email: 'carlos@tecniurbano.com.ar',
  role: 'technician', technicianId: 'tec-001', customerId: null, avatarText: 'CM',
};

const technicianUser2: CurrentUserData = {
  id: 'tech-2', name: 'María', email: 'maria@tecniurbano.com.ar',
  role: 'technician', technicianId: 'tec-002', customerId: null, avatarText: 'MR',
};

const customerUser1: CurrentUserData = {
  id: 'cust-1', name: 'Julián', email: 'julian@tecniurbano.com.ar',
  role: 'customer', technicianId: null, customerId: 'cust-001', avatarText: 'JA',
};

const customerUser2: CurrentUserData = {
  id: 'cust-2', name: 'Florencia', email: 'florencia@tecniurbano.com.ar',
  role: 'customer', technicianId: null, customerId: 'cust-002', avatarText: 'FS',
};

const orderAssignedToTech1: ServiceOrder = {
  id: 'SC-800', title: 'Plomería urgencia', description: 'Fuga en lavadero',
  serviceType: 'Plomería', priority: 'alta', status: 'assigned',
  clientId: customerUser1.customerId!, clientName: customerUser1.name,
  clientPhone: '123456789', clientAddress: 'Calle 1, 100', clientNeighborhood: 'Palermo',
  assignedTechnicianId: technicianUser1.technicianId!, assignedTechnicianName: technicianUser1.name,
  scheduledDate: '2026-08-18', createdAt: '2026-08-17T10:00:00Z', completedAt: undefined,
  checklist: [], timeLogs: [], technicalNotes: [], usedMaterials: [], customerSignature: undefined, events: [],
} as unknown as ServiceOrder;

const orderAssignedToTech2: ServiceOrder = {
  ...orderAssignedToTech1, id: 'SC-801',
  assignedTechnicianId: technicianUser2.technicianId!, assignedTechnicianName: technicianUser2.name,
  clientId: customerUser2.customerId!, clientName: customerUser2.name,
};

function expectSecurityError(fn: () => void, code: string) {
  try {
    fn();
    expect.fail(`Se esperaba que lanzara SecurityError con code=${code}, pero no lanzó nada.`);
  } catch (err) {
    expect(err).toBeInstanceOf(SecurityError);
    expect((err as SecurityError).code).toBe(code);
  }
}

describe('Acceso de admin', () => {
  it('admin puede crear órdenes', () => {
    expect(() => validateOrderCreationAccess(adminUser)).not.toThrow();
  });
  it('admin puede modificar cualquier orden', () => {
    expect(() => validateOrderModificationAccess(adminUser, orderAssignedToTech1)).not.toThrow();
  });
  it('admin puede acceder a cualquier orden', () => {
    expect(() => validateTechnicianOrderAccess(adminUser, orderAssignedToTech1)).not.toThrow();
  });
  it('admin puede asignar técnicos', () => {
    expect(() => validateTechnicianAssignmentAccess(adminUser)).not.toThrow();
  });
});

describe('Acceso de técnico', () => {
  it('técnico NO puede crear órdenes', () => {
    expectSecurityError(() => validateOrderCreationAccess(technicianUser1), 'ORDER_CREATION_DENIED');
  });
  it('técnico NO puede modificar la orden de otro técnico', () => {
    expectSecurityError(() => validateOrderModificationAccess(technicianUser1, orderAssignedToTech2), 'ORDER_MODIFICATION_DENIED');
  });
  it('técnico SÍ puede modificar su propia orden asignada', () => {
    expect(() => validateOrderModificationAccess(technicianUser1, orderAssignedToTech1)).not.toThrow();
  });
  it('técnico NO puede acceder a la orden de otro técnico', () => {
    expectSecurityError(() => validateTechnicianOrderAccess(technicianUser1, orderAssignedToTech2), 'ORDER_ACCESS_DENIED');
  });
  it('técnico NO puede asignar técnicos', () => {
    expectSecurityError(() => validateTechnicianAssignmentAccess(technicianUser1), 'ASSIGNMENT_DENIED');
  });
});

describe('Acceso de cliente', () => {
  it('cliente NO puede crear órdenes', () => {
    expectSecurityError(() => validateOrderCreationAccess(customerUser1), 'ORDER_CREATION_DENIED');
  });
  it('cliente NO puede modificar órdenes (ni siquiera la propia)', () => {
    expectSecurityError(() => validateOrderModificationAccess(customerUser1, orderAssignedToTech1), 'CUSTOMER_CANNOT_MODIFY');
  });
  it('cliente SÍ puede acceder a su propia orden', () => {
    expect(() => validateCustomerOrderAccess(customerUser1, orderAssignedToTech1)).not.toThrow();
  });
  it('cliente NO puede acceder a la orden de otro cliente', () => {
    expectSecurityError(() => validateCustomerOrderAccess(customerUser1, orderAssignedToTech2), 'ORDER_ACCESS_DENIED');
  });
  it('cliente NO puede asignar técnicos', () => {
    expectSecurityError(() => validateTechnicianAssignmentAccess(customerUser1), 'ASSIGNMENT_DENIED');
  });
});

describe('validateOrderId — nunca confiar en un ID sin validar', () => {
  it('acepta un UUID real de Supabase', () => {
    expect(() => validateOrderId('9f4ba762-e4f5-4edb-a5e0-b5c0631a8dbc')).not.toThrow();
  });
  it('acepta IDs legacy/temporales del formato conocido', () => {
    expect(() => validateOrderId('SC-800')).not.toThrow();
    expect(() => validateOrderId('tmp-1234567890')).not.toThrow();
  });
  it('rechaza un formato inválido', () => {
    expectSecurityError(() => validateOrderId('INVALID-ORDER-ID'), 'INVALID_ORDER_ID');
  });
  it('rechaza un intento de inyección SQL disfrazado de ID', () => {
    expectSecurityError(() => validateOrderId("SC-800'; DROP TABLE orders; --"), 'INVALID_ORDER_ID');
  });
});

describe('Firma de conformidad — acción exclusiva del cliente titular', () => {
  it('el cliente titular puede firmar su propia orden', () => {
    expect(() => validateCustomerSignatureAccess(customerUser1, orderAssignedToTech1)).not.toThrow();
  });
  it('un técnico NO puede firmar en nombre del cliente', () => {
    expectSecurityError(() => validateCustomerSignatureAccess(technicianUser1, orderAssignedToTech1), 'SIGNATURE_CUSTOMER_ONLY');
  });
  it('admin NO puede firmar en nombre del cliente (ni siquiera admin)', () => {
    expectSecurityError(() => validateCustomerSignatureAccess(adminUser, orderAssignedToTech1), 'SIGNATURE_CUSTOMER_ONLY');
  });
  it('un cliente NO puede firmar la orden de otro cliente', () => {
    expectSecurityError(() => validateCustomerSignatureAccess(customerUser1, orderAssignedToTech2), 'SIGNATURE_ORDER_ACCESS_DENIED');
  });
});

describe('Usuario no autenticado — siempre rechazado', () => {
  it('no puede crear órdenes', () => {
    expectSecurityError(() => validateOrderCreationAccess(null), 'AUTH_REQUIRED');
  });
  it('no puede modificar órdenes', () => {
    expectSecurityError(() => validateOrderModificationAccess(null, orderAssignedToTech1), 'AUTH_REQUIRED');
  });
  it('requireAdmin rechaza sesión nula', () => {
    expectSecurityError(() => requireAdmin(null), 'AUTH_REQUIRED');
  });
});
