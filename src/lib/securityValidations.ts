/**
 * Security Validation Utilities
 * 
 * Validates access control rules to prevent:
 * - Cross-user data access (CWE-639)
 * - Unauthorized modifications
 * - Privilege escalation
 * 
 * Rules:
 * - Admin: full access
 * - Technician: only own assigned orders + read-only catalog
 * - Customer: only own orders + read-only own data
 */

import type { CurrentUserData, ServiceOrder } from '../types';

export class SecurityError extends Error {
  constructor(message: string, public code: string = 'SECURITY_ERROR') {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Validates that current user is an admin
 * Throws SecurityError if not authorized
 */
export function requireAdmin(currentUser: CurrentUserData | null): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }
  if (currentUser.role !== 'admin') {
    throw new SecurityError(
      'Operación restringida a administradores',
      'ADMIN_ONLY'
    );
  }
}

/**
 * Validates that current user is a technician
 * Throws SecurityError if not authorized
 */
export function requireTechnician(currentUser: CurrentUserData | null): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }
  if (currentUser.role !== 'technician') {
    throw new SecurityError(
      'Operación restringida a técnicos',
      'TECHNICIAN_ONLY'
    );
  }
}

/**
 * Validates that current user is a customer
 * Throws SecurityError if not authorized
 */
export function requireCustomer(currentUser: CurrentUserData | null): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }
  if (currentUser.role !== 'customer') {
    throw new SecurityError(
      'Operación restringida a clientes',
      'CUSTOMER_ONLY'
    );
  }
}

/**
 * Validates that technician owns the assigned order
 * Admins always have access
 */
export function validateTechnicianOrderAccess(
  currentUser: CurrentUserData | null,
  order: ServiceOrder | undefined
): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }

  if (!order) {
    throw new SecurityError('Orden no encontrada', 'ORDER_NOT_FOUND');
  }

  // Admin has access to all orders
  if (currentUser.role === 'admin') {
    return;
  }

  // Technician can only access their assigned orders
  if (currentUser.role === 'technician') {
    if (order.assignedTechnicianId !== currentUser.technicianId) {
      throw new SecurityError(
        'No tienes permiso para acceder a esta orden',
        'ORDER_ACCESS_DENIED'
      );
    }
    return;
  }

  throw new SecurityError(
    'Rol no autorizado para esta operación',
    'INVALID_ROLE'
  );
}

/**
 * Validates that customer owns the order
 * Admins always have access
 */
export function validateCustomerOrderAccess(
  currentUser: CurrentUserData | null,
  order: ServiceOrder | undefined
): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }

  if (!order) {
    throw new SecurityError('Orden no encontrada', 'ORDER_NOT_FOUND');
  }

  // Admin has access to all orders
  if (currentUser.role === 'admin') {
    return;
  }

  // Customer can only access their own orders
  if (currentUser.role === 'customer') {
    if (order.clientId !== currentUser.customerId) {
      throw new SecurityError(
        'No tienes permiso para acceder a esta orden',
        'ORDER_ACCESS_DENIED'
      );
    }
    return;
  }

  throw new SecurityError(
    'Rol no autorizado para esta operación',
    'INVALID_ROLE'
  );
}

/**
 * Validates that user can modify the order
 * Only admin or assigned technician
 */
export function validateOrderModificationAccess(
  currentUser: CurrentUserData | null,
  order: ServiceOrder | undefined
): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }

  if (!order) {
    throw new SecurityError('Orden no encontrada', 'ORDER_NOT_FOUND');
  }

  // Admin can modify any order
  if (currentUser.role === 'admin') {
    return;
  }

  // Technician can only modify their assigned orders
  if (currentUser.role === 'technician') {
    if (order.assignedTechnicianId !== currentUser.technicianId) {
      throw new SecurityError(
        'No tienes permiso para modificar esta orden',
        'ORDER_MODIFICATION_DENIED'
      );
    }
    return;
  }

  // Customers cannot modify orders (only sign them)
  if (currentUser.role === 'customer') {
    throw new SecurityError(
      'Los clientes no pueden modificar órdenes',
      'CUSTOMER_CANNOT_MODIFY'
    );
  }

  throw new SecurityError(
    'Rol no autorizado para esta operación',
    'INVALID_ROLE'
  );
}

/**
 * Validates that user can create orders
 * Only admin
 */
export function validateOrderCreationAccess(
  currentUser: CurrentUserData | null
): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }

  if (currentUser.role !== 'admin') {
    throw new SecurityError(
      'Solo administradores pueden crear órdenes',
      'ORDER_CREATION_DENIED'
    );
  }
}

/**
 * Validates that user can assign technicians
 * Only admin
 */
export function validateTechnicianAssignmentAccess(
  currentUser: CurrentUserData | null
): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }

  if (currentUser.role !== 'admin') {
    throw new SecurityError(
      'Solo administradores pueden asignar técnicos',
      'ASSIGNMENT_DENIED'
    );
  }
}

/**
 * Validates customer ID access
 * Only admin can access all customers; customers can only access themselves
 */
export function validateCustomerAccess(
  currentUser: CurrentUserData | null,
  targetCustomerId: string
): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }

  // Admin can access any customer
  if (currentUser.role === 'admin') {
    return;
  }

  // Customer can only access their own data
  if (currentUser.role === 'customer') {
    if (currentUser.customerId !== targetCustomerId) {
      throw new SecurityError(
        'No puedes acceder a datos de otros clientes',
        'CUSTOMER_ACCESS_DENIED'
      );
    }
    return;
  }

  throw new SecurityError(
    'Rol no autorizado para acceder a datos de clientes',
    'INVALID_ROLE'
  );
}

/**
 * Validates technician ID access
 * Only admin can access technician data
 */
export function validateTechnicianAccess(
  currentUser: CurrentUserData | null,
  _targetTechnicianId: string
): void {
  if (!currentUser) {
    throw new SecurityError('Usuario no autenticado', 'AUTH_REQUIRED');
  }

  // Only admin can access technician data
  if (currentUser.role !== 'admin') {
    throw new SecurityError(
      'No tienes permiso para acceder a datos de técnicos',
      'TECHNICIAN_ACCESS_DENIED'
    );
  }
}

/**
 * Validates that order ID format is safe
 * Prevents injection or manipulation
 */
export function validateOrderId(orderId: string): void {
  if (!orderId || typeof orderId !== 'string') {
    throw new SecurityError('ID de orden inválido', 'INVALID_ORDER_ID');
  }

  // Orders should match format SC-XXX or tmp-XXXXX
  if (!/^(SC-\d+|tmp-\d+)$/.test(orderId)) {
    throw new SecurityError('Formato de ID de orden inválido', 'INVALID_ORDER_ID');
  }
}

/**
 * Validates that user ID format is safe
 */
export function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string') {
    throw new SecurityError('ID de usuario inválido', 'INVALID_USER_ID');
  }

  // Should be a UUID or email
  if (!/^[a-zA-Z0-9\-_.@]+$/.test(userId)) {
    throw new SecurityError('Formato de ID de usuario inválido', 'INVALID_USER_ID');
  }
}
